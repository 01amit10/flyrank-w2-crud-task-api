const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const morgan = require('morgan');
const openapi = require('./openapi.json');
const PORT = process.env.PORT || 3000;

app.use(morgan('dev'));
app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'tasks.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Stage 0: Create tasks table if it does not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

// Schema migration fallback: add timestamp columns if missing
try { db.exec("ALTER TABLE tasks ADD COLUMN created_at TEXT DEFAULT (datetime('now'))"); } catch (_) {}
try { db.exec("ALTER TABLE tasks ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))"); } catch (_) {}

// Indexes for optimized query lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
  CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);
`);

// Seed 3 example tasks if table is empty (wrapped in transaction)
const rowCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
if (rowCount === 0) {
  const now = new Date().toISOString();
  const seedInsert = db.prepare('INSERT INTO tasks (title, done, created_at, updated_at) VALUES (?, ?, ?, ?)');
  const seedMany = db.transaction((items) => {
    for (const item of items) {
      seedInsert.run(item.title, item.done, now, now);
    }
  });

  seedMany([
    { title: 'Finish Week 2 API', done: 0 },
    { title: 'Test CRUD endpoints', done: 0 },
    { title: 'Publish project to GitHub', done: 0 }
  ]);
  console.log('Database initialized: seeded 3 initial tasks into tasks.db');
}

// Helper to format task object and ensure boolean done
function formatTask(row) {
  if (!row) return null;
  const task = {
    id: row.id,
    title: row.title,
    done: Boolean(row.done)
  };
  if (row.created_at) task.createdAt = row.created_at;
  if (row.updated_at) task.updatedAt = row.updated_at;
  return task;
}

app.get('/', (req, res) => res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks', '/stats'] }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// GET /stats: Real statistics calculated with SQL COUNT(*)
app.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
  const completed = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE done = 1').get().count;
  const pending = total - completed;
  res.json({
    total,
    completed,
    pending,
    completionRate: total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%'
  });
});

// GET /tasks: Supports SQL LIKE search, status filter, and title/id sorting
app.get('/tasks', (req, res) => {
  const { done, search, sort, order } = req.query;
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (done === 'true') {
    query += ' AND done = ?';
    params.push(1);
  } else if (done === 'false') {
    query += ' AND done = ?';
    params.push(0);
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    query += ' AND title LIKE ?';
    params.push(`%${search.trim()}%`);
  }

  const sortCol = sort === 'title' ? 'title' : 'id';
  const sortDirection = order && order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  query += ` ORDER BY ${sortCol} ${sortDirection}`;

  const rows = db.prepare(query).all(...params);
  res.json(rows.map(formatTask));
});

app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Task not found' });
  res.json(formatTask(row));
});

app.post('/tasks', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'title is required and cannot be empty' });

  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO tasks (title, done, created_at, updated_at) VALUES (?, ?, ?, ?)');
  const result = stmt.run(title, 0, now, now);

  const newTask = {
    id: Number(result.lastInsertRowid),
    title,
    done: false,
    createdAt: now,
    updatedAt: now
  };
  res.status(201).json(newTask);
});

app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const body = req.body;
  if (!body || Object.keys(body).length === 0) return res.status(400).json({ error: 'Request body cannot be empty' });
  if ('title' in body && (typeof body.title !== 'string' || !body.title.trim())) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if ('done' in body && typeof body.done !== 'boolean') {
    return res.status(400).json({ error: 'done must be a boolean' });
  }

  const newTitle = 'title' in body ? body.title.trim() : existing.title;
  const newDone = 'done' in body ? (body.done ? 1 : 0) : existing.done;
  const now = new Date().toISOString();

  db.prepare('UPDATE tasks SET title = ?, done = ?, updated_at = ? WHERE id = ?').run(newTitle, newDone, now, id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(formatTask(updated));
});

app.patch('/tasks/:id/done', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const newDone = existing.done === 1 ? 0 : 1;
  const now = new Date().toISOString();
  db.prepare('UPDATE tasks SET done = ?, updated_at = ? WHERE id = ?').run(newDone, now, id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(formatTask(updated));
});

app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
});

// 404 – unknown route
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Task API running at http://localhost:${PORT}`));
