require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

const isPlaceholder = !supabaseUrl || !supabaseKey || 
  supabaseUrl.includes('your_project_url') || 
  supabaseKey.includes('your_anon_key') ||
  process.env.USE_DEV_AUTH === 'true';

let supabase;

if (!isPlaceholder) {
  // Production live Supabase client
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Connected to live Supabase Auth at:', supabaseUrl);
} else {
  // Built-in offline development & test emulator with RFC 7519 compliant JWTs
  console.log('Running Supabase Auth in local developer sandbox mode.');
  const JWT_SECRET = process.env.JWT_SECRET || 'flyrank-supabase-auth-dev-secret-key-32bytes';

  // In-memory user store for dev mode
  const users = new Map();
  const sessions = new Map();

  function base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Buffer.from(base64, 'base64').toString();
  }

  function createJwt(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  function verifyJwt(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [encodedHeader, encodedPayload, signature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      if (signature !== expectedSignature) return null;
      const payload = JSON.parse(base64UrlDecode(encodedPayload));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      return payload;
    } catch (_) {
      return null;
    }
  }

  // Pre-seed a test user for immediate convenience
  const defaultSalt = crypto.randomBytes(16).toString('hex');
  const defaultHash = crypto.pbkdf2Sync('password123', defaultSalt, 1000, 64, 'sha512').toString('hex');
  const defaultUserId = '00000000-0000-0000-0000-000000000001';
  users.set('test@example.com', {
    id: defaultUserId,
    email: 'test@example.com',
    salt: defaultSalt,
    hash: defaultHash,
    role: 'authenticated',
    created_at: new Date('2026-10-04T10:00:00Z').toISOString()
  });

  supabase = {
    auth: {
      async signUp({ email, password, options = {} }) {
        if (!email || !password) {
          return { data: { user: null, session: null }, error: { message: 'Email and password are required' } };
        }
        if (users.has(email)) {
          return { data: { user: null, session: null }, error: { message: 'User already registered' } };
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        const id = crypto.randomUUID();
        const role = options.data?.role || 'authenticated';
        const user = {
          id,
          email,
          salt,
          hash,
          role,
          created_at: new Date().toISOString()
        };
        users.set(email, user);
        return {
          data: {
            user: { id: user.id, email: user.email, role: user.role, created_at: user.created_at },
            session: null
          },
          error: null
        };
      },

      async signInWithPassword({ email, password }) {
        const user = users.get(email);
        if (!user) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
        }
        const verifyHash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex');
        if (verifyHash !== user.hash) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
        }

        const now = Math.floor(Date.now() / 1000);
        const accessToken = createJwt({
          sub: user.id,
          email: user.email,
          role: user.role,
          iat: now,
          exp: now + 3600
        });
        const refreshToken = crypto.randomBytes(32).toString('hex');
        sessions.set(refreshToken, { userId: user.id, email: user.email, role: user.role });

        return {
          data: {
            user: { id: user.id, email: user.email, role: user.role, created_at: user.created_at },
            session: {
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_in: 3600,
              token_type: 'bearer'
            }
          },
          error: null
        };
      },

      async getUser(token) {
        if (!token) {
          return { data: { user: null }, error: { message: 'Token required' } };
        }
        const payload = verifyJwt(token);
        if (!payload) {
          return { data: { user: null }, error: { message: 'Invalid or expired token' } };
        }
        const user = users.get(payload.email);
        if (!user) {
          return { data: { user: null }, error: { message: 'User not found' } };
        }
        return {
          data: {
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              created_at: user.created_at
            }
          },
          error: null
        };
      },

      async refreshSession({ refresh_token }) {
        const session = sessions.get(refresh_token);
        if (!session) {
          return { data: { session: null, user: null }, error: { message: 'Invalid refresh token' } };
        }
        const now = Math.floor(Date.now() / 1000);
        const newAccessToken = createJwt({
          sub: session.userId,
          email: session.email,
          role: session.role,
          iat: now,
          exp: now + 3600
        });
        const newRefreshToken = crypto.randomBytes(32).toString('hex');
        sessions.delete(refresh_token);
        sessions.set(newRefreshToken, session);

        return {
          data: {
            session: {
              access_token: newAccessToken,
              refresh_token: newRefreshToken,
              expires_in: 3600,
              token_type: 'bearer'
            },
            user: { id: session.userId, email: session.email, role: session.role }
          },
          error: null
        };
      },

      async signOut() {
        return { error: null };
      }
    }
  };
}

module.exports = supabase;
