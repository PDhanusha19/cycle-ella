const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  savePeriodHistory,
  logPeriodStart,
  logPeriodEnd,
  editEntry,
  deleteEntry,
  getCurrentPhase,
  getPeriodHistory,
  getPeriodCalendar,
  getPredictions,
  getCycleSummary,
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

// Edit a logged period entry
router.put('/entries/:id', protect, editEntry);

// Soft-delete a logged period entry
router.delete('/entries/:id', protect, deleteEntry);

// Get current cycle phase
router.get('/phase', protect, getCurrentPhase);

// Get period history (cycle history list)
router.get('/history', protect, getPeriodHistory);

// Get calendar days for a specific month/year
router.get('/calendar', protect, getPeriodCalendar);

// Get predictions (next period — no ovulation window; unreliable in
// anovulatory cycles, which PCOS is defined by)
router.get('/predictions', protect, getPredictions);

// Get cycle summary stats (avg interval, variance, cycles in 12mo, longest gap)
router.get('/summary', protect, getCycleSummary);

// Save today's symptoms
router.post('/symptoms', protect, logSymptoms);

// Get today's symptoms
router.get('/symptoms/today', protect, getTodaySymptoms);

router.get('/regularity', protect, getRegularity);

module.exports = router;
