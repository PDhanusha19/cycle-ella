const db = require('../config/db');

// ── Helpers ───────────────────────────────────────────
function getPhaseFromDay(dayOfCycle) {
  if (dayOfCycle <= 5) return 'Menstrual';
  if (dayOfCycle <= 13) return 'Follicular';
  if (dayOfCycle <= 16) return 'Ovulatory';
  return 'Luteal';
}

function getNutritionTip(phase) {
  const tips = {
    'Menstrual': 'Focus on iron-rich foods like spinach, lentils, and dates to replenish blood loss.',
    'Follicular': 'Eat protein-rich foods like eggs, legumes, and nuts to support follicle growth.',
    'Ovulatory': 'Include antioxidant-rich foods like berries, leafy greens, and avocado.',
    'Luteal': 'Reduce sugar and caffeine. Eat magnesium-rich foods like dark chocolate and nuts.'
  };
  return tips[phase] || 'Maintain a balanced diet with whole foods.';
}

// Computes Regular/Irregular status from a list of period start dates.
// Shared by getRegularity (ongoing tracking) and savePeriodHistory
// (onboarding, when the user gave exact dates) so both use the exact
// same clinical rule instead of two different implementations drifting apart.
function computeRegularity(startDates) {
  const sorted = [...startDates].sort((a, b) => new Date(a) - new Date(b));

  if (sorted.length < 2) {
    return {
      status: 'Not enough data',
      message: 'Log at least 2 periods to detect your cycle pattern',
      cycleLengths: [],
      avgCycle: null,
      variance: null
    };
  }

  // Calculate gap (in days) between each consecutive period start
  const cycleLengths = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const gap = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (gap > 0 && gap < 90) cycleLengths.push(gap); // ignore bad data
  }

  if (cycleLengths.length === 0) {
    return {
      status: 'Not enough data',
      message: 'Log at least 2 valid periods to detect your cycle pattern',
      cycleLengths: [],
      avgCycle: null,
      variance: null
    };
  }

  const avgCycle = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);

  // Variance = max deviation between any two cycle lengths
  const maxLen = Math.max(...cycleLengths);
  const minLen = Math.min(...cycleLengths);
  const variance = maxLen - minLen;

  // Clinical guideline: a "normal" cycle is 21-35 days.
  // If avg is outside that range OR variance between cycles > 9 days → Irregular
  const outOfNormalRange = avgCycle < 21 || avgCycle > 35;
  const highVariance = variance > 9;
  const isIrregular = outOfNormalRange || highVariance;

  let message;
  if (isIrregular && outOfNormalRange) {
    message = `Your average cycle (${avgCycle} days) is outside the typical 21-35 day range. This pattern is often seen in PCOS — consider discussing with a gynecologist.`;
  } else if (isIrregular && highVariance) {
    message = `Your cycle length varies by ${variance} days between periods. Irregular cycles are a common PCOS symptom — worth tracking and discussing with a doctor.`;
  } else {
    message = `Your cycles are fairly consistent (${avgCycle} days on average, varying by ${variance} days). Keep tracking to monitor any changes.`;
  }

  return {
    status: isIrregular ? 'Irregular' : 'Regular',
    message,
    cycleLengths,
    avgCycle,
    variance
  };
}

function getOverlapDays(startDateStr, duration, year, month) {
  const days = [];
  const start = new Date(startDateStr);
  for (let i = 0; i < (duration || 5); i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      days.push(d.getDate());
    }
  }
  return days;
}

// ── SAVE PERIOD HISTORY (onboarding) ─────────────────
// `periods[i].day` (1-31) is optional — the exact day the user
// remembers that period starting. When given, we can compute real
// regularity right away; when omitted, that entry is stored as an
// estimate (first-of-month) and excluded from the regularity math
// (see computeRegularity / getRegularity) rather than faking precision.
const savePeriodHistory = (req, res) => {
  const user_id = req.user.id;
  const { periods, avg_cycle_length } = req.body || {};

  if (!periods || periods.length === 0) {
    return res.status(400).json({ message: 'No period data provided' });
  }

  const prepared = periods.map((period) => {
    const day = Number.isInteger(period.day) && period.day >= 1 && period.day <= 31 ? period.day : null;
    const isEstimated = day === null;
    const startDate = `${period.year}-${String(period.month).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}`;
    return { ...period, startDate, isEstimated };
  });

  const preciseDates = prepared.filter(p => !p.isEstimated).map(p => p.startDate);
  const regularity = computeRegularity(preciseDates);
  const resolvedAvgCycle = regularity.avgCycle || avg_cycle_length || 28;

  db.query('DELETE FROM period_logs WHERE user_id = ?', [user_id], (err) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    let inserted = 0;
    prepared.forEach((period) => {
      db.query(
        'INSERT INTO period_logs (user_id, month, year, duration_days, avg_cycle_length, start_date, is_estimated) VALUES (?,?,?,?,?,?,?)',
        [user_id, period.month, period.year, period.duration_days, resolvedAvgCycle, period.startDate, period.isEstimated],
        (err) => {
          if (err) return res.status(500).json({ message: 'Error saving period' });
          inserted++;

          if (inserted === prepared.length) {
            res.status(201).json({
              message: 'Period history saved! 🌸',
              next_period: predictNextPeriod(periods, resolvedAvgCycle),
              regularity_status: regularity
            });
          }
        }
      );
    });
  });
};

