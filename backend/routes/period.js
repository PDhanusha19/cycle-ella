const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  savePeriodHistory,
  logPeriodStart,
  logPeriodEnd,
  getCurrentPhase,
  getPeriodHistory
} = require('../controllers/periodController');

// Save period history (onboarding)
router.post('/history', protect, savePeriodHistory);

// Log period start
router.post('/start', protect, logPeriodStart);

// Log period end
router.put('/end', protect, logPeriodEnd);

// Get current cycle phase
router.get('/phase', protect, getCurrentPhase);

// Get period history
router.get('/history', protect, getPeriodHistory);

module.exports = router;