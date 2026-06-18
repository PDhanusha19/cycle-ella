const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getCategories,
  getByCategory,
  searchFaq,
  getAllFaq,
  markHelpful
} = require('../controllers/faqController');

// Public routes - no token needed
router.get('/', getAllFaq);
router.get('/categories', getCategories);
router.get('/search', searchFaq);
router.get('/category/:category', getByCategory);

// Protected - need token to mark helpful
router.put('/helpful/:id', protect, markHelpful);

module.exports = router;