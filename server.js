require('dotenv').config();
const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const morgan = require('morgan');
const openapi = require('./openapi.json');
const db = require('./db');

const PORT = process.env.PORT || 3000;

app.use(morgan('dev'));
app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Metadata
app.get('/', (req, res) => {
  res.json({
    name: 'Task API (Containerized PostgreSQL)',
    version: '3.0.0',
    endpoints: ['/tasks', '/stats', '/health', '/docs']
  });
});

// Real health check endpoint (runs SELECT 1 against Postgres)
app.get('/health', async (req, res) => {
  try {
    await db.checkDbHealth();
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'error', error: err.message });
  }
});

// GET /stats: Real-time statistics computed with SQL COUNT(*)
app.get('/stats', async (req, res, next) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /tasks: Supports SQL LIKE search, status filter, and title/id sorting
app.get('/tasks', async (req, res, next) => {
  try {
    const { done, search, sort, order } = req.query;
    const tasks = await db.getAllTasks({ done, search, sort, order });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// GET /tasks/:id: Fetch single task using parameterized query ($1)
app.get('/tasks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'id must be a number' });
    }
    const task = await db.getTaskById(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// POST /tasks: Insert new task with parameterized values ($1, $2) and RETURNING *
app.post('/tasks', async (req, res, next) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) {
      return res.status(400).json({ error: 'title is required and cannot be empty' });
    }
    const newTask = await db.createTask(title);
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
});

// PUT /tasks/:id: Update task using parameterized query ($1, $2, $3) and RETURNING *
app.put('/tasks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'id must be a number' });
    }
    const existing = await db.getTaskById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ error: 'Request body cannot be empty' });
    }
    if ('title' in body && (typeof body.title !== 'string' || !body.title.trim())) {
      return res.status(400).json({ error: 'title must be a non-empty string' });
    }
    if ('done' in body && typeof body.done !== 'boolean') {
      return res.status(400).json({ error: 'done must be a boolean' });
    }

    const updated = await db.updateTask(id, {
      title: 'title' in body ? body.title.trim() : undefined,
      done: 'done' in body ? body.done : undefined
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PATCH /tasks/:id/done: Toggle done status
app.patch('/tasks/:id/done', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'id must be a number' });
    }
    const toggled = await db.toggleTaskDone(id);
    if (!toggled) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(toggled);
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id: Delete row with parameterized query ($1)
app.delete('/tasks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'id must be a number' });
    }
    const deleted = await db.deleteTask(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 404 – unknown route catch-all
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Auto-initialize DB and start server
if (require.main === module) {
  db.initDb()
    .then(() => {
      app.listen(PORT, () => console.log(`Task API running at http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error('Database connection / init failed:', err.message);
      // Still listen so health check reports status
      app.listen(PORT, () => console.log(`Task API running in degraded mode at http://localhost:${PORT}`));
    });
}

module.exports = app;
