const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getAllDoctors,
  searchDoctors,
  getDoctorById,
  getDistricts,
  seedDoctors
} = require('../controllers/gynoController');

// Get all doctors (filter by district)
router.get('/', protect, getAllDoctors);

// Search doctors
router.get('/search', protect, searchDoctors);

// Get all districts
router.get('/districts', protect, getDistricts);

// Get doctor by id
router.get('/:id', protect, getDoctorById);

// Seed doctors data
router.post('/seed', protect, seedDoctors);

module.exports = router;