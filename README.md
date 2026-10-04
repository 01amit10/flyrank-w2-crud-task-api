# FlyRank Week 1 · Assignment A3 — Containerize Your Stack (PostgreSQL + Docker Compose)

A production-grade, containerized RESTful Task Management API built with **Node.js, Express, PostgreSQL, and Docker Compose**. This project represents the third storage evolution in this repository:
$$\text{In-Memory Array (A1)} \longrightarrow \text{SQLite File (A2)} \longrightarrow \text{Containerized PostgreSQL Cluster (A3)}$$

Every API endpoint, URL route, validation rule, and response contract remains **identical**, proving that the database engine is strictly an implementation detail.

![PostgreSQL Database in DBeaver](docs/postgres-db-screenshot.jpg)

---

## 🚀 Quick Start (One Command Setup)

You can launch the entire stack (Node.js API + PostgreSQL Server + Persistent Volume) with a single command.

```bash
# 1. Clone repository & copy environment configuration
cp .env.example .env

# 2. Start the full containerized stack
docker compose up --build
```

- **API Base URL:** `http://localhost:3000`
- **Interactive Swagger Docs:** `http://localhost:3000/docs`
- **Health Check (with DB Ping):** `http://localhost:3000/health`
- **Task Statistics:** `http://localhost:3000/stats`
- **Direct PostgreSQL Port:** `localhost:5432` (`postgres:dev`, db: `tasks`)

To stop the stack:
```bash
docker compose down
```

---

## 🔑 Environment Variables & Secrets (.env)

Database credentials and connection secrets are decoupled from application code and excluded from Git via `.gitignore`.

Inspect [`.env.example`](.env.example) to see required keys:
```ini
PORT=3000

# When running locally on host machine talking to container:
DATABASE_URL=postgres://postgres:dev@localhost:5432/tasks

# When running inside Docker Compose network (service name 'db'):
# DATABASE_URL=postgres://postgres:dev@db:5432/tasks
```

---

## 📋 API Endpoints Reference

| Method | Route | Description | Status Codes |
|---|---|---|---|
| `GET` | `/` | API Metadata & service info | `200` |
| `GET` | `/health` | Deep health check (runs `SELECT 1` against Postgres) | `200`, `503` |
| `GET` | `/stats` | Task metrics calculated via SQL `COUNT(*)` | `200` |
| `GET` | `/tasks` | List tasks (supports search, status filter, sort) | `200` |
| `GET` | `/tasks/:id` | Get single task by ID | `200`, `400`, `404` |
| `POST` | `/tasks` | Create task (`RETURNING *` with auto-increment ID) | `201`, `400` |
| `PUT` | `/tasks/:id` | Update title and/or done status | `200`, `400`, `404` |
| `PATCH`| `/tasks/:id/done` | Toggle task completion status | `200`, `400`, `404` |
| `DELETE`| `/tasks/:id` | Delete task | `204`, `400`, `404` |

---

## 🧪 Sample `curl -i` Execution

### Create Task:
```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Containerize stack with Docker Compose"}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Content-Length: 153

{
  "id": 4,
  "title": "Containerize stack with Docker Compose",
  "done": false,
  "createdAt": "2026-10-04T08:45:43.226Z",
  "updatedAt": "2026-10-04T08:45:43.226Z"
}
```

### Deep Health Check:
```bash
curl -i http://localhost:3000/health
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "ok",
  "db": "ok"
}
```

---

## 🏛️ Architecture & Storage Swap Ladder

```
Assignment 1:  Client ──(HTTP)──>  Express Routes  ──>  In-Memory Array (volatile)
Assignment 2:  Client ──(HTTP)──>  Express Routes  ──>  SQLite tasks.db (single file)
Assignment 3:  Client ──(HTTP)──>  Express Routes  ──>  PostgreSQL in Docker (server container)
```

### Why Identical Tests Passing Proves Storage Is an Implementation Detail
The routes in `server.js` do not know or care where data lives. All SQL queries are encapsulated in a dedicated repository module (`db.js`). Whether the database is an array, SQLite, or a production PostgreSQL instance, client requests receive identical status codes, error messages, and payload formats. This separation of concerns allows developers to migrate, optimize, or replace backends with zero downtime or frontend disruption.

---

## ⚡ Engineering Deep Dives & Stretch Goals

### 1. The Mortality Experiment: Why Docker Volumes Exist
If you run a Postgres container without a mounted volume:
```bash
docker run --name tempdb -e POSTGRES_PASSWORD=dev -d postgres
# Create tasks inside tempdb...
docker rm -f tempdb
docker run --name tempdb -e POSTGRES_PASSWORD=dev -d postgres
```
The tasks vanish instantly. A container's writeable layer is ephemeral and dies when the container is deleted. A **named volume** (`taskdata:/var/lib/postgresql/data`) decouples state from the container lifecycle, storing rows directly on host disk so data survives reboots, rebuilds, and image upgrades.

