const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getReminders,
  saveReminder,
  updateReminder,
  deleteReminder,
  setupDefaultReminders
} = require('../controllers/remindersController');

// Get all reminders
router.get('/', protect, getReminders);

// Save new reminder
router.post('/', protect, saveReminder);

// Update reminder
router.put('/:id', protect, updateReminder);

// Delete reminder
router.delete('/:id', protect, deleteReminder);

// Setup default reminders
router.post('/setup-defaults', protect, setupDefaultReminders);

module.exports = router;