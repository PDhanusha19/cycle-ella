const db = require('../config/db');
const axios = require('axios');
const {
  getCyclePhaseTip,
  getWeatherTip,
  getFoodAnalysisTips,
  getBudgetTip,
  calculateHealthScore
} = require('../ai/tipEngine');

// GET WEATHER DATA
const getWeather = async (lat, lon) => {
  try {
    const API_KEY = process.env.WEATHER_API_KEY || 'demo';
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
    const response = await axios.get(url);
    return {
      temp: response.data.main.temp,
      condition: response.data.weather[0].main,
      humidity: response.data.main.humidity
    };
  } catch (err) {
    // Default to Colombo weather if API fails
    return { temp: 30, condition: 'Sunny', humidity: 80 };
  }
};

// GENERATE ALL TIPS FOR TODAY
const generateTips = async (req, res) => {
  const user_id = req.user.id;
  const { lat, lon } = req.query;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Get cycle phase
    const getPhase = () => new Promise((resolve) => {
      db.query(
        'SELECT * FROM cycle_phases WHERE user_id = ? AND phase_date = ?',
        [user_id, today],
        (err, results) => resolve(results?.[0] || null)
      );
    });

    // Get nutrition summary
    const getNutrition = () => new Promise((resolve) => {
      db.query(
        'SELECT * FROM nutrition_daily WHERE user_id = ? AND log_date = ?',
        [user_id, today],
        (err, results) => resolve(results?.[0] || null)
      );
    });

    // Get health profile (for budget)
    const getHealthProfile = () => new Promise((resolve) => {
      db.query(
        'SELECT * FROM user_health_profile WHERE user_id = ?',
        [user_id],
        (err, results) => resolve(results?.[0] || null)
      );
    });

    // Get food logs total cost today
    const getFoodSpent = () => new Promise((resolve) => {
      db.query(
        'SELECT SUM(calories) as total FROM food_logs WHERE user_id = ? AND log_date = ?',
        [user_id, today],
        (err, results) => resolve(results?.[0] || null)
      );
    });

    // Run all queries in parallel
    const [phase, nutrition, healthProfile, weatherData] = await Promise.all([
      getPhase(),
      getNutrition(),
      getHealthProfile(),
      getWeather(lat || 6.9271, lon || 79.8612)
    ]);

    // Calculate remaining budget
    const totalBudget = healthProfile?.food_budget || 800;
    const caloriesLogged = nutrition?.total_calories || 0;
    const estimatedSpent = (caloriesLogged / 2000) * totalBudget;
    const remainingBudget = Math.max(0, totalBudget - estimatedSpent).toFixed(0);

    // Generate all 4 tips
    const cycleTip = getCyclePhaseTip(phase?.phase_name || 'Unknown');
    const weatherTip = getWeatherTip(weatherData);
    const foodTips = getFoodAnalysisTips(nutrition);
    const budgetTip = getBudgetTip(remainingBudget);

    const allTips = {
      date: today,
      cycle_tip: {
        type: 'Cycle Phase',
        phase: phase?.phase_name || 'Unknown',
        day: phase?.day_of_cycle || 0,
        ...cycleTip
      },
      weather_tip: {
        type: 'Weather',
        weather: weatherData,
        tip: weatherTip
      },
      food_tip: {
        type: 'Food Analysis',
        nutrition: nutrition || {},
        tips: foodTips
      },
      budget_tip: {
        type: 'Budget',
        total_budget: totalBudget,
        remaining: remainingBudget,
        tip: budgetTip
      }
    };

    // Save tips to database
    const saveTip = (type, content) => {
      db.query(
        `INSERT INTO tips_log (user_id, tip_date, tip_type, tip_content) 
         VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE tip_content=?`,
        [user_id, today, type, content, content]
      );
    };

    saveTip('cycle', cycleTip.tip);
    saveTip('weather', weatherTip);
    saveTip('food', foodTips.join(' | '));
    saveTip('budget', budgetTip);

    res.json(allTips);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating tips' });
  }
};

// GET PAST TIPS BY DATE
const getPastTips = (req, res) => {
  const user_id = req.user.id;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  db.query(
    'SELECT * FROM tips_log WHERE user_id = ? AND tip_date = ?',
    [user_id, date],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json(results);
    }
  );
};

// GET HEALTH SCORE
const getHealthScore = (req, res) => {
  const user_id = req.user.id;

  // Get period logs
  db.query(
    'SELECT * FROM period_logs WHERE user_id = ?',
    [user_id],
    (err, periodLogs) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      // Get latest risk level
      db.query(
        'SELECT risk_level FROM pcos_risk WHERE user_id = ? ORDER BY assessed_at DESC LIMIT 1',
        [user_id],
        (err, riskResults) => {
          if (err) return res.status(500).json({ message: 'Database error' });

          // Get today nutrition
          const today = new Date().toISOString().split('T')[0];
          db.query(
            'SELECT * FROM nutrition_daily WHERE user_id = ? AND log_date = ?',
            [user_id, today],
            (err, nutritionResults) => {
              if (err) return res.status(500).json({ message: 'Database error' });

              // Get log streak
              db.query(
                `SELECT COUNT(DISTINCT log_date) as streak 
                 FROM food_logs 
                 WHERE user_id = ? 
                 AND log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
                [user_id],
                (err, streakResults) => {
                  if (err) return res.status(500).json({ message: 'Database error' });

                  const score = calculateHealthScore({
                    nutrition: nutritionResults[0] || null,
                    periodLogs: periodLogs,
                    riskLevel: riskResults[0]?.risk_level || 'Unknown',
                    logStreak: streakResults[0]?.streak || 0
                  });

                  res.json({
                    health_score: score,
                    breakdown: {
                      nutrition: '30%',
                      cycle_regularity: '25%',
                      symptoms: '25%',
                      consistency: '20%'
                    },
                    log_streak: streakResults[0]?.streak || 0,
                    risk_level: riskResults[0]?.risk_level || 'Unknown'
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

module.exports = {
  generateTips,
  getPastTips,
  getHealthScore
};