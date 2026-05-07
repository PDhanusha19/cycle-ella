const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  generateTips,
  getPastTips,
  getHealthScore
} = require('../controllers/tipsController');

// Generate today's personalized tips
router.get('/generate', protect, generateTips);

// Get past tips by date
router.get('/past', protect, getPastTips);

// Get health score
router.get('/health-score', protect, getHealthScore);

module.exports = router;