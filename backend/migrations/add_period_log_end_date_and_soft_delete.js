// ============================================
// MIGRATION: Add end_date + soft delete to period_logs
// Run once:  node migrations/add_period_log_end_date_and_soft_delete.js
// Safe to run multiple times.
//
// end_date NULL means the period is currently "open" (started, not yet
// ended) — this replaces the old behavior of guessing which row is open
// by grabbing whichever one has the highest id. deleted_at NULL means
// active; a timestamp means the entry was soft-deleted (edit/delete
// endpoints need a real row to keep an audit trail instead of hard
// deleting logged health data).
// ============================================

require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL! 🌸');

  db.query(
    `ALTER TABLE period_logs ADD COLUMN end_date DATE NULL`,
    (err) => {
      if (err && err.errno !== 1060) {
        console.error('❌ Error adding end_date:', err.message);
      } else {
        console.log("✅ Column 'end_date' added to period_logs (or already existed)");
      }

      db.query(
        `ALTER TABLE period_logs ADD COLUMN deleted_at DATETIME NULL`,
        (err2) => {
          if (err2 && err2.errno !== 1060) {
            console.error('❌ Error adding deleted_at:', err2.message);
          } else {
            console.log("✅ Column 'deleted_at' added to period_logs (or already existed)");
          }
          console.log('\n✅ Migration complete!');
          db.end();
        }
      );
    }
  );
});
