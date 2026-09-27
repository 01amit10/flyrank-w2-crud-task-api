const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

let tasks = [
  { id: 1, title: 'Finish Week 2 API', done: false, createdAt: new Date('2026-09-27T10:00:00Z').toISOString() },
  { id: 2, title: 'Test CRUD endpoints', done: false, createdAt: new Date('2026-09-27T10:05:00Z').toISOString() },
  { id: 3, title: 'Publish project to GitHub', done: false, createdAt: new Date('2026-09-27T10:10:00Z').toISOString() }
];

app.get('/', (req, res) => res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks'] }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/tasks', (req, res) => {
  const { done } = req.query;
  if (done === 'true') return res.json(tasks.filter((t) => t.done === true));
  if (done === 'false') return res.json(tasks.filter((t) => t.done === false));
  res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((item) => item.id === id);
  if (!task) return res.status(404).json({ error: `Task ${id} not found` });
  res.json(task);
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
