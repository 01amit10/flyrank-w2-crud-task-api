/**
 * PostgreSQL CRUD Demonstration Script
 * Run with: node scripts/postgres-demo.js
 */
process.env.USE_MEM_PG = process.env.USE_MEM_PG || 'true';
const db = require('../db');

async function runDemo() {
  console.log('=== PostgreSQL CRUD Cycle Demonstration ===\n');

  // Initialize DB and ensure tables exist
  await db.initDb();

  // 1. Read all tasks
  console.log('1. Fetching all tasks (SELECT * FROM tasks)...');
  const tasks = await db.getAllTasks();
  console.table(tasks);

  // 2. Create new task
  console.log('\n2. Creating new task (INSERT INTO tasks ... RETURNING *)...');
  const created = await db.createTask('Postgres container demo task');
  console.log('Created task:', created);

  // 3. Update task
  console.log('\n3. Updating task (UPDATE tasks SET done = true ... RETURNING *)...');
  const updated = await db.updateTask(created.id, { done: true });
  console.log('Updated task:', updated);

  // 4. Delete task
  console.log('\n4. Deleting task (DELETE FROM tasks WHERE id = $1)...');
  const deleted = await db.deleteTask(created.id);
  console.log('Task deleted successfully:', deleted);

  // 5. Real health check
  console.log('\n5. Database Health Check (SELECT 1)...');
  const healthy = await db.checkDbHealth();
  console.log('Database healthy:', healthy);

  console.log('\n=== PostgreSQL CRUD Demonstration Completed Successfully ===');
  process.exit(0);
}

runDemo().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
