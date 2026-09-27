# FlyRank Week 2 – CRUD Task API

A RESTful Task Management API built with **Node.js + Express**, featuring Swagger UI docs, request logging, and full CRUD support.

---

## 🚀 Quick Start

```bash
npm install
npm start
```

Server runs at: `http://localhost:3000`  
Swagger docs at: `http://localhost:3000/docs`

---

## 📋 Endpoints

### Root & Health

| Method | Route     | Description                  |
|--------|-----------|------------------------------|
| GET    | `/`       | API info and version         |
| GET    | `/health` | Health check – returns `ok`  |

### Tasks

| Method | Route                  | Description                          |
|--------|------------------------|--------------------------------------|
| GET    | `/tasks`               | Get all tasks (supports `?done=true/false`) |
| GET    | `/tasks/:id`           | Get a single task by ID              |
| POST   | `/tasks`               | Create a new task                    |
| PUT    | `/tasks/:id`           | Update a task (title and/or done)    |
| PATCH  | `/tasks/:id/done`      | Toggle the `done` status of a task   |
| DELETE | `/tasks/:id`           | Delete a task                        |

---

## 📝 Task Schema

```json
{
  "id": 1,
  "title": "Finish Week 2 API",
  "done": false,
  "createdAt": "2026-09-27T10:00:00.000Z"
}
```

---

## 🔍 Query Filtering

Filter tasks by completion status:

```
GET /tasks?done=true    → returns only completed tasks
GET /tasks?done=false   → returns only pending tasks
GET /tasks              → returns all tasks
```

---

## 📦 Request & Response Examples

### Create a Task
```http
POST /tasks
Content-Type: application/json

{ "title": "Write unit tests" }
```
**Response `201`:**
```json
{ "id": 4, "title": "Write unit tests", "done": false, "createdAt": "..." }
```

### Update a Task
```http
PUT /tasks/1
Content-Type: application/json

{ "title": "Updated title", "done": true }
```

### Toggle Done
```http
PATCH /tasks/1/done
```
**Response `200`:** returns the task with `done` flipped.

### Delete a Task
```http
DELETE /tasks/1
```
**Response `204 No Content`**

---

## ⚙️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express v5
- **Logging:** Morgan (dev)
- **API Docs:** Swagger UI Express + OpenAPI 3.0

---

## 📁 Project Structure

```
W2_A1_Task_API/
├── server.js        # Main Express application
├── openapi.json     # OpenAPI 3.0 specification
├── package.json     # Dependencies and scripts
└── README.md        # This file
```
