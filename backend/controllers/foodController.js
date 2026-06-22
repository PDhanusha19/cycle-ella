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
      res.status(201).json({ message: 'Food logged! 🌸', id: result.insertId });
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

// GET DAILY NUTRITION SUMMARY (calculated from food_logs)
const getDailySummary = (req, res) => {
  const user_id = req.user.id;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  db.query(
    `SELECT 
      COALESCE(SUM(calories), 0) as total_calories,
      COALESCE(SUM(protein), 0) as total_protein,
      COALESCE(SUM(carbs), 0) as total_carbs,
      COALESCE(SUM(fats), 0) as total_fats
     FROM food_logs WHERE user_id = ? AND log_date = ?`,
    [user_id, date],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
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

// GET WEEKLY CALORIES for progress chart
const getWeeklyCalories = (req, res) => {
  const user_id = req.user.id;

  db.query(
    `SELECT 
      DATE(log_date) as date,
      SUM(calories) as total_calories
     FROM food_logs 
     WHERE user_id = ? 
     AND log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY DATE(log_date)
     ORDER BY date ASC`,
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// ANALYSE FOOD LOG FOR TIPS (calculated from food_logs)
const analyseFoodLog = (req, res) => {
  const user_id = req.user.id;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  db.query(
    `SELECT 
      COALESCE(SUM(calories), 0) as total_calories,
      COALESCE(SUM(protein), 0) as total_protein,
      COALESCE(SUM(carbs), 0) as total_carbs,
      COALESCE(SUM(fats), 0) as total_fats
     FROM food_logs WHERE user_id = ? AND log_date = ?`,
    [user_id, date],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      const nutrition = results[0];
      const tips = [];

      if (nutrition.total_calories > 2000) {
        tips.push('⚠️ You have exceeded your daily calorie limit. Try a light dinner.');
      } else if (nutrition.total_calories < 800) {
        tips.push('⚠️ Your calorie intake is very low today. Make sure to eat enough.');
      }
      if (nutrition.total_protein < 40) {
        tips.push('🥜 Your protein is low — add groundnuts, boiled eggs, or dhal to your next meal.');
      }
      if (nutrition.total_carbs > 200) {
        tips.push('⚠️ Too many carbs today — avoid sugary drinks and white rice for dinner.');
      }
      if (nutrition.total_fats > 65) {
        tips.push('⚠️ Your fat intake is high — avoid fried foods for the rest of the day.');
      }
      if (tips.length === 0) {
        tips.push('✅ Great job! Your nutrition looks balanced today. Keep it up!');
      }

      res.json({ nutrition, tips, date });
    }
  );
};

// SEARCH FOODS
const searchFoods = (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ items: [] });

  db.query(
    'SELECT * FROM foods WHERE name LIKE ? LIMIT 10',
    [`%${q}%`],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ items: results });
    }
  );
};

// GET TODAY'S food log
const getTodayLog = (req, res) => {
  const user_id = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  db.query(
    'SELECT * FROM food_logs WHERE user_id = ? AND log_date = ?',
    [user_id, today],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      const meals = { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] };
      let calories = 0, protein = 0, carbs = 0, fats = 0;

      results.forEach(item => {
        const mealKey = item.meal_type?.charAt(0).toUpperCase() +
                        item.meal_type?.slice(1) || 'Breakfast';
        if (meals[mealKey]) meals[mealKey].push({
          name: item.food_name,
          calories: item.calories || 0,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fats: item.fats || 0,
          quantity: item.quantity || 1,
          unit: item.unit || 'serving'
        });
        calories += parseFloat(item.calories || 0);
        protein += parseFloat(item.protein || 0);
        carbs += parseFloat(item.carbs || 0);
        fats += parseFloat(item.fats || 0);
      });

      res.json({
        meals,
        nutrition: {
          calories: Math.round(calories),
          goal: 1800,
          protein: Math.round(protein),
          carbs: Math.round(carbs),
          fats: Math.round(fats)
        }
      });
    }
  );
};

// SAVE food log
const saveLog = (req, res) => {
  res.json({ message: 'Food log saved! 🌸' });
};

module.exports = {
  logFood,
  getFoodLogs,
  getDailySummary,
  deleteFood,
  getWeeklySummary,
  analyseFoodLog,
  searchFoods,
  getTodayLog,
  saveLog,
  getWeeklyCalories
};