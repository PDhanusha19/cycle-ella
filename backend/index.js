const dotenv = require('dotenv');

// Must run before anything that reads process.env at require time —
// config/db.js builds its pool from these variables the moment it is
// required, so loading .env after that require left it with undefined
// credentials.
dotenv.config();

// Fail fast and loudly rather than starting a server that cannot talk to
// the database, or one that signs tokens with an undefined secret.
const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error('');
  console.error('❌ Cannot start: missing required environment variable(s):');
  missingEnv.forEach((name) => console.error(`   - ${name}`));
  console.error('');
  console.error('Add them to backend/.env — see backend/.env.example for the full list.');
  console.error('');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const db = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
const profileRoutes = require('./routes/profile');
app.use('/api/profile', profileRoutes);
const pcosRoutes = require('./routes/pcos');
app.use('/api/pcos', pcosRoutes);
const periodRoutes = require('./routes/period');
app.use('/api/period', periodRoutes);
const foodRoutes = require('./routes/food');
app.use('/api/food', foodRoutes);
const tipsRoutes = require('./routes/tips');
app.use('/api/tips', tipsRoutes);
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes);
const remindersRoutes = require('./routes/reminders');
app.use('/api/reminders', remindersRoutes);
const gynoRoutes = require('./routes/gyno');
app.use('/api/gyno', gynoRoutes);
const aiRoutes = require('./routes/ai');
app.use('/api/ai', aiRoutes);
const faqRoutes = require('./routes/faq');
app.use('/api/faq', faqRoutes);
const chatbotRoutes = require('./routes/chatbot');
app.use('/api/chatbot', chatbotRoutes);
const nutritionRoutes = require('./routes/nutrition');
app.use('/api/nutrition', nutritionRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Cycle Ella API is running! 🌸' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🌸`);
});