### 2. Real Deep Health Checks & Load Balancers
`GET /health` runs an active `SELECT 1` query against PostgreSQL.
**Why this matters:** A load balancer (like AWS ALB or Nginx) uses this health check to determine whether traffic should be routed to the instance. If the database connection drops, the endpoint returns `503 Service Unavailable`, prompting the orchestrator to failover or restart the unhealthy container before users encounter runtime 500 errors.

### 3. Query Optimization with Indexes (`EXPLAIN ANALYZE`)
We indexed the `done` and `title` columns:
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
```
- **Without index:** Postgres must execute a **Sequential Scan** ($O(N)$), inspecting every row on disk.
- **With index:** Postgres performs a **Bitmap Index Scan** ($O(\log N)$) using a B-tree, accelerating status filtering as table size grows to millions of rows.

### 4. Image Size Optimization (Multi-Stage Dockerfile)
We implemented a multi-stage Docker build in `Dockerfile`:
- **Single-stage image (`node:20` standard):** ~1.1 GB (includes compiler toolchains, package managers, development caches).
- **Multi-stage image (`node:20-alpine` with `--omit=dev`):** ~182 MB (**83% size reduction**), reducing deployment network transfer times and closing attack vectors by omitting build tools.

---

## 🤖 Stage 6: The AI Rematch ("AI vs Me")

In Stage 6, we prompted an AI assistant to containerize the task CRUD API onto PostgreSQL and quarantined its output in [`ai-version/`](ai-version/).

### 1. The Prompt Used
```text
Containerize this Node.js Express task CRUD API using PostgreSQL and Docker Compose.
Requirements:
1. Use node-postgres (pg) to talk to a PostgreSQL database.
2. Read the database connection string from environment variables (.env file with DATABASE_URL), never hardcode passwords.
3. Automatically create the tasks table (id serial primary key, title text, done boolean) and seed three initial tasks if empty.
4. Keep the 5 CRUD endpoints (GET /tasks, GET /tasks/:id, POST /tasks, PUT /tasks/:id, DELETE /tasks/:id) with identical status codes (200, 201, 204, 400, 404) and parameterized queries ($1, $2).
5. Write a Dockerfile for the app.
6. Write a compose.yaml orchestrating the app and postgres service with a persistent volume so data survives container restarts.
```

### 2. Three Concrete Differences Found in Code Review

| Aspect | What the AI Did | What the Hand-Built Version Did | Engineering Impact |
|---|---|---|---|
| **Startup Race Conditions** | Simple `depends_on: [db]` without a healthcheck. | Used `condition: service_healthy` with a `pg_isready` healthcheck probe. | The AI app crashes on initial startup because Postgres takes a few seconds to initialize before accepting socket connections. |
| **Architectural Separation** | Smeared raw SQL queries and connection pools across `server.js` route handlers. | Encapsulated all database logic into a dedicated repository module (`db.js`). | The AI violates the golden rule: swapping storage broke route cleanliness. The hand-built version kept routes untouched. |
| **Container Security & Size** | Single-stage Dockerfile running as `root` user (`node:18`). | Multi-stage `node:20-alpine` build dropping privileges to non-root `USER node`. | The hand-built version is 80% smaller (~180MB vs >1GB) and follows container security best practices. |

### 3. What Did the Prompt Forget to Specify?
The prompt omitted specifying healthcheck synchronization for container startup ordering, non-root user permissions, and repository pattern modularity. The AI took the naive path: basic single-stage image and loose container dependency.

---

## 📁 Repository Structure

```
W2_A1_Task_API/
├── ai-version/
│   ├── prompt.txt          # Quarantine prompt used in Stage 6 AI rematch
│   ├── Dockerfile          # AI-generated single-stage Dockerfile
│   ├── compose.yaml        # AI-generated compose file
│   └── server.js           # AI-generated server implementation
├── docs/
│   ├── postgres-db-screenshot.jpg # DBeaver connected to PostgreSQL
│   └── db-browser-screenshot.jpg # DB Browser for SQLite (Week 2/3)
├── scripts/
│   ├── postgres-demo.js    # PostgreSQL CRUD verification script
│   └── explain-demo.js     # EXPLAIN ANALYZE index demonstration
├── .dockerignore           # Excludes node_modules, secrets, git from image
├── .env.example            # Committed template of environment variables
├── .env                    # Git-ignored local secrets
├── .gitignore              # Ignores .env, node_modules, tasks.db*
├── compose.yaml            # Docker Compose orchestration (api + db + volume)
├── Dockerfile              # Production multi-stage Alpine Dockerfile
├── db.js                   # PostgreSQL repository module
├── openapi.json            # Swagger UI OpenAPI 3.0 specification
├── package.json            # Dependencies (express, pg, dotenv)
├── server.js               # Clean Express API controller
└── README.md               # Complete architecture and run guide
```
