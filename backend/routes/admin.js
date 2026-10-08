const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/adminAuth');
const ctrl = require('../controllers/adminController');

router.post('/login', ctrl.login);

// All of the following are read-only aggregate endpoints behind adminAuth.
router.get('/summary', adminAuth, ctrl.getSummary);
router.get('/risk-distribution', adminAuth, ctrl.getRiskDistribution);
router.get('/timeseries', adminAuth, ctrl.getTimeseries);
router.get('/cycle-regularity', adminAuth, ctrl.getCycleRegularity);
router.get('/top-foods', adminAuth, ctrl.getTopFoods);
router.get('/health-conditions', adminAuth, ctrl.getHealthConditions);
router.get('/languages', adminAuth, ctrl.getLanguages);
router.get('/feature-usage', adminAuth, ctrl.getFeatureUsage);
router.get('/model-evaluation', adminAuth, ctrl.getModelEvaluation);

module.exports = router;
