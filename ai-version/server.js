const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Open or create SQLite database
const db = new Database(path.join(__dirname, 'tasks.db'));

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0
  )
`);

// Seed default tasks if empty
const countResult = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
if (countResult.count === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  insert.run('Finish Week 2 API', 0);
  insert.run('Test CRUD endpoints', 0);
  insert.run('Publish project to GitHub', 0);
  console.log('Seeded initial tasks.');
}

// GET /tasks
app.get('/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  res.json(tasks);
});

// GET /tasks/:id
app.get('/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

// POST /tasks
app.post('/tasks', (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const stmt = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const result = stmt.run(title.trim(), 0);
  res.status(201).json({ id: result.lastInsertRowid, title: title.trim(), done: 0 });
});

// PUT /tasks/:id
app.put('/tasks/:id', (req, res) => {
  const { title, done } = req.body;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!req.body || (!title && done === undefined)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newDone = done !== undefined ? (done ? 1 : 0) : existing.done;

  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(newTitle, newDone, req.params.id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /tasks/:id
app.delete('/tasks/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.status(204).send();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AI version server running on port ${PORT}`);
  });
}

module.exports = app;
