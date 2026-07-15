const db = require('../config/db');
const axios = require('axios');

const PYTHON_AI_URL = 'http://localhost:5001';

// NOTE: the old saveQuestionnaire() function that lived here has been
// removed — it was a simple point-counting system (Never=0...Always=3,
// total <=16 = Low etc.), not real machine learning, and used a
// different question set than the one the real model was trained on.
// Real assessment now happens via saveSymptomsAndPredict() below
// (POST /api/pcos/assessment), which calls the actual trained model.

// Risk description helper
const getRiskDescription = (level) => {
  if (level === 'Low') return 'Your symptoms suggest a low risk of PCOS. Keep maintaining a healthy lifestyle!';
  if (level === 'Moderate') return 'Your symptoms suggest moderate signs of PCOS. We recommend consulting a gynecologist.';
  return 'Your symptoms suggest high signs of PCOS. Please consult a gynecologist as soon as possible.';
};

// GET LATEST RISK RESULT
const getRiskResult = (req, res) => {
  const user_id = req.user.id;

  db.query(
    'SELECT * FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (results.length === 0) return res.status(404).json({ message: 'No assessment found' });

      const result = results[0];
      res.json({
        ...result,
        description: getRiskDescription(result.risk_level)
      });
    }
  );
};

// GET ALL PAST ASSESSMENTS
const getAllAssessments = (req, res) => {
  const user_id = req.user.id;

  db.query(
    'SELECT * FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// ============================================
// NEW — REAL SYMPTOM-BASED ASSESSMENT (Phase 2)
// Uses the actual trained Logistic Regression model
// (539 real patients) instead of point-counting.
// ============================================

const calculateAge = (dob) => {
  if (!dob) return 25;
  const diffMs = new Date() - new Date(dob);
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
};

const saveSymptomsAndPredict = (req, res) => {
  const user_id = req.user.id;
  const {
    cycle_regularity,
    period_duration_days,
    weight_gain,
    hair_growth,
    skin_darkening,
    hair_loss,
    pimples,
    fast_food,
    regular_exercise,
  } = req.body;

  if (!cycle_regularity || period_duration_days === undefined) {
    return res.status(400).json({ message: 'Please answer all questions before submitting' });
  }

  db.query('SELECT date_of_birth FROM users WHERE id = ?', [user_id], (err, userResults) => {
    if (err) return res.status(500).json({ message: 'Database error', error: err.message });

    db.query(
      'SELECT weight, height FROM user_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
      [user_id],
      (err, measurements) => {
        if (err) return res.status(500).json({ message: 'Database error', error: err.message });

        if (!measurements[0]) {
          return res.status(400).json({
            message: 'Please complete your weight & height in the BMI step before taking this assessment.'
          });
        }

        const age = calculateAge(userResults[0]?.date_of_birth);
        const weight_kg = parseFloat(measurements[0].weight);
        const height_cm = parseFloat(measurements[0].height);

        db.query('DELETE FROM pcos_symptoms WHERE user_id = ?', [user_id], (err) => {
          if (err) return res.status(500).json({ message: 'Database error', error: err.message });

          db.query(
            `INSERT INTO pcos_symptoms
              (user_id, cycle_regularity, period_duration_days, weight_gain, hair_growth,
               skin_darkening, hair_loss, pimples, fast_food, regular_exercise)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, cycle_regularity, period_duration_days, !!weight_gain, !!hair_growth,
             !!skin_darkening, !!hair_loss, !!pimples, !!fast_food, !!regular_exercise],
            async (err) => {
              if (err) return res.status(500).json({ message: 'Database error', error: err.message });

              try {
                const response = await axios.post(`${PYTHON_AI_URL}/predict-pcos`, {
                  age,
                  weight_kg,
                  height_cm,
                  cycle_regularity,
                  period_duration_days,
                  weight_gain: !!weight_gain,
                  hair_growth: !!hair_growth,
                  skin_darkening: !!skin_darkening,
                  hair_loss: !!hair_loss,
                  pimples: !!pimples,
                  fast_food: !!fast_food,
                  regular_exercise: !!regular_exercise,
                });

                const result = response.data;

                db.query(
                  'INSERT INTO pcos_risk (user_id, total_score, risk_level, pcos_probability_percent) VALUES (?,?,?,?)',
                  [user_id, null, result.risk_level, result.pcos_probability_percent],
                  (err) => {
                    if (err) console.error('Error saving risk result:', err.message);
                  }
                );

                res.status(201).json({
                  message: 'Assessment complete! 🌸',
                  risk_level: result.risk_level,
                  pcos_probability_percent: result.pcos_probability_percent,
                  pcos_detected: result.pcos_detected,
                  top_contributing_factors: result.top_contributing_factors,
                  description: getRiskDescription(result.risk_level),
                  disclaimer: result.disclaimer,
                  // TEMPORARY DEBUG FIELD — remove once the probability
                  // discrepancy is diagnosed. Shows exactly what was sent
                  // to the Python model for this prediction.
                  _debug_input_used: {
                    age, weight_kg, height_cm, cycle_regularity, period_duration_days,
                    weight_gain: !!weight_gain, hair_growth: !!hair_growth,
                    skin_darkening: !!skin_darkening, hair_loss: !!hair_loss,
                    pimples: !!pimples, fast_food: !!fast_food,
                    regular_exercise: !!regular_exercise,
                  },
                });
              } catch (err) {
                console.error('Python AI service error:', err.message);
                res.status(500).json({ message: 'Could not reach the prediction service', error: err.message });
              }
            }
          );
        });
      }
    );
  });
};

module.exports = {
  getRiskResult,
  getAllAssessments,
  saveSymptomsAndPredict
};