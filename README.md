# FlyRank Week 2 · Assignment A4 — Auth: Login & Protect

A production-grade, secure RESTful API built with **Node.js, Express, Supabase Auth, and JSON Web Tokens (JWTs)**. This assignment adds user authentication, session management, and route guarding to the task management backend.

![Swagger UI with Bearer Authentication Padlock](docs/swagger-auth-screenshot.jpg)

---

## 🔐 The Big Idea: The Trust Triangle

Secure modern authentication is a trust triangle between three parties:

```
      [ 1. Credentials (email + password) ]
Client ──────────────────────────────────────> Supabase Auth (IdP)
       <──────────────────────────────────────
      [ 2. Signed JWT Access Token + Refresh ]
  │
  │   [ 3. HTTP Request with Authorization: Bearer <token> ]
  ▼
Express Backend ─────────────────────────────> Supabase Auth
                [ 4. Verify Signature (getUser) ]
```

### Why We Never Roll Our Own Cryptography
Storing plain passwords, writing custom salting algorithms, or rolling custom encryption is dangerous. In production, backends rely on an **Identity Provider (IdP)** like Supabase to safely store credentials, execute secure password hashing (bcrypt/argon2), and issue cryptographically signed JWTs. Our backend focuses on its core responsibility: **verifying incoming tokens, extracting user identity, and guarding protected endpoints.**

---

## 🚀 Quick Start (One Command Setup)

The API is ready to run out of the box with zero external configuration needed for local testing:

```bash
# 1. Clone repository & install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Start the server (runs on port 3000)
npm start
```

- **API Base URL:** `http://localhost:3000`
- **Interactive Swagger Docs with Bearer Padlock:** `http://localhost:3000/docs`
- **System Health Check:** `http://localhost:3000/health`
- **Public Open Info:** `http://localhost:3000/public/info`

---

## 🔑 Environment Variables & Secrets (.env)

All secrets are kept out of Git via `.gitignore`. Inspect [`.env.example`](.env.example):

```ini
PORT=3000

# Supabase Auth Configuration
# Obtain your Project URL and anon public key from Supabase Dashboard -> Project Settings -> API
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_anon_key

# PostgreSQL Connection String (Optional for container stack)
DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks
```

*(Note: If placeholder keys are left in `.env`, the server automatically activates a local development sandbox emulator generating standard RFC 7519 JWTs so all endpoints and tests run offline immediately).*

---

## 📋 Complete API Reference

| Method | Route | Description | Auth Required? | Status Codes |
|---|---|---|---|---|
| `GET` | `/` | API Metadata & service discovery | None | `200` |
| `GET` | `/public/info` | Public open data endpoint | None | `200` |
| `GET` | `/health` | Deep health check (runs `SELECT 1` & checks Auth) | None | `200`, `503` |
| `POST` | `/auth/signup` | Register new user account | None | `201`, `400` |
| `POST` | `/auth/login` | Authenticate & receive JWT access + refresh tokens | None | `200`, `400`, `401`, `429` |
| `POST` | `/auth/logout` | End current user session | `Bearer <token>` | `204`, `401` |
| `POST` | `/auth/refresh` | Exchange refresh token for new access token | None | `200`, `400`, `401` |
| `GET` | `/protected/profile` | Read authenticated user profile details | `Bearer <token>` | `200`, `401` |
| `GET` | `/protected/dashboard` | Access protected dashboard metrics | `Bearer <token>` | `200`, `401` |
| `GET` | `/protected/admin` | Restricted admin route (demonstrates 403 Forbidden) | `Bearer <token>` | `200`, `401`, `403` |
| `GET` | `/tasks` | List tasks (with search, status filter, sort) | None | `200` |
| `POST` | `/tasks` | Create task | None | `201`, `400` |

---

## 🛡️ 401 Unauthorized vs. 403 Forbidden

Understanding the difference between authentication and authorization is fundamental:

- **`401 Unauthorized` ("Who are you?"):**
  Returned when the client provides no credentials, a malformed `Authorization` header, or an invalid/expired token. The server cannot verify your identity.
  *(Example: Visiting `/protected/profile` without sending `Authorization: Bearer <token>`)*.

- **`403 Forbidden` ("I know who you are, but you cannot enter"):**
  Returned when the client is successfully authenticated, but lacks the necessary permissions or role.
  *(Example: An authenticated regular user trying to access `/protected/admin`)*.

---

## 🧪 Sample `curl -i` Execution

### 1. User Registration (`POST /auth/signup`)
```bash
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@example.com","password":"securePassword123"}'
```
```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{
  "id": "d876200e-d538-41aa-8f59-5ede68ee03c4",
  "email": "alex@example.com",
  "role": "authenticated",
  "created_at": "2026-10-04T08:55:27.272Z"
}
```

### 2. User Login (`POST /auth/login`)
```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@example.com","password":"securePassword123"}'
```
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "8f8c9b20e14a78c187...",
  "expires_in": 3600,
  "token_type": "bearer",
  "user": { "id": "d876200e-d538-41aa-8f59-5ede68ee03c4", "email": "alex@example.com" }
}
```

### 3. Protected Route Access (`GET /protected/profile`)
```bash
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <PASTE_YOUR_ACCESS_TOKEN>"
```
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "id": "d876200e-d538-41aa-8f59-5ede68ee03c4",
  "email": "alex@example.com",
  "role": "authenticated",
  "createdAt": "2026-10-04T08:55:27.272Z"
}
```

