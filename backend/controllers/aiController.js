const db = require('../config/db');
const axios = require('axios');
const { computeCycleStats, computePhase } = require('../utils/cycleCalculations');
const PYTHON_AI_URL = 'http://localhost:5001';

// NOTE: The old "Neural Network (Synaptic.js)" prediction function that
// used to live here has been removed — it was trained on 18 made-up
// examples, not real patients, and was not a genuine predictive model.
// Real PCOS prediction now happens via pcosController.saveSymptomsAndPredict
// (see routes/pcos.js -> POST /api/pcos/assessment), which calls our
// actual trained model (539 real patients, tested, compared against
// 2 other algorithms — see pcos_model_comparison/ for details).
//
// The old JS collaborative-filtering food recommendation functions
// (getRecommendations/searchFoodItem/getFoods, over a hardcoded 29-food
// list in ../ai/foodRecommender) have also been removed — never called
// by the frontend, fully superseded by the real Python content-based +
// KNN engine over the live 83-food MySQL database.

// COMBINED AI ANALYSIS
const getFullAIAnalysis = (req, res) => {
  const user_id = req.user.id;
  db.query('SELECT full_name FROM users WHERE id = ?', [user_id], (err, userResults) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    const userName = userResults[0]?.full_name?.split(' ')[0] || 'there';
    res.json({
      message: `${userName}'s AI Analysis is ready! 🌸`,
      algorithms_used: [
        { name: 'Rule-Based Expert System', purpose: 'Daily personalized nutrition tips', endpoint: '/api/tips/generate' },
        { name: 'Logistic Regression (Python, real trained model)', purpose: 'PCOS Risk Prediction', endpoint: '/api/pcos/assessment' },
        { name: 'Content-Based Filtering + KNN (Python)', purpose: 'Personalized food recommendations', endpoint: '/api/ai/python/recommendations' },
        { name: 'Content-Based Filtering (Python)', purpose: 'Personalized meal planning', endpoint: '/api/ai/python/meal-plan' },
      ],
      note: 'All models are now live.'
    });
  });
};

// NOTE: the old predictRiskPython() function that lived here has been
// removed — it sent the wrong data shape (menstrual_score/hormonal_score
// left over from the old fake Neural Network) to the real model. The
// correct version now lives in pcosController.saveSymptomsAndPredict
// (POST /api/pcos/assessment), which sends the real 13-symptom shape
// the model was actually trained on.

// PYTHON AI — Food Recommendations (Model 2, now live)
const getRecommendationsPython = async (req, res) => {
  const user_id = req.user.id;
  db.query('SELECT * FROM user_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
    [user_id], (err, measurements) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      db.query('SELECT diabetes, cholesterol, blood_pressure FROM users WHERE id = ?', [user_id], (err, healthProfile) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        // Cycle phase derived live from period_logs. The cycle_phases
        // table is never written to anywhere in this codebase, so reading
        // it always produced nothing and every user fell through to the
        // 'Follicular' default. Same source and helpers tipsController
        // and periodController use, so all three agree.
        db.query(
          `SELECT * FROM period_logs
           WHERE user_id = ? AND deleted_at IS NULL AND start_date IS NOT NULL
           ORDER BY start_date ASC`,
          [user_id],
          (err, periodRows) => {
          if (err) return res.status(500).json({ message: 'Database error' });
          const phaseName = periodRows.length
            ? computePhase(computeCycleStats(periodRows)).phaseName
            : 'Follicular';
          db.query('SELECT risk_level FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
            [user_id], async (err, riskResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });
              try {
                const response = await axios.post(`${PYTHON_AI_URL}/recommend-foods`, {
                  bmi: parseFloat(measurements[0]?.bmi || 22),
                  risk_level: riskResults[0]?.risk_level || 'Medium',
                  phase: phaseName,
                  // Pass the real severity level through (None /
                  // Pre-diabetic / Diet-controlled / Insulin-dependent)
                  // instead of collapsing it to a Yes/No boolean.
                  diabetes: healthProfile[0]?.diabetes || 'None',
                  cholesterol: healthProfile[0]?.cholesterol === 'Yes'
                });
                res.json({ message: 'Food recommendations ready! 🍽️', ...response.data });
              } catch (err) {
                res.status(500).json({ message: 'Python AI service error', error: err.message });
              }
            });
        });
      });
    });
};

// PYTHON AI — Meal Plan (Model 2, now live)
const getMealPlan = async (req, res) => {
  const user_id = req.user.id;
  db.query('SELECT * FROM user_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
    [user_id], (err, measurements) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      db.query('SELECT diabetes, cholesterol, blood_pressure FROM users WHERE id = ?', [user_id], (err, healthProfile) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        // Cycle phase derived live from period_logs. The cycle_phases
        // table is never written to anywhere in this codebase, so reading
        // it always produced nothing and every user fell through to the
        // 'Follicular' default. Same source and helpers tipsController
        // and periodController use, so all three agree.
        db.query(
          `SELECT * FROM period_logs
           WHERE user_id = ? AND deleted_at IS NULL AND start_date IS NOT NULL
           ORDER BY start_date ASC`,
          [user_id],
          (err, periodRows) => {
          if (err) return res.status(500).json({ message: 'Database error' });
          const phaseName = periodRows.length
            ? computePhase(computeCycleStats(periodRows)).phaseName
            : 'Follicular';
          db.query('SELECT risk_level FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
            [user_id], async (err, riskResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });
              try {
                const response = await axios.post(`${PYTHON_AI_URL}/meal-plan`, {
                  bmi: parseFloat(measurements[0]?.bmi || 22),
                  risk_level: riskResults[0]?.risk_level || 'Medium',
                  phase: phaseName,
                  diabetes: healthProfile[0]?.diabetes || 'None',
                  cholesterol: healthProfile[0]?.cholesterol === 'Yes'
                });
                res.json({ message: 'Daily meal plan generated! 🍛', ...response.data });
              } catch (err) {
                res.status(500).json({ message: 'Python AI service error', error: err.message });
              }
            });
        });
      });
    });
};

module.exports = {
  getFullAIAnalysis,
  getRecommendationsPython,
  getMealPlan
};