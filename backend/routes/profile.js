const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const {
  saveHealthProfile,
  saveMeasurements,
  getMeasurements,
  getProfile,
  updateProfile
} = require('../controllers/profileController');

router.get('/', protect, getProfile);
router.put('/update', protect, updateProfile);
router.post('/health', protect, saveHealthProfile);
router.post('/measurements', protect, saveMeasurements);
router.get('/measurements/latest', protect, getMeasurements);

module.exports = router;