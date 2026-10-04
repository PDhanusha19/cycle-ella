const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getFullAIAnalysis,
  getRecommendationsPython,
  getMealPlan
} = require('../controllers/aiController');

// NOTE: the old '/predict-risk' (fake Neural Network) and
// '/python/predict-risk' (old, wrong data shape) routes have been
// removed. Real PCOS prediction now happens at POST /api/pcos/assessment
// (see routes/pcos.js) — that's the one your app should call.
//
// The old '/recommendations', '/food/search' and '/food/all' routes
// (JS collaborative filtering over a hardcoded 29-food list) have also
// been removed — never called by the frontend, and fully superseded by
// the real Python content-based + KNN engine over the live 83-food
// MySQL database (see '/python/recommendations' and '/python/meal-plan'
// below).

// Full AI analysis overview
router.get('/analysis', protect, getFullAIAnalysis);

// Python AI routes — Model 2 (content-based + KNN food recommender)
router.post('/python/recommendations', protect, getRecommendationsPython);
router.post('/python/meal-plan', protect, getMealPlan);

module.exports = router;