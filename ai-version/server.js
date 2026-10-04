const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

// AI middleware: basic token extraction without prefix validation
async function authMiddleware(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Flaw 1: naive split that crashes if header is just "Bearer" without token, or fails if lowercase
  const rawToken = token.replace('Bearer ', '');
  const { data } = await supabase.auth.getUser(rawToken);

  // Flaw 2: does not check error object, assumes data.user existence is sufficient
  if (!data || !data.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = data.user;
  next();
}

app.get('/public/info', (req, res) => {
  res.json({ message: 'Welcome stranger! This info is public.' });
});

app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data.user);
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Invalid login' });
  res.json({ access_token: data.session.access_token });
});

app.post('/auth/logout', authMiddleware, async (req, res) => {
  await supabase.auth.signOut();
  res.status(204).send();
});

app.get('/protected/profile', authMiddleware, (req, res) => {
  res.json(req.user);
});

app.listen(3000, () => console.log('AI auth server listening on port 3000'));
