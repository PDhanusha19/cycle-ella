const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getRiskResult,
  getAllAssessments,
  saveSymptomsAndPredict
} = require('../controllers/pcosController');

// NOTE: the old '/questionnaire' route (simple point-counting, not real
// ML) has been removed. Real assessment now happens at '/assessment'
// below, which calls the actual trained model.

// Save real symptom answers + get a real prediction
router.post('/assessment', protect, saveSymptomsAndPredict);

// Get latest risk result
router.get('/risk', protect, getRiskResult);

// Get all past assessments
router.get('/assessments', protect, getAllAssessments);

module.exports = router;