const db = require('../config/db');
const { predictPCOSRisk } = require('../ai/pcosPredictor');
const { getFoodRecommendations, searchFood, getAllFoods } = require('../ai/foodRecommender');

// ALGORITHM 2 — Neural Network PCOS Prediction
const predictRisk = (req, res) => {
  const user_id = req.user.id;

  // Get user data from DB
  db.query(
    'SELECT * FROM user_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
    [user_id],
    (err, measurements) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      // Get questionnaire scores by category
      db.query(
        `SELECT category, SUM(score) as category_score 
         FROM questionnaire_answers 
         WHERE user_id = ? 
         GROUP BY category`,
        [user_id],
        (err, scores) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          // Get user age
          db.query(
            'SELECT date_of_birth FROM users WHERE id = ?',
            [user_id],
            (err, userResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });

              const bmi = measurements[0]?.bmi || 22;
              const dob = userResults[0]?.date_of_birth;
              const age = dob
                ? Math.floor((new Date() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000))
                : 25;

              // Map category scores
              const scoreMap = {};
              scores.forEach(s => {
                scoreMap[s.category] = s.category_score;
              });

              const userData = {
                bmi: parseFloat(bmi),
                menstrual_score: scoreMap['Menstrual Symptoms'] || 0,
                hormonal_score: scoreMap['Hormonal Symptoms'] || 0,
                physical_score: scoreMap['Physical Symptoms'] || 0,
                lifestyle_score: scoreMap['Lifestyle & Mental Health'] || 0,
                age
              };

              // Run neural network prediction
              const prediction = predictPCOSRisk(userData);

              if (!prediction) {
                return res.status(500).json({ message: 'Prediction failed' });
              }

              // Save to database
              db.query(
                'INSERT INTO pcos_risk (user_id, total_score, risk_level) VALUES (?,?,?)',
                [user_id, Object.values(scoreMap).reduce((a, b) => a + b, 0), prediction.risk_level],
                (err) => {
                  if (err) console.error('Error saving prediction');
                }
              );

              res.json({
                message: 'PCOS Risk predicted using Neural Network! 🧠',
                prediction,
                input_data: userData
              });
            }
          );
        }
      );
    }
  );
};

// ALGORITHM 3 — Collaborative Filtering Food Recommendations
const getRecommendations = (req, res) => {
  const user_id = req.user.id;

  // Get user data
  db.query(
    'SELECT * FROM user_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
    [user_id],
    (err, measurements) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      db.query(
        'SELECT * FROM user_health_profile WHERE user_id = ?',
        [user_id],
        (err, healthProfile) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          const today = new Date().toISOString().split('T')[0];
          db.query(
            'SELECT * FROM cycle_phases WHERE user_id = ? AND phase_date = ?',
            [user_id, today],
            (err, phaseResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });

              db.query(
                'SELECT risk_level FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
                [user_id],
                (err, riskResults) => {
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

                  res.json({
                    message: 'Food recommendations generated! 🍽️',
                    ...recommendations,
                    user_profile: userData
                  });
                }
              );
            }
          );
        }
      );
    }
  );
};

// SEARCH FOOD
const searchFoodItem = (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ message: 'Search query required' });
  }

  const results = searchFood(query);
  res.json({
    results,
    count: results.length
  });
};

// GET ALL FOODS
const getFoods = (req, res) => {
  const foods = getAllFoods();
  res.json({
    foods,
    count: foods.length
  });
};

// COMBINED AI ANALYSIS
const getFullAIAnalysis = (req, res) => {
  const user_id = req.user.id;

  db.query(
    'SELECT full_name FROM users WHERE id = ?',
    [user_id],
    (err, userResults) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      const userName = userResults[0]?.full_name?.split(' ')[0] || 'there';

      res.json({
        message: `${userName}'s AI Analysis is ready! 🌸`,
        algorithms_used: [
          {
            name: 'Rule-Based Expert System',
            purpose: 'Daily personalized nutrition tips',
            endpoint: '/api/tips/generate'
          },
          {
            name: 'Neural Network (Synaptic.js)',
            purpose: 'PCOS Risk Prediction with confidence score',
            endpoint: '/api/ai/predict-risk'
          },
          {
            name: 'Collaborative Filtering',
            purpose: 'Food recommendations based on similar users',
            endpoint: '/api/ai/recommendations'
          }
        ]
      });
    }
  );
};

module.exports = {
  predictRisk,
  getRecommendations,
  searchFoodItem,
  getFoods,
  getFullAIAnalysis
};