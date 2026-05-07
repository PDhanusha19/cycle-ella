const db = require('../config/db');

// SAVE HEALTH PROFILE
const saveHealthProfile = (req, res) => {
  const user_id = req.user.id;
  const { diabetes, cholesterol, blood_pressure, food_budget, language } = req.body;

  db.query('UPDATE users SET language = ? WHERE id = ?', [language, user_id], (err) => {
    if (err) return res.status(500).json({ message: 'Database error' });
  });

  db.query('SELECT * FROM user_health_profile WHERE user_id = ?', [user_id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (results.length > 0) {
      db.query(
        'UPDATE user_health_profile SET diabetes=?, cholesterol=?, blood_pressure=?, food_budget=? WHERE user_id=?',
        [diabetes, cholesterol, blood_pressure, food_budget, user_id],
        (err) => {
          if (err) return res.status(500).json({ message: 'Error updating profile' });
          res.json({ message: 'Health profile updated! 🌸' });
        }
      );
    } else {
      db.query(
        'INSERT INTO user_health_profile (user_id, diabetes, cholesterol, blood_pressure, food_budget) VALUES (?,?,?,?,?)',
        [user_id, diabetes, cholesterol, blood_pressure, food_budget],
        (err) => {
          if (err) return res.status(500).json({ message: 'Error saving profile' });
          res.status(201).json({ message: 'Health profile saved! 🌸' });
        }
      );
    }
  });
};

// BMI Category helper
const getBMICategory = (bmi) => {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25)   return 'Normal Weight';
  if (bmi < 30)   return 'Overweight';
  return 'Obese';
};

// SAVE BMI & MEASUREMENTS
const saveMeasurements = (req, res) => {
  const user_id = req.user.id;
  const { weight, height } = req.body;

  if (!weight || !height) {
    return res.status(400).json({ message: 'Weight and height are required' });
  }

  const heightInMeters = height / 100;
  const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(2);

  db.query(
    'INSERT INTO user_measurements (user_id, weight, height, bmi) VALUES (?,?,?,?)',
    [user_id, weight, height, bmi],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error saving measurements' });

      res.status(201).json({
        message: 'Measurements saved! 🌸',
        bmi: parseFloat(bmi),
        category: getBMICategory(parseFloat(bmi))
      });
    }
  );
};

// GET LATEST MEASUREMENTS
const getMeasurements = (req, res) => {
  const user_id = req.user.id;

  db.query(
    'SELECT * FROM user_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results[0] || {});
    }
  );
};

// GET FULL USER PROFILE
const getProfile = (req, res) => {
  const user_id = req.user.id;

  db.query(
    'SELECT id, full_name, email, phone, gender, date_of_birth, language FROM users WHERE id = ?',
    [user_id],
    (err, userResults) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      db.query(
        'SELECT * FROM user_health_profile WHERE user_id = ?',
        [user_id],
        (err, healthResults) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          db.query(
            'SELECT * FROM user_measurements WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
            [user_id],
            (err, measureResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });

              res.json({
                user: userResults[0],
                health_profile: healthResults[0] || null,
                measurements: measureResults[0] || null
              });
            }
          );
        }
      );
    }
  );
};

// UPDATE USER PROFILE
const updateProfile = (req, res) => {
  const user_id = req.user.id;
  const { full_name, gender, date_of_birth, phone } = req.body;

  db.query(
    'UPDATE users SET full_name=?, gender=?, date_of_birth=?, phone=? WHERE id=?',
    [full_name, gender, date_of_birth, phone, user_id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error updating profile' });
      res.json({ message: 'Profile updated! 🌸' });
    }
  );
};

module.exports = {
  saveHealthProfile,
  saveMeasurements,
  getMeasurements,
  getProfile,
  updateProfile
};