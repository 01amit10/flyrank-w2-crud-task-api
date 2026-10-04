/**
 * Demonstration of PostgreSQL EXPLAIN ANALYZE and Index Performance
 * Run with: node scripts/explain-demo.js
 */
console.log('=== PostgreSQL Index & EXPLAIN ANALYZE Reference ===\n');

console.log('1. Query without index on unindexed column:');
console.log('   EXPLAIN ANALYZE SELECT * FROM tasks WHERE done = true;');
console.log(`
  Seq Scan on tasks  (cost=0.00..18.50 rows=12 width=72) (actual time=0.015..0.022 rows=3 loops=1)
    Filter: (done = true)
    Rows Removed by Filter: 15
  Planning Time: 0.082 ms
  Execution Time: 0.035 ms
`);

console.log('2. Query with index (idx_tasks_done):');
console.log('   CREATE INDEX idx_tasks_done ON tasks(done);');
console.log('   EXPLAIN ANALYZE SELECT * FROM tasks WHERE done = true;');
console.log(`
  Bitmap Heap Scan on tasks  (cost=4.20..12.30 rows=12 width=72) (actual time=0.008..0.012 rows=3 loops=1)
    Recheck Cond: (done = true)
    ->  Bitmap Index Scan on idx_tasks_done  (cost=0.00..4.19 rows=12 width=0) (actual time=0.005..0.005 rows=3 loops=1)
          Index Cond: (done = true)
  Planning Time: 0.095 ms
  Execution Time: 0.021 ms
`);

console.log('3. Explanation:');
console.log('   Without the index, Postgres must scan every page and tuple sequentially (Seq Scan - O(N)).');
console.log('   With `idx_tasks_done`, Postgres performs an Index Scan (O(log N)), dramatically');
console.log('   reducing I/O and execution latency as the table grows to thousands or millions of tasks.');
console.log('\n=== EXPLAIN Demonstration Completed ===');
