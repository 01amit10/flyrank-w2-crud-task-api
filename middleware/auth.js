const supabase = require('../supabaseClient');

/**
 * Reusable Auth Middleware Guard
 * Validates 'Authorization: Bearer <token>' header and verifies token via Supabase
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Stage 2: Check for presence of Authorization Bearer header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Stage 3: Ask Supabase if token is genuine & valid
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach verified user to request
    req.user = data.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional Extra: Role-based Authorization Guard (403 Forbidden)
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden: admin access required' });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
