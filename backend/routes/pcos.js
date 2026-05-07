const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  saveQuestionnaire,
  getRiskResult,
  getAllAssessments
} = require('../controllers/pcosController');

// Save questionnaire answers + get risk result
router.post('/questionnaire', protect, saveQuestionnaire);

// Get latest risk result
router.get('/risk', protect, getRiskResult);

// Get all past assessments
router.get('/assessments', protect, getAllAssessments);

module.exports = router;