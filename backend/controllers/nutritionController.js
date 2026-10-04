const db = require('../config/db');
const { getBMICategory } = require('../utils/healthCalc');
const { calculateAge } = require('./pcosController');

// Activity factor: derived from pcos_symptoms.regular_exercise (no row
// yet, e.g. assessment not taken → treated as inactive, the more
// conservative default).
const ACTIVE_FACTOR = 1.55;
const INACTIVE_FACTOR = 1.375;

const MIN_DAILY_CALORIES = 1200; // hard floor — never go lower, regardless of BMI
const MAX_DEFICIT = 500;         // ~0.5kg/week — never a bigger deficit
const GAIN_SURPLUS = 300;

const DISCLAIMER = 'These are general estimates. Talk to a doctor or dietitian before making big changes to how you eat.';

// Monday-aligned, UTC-based week start. Deliberately not CURDATE() (server
// timezone dependent) — matches the rest of this app's convention of
// computing "today"/dates in Node with toISOString(), so this doesn't
// drift against food_logs.log_date or period_logs dates.
function getWeekStart(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  date.setUTCDate(date.getUTCDate() + ((day === 0 ? -6 : 1) - day));
  return date.toISOString().split('T')[0];
}

// Pure calculation — Mifflin-St Jeor (female) → TDEE → BMI-based goal →
// clamped calories → PCOS-adjusted macro split (higher protein / lower
// carbs, per the 2023 Teede et al. PCOS guideline).
function computeTargets({ weight, height, age, isActive }) {
  const bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  const tdee = bmr * (isActive ? ACTIVE_FACTOR : INACTIVE_FACTOR);
  const bmi = weight / ((height / 100) ** 2);
  const bmiCategory = getBMICategory(bmi);

  let goal, adjustment;
  if (bmiCategory === 'Underweight') {
    goal = 'gain';
    adjustment = GAIN_SURPLUS;
  } else if (bmiCategory === 'Normal Weight') {
    goal = 'maintain';
    adjustment = 0;
  } else {
    goal = 'lose';
    adjustment = -MAX_DEFICIT;
  }

  // Clamp on the rounded value, then derive macros from the FINAL
  // (possibly clamped) calorie number — never from the pre-clamp figure.
  const dailyCalories = Math.max(MIN_DAILY_CALORIES, Math.round(tdee + adjustment));

  return {
    bmi: Math.round(bmi * 100) / 100,
    bmiCategory,
    goal,
    dailyCalories,
    weeklyCalories: dailyCalories * 7,
    dailyProteinG: Math.round((dailyCalories * 0.30 / 4) * 10) / 10,
    dailyCarbsG: Math.round((dailyCalories * 0.40 / 4) * 10) / 10,
    dailyFatsG: Math.round((dailyCalories * 0.30 / 9) * 10) / 10,
  };
}

// Not an Express handler — a plain reusable function. Called from
// profileController.saveMeasurements (fresh weigh-in) and lazily from
// getTodayNutrition below (current week has no row yet).
function recalculateTargetsForUser(user_id, weightRaw, heightRaw, callback) {
  // mysql2 returns DECIMAL columns as strings — coerce once here
  // regardless of whether the caller passed fresh req.body numbers or a
  // DB-read row.
  const weight = parseFloat(weightRaw);
  const height = parseFloat(heightRaw);

  db.query('SELECT date_of_birth FROM users WHERE id = ?', [user_id], (err, userRows) => {
    if (err) return callback(err);
    const age = calculateAge(userRows[0]?.date_of_birth);

    db.query(
      'SELECT regular_exercise FROM pcos_symptoms WHERE user_id = ?',
      [user_id],
      (err2, symptomRows) => {
        if (err2) return callback(err2);
        const isActive = !!symptomRows[0]?.regular_exercise;

        const t = computeTargets({ weight, height, age, isActive });
        const week_start = getWeekStart();

        db.query(
          `INSERT INTO nutrition_targets
            (user_id, week_start, weight, height, bmi, bmi_category, goal,
             daily_calories, weekly_calories, daily_protein_g, daily_carbs_g, daily_fats_g)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             weight=VALUES(weight), height=VALUES(height), bmi=VALUES(bmi), bmi_category=VALUES(bmi_category),
             goal=VALUES(goal), daily_calories=VALUES(daily_calories), weekly_calories=VALUES(weekly_calories),
             daily_protein_g=VALUES(daily_protein_g), daily_carbs_g=VALUES(daily_carbs_g), daily_fats_g=VALUES(daily_fats_g)`,
          [
            user_id, week_start, weight, height, t.bmi, t.bmiCategory, t.goal,
            t.dailyCalories, t.weeklyCalories, t.dailyProteinG, t.dailyCarbsG, t.dailyFatsG,
          ],
          (err3) => {
            if (err3) return callback(err3);
            callback(null, {
              user_id,
              week_start,
              weight,
              height,
              bmi: t.bmi,
              bmi_category: t.bmiCategory,
              goal: t.goal,
              daily_calories: t.dailyCalories,
              weekly_calories: t.weeklyCalories,
              daily_protein_g: t.dailyProteinG,
              daily_carbs_g: t.dailyCarbsG,
              daily_fats_g: t.dailyFatsG,
            });
          }
        );
      }
    );
  });
}

