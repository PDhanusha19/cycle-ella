const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const {
  saveHealthProfile,
  saveMeasurements,
  getMeasurements,
  getProfile,
  updateProfile,
  getBMIHistory
} = require('../controllers/profileController');

router.get('/', protect, getProfile);
router.put('/update', protect, updateProfile);
router.post('/health', protect, saveHealthProfile);
router.post('/measurements', protect, saveMeasurements);
router.get('/measurements/latest', protect, getMeasurements);
router.get('/bmi-history', protect, getBMIHistory);

module.exports = router;