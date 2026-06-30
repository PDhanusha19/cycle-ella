const db = require('../config/db');

// ── Helpers ───────────────────────────────────────────
function getPhaseFromDay(dayOfCycle) {
  if (dayOfCycle <= 5) return 'Menstrual';
  if (dayOfCycle <= 13) return 'Follicular';
  if (dayOfCycle <= 16) return 'Ovulatory';
  return 'Luteal';
}

function getNextWeekTip(currentPhase) {
  const tips = {
    'Menstrual': "Next you'll enter the follicular phase — a great time to increase protein intake and start light exercise.",
    'Follicular': "Next you'll enter the ovulatory phase — focus on antioxidant-rich foods like berries and leafy greens.",
    'Ovulatory': "Next you'll enter the luteal phase — reduce sugar and increase magnesium-rich foods to ease PMS.",
    'Luteal': "Your period is approaching — stock up on iron-rich foods like spinach, dates, and lentils."
  };
  return tips[currentPhase] || 'Maintain a balanced diet and stay consistent with food logging.';
}

function getCurrentPhaseInfo(user_id, callback) {
  db.query(
    'SELECT * FROM period_logs WHERE user_id = ? AND start_date IS NOT NULL ORDER BY start_date DESC LIMIT 1',
    [user_id],
    (err, results) => {
      if (err || results.length === 0) return callback(null, null);
      const latest = results[0];
      const avgCycle = latest.avg_cycle_length || 28;
      const startDate = new Date(latest.start_date);
      const today = new Date();
      const daysSince = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      let dayOfCycle = (daysSince % avgCycle) + 1;
      if (dayOfCycle < 1) dayOfCycle = 1;
      const phaseName = getPhaseFromDay(dayOfCycle);
      callback(phaseName, avgCycle);
    }
  );
}

function buildReport(user_id, days, totalDaysLabel, res) {
  // 1. Nutrition summary
  db.query(
    `SELECT 
      COUNT(DISTINCT log_date) as days_logged,
      AVG(calories) as avg_calories
     FROM food_logs 
     WHERE user_id = ? AND log_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [user_id, days],
    (err, nutritionResults) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      // 2. Top foods
      db.query(
        `SELECT food_name, COUNT(*) as count 
         FROM food_logs 
         WHERE user_id = ? AND log_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY food_name ORDER BY count DESC LIMIT 5`,
        [user_id, days],
        (err, topFoodsRaw) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          // 3. Symptoms
          db.query(
            `SELECT symptoms FROM period_symptoms 
             WHERE user_id = ? AND log_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
            [user_id, days],
            (err, symptomRows) => {
              if (err) return res.status(500).json({ message: 'Database error' });

              // 4. Risk level
              db.query(
                'SELECT risk_level FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
                [user_id],
                (err, riskResults) => {
                  // 5. Phase + cycle (dynamic, no cycle_phases table)
                  getCurrentPhaseInfo(user_id, (phaseName, avgCycle) => {
                    const nutrition = nutritionResults[0];
                    const daysLogged = nutrition.days_logged || 0;
                    const avgCalories = Math.round(nutrition.avg_calories || 0);

                    const maxCount = topFoodsRaw.length > 0 ? topFoodsRaw[0].count : 1;
                    const topFoods = topFoodsRaw.map(f => ({
                      emoji: '🍽️',
                      name: f.food_name,
                      freq: f.count,
                      pct: Math.round((f.count / maxCount) * 100)
                    }));

                    const symptomCounts = {};
                    symptomRows.forEach(row => {
                      (row.symptoms || '').split(',').filter(Boolean).forEach(sym => {
                        symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
                      });
                    });
                    const symptomTypes = ['pink', 'purple', 'amber'];
                    const symptoms = Object.entries(symptomCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([label, count], i) => ({
                        label: `${label} × ${count}`,
                        type: symptomTypes[i % symptomTypes.length]
                      }));

                    let healthScore = 50;
                    healthScore += Math.min(25, Math.round((daysLogged / days) * 25));
                    if (avgCalories >= 1200 && avgCalories <= 2200) healthScore += 15;
                    if (riskResults[0]?.risk_level === 'Low') healthScore += 10;
                    healthScore = Math.min(100, Math.max(0, healthScore));

                    res.json({
                      stats: {
                        daysLogged: `${daysLogged}/${totalDaysLabel}`,
                        avgCalories: avgCalories.toLocaleString(),
                        cycleLength: avgCycle ? `${avgCycle}d` : '—',
                        healthScore: String(healthScore)
                      },
                      topFoods: topFoods.length > 0 ? topFoods : [],
                      symptoms: symptoms.length > 0 ? symptoms : [{ label: 'No symptoms logged', type: 'purple' }],
                      nextWeekTip: getNextWeekTip(phaseName),
                      riskLevel: riskResults[0]?.risk_level || 'Not assessed',
                      currentPhase: phaseName || 'Unknown'
                    });
                  });
                }
              );
            }
          );
        }
      );
    }
  );
}

// ── GET WEEKLY REPORT ─────────────────────────────────
const getWeeklyReport = (req, res) => {
  const user_id = req.user.id;
  buildReport(user_id, 7, '7', res);
};

// ── GET MONTHLY REPORT ────────────────────────────────
const getMonthlyReport = (req, res) => {
  const user_id = req.user.id;
  buildReport(user_id, 30, '30', res);
};

module.exports = { getWeeklyReport, getMonthlyReport };