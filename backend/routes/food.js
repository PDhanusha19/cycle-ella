const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  logFood,
  getFoodLogs,
  getDailySummary,
  deleteFood,
  getWeeklySummary,
  analyseFoodLog
} = require('../controllers/foodController');

// Log food item
router.post('/log', protect, logFood);

// Get food logs by date
router.get('/logs', protect, getFoodLogs);

// Get daily nutrition summary
router.get('/summary', protect, getDailySummary);

// Delete food item
router.delete('/log/:id', protect, deleteFood);

// Get weekly summary
router.get('/weekly', protect, getWeeklySummary);

// Analyse food log for tips
router.get('/analyse', protect, analyseFoodLog);

module.exports = router;