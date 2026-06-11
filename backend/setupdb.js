const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'cycleella'
});

db.connect((err) => {
  if (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL!');

  // Create database
  db.query('CREATE DATABASE IF NOT EXISTS cycleella', (err) => {
    if (err) {
      console.error('Database creation error:', err.message);
      process.exit(1);
    }
    console.log('Database cycleella created/exists');

    // Switch to database
    db.changeUser({ database: 'cycleella' }, (err) => {
      if (err) {
        console.error('Error switching database:', err.message);
        process.exit(1);
      }

      // Array of all table creation queries
      const tables = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          full_name VARCHAR(255) NOT NULL,
          gender VARCHAR(50),
          date_of_birth DATE,
          phone VARCHAR(20),
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          is_verified BOOLEAN DEFAULT FALSE,
          otp VARCHAR(10),
          otp_expires DATETIME,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // User measurements (BMI, weight, height)
        `CREATE TABLE IF NOT EXISTS user_measurements (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          weight DECIMAL(5,2),
          height DECIMAL(5,2),
          bmi DECIMAL(5,2),
          recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // User health profile
        `CREATE TABLE IF NOT EXISTS user_health_profile (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          pcos_diagnosis BOOLEAN DEFAULT FALSE,
          diabetes VARCHAR(20),
          cholesterol VARCHAR(20),
          food_budget DECIMAL(10,2),
          activity_level VARCHAR(50),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // Cycle phases tracking
        `CREATE TABLE IF NOT EXISTS cycle_phases (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          phase_name VARCHAR(50),
          phase_date DATE,
          start_date DATE,
          end_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // Period tracking
        `CREATE TABLE IF NOT EXISTS periods (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          start_date DATE,
          end_date DATE,
          flow_intensity VARCHAR(20),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // PCOS risk assessments
        `CREATE TABLE IF NOT EXISTS pcos_risk (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          total_score INT,
          risk_level VARCHAR(50),
          assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // Questionnaire answers
        `CREATE TABLE IF NOT EXISTS questionnaire_answers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          category VARCHAR(100),
          score INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // Food log
        `CREATE TABLE IF NOT EXISTS food_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          log_date DATE,
          meal_type VARCHAR(50),
          food_name VARCHAR(255),
          quantity DECIMAL(8,2),
          unit VARCHAR(50),
          calories INT,
          protein DECIMAL(5,2),
          carbs DECIMAL(5,2),
          fats DECIMAL(5,2),
          input_method VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // Food catalog for AI recommendations
        `CREATE TABLE IF NOT EXISTS foods (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255),
          category VARCHAR(100),
          calories INT,
          protein DECIMAL(7,2),
          carbs DECIMAL(7,2),
          fats DECIMAL(7,2),
          glycemic_index VARCHAR(50),
          pcos_friendly BOOLEAN DEFAULT TRUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,


        `CREATE TABLE IF NOT EXISTS nutrition_daily (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          log_date DATE,
          total_calories INT DEFAULT 0,
          total_protein DECIMAL(7,2) DEFAULT 0,
          total_carbs DECIMAL(7,2) DEFAULT 0,
          total_fats DECIMAL(7,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_daily_summary (user_id, log_date),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        `CREATE TABLE IF NOT EXISTS period_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          month INT,
          year INT,
          duration_days INT,
          is_regular BOOLEAN DEFAULT FALSE,
          avg_cycle_length INT,
          start_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        `CREATE TABLE IF NOT EXISTS tips_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          tip_date DATE,
          tip_type VARCHAR(50),
          tip_content TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_tip (user_id, tip_date, tip_type),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // Reminders
        `CREATE TABLE IF NOT EXISTS reminders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          title VARCHAR(255),
          description TEXT,
          reminder_time TIME,
          reminder_date DATE,
          reminder_type VARCHAR(50),
          is_completed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // Gynecology health data
        `CREATE TABLE IF NOT EXISTS gyno_health (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          last_checkup_date DATE,
          ovarian_cysts BOOLEAN DEFAULT FALSE,
          hirsutism VARCHAR(20),
          acne_level VARCHAR(20),
          pcos_confirmed BOOLEAN DEFAULT FALSE,
          notes TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // Reports/insights
        `CREATE TABLE IF NOT EXISTS reports (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          report_type VARCHAR(100),
          data JSON,
          generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`
      ];

      // Execute all table creation queries sequentially
      let tableIndex = 0;
      const createNextTable = () => {
        if (tableIndex >= tables.length) {
          db.end();
          console.log('✅ Database setup complete! All tables created.');
          process.exit(0);
        }

        db.query(tables[tableIndex], (err) => {
          if (err) {
            console.error(`Table creation error at index ${tableIndex}:`, err.message);
            process.exit(1);
          }
          const tableName = tables[tableIndex].match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
          console.log(`✅ Table '${tableName}' created/exists`);
          tableIndex++;
          createNextTable();
        });
      };

      createNextTable();
    });
  });
});
