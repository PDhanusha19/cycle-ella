const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  predictRisk,
  getRecommendations,
  searchFoodItem,
  getFoods,
  getFullAIAnalysis,
  predictRiskPython,
  getRecommendationsPython,
  getMealPlan
} = require('../controllers/aiController');

// Algorithm 2 — Neural Network PCOS Risk Prediction
router.get('/predict-risk', protect, predictRisk);

// Algorithm 3 — Collaborative Filtering Food Recommendations
router.get('/recommendations', protect, getRecommendations);

// Search food from Sri Lankan database
router.get('/food/search', protect, searchFoodItem);

// Get all foods
router.get('/food/all', protect, getFoods);

// Full AI analysis overview
router.get('/analysis', protect, getFullAIAnalysis);

// Python AI routes
router.post('/python/predict-risk', protect, predictRiskPython);
router.post('/python/recommendations', protect, getRecommendationsPython);
router.post('/python/meal-plan', protect, getMealPlan);

module.exports = router;