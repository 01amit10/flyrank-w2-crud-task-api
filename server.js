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
    done INTEGER NOT NULL DEFAULT 0
  )
`);

// Seed 3 example tasks if table is empty
const rowCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
if (rowCount === 0) {
  const seedInsert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const seedMany = db.transaction((items) => {
    for (const item of items) {
      seedInsert.run(item.title, item.done);
    }
  });

  seedMany([
    { title: 'Finish Week 2 API', done: 0 },
    { title: 'Test CRUD endpoints', done: 0 },
    { title: 'Publish project to GitHub', done: 0 }
  ]);
  console.log('Database initialized: seeded 3 initial tasks into tasks.db');
}

// Helper to ensure boolean done is returned to clients
function formatTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    done: Boolean(row.done)
  };
}

let tasks = [
  { id: 1, title: 'Finish Week 2 API', done: false, createdAt: new Date('2026-09-27T10:00:00Z').toISOString() },
  { id: 2, title: 'Test CRUD endpoints', done: false, createdAt: new Date('2026-09-27T10:05:00Z').toISOString() },
  { id: 3, title: 'Publish project to GitHub', done: false, createdAt: new Date('2026-09-27T10:10:00Z').toISOString() }
];

app.get('/', (req, res) => res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks'] }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/tasks', (req, res) => {
  const { done } = req.query;
  let rows;
  if (done === 'true') {
    rows = db.prepare('SELECT * FROM tasks WHERE done = ?').all(1);
  } else if (done === 'false') {
    rows = db.prepare('SELECT * FROM tasks WHERE done = ?').all(0);
  } else {
    rows = db.prepare('SELECT * FROM tasks').all();
  }
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
  const nextId = tasks.length ? Math.max(...tasks.map((item) => item.id)) + 1 : 1;
  const task = { id: nextId, title, done: false, createdAt: new Date().toISOString() };
  tasks.push(task);
  res.status(201).json(task);
});

app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((item) => item.id === id);
  if (!task) return res.status(404).json({ error: `Task ${id} not found` });
  const body = req.body;
  if (!body || Object.keys(body).length === 0) return res.status(400).json({ error: 'Request body cannot be empty' });
  if ('title' in body && (typeof body.title !== 'string' || !body.title.trim())) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if ('done' in body && typeof body.done !== 'boolean') {
    return res.status(400).json({ error: 'done must be a boolean' });
  }
  if ('title' in body) task.title = body.title.trim();
  if ('done' in body) task.done = body.done;
  res.json(task);
});

app.patch('/tasks/:id/done', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((item) => item.id === id);
  if (!task) return res.status(404).json({ error: `Task ${id} not found` });
  task.done = !task.done;
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = tasks.findIndex((item) => item.id === id);
  if (index === -1) return res.status(404).json({ error: `Task ${id} not found` });
  tasks.splice(index, 1);
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
