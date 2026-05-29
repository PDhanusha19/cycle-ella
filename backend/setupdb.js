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

      // Create users table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS users (
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
        )
      `;

      db.query(createTableSQL, (err) => {
        if (err) {
          console.error('Table creation error:', err.message);
          process.exit(1);
        }
        console.log('Users table created/exists');
        db.end();
        console.log('Database setup complete!');
      });
    });
  });
});
