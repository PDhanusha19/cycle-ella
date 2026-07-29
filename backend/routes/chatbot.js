const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { askChatbot } = require('../controllers/chatbotController');

router.post('/ask', protect, askChatbot);

module.exports = router;
