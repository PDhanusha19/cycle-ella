// ============================================
// MIGRATION: Drop food_budget column
// Run once:  node migrations/drop_food_budget.js
// Safe to run multiple times.
//
// The daily food budget feature was removed from the app — nothing
// in the UI collects it and nothing reads it for recommendations
// anymore. This drops the now-unused column from users.
// ============================================

const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'cycleella',
  database: 'cycleella'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL! 🌸');

  db.query(`ALTER TABLE users DROP COLUMN food_budget`, (err) => {
    // Error code 1091 = column doesn't exist — safe to ignore
    if (err && err.errno !== 1091) {
      console.error('❌ Error dropping food_budget from users:', err.message);
    } else {
      console.log("✅ Column 'food_budget' dropped from users (or already gone)");
    }
    console.log('\n✅ Migration complete!');
    db.end();
  });
});
