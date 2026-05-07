// ============================================
// CYCLE ELLA — AI TIP ENGINE
// Generates personalized tips based on:
// 1. Cycle phase
// 2. Weather
// 3. Food log analysis
// 4. Budget remaining
// ============================================

// TIP 1 — CYCLE PHASE TIPS
const getCyclePhaseTip = (phaseName) => {
  const tips = {
    'Menstrual': {
      tip: `You're in your menstrual phase — your body needs extra iron and warmth right now.`,
      foods: ['Spinach', 'Dates', 'Lentils', 'Dark chocolate', 'Ginger tea'],
      avoid: ['Caffeine', 'Salty foods', 'Alcohol'],
      exercise: 'Light walking or yoga recommended'
    },
    'Follicular': {
      tip: `You're in your follicular phase — energy is rising! Great time for protein-rich meals.`,
      foods: ['Eggs', 'Legumes', 'Nuts', 'Quinoa', 'Fresh vegetables'],
      avoid: ['Heavy processed foods'],
      exercise: 'Good time for moderate exercise'
    },
    'Ovulatory': {
      tip: `You're in your ovulatory phase — peak energy! Focus on antioxidant-rich foods.`,
      foods: ['Berries', 'Avocado', 'Leafy greens', 'Salmon', 'Flaxseeds'],
      avoid: ['Excess sugar', 'Refined carbs'],
      exercise: 'Best time for high intensity workouts'
    },
    'Luteal': {
      tip: `You're in your luteal phase — reduce sugar and focus on magnesium-rich foods to manage PMS.`,
      foods: ['Dark chocolate', 'Nuts', 'Spinach', 'Sweet potato', 'Chamomile tea'],
      avoid: ['Sugar', 'Caffeine', 'Alcohol', 'Fried foods'],
      exercise: 'Light to moderate exercise'
    }
  };

  return tips[phaseName] || {
    tip: 'Maintain a balanced diet with whole foods and stay hydrated.',
    foods: ['Vegetables', 'Fruits', 'Whole grains', 'Lean protein'],
    avoid: ['Processed foods', 'Excess sugar'],
    exercise: 'Regular moderate exercise'
  };
};

// TIP 2 — WEATHER TIPS
const getWeatherTip = (weatherData) => {
  if (!weatherData) {
    return 'Stay hydrated and maintain a balanced diet today.';
  }

  const temp = weatherData.temp;
  const condition = weatherData.condition?.toLowerCase() || '';

  if (temp >= 30) {
    return `It's hot and humid today (${temp}°C) — avoid heavy fried foods. Drink at least 2.5L of water. Try coconut water or fresh lime juice to stay cool.`;
  } else if (temp >= 25) {
    return `It's warm today (${temp}°C) — stay hydrated with light meals. Fresh fruits and salads are great choices.`;
  } else if (temp >= 20) {
    return `Pleasant weather today (${temp}°C) — a great day for a balanced meal with vegetables and lean protein.`;
  } else if (temp >= 15) {
    return `It's a bit cool today (${temp}°C) — warm soups, herbal teas and cooked vegetables will keep you comfortable.`;
  } else {
    return `It's cold today (${temp}°C) — have warm meals like soups, dhal curry, and ginger tea to keep your body warm.`;
  }
};

// TIP 3 — FOOD LOG ANALYSIS TIPS
const getFoodAnalysisTips = (nutrition) => {
  const tips = [];

  if (!nutrition || nutrition.total_calories === 0) {
    return ["You haven't logged any food today. Start logging to get personalized nutrition tips!"];
  }

  // Calorie analysis
  if (nutrition.total_calories > 2000) {
    tips.push('⚠️ You have exceeded your daily calorie goal — try a light dinner like vegetable soup.');
  } else if (nutrition.total_calories < 800 && new Date().getHours() > 14) {
    tips.push('⚠️ Your calorie intake is very low today — make sure to eat a proper meal.');
  }

  // Protein analysis
  if (nutrition.total_protein < 40) {
    tips.push('🥜 Your protein is low today — add a handful of groundnuts, 2 boiled eggs, or a cup of dhal to boost it.');
  } else if (nutrition.total_protein >= 60) {
    tips.push('✅ Great protein intake today! Keep it up.');
  }

  // Carbs/Sugar analysis
  if (nutrition.total_carbs > 200) {
    tips.push('⚠️ Your carb intake is high — avoid sugary drinks and white rice for the rest of the day.');
  }

  // Fat analysis
  if (nutrition.total_fats > 65) {
    tips.push('⚠️ Your fat intake is high — avoid fried foods for the rest of the day.');
  }

  // Iron check (if available)
  if (nutrition.iron !== undefined && nutrition.iron < 8) {
    tips.push('🌿 Your iron is low — add green leafy vegetables like gotukola or spinach to your next meal.');
  }

  // All good
  if (tips.length === 0) {
    tips.push('✅ Your nutrition looks balanced today — great job! Keep maintaining this healthy pattern.');
  }

  return tips;
};

// TIP 4 — BUDGET TIPS
const getBudgetTip = (remainingBudget) => {
  if (!remainingBudget || remainingBudget <= 0) {
    return "You've reached your daily food budget. Try home-cooked meals for the rest of the day.";
  }

  const budget = parseFloat(remainingBudget);

  if (budget >= 500) {
    return `You have Rs. ${budget} remaining today — you can have a proper meal. Try rice with dhal curry and a vegetable side — nutritious and affordable.`;
  } else if (budget >= 300) {
    return `You have Rs. ${budget} remaining — dhal curry with rice costs around Rs. 150–200 at most local spots. High in protein and folate!`;
  } else if (budget >= 150) {
    return `You have Rs. ${budget} left — a banana and a boiled egg is a great snack under Rs. 100. Gives you potassium and protein!`;
  } else if (budget >= 50) {
    return `You have Rs. ${budget} left — a cup of plain tea and a roti is a light option under Rs. 50.`;
  } else {
    return `Budget is almost done for today — try drinking water and having home food for your next meal.`;
  }
};

// CALCULATE HEALTH SCORE
const calculateHealthScore = (data) => {
  let score = 0;

  // Nutrition score (30%)
  if (data.nutrition && data.nutrition.total_calories > 0) {
    const calorieScore = Math.min(30, (data.nutrition.total_calories / 1800) * 30);
    score += calorieScore;
  }

  // Cycle regularity (25%)
  if (data.periodLogs && data.periodLogs.length >= 2) {
    score += 25;
  } else if (data.periodLogs && data.periodLogs.length === 1) {
    score += 12;
  }

  // Symptoms (25%)
  if (data.riskLevel === 'Low') score += 25;
  else if (data.riskLevel === 'Moderate') score += 15;
  else if (data.riskLevel === 'High') score += 5;

  // Consistency/streak (20%)
  if (data.logStreak >= 7) score += 20;
  else if (data.logStreak >= 3) score += 12;
  else if (data.logStreak >= 1) score += 5;

  return Math.round(Math.min(100, score));
};

module.exports = {
  getCyclePhaseTip,
  getWeatherTip,
  getFoodAnalysisTips,
  getBudgetTip,
  calculateHealthScore
};