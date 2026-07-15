const db = require('../config/db');
const { getFoodRecommendations, searchFood, getAllFoods } = require('../ai/foodRecommender');
const axios = require('axios');
const PYTHON_AI_URL = 'http://localhost:5001';

// NOTE: The old "Neural Network (Synaptic.js)" prediction function that
// used to live here has been removed — it was trained on 18 made-up
// examples, not real patients, and was not a genuine predictive model.
// Real PCOS prediction now happens via pcosController.saveSymptomsAndPredict
// (see routes/pcos.js -> POST /api/pcos/assessment), which calls our
// actual trained model (539 real patients, tested, compared against
// 2 other algorithms — see pcos_model_comparison/ for details).

// ALGORITHM 3 — Collaborative Filtering Food Recommendations
const getRecommendations = (req, res) => {
  const user_id = req.user.id;
  db.query('SELECT * FROM user_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
    [user_id], (err, measurements) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      db.query('SELECT diabetes, cholesterol, blood_pressure FROM users WHERE id = ?', [user_id], (err, healthProfile) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        const today = new Date().toISOString().split('T')[0];
        db.query('SELECT * FROM cycle_phases WHERE user_id = ? AND phase_date = ?', [user_id, today], (err, phaseResults) => {
          if (err) return res.status(500).json({ message: 'Database error' });
          db.query('SELECT risk_level FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
            [user_id], (err, riskResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });
              const userData = {
                bmi: parseFloat(measurements[0]?.bmi || 22),
                risk_level: riskResults[0]?.risk_level || 'Moderate',
                phase: phaseResults[0]?.phase_name || 'Follicular',
                budget: parseFloat(healthProfile[0]?.food_budget || 800),
                diabetes: healthProfile[0]?.diabetes || 'No',
                cholesterol: healthProfile[0]?.cholesterol || 'No'
              };
              const recommendations = getFoodRecommendations(userData);
              res.json({ message: 'Food recommendations generated! 🍽️', ...recommendations, user_profile: userData });
            });
        });
      });
    });
};

// SEARCH FOOD
const searchFoodItem = (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ message: 'Search query required' });
  const results = searchFood(query);
  res.json({ results, count: results.length });
};

// GET ALL FOODS
const getFoods = (req, res) => {
  const foods = getAllFoods();
  res.json({ foods, count: foods.length });
};

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
        { name: 'Collaborative Filtering (JS)', purpose: 'Food recommendations', endpoint: '/api/ai/recommendations' },
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
        const today = new Date().toISOString().split('T')[0];
        db.query('SELECT * FROM cycle_phases WHERE user_id = ? AND phase_date = ?', [user_id, today], (err, phaseResults) => {
          if (err) return res.status(500).json({ message: 'Database error' });
          db.query('SELECT risk_level FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
            [user_id], async (err, riskResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });
              try {
                const response = await axios.post(`${PYTHON_AI_URL}/recommend-foods`, {
                  bmi: parseFloat(measurements[0]?.bmi || 22),
                  risk_level: riskResults[0]?.risk_level || 'Medium',
                  phase: phaseResults[0]?.phase_name || 'Follicular',
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
        const today = new Date().toISOString().split('T')[0];
        db.query('SELECT * FROM cycle_phases WHERE user_id = ? AND phase_date = ?', [user_id, today], (err, phaseResults) => {
          if (err) return res.status(500).json({ message: 'Database error' });
          db.query('SELECT risk_level FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
            [user_id], async (err, riskResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });
              try {
                const response = await axios.post(`${PYTHON_AI_URL}/meal-plan`, {
                  bmi: parseFloat(measurements[0]?.bmi || 22),
                  risk_level: riskResults[0]?.risk_level || 'Medium',
                  phase: phaseResults[0]?.phase_name || 'Follicular',
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
  getRecommendations,
  searchFoodItem,
  getFoods,
  getFullAIAnalysis,
  getRecommendationsPython,
  getMealPlan
};