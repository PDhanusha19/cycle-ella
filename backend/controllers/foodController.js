const db = require('../config/db');

// LOG FOOD ITEM
const logFood = (req, res) => {
  const user_id = req.user.id;
  const {
    log_date, meal_type, food_name,
    quantity, unit, calories,
    protein, carbs, fats, input_method
  } = req.body;

  if (!food_name || !calories) {
    return res.status(400).json({ message: 'Food name and calories are required' });
  }

  const date = log_date || new Date().toISOString().split('T')[0];

  db.query(
    `INSERT INTO food_logs 
     (user_id, log_date, meal_type, food_name, quantity, unit, calories, protein, carbs, fats, input_method) 
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [user_id, date, meal_type, food_name, quantity, unit, calories, protein || 0, carbs || 0, fats || 0, input_method || 'manual'],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Error logging food' });

      // Update daily nutrition summary
      updateDailySummary(user_id, date);

      res.status(201).json({
        message: 'Food logged! 🌸',
        id: result.insertId
      });
    }
  );
};

// UPDATE DAILY NUTRITION SUMMARY
const updateDailySummary = (user_id, date) => {
  db.query(
    `SELECT 
      SUM(calories) as total_calories,
      SUM(protein) as total_protein,
      SUM(carbs) as total_carbs,
      SUM(fats) as total_fats
     FROM food_logs WHERE user_id = ? AND log_date = ?`,
    [user_id, date],
    (err, results) => {
      if (err) return;

      const summary = results[0];

      db.query(
        `INSERT INTO nutrition_daily 
         (user_id, log_date, total_calories, total_protein, total_carbs, total_fats)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
         total_calories=?, total_protein=?, total_carbs=?, total_fats=?`,
        [
          user_id, date,
          summary.total_calories || 0,
          summary.total_protein || 0,
          summary.total_carbs || 0,
          summary.total_fats || 0,
          summary.total_calories || 0,
          summary.total_protein || 0,
          summary.total_carbs || 0,
          summary.total_fats || 0
        ]
      );
    }
  );
};

// GET FOOD LOGS BY DATE
const getFoodLogs = (req, res) => {
  const user_id = req.user.id;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  db.query(
    'SELECT * FROM food_logs WHERE user_id = ? AND log_date = ? ORDER BY created_at ASC',
    [user_id, date],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// GET DAILY NUTRITION SUMMARY
const getDailySummary = (req, res) => {
  const user_id = req.user.id;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  db.query(
    'SELECT * FROM nutrition_daily WHERE user_id = ? AND log_date = ?',
    [user_id, date],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      if (results.length === 0) {
        return res.json({
          total_calories: 0,
          total_protein: 0,
          total_carbs: 0,
          total_fats: 0,
          message: 'No food logged for this date'
        });
      }

      res.json(results[0]);
    }
  );
};

// DELETE FOOD ITEM
const deleteFood = (req, res) => {
  const user_id = req.user.id;
  const { id } = req.params;

  db.query(
    'DELETE FROM food_logs WHERE id = ? AND user_id = ?',
    [id, user_id],
    (err) => {
      if (err) return res.status(500).json({ message: 'Error deleting food' });
      res.json({ message: 'Food item deleted! 🌸' });
    }
  );
};

// GET WEEKLY FOOD SUMMARY
const getWeeklySummary = (req, res) => {
  const user_id = req.user.id;

  db.query(
    `SELECT log_date, 
      SUM(calories) as total_calories,
      SUM(protein) as total_protein,
      SUM(carbs) as total_carbs,
      SUM(fats) as total_fats
     FROM food_logs 
     WHERE user_id = ? 
     AND log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY log_date
     ORDER BY log_date ASC`,
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// ANALYSE FOOD LOG FOR TIPS
const analyseFoodLog = (req, res) => {
  const user_id = req.user.id;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  db.query(
    'SELECT * FROM nutrition_daily WHERE user_id = ? AND log_date = ?',
    [user_id, date],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      const nutrition = results[0] || {
        total_calories: 0,
        total_protein: 0,
        total_carbs: 0,
        total_fats: 0
      };

      const tips = [];

      // Calorie check
      if (nutrition.total_calories > 2000) {
        tips.push('⚠️ You have exceeded your daily calorie limit. Try a light dinner.');
      } else if (nutrition.total_calories < 800) {
        tips.push('⚠️ Your calorie intake is very low today. Make sure to eat enough.');
      }

      // Protein check
      if (nutrition.total_protein < 40) {
        tips.push('🥜 Your protein is low — add groundnuts, boiled eggs, or dhal to your next meal.');
      }

      // Sugar/carbs check
      if (nutrition.total_carbs > 200) {
        tips.push('⚠️ You have had too many carbs today — avoid sugary drinks and white rice for dinner.');
      }

      // Fat check
      if (nutrition.total_fats > 65) {
        tips.push('⚠️ Your fat intake is high — avoid fried foods for the rest of the day.');
      }

      if (tips.length === 0) {
        tips.push('✅ Great job! Your nutrition looks balanced today. Keep it up!');
      }

      res.json({
        nutrition,
        tips,
        date
      });
    }
  );
};

module.exports = {
  logFood,
  getFoodLogs,
  getDailySummary,
  deleteFood,
  getWeeklySummary,
  analyseFoodLog
};