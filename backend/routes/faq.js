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

router.get('/', protect, getAllFaq);
router.get('/categories', protect, getCategories);
router.get('/search', protect, searchFaq);
router.get('/category/:category', protect, getByCategory);
router.put('/helpful/:id', protect, markHelpful);

module.exports = router;