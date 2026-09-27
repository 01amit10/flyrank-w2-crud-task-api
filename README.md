# Task API — FlyRank Week 2 A1

A small Express API that manages an in-memory to-do list using CRUD operations. It includes Swagger UI for interactive API documentation.

## Tech stack
- Node.js
- Express
- Swagger UI (`swagger-ui-express`)
- In-memory JavaScript array (no database)

## Run locally

```bash
npm install
npm start
```

Server: `http://localhost:3000`  
Swagger UI: `http://localhost:3000/docs`

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | API metadata |
| GET | `/health` | Health check |
| GET | `/tasks` | List all tasks |
| GET | `/tasks/:id` | Get one task |
| POST | `/tasks` | Create a task |
| PUT | `/tasks/:id` | Update task title and/or done |
| DELETE | `/tasks/:id` | Delete a task |

## Status codes
- `200` — successful read/update
- `201` — task created
- `204` — task deleted, no response body
- `400` — invalid or empty request body
- `404` — task or route not found

## Example curl output

```text
$ curl -i http://localhost:3000/tasks/1
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Finish Week 2 API","done":false}
```

## Full CRUD example

```bash
curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Buy milk"}'
curl -i http://localhost:3000/tasks
curl -i http://localhost:3000/tasks/4
curl -i -X PUT http://localhost:3000/tasks/4 -H "Content-Type: application/json" -d '{"done":true}'
curl -i -X DELETE http://localhost:3000/tasks/4
```

## Validation examples

```bash
curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{}'
curl -i http://localhost:3000/tasks/99
```

## Swagger screenshot

Open `http://localhost:3000/docs` and use **Try it out** to create, list, update, and delete tasks. Add your screenshot below before final submission.

`[Insert Swagger UI screenshot here]`

## Notes

The task data is intentionally stored only in memory. Restarting the server resets the list to the three seed tasks.