function getConsumedToday(user_id, callback) {
  const today = new Date().toISOString().split('T')[0];
  db.query(
    `SELECT
      COALESCE(SUM(calories), 0) as calories,
      COALESCE(SUM(protein), 0) as protein,
      COALESCE(SUM(carbs), 0) as carbs,
      COALESCE(SUM(fats), 0) as fats
     FROM food_logs WHERE user_id = ? AND log_date = ?`,
    [user_id, today],
    (err, rows) => {
      if (err) return callback(err);
      const r = rows[0];
      callback(null, {
        calories: Math.round(parseFloat(r.calories)),
        protein: Math.round(parseFloat(r.protein) * 10) / 10,
        carbs: Math.round(parseFloat(r.carbs) * 10) / 10,
        fats: Math.round(parseFloat(r.fats) * 10) / 10,
      });
    }
  );
}

// GET /api/nutrition/today
const getTodayNutrition = (req, res) => {
  const user_id = req.user.id;
  const week_start = getWeekStart();

  const respondWithTargets = (target) => {
    getConsumedToday(user_id, (err, consumed) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      const targets = {
        daily_calories: target.daily_calories,
        daily_protein_g: parseFloat(target.daily_protein_g),
        daily_carbs_g: parseFloat(target.daily_carbs_g),
        daily_fats_g: parseFloat(target.daily_fats_g),
        goal: target.goal,
        bmi_category: target.bmi_category,
      };

      const remaining = {
        // Deliberately not clamped — can go negative, shown honestly.
        calories: targets.daily_calories - consumed.calories,
        protein: Math.round((targets.daily_protein_g - consumed.protein) * 10) / 10,
        carbs: Math.round((targets.daily_carbs_g - consumed.carbs) * 10) / 10,
        fats: Math.round((targets.daily_fats_g - consumed.fats) * 10) / 10,
      };

      const percent_consumed = targets.daily_calories > 0
        ? Math.round((consumed.calories / targets.daily_calories) * 100)
        : null;

      res.json({
        needsMeasurements: false,
        targets,
        consumed,
        remaining,
        percent_consumed,
        disclaimer: DISCLAIMER,
      });
    });
  };

  db.query(
    'SELECT * FROM nutrition_targets WHERE user_id = ? AND week_start = ?',
    [user_id, week_start],
    (err, rows) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      if (rows.length > 0) return respondWithTargets(rows[0]);

      // No row for the current week yet — try to lazily recompute from
      // the most recent measurement.
      db.query(
        'SELECT weight, height FROM user_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
        [user_id],
        (err2, mRows) => {
          if (err2) return res.status(500).json({ message: 'Database error' });

          if (mRows.length === 0) {
            // No measurements at all. This is a daily-use screen, not a
            // gated onboarding step — respond 200 with real consumed
            // data so the food log itself doesn't look broken, and let
            // the frontend prompt her to complete the BMI step.
            return getConsumedToday(user_id, (err3, consumed) => {
              if (err3) return res.status(500).json({ message: 'Database error' });
              res.json({
                needsMeasurements: true,
                targets: null,
                consumed,
                remaining: null,
                percent_consumed: null,
                disclaimer: DISCLAIMER,
              });
            });
          }

          recalculateTargetsForUser(user_id, mRows[0].weight, mRows[0].height, (err3, target) => {
            if (err3) return res.status(500).json({ message: 'Database error' });
            respondWithTargets(target);
          });
        }
      );
    }
  );
};

module.exports = {
  getWeekStart,
  recalculateTargetsForUser,
  getTodayNutrition,
  DISCLAIMER,
};
