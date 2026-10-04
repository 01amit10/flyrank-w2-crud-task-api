/**
 * Stage 4: Learn your first SQL by hand
 * Run directly with: node scripts/sql-demo.js
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'tasks.db');
const db = new Database(dbPath);

console.log('=== Stage 4: Direct SQLite Query Exploration ===\n');

// 1. List every task
console.log('1. SELECT * FROM tasks;');
const allTasks = db.prepare('SELECT * FROM tasks').all();
console.table(allTasks);

// 2. Count all tasks
console.log('\n2. SELECT COUNT(*) FROM tasks;');
const count = db.prepare('SELECT COUNT(*) as total FROM tasks').get();
console.log('Total tasks count:', count.total);

// 3. Filter by done
console.log('\n3. SELECT * FROM tasks WHERE done = 1;');
const doneTasks = db.prepare('SELECT * FROM tasks WHERE done = 1').all();
console.log('Completed tasks:', doneTasks);

// 4. Update task completion
console.log('\n4. UPDATE tasks SET done = 1 WHERE id = 1;');
db.prepare('UPDATE tasks SET done = 1 WHERE id = 1').run();
const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = 1').get();
console.log('Updated Task (id: 1):', updatedTask);

// Reset task 1 back to done = 0 for consistency
db.prepare('UPDATE tasks SET done = 0 WHERE id = 1').run();
console.log('\nReset task 1 done back to 0.');
console.log('\nExploration complete. Database remains the single source of truth.');
