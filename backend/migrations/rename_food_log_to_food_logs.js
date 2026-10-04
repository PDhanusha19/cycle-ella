// ============================================
// MIGRATION: Rename food_log -> food_logs
// Run once:  node migrations/rename_food_log_to_food_logs.js
// Safe to run multiple times.
//
// setupdb.js used to create the table as 'food_log' (singular) while every
// query in the codebase uses 'food_logs'. setupdb.js now creates
// 'food_logs' directly, so this migration only exists to carry an existing
// install (and any food already logged in it) over to the correct name.
//
// Behaviour:
//   - food_logs exists, food_log doesn't  -> nothing to do
//   - food_log exists, food_logs doesn't  -> rename it, data preserved
//   - both exist                          -> leave both alone and warn,
//                                            merging is a manual decision
// ============================================

require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const tableExists = (name) => new Promise((resolve, reject) => {
  db.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [name],
    (err, rows) => (err ? reject(err) : resolve(rows[0].n > 0))
  );
});

db.connect(async (err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL! 🌸');

  try {
    const [hasOld, hasNew] = await Promise.all([
      tableExists('food_log'),
      tableExists('food_logs')
    ]);

    if (!hasOld && hasNew) {
      console.log("✅ 'food_logs' already present, no 'food_log' to rename — nothing to do");
    } else if (!hasOld && !hasNew) {
      console.log("ℹ️  Neither table exists — run 'node setupdb.js' first");
    } else if (hasOld && hasNew) {
      console.warn(
        "⚠️  Both 'food_log' and 'food_logs' exist. Not touching either — " +
        "copy any rows you need out of 'food_log' manually, then drop it."
      );
    } else {
      await new Promise((resolve, reject) => {
        db.query('RENAME TABLE food_log TO food_logs', (e) => (e ? reject(e) : resolve()));
      });
      console.log("✅ Renamed 'food_log' -> 'food_logs' (existing rows preserved)");
    }

    console.log('\n✅ Migration complete!');
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    db.end();
    process.exit(1);
  }

  db.end();
});
