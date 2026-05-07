const db = require('../config/db');

// SAVE QUESTIONNAIRE ANSWERS + CALCULATE RISK
const saveQuestionnaire = (req, res) => {
  const user_id = req.user.id;
  const { answers } = req.body;

  if (!answers || answers.length === 0) {
    return res.status(400).json({ message: 'No answers provided' });
  }

  // Score mapping
  const scoreMap = { 'Never': 0, 'Sometimes': 1, 'Often': 2, 'Always': 3 };

  let totalScore = 0;

  // Delete old answers first
  db.query('DELETE FROM questionnaire_answers WHERE user_id = ?', [user_id], (err) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    // Insert all answers
    let inserted = 0;
    answers.forEach((item) => {
      const score = scoreMap[item.answer] || 0;
      totalScore += score;

      db.query(
        'INSERT INTO questionnaire_answers (user_id, category, question, answer, score) VALUES (?,?,?,?,?)',
        [user_id, item.category, item.question, item.answer, score],
        (err) => {
          if (err) return res.status(500).json({ message: 'Error saving answers' });
          inserted++;

          if (inserted === answers.length) {
            // Calculate risk level
            let riskLevel = '';
            if (totalScore <= 16) riskLevel = 'Low';
            else if (totalScore <= 32) riskLevel = 'Moderate';
            else riskLevel = 'High';

            // Save risk result
            db.query(
              'INSERT INTO pcos_risk (user_id, total_score, risk_level) VALUES (?,?,?)',
              [user_id, totalScore, riskLevel],
              (err) => {
                if (err) return res.status(500).json({ message: 'Error saving risk' });

                res.status(201).json({
                  message: 'Assessment complete! 🌸',
                  total_score: totalScore,
                  risk_level: riskLevel,
                  description: getRiskDescription(riskLevel)
                });
              }
            );
          }
        }
      );
    });
  });
};

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

module.exports = {
  saveQuestionnaire,
  getRiskResult,
  getAllAssessments
};