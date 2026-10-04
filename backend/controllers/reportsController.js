const db = require('../config/db');
const C = require('../utils/cycleCalculations');

function fetchActiveEntries(user_id, callback) {
  db.query(
    'SELECT * FROM period_logs WHERE user_id = ? AND deleted_at IS NULL AND start_date IS NOT NULL ORDER BY start_date ASC',
    [user_id],
    callback
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
                  // 5. Cycle data — phase, regularity, periods within the report window
                  fetchActiveEntries(user_id, (err, entries) => {
                    if (err) return res.status(500).json({ message: 'Database error' });

                    const stats = C.computeCycleStats(entries || []);
                    const phase = C.computePhase(stats);
                    const regularity = C.regularityStatus(stats);

                    const windowStart = new Date();
                    windowStart.setDate(windowStart.getDate() - days);
                    const periodsInWindow = (entries || [])
                      .filter((e) => C.toDate(e.start_date) >= windowStart)
                      .map((e) => ({
                        start_date: C.isoDate(e.start_date),
                        end_date: e.end_date ? C.isoDate(e.end_date) : null,
                        duration_days: e.duration_days,
                      }));

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
                        cycleLength: stats.avgInterval ? `${stats.avgInterval}d` : '—',
                        healthScore: String(healthScore)
                      },
                      cycleSummary: {
                        periodsInWindow,
                        avgIntervalDays: stats.avgInterval,
                        varianceDays: stats.varianceDays,
                        regularityStatus: regularity.status,
                        regularityMessage: regularity.message,
                        currentPhase: phase.phaseName,
                        cyclesLoggedLast12Months: stats.cyclesLoggedLast12Months,
                      },
                      topFoods: topFoods.length > 0 ? topFoods : [],
                      symptoms: symptoms.length > 0 ? symptoms : [{ label: 'No symptoms logged', type: 'purple' }],
                      nextWeekTip: phase.phaseName === 'Unknown' ? 'Log your period to get a personalized tip.' : C.getNextPhaseTip(phase.phaseName),
                      riskLevel: riskResults[0]?.risk_level || 'Not assessed',
                      currentPhase: phase.phaseName
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
