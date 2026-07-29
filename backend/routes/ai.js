const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getRecommendations,
  searchFoodItem,
  getFoods,
  getFullAIAnalysis,
  getRecommendationsPython,
  getMealPlan
} = require('../controllers/aiController');

// NOTE: the old '/predict-risk' (fake Neural Network) and
// '/python/predict-risk' (old, wrong data shape) routes have been
// removed. Real PCOS prediction now happens at POST /api/pcos/assessment
// (see routes/pcos.js) — that's the one your app should call.

// Collaborative Filtering Food Recommendations (JS, real data, working)
router.get('/recommendations', protect, getRecommendations);

// Search food from Sri Lankan database
router.get('/food/search', protect, searchFoodItem);

// Get all foods
router.get('/food/all', protect, getFoods);

// Full AI analysis overview
router.get('/analysis', protect, getFullAIAnalysis);

// Python AI routes — Model 2 (content-based + KNN food recommender)
router.post('/python/recommendations', protect, getRecommendationsPython);
router.post('/python/meal-plan', protect, getMealPlan);

module.exports = router;