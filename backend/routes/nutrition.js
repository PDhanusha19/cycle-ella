const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTodayNutrition } = require('../controllers/nutritionController');

router.get('/today', protect, getTodayNutrition);

module.exports = router;
