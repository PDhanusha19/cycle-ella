const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getWeeklyReport, getMonthlyReport } = require('../controllers/reportsController');

// Get weekly report
router.get('/weekly', protect, getWeeklyReport);

// Get monthly report
router.get('/monthly', protect, getMonthlyReport);

module.exports = router;