const db = require('../config/db');

// SAVE PERIOD HISTORY (onboarding)
const savePeriodHistory = (req, res) => {
  const user_id = req.user.id;
  const { periods, is_regular, avg_cycle_length } = req.body;

  if (!periods || periods.length === 0) {
    return res.status(400).json({ message: 'No period data provided' });
  }

  // Delete old history first
  db.query('DELETE FROM period_logs WHERE user_id = ?', [user_id], (err) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    let inserted = 0;
    periods.forEach((period) => {
      db.query(
        'INSERT INTO period_logs (user_id, month, year, duration_days, is_regular, avg_cycle_length) VALUES (?,?,?,?,?,?)',
        [user_id, period.month, period.year, period.duration_days, is_regular, avg_cycle_length],
        (err) => {
          if (err) return res.status(500).json({ message: 'Error saving period' });
          inserted++;

          if (inserted === periods.length) {
            // Detect and save cycle phases
            detectAndSavePhases(user_id, avg_cycle_length);

            res.status(201).json({
              message: 'Period history saved! 🌸',
              next_period: predictNextPeriod(periods, avg_cycle_length)
            });
          }
        }
      );
    });
  });
};

// PREDICT NEXT PERIOD
const predictNextPeriod = (periods, avgCycleLength) => {
  const sorted = periods.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const latest = sorted[0];
  const latestDate = new Date(latest.year, latest.month - 1, 1);
  latestDate.setDate(latestDate.getDate() + (avgCycleLength || 28));

  return latestDate.toISOString().split('T')[0];
};

// DETECT AND SAVE CYCLE PHASES
const detectAndSavePhases = (user_id, avgCycleLength) => {
  const today = new Date();
  const cycle = avgCycleLength || 28;

  // Generate phases for next 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfCycle = (i % cycle) + 1;

    let phaseName = '';
    if (dayOfCycle <= 5) phaseName = 'Menstrual';
    else if (dayOfCycle <= 13) phaseName = 'Follicular';
    else if (dayOfCycle <= 16) phaseName = 'Ovulatory';
    else phaseName = 'Luteal';

    const phaseDate = date.toISOString().split('T')[0];

    db.query(
      'INSERT INTO cycle_phases (user_id, phase_date, phase_name, day_of_cycle) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE phase_name=?, day_of_cycle=?',
      [user_id, phaseDate, phaseName, dayOfCycle, phaseName, dayOfCycle]
    );
  }
};

// LOG PERIOD START
const logPeriodStart = (req, res) => {
  const user_id = req.user.id;
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  db.query(
    'INSERT INTO period_logs (user_id, month, year, start_date) VALUES (?,?,?,?)',
    [user_id, month, year, today.toISOString().split('T')[0]],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error logging period' });
      res.status(201).json({ message: 'Period started logged! 🌸' });
    }
  );
};

// UPDATE PERIOD END
const logPeriodEnd = (req, res) => {
  const user_id = req.user.id;
  const { duration_days } = req.body;
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  db.query(
    'UPDATE period_logs SET duration_days=? WHERE user_id=? AND month=? AND year=? ORDER BY id DESC LIMIT 1',
    [duration_days, user_id, month, year],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error updating period' });
      res.json({ message: 'Period end logged! 🌸' });
    }
  );
};

// GET CURRENT CYCLE PHASE
const getCurrentPhase = (req, res) => {
  const user_id = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  db.query(
    'SELECT * FROM cycle_phases WHERE user_id = ? AND phase_date = ?',
    [user_id, today],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      if (results.length === 0) {
        return res.json({
          phase_name: 'Unknown',
          day_of_cycle: 0,
          message: 'No cycle data found. Please log your period history.'
        });
      }

      const phase = results[0];
      res.json({
        ...phase,
        nutrition_tip: getNutritionTip(phase.phase_name)
      });
    }
  );
};

// GET PERIOD HISTORY
const getPeriodHistory = (req, res) => {
  const user_id = req.user.id;

  db.query(
    'SELECT * FROM period_logs WHERE user_id = ? ORDER BY year DESC, month DESC',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// Nutrition tip by phase
const getNutritionTip = (phase) => {
  const tips = {
    'Menstrual': 'Focus on iron-rich foods like spinach, lentils, and dates to replenish blood loss.',
    'Follicular': 'Eat protein-rich foods like eggs, legumes, and nuts to support follicle growth.',
    'Ovulatory': 'Include antioxidant-rich foods like berries, leafy greens, and avocado.',
    'Luteal': 'Reduce sugar and caffeine. Eat magnesium-rich foods like dark chocolate and nuts.'
  };
  return tips[phase] || 'Maintain a balanced diet with whole foods.';
};

module.exports = {
  savePeriodHistory,
  logPeriodStart,
  logPeriodEnd,
  getCurrentPhase,
  getPeriodHistory
};