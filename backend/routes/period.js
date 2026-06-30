const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  savePeriodHistory,
  logPeriodStart,
  logPeriodEnd,
  getCurrentPhase,
  getPeriodHistory,
  getPeriodCalendar,
  getPredictions,
  logSymptoms,
  getTodaySymptoms,
  getRegularity
} = require('../controllers/periodController');

// Save period history (onboarding)
router.post('/history', protect, savePeriodHistory);

// Log period start
router.post('/start', protect, logPeriodStart);

// Log period end
router.put('/end', protect, logPeriodEnd);

// Get current cycle phase
router.get('/phase', protect, getCurrentPhase);

// Get period history (raw list)
router.get('/history', protect, getPeriodHistory);

// Get calendar days for a specific month/year
router.get('/calendar', protect, getPeriodCalendar);

// Get predictions (next period, ovulation, avg cycle)
router.get('/predictions', protect, getPredictions);

// Save today's symptoms
router.post('/symptoms', protect, logSymptoms);

// Get today's symptoms
router.get('/symptoms/today', protect, getTodaySymptoms);

router.get('/regularity', protect, getRegularity);

module.exports = router;