const db = require('../config/db');

// GET WEEKLY REPORT
const getWeeklyReport = (req, res) => {
  const user_id = req.user.id;

  // Get food logs for last 7 days
  db.query(
    `SELECT 
      COUNT(DISTINCT log_date) as days_logged,
      AVG(total_calories) as avg_calories,
      SUM(total_protein) as total_protein,
      SUM(total_carbs) as total_carbs,
      SUM(total_fats) as total_fats
     FROM nutrition_daily 
     WHERE user_id = ? 
     AND log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
    [user_id],
    (err, nutritionResults) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      // Get most eaten foods
      db.query(
        `SELECT food_name, COUNT(*) as count 
         FROM food_logs 
         WHERE user_id = ? 
         AND log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY food_name 
         ORDER BY count DESC 
         LIMIT 5`,
        [user_id],
        (err, topFoods) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          // Get current cycle phase
          db.query(
            'SELECT * FROM cycle_phases WHERE user_id = ? AND phase_date = CURDATE()',
            [user_id],
            (err, phaseResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });

              // Get latest risk level
              db.query(
                'SELECT risk_level FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
                [user_id],
                (err, riskResults) => {
                  if (err) return res.status(500).json({ message: 'Database error' });

                  const nutrition = nutritionResults[0];
                  const phase = phaseResults[0];

                  res.json({
                    report_type: 'weekly',
                    period: 'Last 7 days',
                    nutrition: {
                      days_logged: nutrition.days_logged || 0,
                      avg_calories: Math.round(nutrition.avg_calories || 0),
                      total_protein: Math.round(nutrition.total_protein || 0),
                      total_carbs: Math.round(nutrition.total_carbs || 0),
                      total_fats: Math.round(nutrition.total_fats || 0)
                    },
                    top_foods: topFoods,
                    current_phase: phase?.phase_name || 'Unknown',
                    risk_level: riskResults[0]?.risk_level || 'Not assessed',
                    next_week_tip: getNextWeekTip(phase?.phase_name)
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

// GET MONTHLY REPORT
const getMonthlyReport = (req, res) => {
  const user_id = req.user.id;

  db.query(
    `SELECT 
      COUNT(DISTINCT log_date) as days_logged,
      AVG(total_calories) as avg_calories
     FROM nutrition_daily 
     WHERE user_id = ? 
     AND log_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
    [user_id],
    (err, nutritionResults) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      // Get weight change
      db.query(
        `SELECT weight, recorded_at FROM user_measurements 
         WHERE user_id = ? 
         ORDER BY recorded_at DESC 
         LIMIT 2`,
        [user_id],
        (err, weightResults) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          // Get period logs this month
          db.query(
            `SELECT * FROM period_logs 
             WHERE user_id = ? 
             AND year = YEAR(CURDATE()) 
             AND month = MONTH(CURDATE())`,
            [user_id],
            (err, periodResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });

              // Get latest risk
              db.query(
                'SELECT * FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
                [user_id],
                (err, riskResults) => {
                  if (err) return res.status(500).json({ message: 'Database error' });

                  const nutrition = nutritionResults[0];
                  let weightChange = 0;

                  if (weightResults.length >= 2) {
                    weightChange = (weightResults[0].weight - weightResults[1].weight).toFixed(1);
                  }

                  res.json({
                    report_type: 'monthly',
                    period: 'Last 30 days',
                    nutrition: {
                      days_logged: nutrition.days_logged || 0,
                      avg_calories: Math.round(nutrition.avg_calories || 0)
                    },
                    weight_change: parseFloat(weightChange),
                    period_logs: periodResults,
                    risk_level: riskResults[0]?.risk_level || 'Not assessed',
                    risk_score: riskResults[0]?.total_score || 0,
                    summary: generateMonthlySummary(nutrition, weightChange, riskResults[0])
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

// Helper - Next week tip based on phase
const getNextWeekTip = (currentPhase) => {
  const tips = {
    'Menstrual': 'Next you enter follicular phase — great time to increase protein intake.',
    'Follicular': 'Next you enter ovulatory phase — focus on antioxidant-rich foods.',
    'Ovulatory': 'Next you enter luteal phase — reduce sugar and increase magnesium-rich foods.',
    'Luteal': 'Your period is approaching — stock up on iron-rich foods like spinach and dates.'
  };
  return tips[currentPhase] || 'Maintain a balanced diet and stay consistent with food logging.';
};

// Helper - Monthly summary
const generateMonthlySummary = (nutrition, weightChange, risk) => {
  let summary = '';

  if (nutrition.days_logged >= 25) {
    summary += 'Excellent consistency this month! ';
  } else if (nutrition.days_logged >= 15) {
    summary += 'Good effort this month. ';
  } else {
    summary += 'Try to log food more consistently next month. ';
  }

  if (weightChange < 0) {
    summary += `You lost ${Math.abs(weightChange)}kg this month. `;
  } else if (weightChange > 0) {
    summary += `Your weight increased by ${weightChange}kg this month. `;
  }

  if (risk?.risk_level === 'Low') {
    summary += 'Your PCOS symptoms are well managed. Keep it up!';
  } else if (risk?.risk_level === 'Moderate') {
    summary += 'Consider consulting your gynecologist for better PCOS management.';
  } else if (risk?.risk_level === 'High') {
    summary += 'Please consult your gynecologist as soon as possible.';
  }

  return summary;
};

module.exports = { getWeeklyReport, getMonthlyReport };