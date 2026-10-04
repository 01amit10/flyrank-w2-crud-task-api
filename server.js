require('dotenv').config();
const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const morgan = require('morgan');
const openapi = require('./openapi.json');
const db = require('./db');
const supabase = require('./supabaseClient');
const { requireAuth, requireRole } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;

app.use(morgan('dev'));
app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Rate limiting state for brute force protection (Extra)
const loginAttempts = new Map();

function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetTime: now + 60000 };

  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + 60000;
  }

  if (entry.count >= 5) {
    return res.status(429).json({ error: 'Too many failed login attempts. Please try again in 1 minute.' });
  }

  req.recordFailedLogin = () => {
    entry.count += 1;
    loginAttempts.set(ip, entry);
  };
  req.clearLoginAttempts = () => {
    loginAttempts.delete(ip);
  };

  next();
}

// ----------------------------------------------------
// PUBLIC ROUTES
// ----------------------------------------------------

app.get('/', (req, res) => {
  res.json({
    name: 'Secure Task & Auth API (Supabase Auth + PostgreSQL)',
    version: '4.0.0',
    endpoints: [
      '/public/info',
      '/auth/signup',
      '/auth/login',
      '/auth/logout',
      '/auth/refresh',
      '/protected/profile',
      '/protected/dashboard',
      '/protected/admin',
      '/tasks',
      '/stats',
      '/health',
      '/docs'
    ]
  });
});

// Stage 2: Public open endpoint
app.get('/public/info', (req, res) => {
  res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

// Deep health check (runs SELECT 1 against database)
app.get('/health', async (req, res) => {
  try {
    await db.checkDbHealth();
    res.json({ status: 'ok', db: 'ok', auth: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'error', error: err.message });
  }
});

// ----------------------------------------------------
// AUTHENTICATION ROUTES (Supabase Auth)
// ----------------------------------------------------

// Stage 1: Sign up new user
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required and cannot be empty' });
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data.user);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during signup' });
  }
});

// Stage 1: Log in user & receive JWT access token
app.post('/auth/login', rateLimitLogin, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error || !data?.session) {
      if (req.recordFailedLogin) req.recordFailedLogin();
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    if (req.clearLoginAttempts) req.clearLoginAttempts();

    res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type || 'bearer',
      user: data.user
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Stage 4: Log out user session
app.post('/auth/logout', requireAuth, async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during logout' });
  }
});

// Optional Extra: Refresh Token endpoint
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token is required' });
    }
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error || !data?.session) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    res.json(data.session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ----------------------------------------------------
// PROTECTED ROUTES (Guarded by requireAuth)
// ----------------------------------------------------

// Stage 3 & 4: User Profile
app.get('/protected/profile', requireAuth, (req, res) => {
  res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role || 'authenticated',
    createdAt: req.user.created_at
  });
});

// Stage 4 Checkpoint: Second protected route to prove middleware reuse
app.get('/protected/dashboard', requireAuth, (req, res) => {
  res.status(200).json({
    message: `Welcome to your private dashboard, ${req.user.email}!`,
    userId: req.user.id,
    role: req.user.role || 'authenticated',
    metrics: {
      activeProjects: 3,
      tasksAssigned: 12,
      lastLogin: new Date().toISOString()
    }
  });
});

// Optional Extra: 403 Forbidden demonstration route
app.get('/protected/admin', requireAuth, requireRole('admin'), (req, res) => {
  res.status(200).json({
    message: 'Welcome Administrator! You have access to restricted settings.',
    adminId: req.user.id
  });
});

// ----------------------------------------------------
// TASK CRUD ENDPOINTS (Encapsulated in db.js)
// ----------------------------------------------------

app.get('/stats', async (req, res, next) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

app.get('/tasks', async (req, res, next) => {
  try {
    const { done, search, sort, order } = req.query;
    const tasks = await db.getAllTasks({ done, search, sort, order });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

app.get('/tasks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'id must be a number' });
    const task = await db.getTaskById(id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

app.post('/tasks', async (req, res, next) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'title is required and cannot be empty' });
    const newTask = await db.createTask(title);
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
});

app.put('/tasks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'id must be a number' });
    const existing = await db.getTaskById(id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const body = req.body;
    if (!body || Object.keys(body).length === 0) return res.status(400).json({ error: 'Request body cannot be empty' });
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

app.patch('/tasks/:id/done', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'id must be a number' });
    const toggled = await db.toggleTaskDone(id);
    if (!toggled) return res.status(404).json({ error: 'Task not found' });
    res.json(toggled);
  } catch (err) {
    next(err);
  }
});

app.delete('/tasks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'id must be a number' });
    const deleted = await db.deleteTask(id);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
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

if (require.main === module) {
  db.initDb()
    .then(() => {
      app.listen(PORT, () => console.log(`Server running and connected to Supabase Auth on http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.warn('Database init warning:', err.message);
      app.listen(PORT, () => console.log(`Server running and connected to Supabase Auth on http://localhost:${PORT}`));
    });
}

module.exports = app;
