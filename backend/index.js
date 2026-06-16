const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');

dotenv.config();

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

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Cycle Ella API is running! 🌸' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🌸`);
});