function predictNextPeriod(periods, avgCycleLength) {
  const sorted = [...periods].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
  const latest = sorted[0];
  const latestDate = new Date(latest.year, latest.month - 1, 1);
  latestDate.setDate(latestDate.getDate() + (avgCycleLength || 28));
  return latestDate.toISOString().split('T')[0];
}

// ── LOG PERIOD START (also accepts custom date + duration) ──
const logPeriodStart = (req, res) => {
  const user_id = req.user.id;
  const { start_date, duration_days } = req.body || {};
  const dateToUse = start_date || new Date().toISOString().split('T')[0];
  const dateObj = new Date(dateToUse);
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();

  db.query(
    'SELECT avg_cycle_length FROM period_logs WHERE user_id = ? ORDER BY start_date DESC LIMIT 1',
    [user_id],
    (err, prevResults) => {
      const avgCycle = prevResults?.[0]?.avg_cycle_length || 28;

      db.query(
        'INSERT INTO period_logs (user_id, month, year, start_date, duration_days, avg_cycle_length, is_regular) VALUES (?,?,?,?,?,?,?)',
        [user_id, month, year, dateToUse, duration_days || 5, avgCycle, 1],
        (err, result) => {
          if (err) return res.status(500).json({ message: 'Error logging period' });
          res.status(201).json({ message: 'Period logged! 🌸', id: result.insertId });
        }
      );
    }
  );
};

// ── LOG PERIOD END (calculates real duration from today) ──
const logPeriodEnd = (req, res) => {
  const user_id = req.user.id;
  const { duration_days, end_date } = req.body || {};

  // If duration_days passed explicitly, use it. Otherwise calculate from start_date to today/end_date.
  db.query(
    'SELECT start_date FROM period_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      if (results.length === 0) {
        return res.status(400).json({ message: 'No period found to end. Please start a period first.' });
      }

      let finalDuration = duration_days;

      if (!finalDuration && results[0].start_date) {
        const start = new Date(results[0].start_date);
        const end = end_date ? new Date(end_date) : new Date();
        finalDuration = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
      }

      finalDuration = finalDuration || 5;

      db.query(
        'UPDATE period_logs SET duration_days=? WHERE user_id=? ORDER BY id DESC LIMIT 1',
        [finalDuration, user_id],
        (err) => {
          if (err) return res.status(500).json({ message: 'Error updating period' });
          res.json({ message: 'Period end logged! 🌸', duration_days: finalDuration });
        }
      );
    }
  );
};

// ── GET CURRENT CYCLE PHASE (calculated dynamically) ──
const getCurrentPhase = (req, res) => {
  const user_id = req.user.id;

  db.query(
    'SELECT * FROM period_logs WHERE user_id = ? AND start_date IS NOT NULL ORDER BY start_date DESC LIMIT 1',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      if (results.length === 0) {
        return res.json({
          phase_name: 'Unknown',
          day_of_cycle: 0,
          message: 'No cycle data found. Please log your period history.'
        });
      }

      const latest = results[0];
      const avgCycle = latest.avg_cycle_length || 28;
      const startDate = new Date(latest.start_date);
      const today = new Date();

      const daysSince = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      let dayOfCycle = (daysSince % avgCycle) + 1;
      if (dayOfCycle < 1) dayOfCycle = 1;

      const phaseName = getPhaseFromDay(dayOfCycle);

      res.json({
        phase_name: phaseName,
        day_of_cycle: dayOfCycle,
        nutrition_tip: getNutritionTip(phaseName)
      });
    }
  );
};

// ── GET PERIOD HISTORY (raw list) ─────────────────────
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

