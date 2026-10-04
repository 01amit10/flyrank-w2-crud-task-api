require('dotenv').config();
const { Pool } = require('pg');

let pool;

if (process.env.USE_MEM_PG === 'true' || process.env.NODE_ENV === 'test-mem') {
  const { newDb } = require('pg-mem');
  const memDb = newDb();
  const pgAdapter = memDb.adapters.createPg();
  pool = new pgAdapter.Pool();
} else {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:dev@localhost:5432/tasks'
  });
}

// Format a Postgres task row so boolean done and ISO timestamps are returned
function formatTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    done: Boolean(row.done),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
  };
}

// Stage 1: Connect, create tasks table, and seed 3 tasks on empty check
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Index on done column for fast filtering
  try {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);');
  } catch (_) {}

  const countRes = await pool.query('SELECT COUNT(*) as count FROM tasks');
  const count = parseInt(countRes.rows[0].count, 10);
  if (count === 0) {
    const seedQuery = `
      INSERT INTO tasks (title, done)
      VALUES 
        ('Finish Week 2 API', false),
        ('Test CRUD endpoints', false),
        ('Publish project to GitHub', false);
    `;
    await pool.query(seedQuery);
    console.log('PostgreSQL initialized: seeded 3 initial tasks into tasks table.');
  }
}

// Stage 2: Read operations using parameterized queries
async function getAllTasks({ done, search, sort, order } = {}) {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (done === 'true') {
    params.push(true);
    query += ` AND done = $${params.length}`;
  } else if (done === 'false') {
    params.push(false);
    query += ` AND done = $${params.length}`;
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    params.push(`%${search.trim()}%`);
    query += ` AND title ILIKE $${params.length}`;
  }

  const sortCol = sort === 'title' ? 'title' : 'id';
  const sortDir = order && order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  query += ` ORDER BY ${sortCol} ${sortDir}`;

  const res = await pool.query(query, params);
  return res.rows.map(formatTask);
}

async function getTaskById(id) {
  const res = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (res.rows.length === 0) return null;
  return formatTask(res.rows[0]);
}

// Stage 3: Create, update, delete using parameterized queries
async function createTask(title) {
  const res = await pool.query(
    'INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *',
    [title, false]
  );
  return formatTask(res.rows[0]);
}

async function updateTask(id, { title, done }) {
  const existing = await getTaskById(id);
  if (!existing) return null;

  const newTitle = title !== undefined ? title : existing.title;
  const newDone = done !== undefined ? done : existing.done;

  const res = await pool.query(
    'UPDATE tasks SET title = $1, done = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [newTitle, newDone, id]
  );
  return formatTask(res.rows[0]);
}

async function toggleTaskDone(id) {
  const existing = await getTaskById(id);
  if (!existing) return null;

  const res = await pool.query(
    'UPDATE tasks SET done = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [!existing.done, id]
  );
  return formatTask(res.rows[0]);
}

async function deleteTask(id) {
  const res = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return res.rowCount > 0;
}

// Real database health check (SELECT 1)
async function checkDbHealth() {
  await pool.query('SELECT 1');
  return true;
}

// Real statistics computed in SQL
async function getStats() {
  const totalRes = await pool.query('SELECT COUNT(*) as count FROM tasks');
  const completedRes = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE done = true');
  const total = parseInt(totalRes.rows[0].count, 10);
  const completed = parseInt(completedRes.rows[0].count, 10);
  const pending = total - completed;
  return {
    total,
    completed,
    pending,
    completionRate: total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%'
  };
}

module.exports = {
  pool,
  initDb,
  formatTask,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  toggleTaskDone,
  deleteTask,
  checkDbHealth,
  getStats
};