### 4. Forged / Tampered Token Rejection
```bash
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer forged.token.signature"
```
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8

{
  "error": "Invalid or expired token"
}
```

---

## ⚡ Engineering Deep Dives & Stretch Goals

### 1. What's Inside a JWT (and why secrets never belong there)
A JWT has three Base64URL-encoded parts: `Header.Payload.Signature`. Anyone who intercepts a token can paste it into [jwt.io](https://jwt.io) and read claims like `sub`, `email`, and `exp`. The signature ensures it cannot be altered without detection, but it offers **zero encryption**. Never place passwords, API keys, or private PII in a token payload.

### 2. Access Tokens vs. Refresh Tokens
Access tokens are deliberately short-lived (typically 1 hour) to limit exposure if intercepted. Refresh tokens are long-lived and securely stored. When an access token expires, clients call `POST /auth/refresh` with their refresh token to obtain a fresh access token without prompting the user to type their password again.

### 3. Brute Force Protection (Rate Limiting)
`POST /auth/login` includes rate-limiting middleware that tracks failed attempts per client IP. After 5 consecutive failed attempts, it responds with `429 Too Many Requests` for 60 seconds, thwarting automated dictionary attacks.

---

## 🤖 Stage 7: The AI Rematch ("AI vs Me")

In Stage 7, we prompted an AI assistant to implement the secured Supabase API and quarantined its output in [`ai-version/`](ai-version/).

### 1. The Prompt Used
```text
Build a secured REST API using Node.js, Express, and Supabase Auth.
Requirements:
1. Initialize the Supabase client using environment variables (SUPABASE_URL and SUPABASE_KEY).
2. Create five routes:
   - POST /auth/signup: creates a user account using email and password, returning 201 Created or 400 Bad Request.
   - POST /auth/login: authenticates with email and password and returns JWT access_token, returning 200 OK or 401 Unauthorized.
   - POST /auth/logout: signs out the user, returning 204 No Content.
   - GET /protected/profile: protected endpoint returning user profile with 200 OK.
   - GET /public/info: open endpoint returning 200 OK with public info.
3. Protect the private routes using an Express authentication middleware that verifies the Bearer token with Supabase (401 if missing, invalid, or expired).
4. Configure Swagger UI with Bearer authentication so users can authorize in /docs.
```

### 2. Three Concrete Differences Found in Code Review

| Aspect | What the AI Did | What the Hand-Built Version Did | Engineering Impact |
|---|---|---|---|
| **Header Parsing & Extraction** | Naive `token.replace('Bearer ', '')`. | Checked `startsWith('Bearer ')`, trimmed whitespace, and validated header structure. | The AI crashes or lets malformed headers slip through if `Bearer` is lowercase or missing token parameters. |
| **Error Handling & Network Guarding** | Checked `if (!data \|\| !data.user)` without inspecting the `error` object or wrapping in `try/catch`. | Checked `{ data, error }`, wrapped network calls in `try/catch`, and handled expired/invalid tokens explicitly. | The AI version unhandled-rejection crashes if the Supabase network socket drops. |
| **Session Continuity & Route Reuse** | Omitted `refresh_token` from login response, omitted second protected route, and omitted role checks. | Returned refresh tokens, provided `POST /auth/refresh`, verified reuse across `/protected/dashboard`, and added 403 checks. | The AI code left users unable to renew expired sessions and missed key architectural security patterns. |

### 3. What Did the Prompt Forget to Specify?
The prompt omitted specifying refresh token return payloads, rate-limiting on login, and non-root user data sanitization. The AI chose the minimum viable script, returning raw user objects directly.

---

## 📁 Repository Structure

```
W2_A1_Task_API/
├── ai-version/
│   ├── prompt.txt          # Quarantine prompt used in Stage 7 AI rematch
│   └── server.js           # AI-generated implementation for comparison
├── docs/
│   ├── swagger-auth-screenshot.jpg # Swagger UI with Bearer Auth padlock
│   └── postgres-db-screenshot.jpg  # PostgreSQL DBeaver screenshot
├── middleware/
│   └── auth.js             # Reusable requireAuth and requireRole guards
├── scripts/
│   ├── postgres-demo.js    # PostgreSQL CRUD verification script
│   └── explain-demo.js     # EXPLAIN ANALYZE index demonstration
├── .env.example            # Committed template of environment variables
├── .env                    # Git-ignored local secrets
├── .gitignore              # Ignores .env, node_modules, tasks.db*
├── compose.yaml            # Docker Compose orchestration
├── Dockerfile              # Multi-stage production Alpine Dockerfile
├── db.js                   # PostgreSQL repository module
├── supabaseClient.js       # Supabase Auth client with dev sandbox fallback
├── openapi.json            # Swagger UI OpenAPI 3.0 spec with securitySchemes
├── package.json            # Dependencies (@supabase/supabase-js, express, pg)
├── server.js               # Clean Express API controller
└── README.md               # Complete architecture and auth documentation
```
