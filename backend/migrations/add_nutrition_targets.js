// ============================================
// MIGRATION: Add nutrition_targets table
// Run once:  node migrations/add_nutrition_targets.js
// Safe to run multiple times (uses IF NOT EXISTS).
//
// Stores weekly-recalculated calorie/macro targets per user, keyed on
// (user_id, week_start) so a re-weigh-in within the same week updates
// the row instead of creating a duplicate.
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
    `CREATE TABLE IF NOT EXISTS nutrition_targets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      week_start DATE NOT NULL,
      weight DECIMAL(5,2),
      height DECIMAL(5,2),
      bmi DECIMAL(5,2),
      bmi_category VARCHAR(20),
      goal VARCHAR(20),
      daily_calories INT,
      weekly_calories INT,
      daily_protein_g DECIMAL(6,1),
      daily_carbs_g DECIMAL(6,1),
      daily_fats_g DECIMAL(6,1),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_week (user_id, week_start),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    (err) => {
      if (err) {
        console.error('❌ Error creating nutrition_targets:', err.message);
      } else {
        console.log("✅ Table 'nutrition_targets' created/exists");
      }
      console.log('\n✅ Migration complete!');
      db.end();
    }
  );
});
