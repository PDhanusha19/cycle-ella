const mysql = require('mysql2');

// index.js loads dotenv before requiring this module, but migrations and
// standalone scripts require it directly, so load here too — dotenv is a
// no-op if the vars are already set.
require('dotenv').config();

// A single mysql.createConnection() gets silently killed by MySQL's
// wait_timeout after a period of inactivity — and since nothing was
// listening for that, mysql2 threw it as an unhandled error and took
// the whole server down. A pool re-establishes dropped connections
// automatically per-query instead of holding one connection open
// forever, so idle periods (like leaving the dev server running
// overnight) don't crash the process.
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    return;
  }
  console.log('Connected to MySQL database! 🌸');
  connection.release();
});

db.on('error', (err) => {
  console.error('MySQL pool error:', err.message);
});

module.exports = db;