// ── GET CALENDAR DAYS for a specific month/year ───────
const getPeriodCalendar = (req, res) => {
  const user_id = req.user.id;
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

  db.query(
    'SELECT * FROM period_logs WHERE user_id = ? AND start_date IS NOT NULL ORDER BY start_date ASC',
    [user_id],
    (err, logs) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      let periodDays = [];
      logs.forEach(log => {
        periodDays.push(...getOverlapDays(log.start_date, log.duration_days, year, month));
      });

      let predictedDays = [];
      if (logs.length > 0) {
        const last = logs[logs.length - 1];
        const avgCycle = last.avg_cycle_length || 28;

        for (let i = 1; i <= 8; i++) {
          const nextStart = new Date(last.start_date);
          nextStart.setDate(nextStart.getDate() + avgCycle * i);
          const overlap = getOverlapDays(
            nextStart.toISOString().split('T')[0],
            last.duration_days || 5,
            year, month
          );
          overlap.forEach(d => {
            if (!periodDays.includes(d) && !predictedDays.includes(d)) {
              predictedDays.push(d);
            }
          });
        }
      }

      res.json({
        periodDays: [...new Set(periodDays)],
        predictedDays: [...new Set(predictedDays)],
      });
    }
  );
};

// ── GET PREDICTIONS (next period, ovulation, avg cycle) ──
const getPredictions = (req, res) => {
  const user_id = req.user.id;

  db.query(
    'SELECT * FROM period_logs WHERE user_id = ? AND start_date IS NOT NULL ORDER BY start_date DESC LIMIT 1',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      if (results.length === 0) {
        return res.json({
          nextPeriod: 'No data yet',
          ovulationWindow: 'No data yet',
          avgCycle: '28d'
        });
      }

      const latest = results[0];
      const avgCycle = latest.avg_cycle_length || 28;
      const today = new Date();

      let nextPeriod = new Date(latest.start_date);
      while (nextPeriod <= today) {
        nextPeriod.setDate(nextPeriod.getDate() + avgCycle);
      }

      const ovulationStart = new Date(nextPeriod);
      ovulationStart.setDate(ovulationStart.getDate() - (avgCycle - 14));
      const ovulationEnd = new Date(ovulationStart);
      ovulationEnd.setDate(ovulationEnd.getDate() + 2);

      const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      res.json({
        nextPeriod: fmt(nextPeriod),
        nextPeriodDate: nextPeriod.toISOString().split('T')[0],
        ovulationWindow: `${ovulationStart.getDate()}–${ovulationEnd.getDate()}`,
        avgCycle: `${avgCycle}d`
      });
    }
  );
};

// ── SAVE TODAY'S SYMPTOMS ─────────────────────────────
const logSymptoms = (req, res) => {
  const user_id = req.user.id;
  const { symptoms, log_date } = req.body || {};
  const date = log_date || new Date().toISOString().split('T')[0];
  const symptomsStr = Array.isArray(symptoms) ? symptoms.join(',') : (symptoms || '');

  db.query(
    `INSERT INTO period_symptoms (user_id, log_date, symptoms) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE symptoms = ?`,
    [user_id, date, symptomsStr, symptomsStr],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error saving symptoms' });
      res.json({ message: 'Symptoms saved! 🌸' });
    }
  );
};

// ── GET TODAY'S SYMPTOMS ──────────────────────────────
const getTodaySymptoms = (req, res) => {
  const user_id = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  db.query(
    'SELECT symptoms FROM period_symptoms WHERE user_id = ? AND log_date = ?',
    [user_id, today],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      const symptoms = results[0]?.symptoms ? results[0].symptoms.split(',').filter(Boolean) : [];
      res.json({ symptoms });
    }
  );
};

// ── GET CYCLE REGULARITY (Regular vs Irregular) ───────
// Only trusts precisely-dated logs (is_estimated = FALSE) — onboarding
// entries where the user didn't remember the exact day are excluded so
// a guessed first-of-month date can't masquerade as a tracked gap.
const getRegularity = (req, res) => {
  const user_id = req.user.id;

  db.query(
    `SELECT start_date FROM period_logs
     WHERE user_id = ? AND start_date IS NOT NULL AND (is_estimated = FALSE OR is_estimated IS NULL)
     ORDER BY start_date ASC`,
    [user_id],
    (err, logs) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      const result = computeRegularity(logs.map(l => l.start_date));
      res.json({ ...result, periodsLogged: logs.length });
    }
  );
};

module.exports = {
  savePeriodHistory,
  logPeriodStart,
  logPeriodEnd,
  getCurrentPhase,
  getPeriodHistory,
  getPeriodCalendar,
  getPredictions,
  logSymptoms,
  getTodaySymptoms,
  getRegularity
};