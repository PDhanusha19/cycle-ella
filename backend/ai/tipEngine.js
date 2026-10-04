// ============================================
// CYCLE ELLA — PERSONALIZED AI COACH ENGINE
// Algorithm 1: Rule-Based Expert System
// ============================================

const getCyclePhaseTip = (phaseName, userName) => {
  const name = userName || 'there';
  const tips = {
    'Menstrual': {
      tip: `Hey ${name}! You're in your menstrual phase. Your body needs extra iron and warmth right now 🌸`,
      foods: ['Spinach', 'Dates', 'Lentils', 'Dark chocolate', 'Ginger tea'],
      avoid: ['Caffeine', 'Salty foods', 'Cold drinks'],
      exercise: `${name}, light walking or gentle yoga is best during your period. Avoid intense workouts today.`
    },
    'Follicular': {
      tip: `Hey ${name}! You're in your follicular phase — energy is rising! Focus on protein-rich meals 💪`,
      foods: ['Eggs', 'Legumes', 'Nuts', 'Quinoa', 'Fresh vegetables'],
      avoid: ['Heavy processed foods', 'Excess sugar'],
      exercise: `${name}, moderate exercise like a 30 min walk or light gym session is perfect today!`
    },
    'Ovulatory': {
      tip: `Hey ${name}! You're at peak energy in your ovulatory phase! Focus on antioxidant-rich foods 🌟`,
      foods: ['Berries', 'Avocado', 'Leafy greens', 'Salmon', 'Flaxseeds'],
      avoid: ['Excess sugar', 'Refined carbs', 'Alcohol'],
      exercise: `${name}, this is your best time for exercise! Try a 45 min workout or brisk walk today.`
    },
    'Luteal': {
      tip: `Hey ${name}! You're in your luteal phase — reduce sugar and eat magnesium-rich foods to manage PMS 🍫`,
      foods: ['Dark chocolate', 'Nuts', 'Spinach', 'Sweet potato', 'Chamomile tea'],
      avoid: ['Sugar', 'Caffeine', 'Alcohol', 'Fried foods'],
      exercise: `${name}, a 20 min walk or stretching session will help reduce bloating and mood swings.`
    }
  };

  return tips[phaseName] || {
    tip: `Hey ${name}! Maintain a balanced diet with whole foods and stay hydrated today 🌸`,
    foods: ['Vegetables', 'Fruits', 'Whole grains', 'Lean protein'],
    avoid: ['Processed foods', 'Excess sugar'],
    exercise: `${name}, aim for at least 20 mins of light activity today!`
  };
};

const getWeatherTip = (weatherData, userName) => {
  const name = userName || 'there';
  if (!weatherData) return `${name}, stay hydrated and maintain a balanced diet today 💧`;

  const temp = weatherData.temp;

  if (temp >= 32) {
    return `${name}, it's really hot today at ${temp}°C! 🌞 Drink at least 2.5L of water. Avoid heavy fried foods — try coconut water or fresh lime juice to cool down.`;
  } else if (temp >= 28) {
    return `${name}, it's warm today at ${temp}°C ☀️ Stay hydrated with light meals. Fresh fruits and coconut water are great right now.`;
  } else if (temp >= 22) {
    return `${name}, lovely weather today at ${temp}°C 🌤️ A great day for a balanced meal with vegetables and lean protein!`;
  } else if (temp >= 18) {
    return `${name}, it's a bit cool today at ${temp}°C 🌧️ Warm soups, herbal teas and cooked vegetables will keep you comfortable.`;
  } else {
    return `${name}, it's cold today at ${temp}°C 🌨️ Have warm meals like soups, dhal curry, and ginger tea. Avoid cold drinks today.`;
  }
};

const getFoodAnalysisTips = (nutrition, healthProfile, userName) => {
  const tips = [];
  const name = userName || 'there';
  const hasDiabetes = healthProfile?.diabetes === 'Yes';
  const hasHighCholesterol = healthProfile?.cholesterol === 'Yes';
  const hasHighBP = healthProfile?.blood_pressure === 'Yes';

  if (!nutrition || nutrition.total_calories === 0) {
    return [`${name}, you haven't logged any food today! Start logging your meals to get personalized tips 🍽️`];
  }

  // Diabetes check
  if (hasDiabetes) {
    if (nutrition.total_carbs > 150) {
      tips.push(`⚠️ ${name}, you have diabetes and your carb intake is high today (${Math.round(nutrition.total_carbs)}g). Please avoid rice, bread and sugary drinks for the rest of the day!`);
    } else if (nutrition.total_carbs > 100) {
      tips.push(`${name}, since you have diabetes — you've had ${Math.round(nutrition.total_carbs)}g carbs so far. Try to keep it under 150g for today.`);
    } else {
      tips.push(`✅ ${name}, great job keeping carbs in check today! Your blood sugar will thank you 😊`);
    }
  }

  // Cholesterol check
  if (hasHighCholesterol) {
    if (nutrition.total_fats > 50) {
      tips.push(`⚠️ ${name}, you have high cholesterol and your fat intake is high (${Math.round(nutrition.total_fats)}g). Avoid fried foods and coconut-heavy dishes for the rest of the day!`);
    } else {
      tips.push(`✅ ${name}, your fat intake looks okay today. Since you have high cholesterol, keep avoiding fried and oily foods — you're doing well!`);
    }
  }

  // Blood pressure check
  if (hasHighBP) {
    tips.push(`${name}, since you have high blood pressure — remember to avoid salty foods, pickles and processed snacks today. Drink plenty of water 💙`);
  }

  // Calorie check + exercise
  if (nutrition.total_calories > 2200) {
    tips.push(`${name}, you've consumed ${Math.round(nutrition.total_calories)} kcal today — above your goal! 🏃 Try a 30 min walk this evening to burn the extra calories. Have a light dinner tonight.`);
  } else if (nutrition.total_calories > 1800) {
    tips.push(`${name}, you're close to your calorie limit (${Math.round(nutrition.total_calories)} kcal). Have a light dinner and try a 20 min evening walk 🚶`);
  } else if (nutrition.total_calories < 800 && new Date().getHours() > 14) {
    tips.push(`${name}, your calorie intake is very low today (${Math.round(nutrition.total_calories)} kcal)! Please eat a proper meal — skipping meals worsens PCOS symptoms.`);
  }

  // Protein check
  if (nutrition.total_protein < 30) {
    tips.push(`${name}, your protein is really low today (${Math.round(nutrition.total_protein)}g) 🥚 Shall we fix that? Eat 2 boiled eggs — gives you 12g protein for under Rs. 40. Or have a handful of groundnuts!`);
  } else if (nutrition.total_protein < 50) {
    tips.push(`${name}, your protein could be higher (${Math.round(nutrition.total_protein)}g). Add a cup of dhal curry or a handful of groundnuts to your next meal 🥜`);
  } else {
    tips.push(`✅ ${name}, great protein intake today (${Math.round(nutrition.total_protein)}g)! Protein helps manage PCOS symptoms — keep it up!`);
  }

  // Fat check
  if (!hasHighCholesterol && nutrition.total_fats > 70) {
    tips.push(`⚠️ ${name}, your fat intake is high today (${Math.round(nutrition.total_fats)}g). Avoid fried foods for the rest of the day.`);
  }

  if (tips.length === 0) {
    tips.push(`✅ ${name}, your nutrition looks really balanced today! Amazing job 🌸`);
  }

  return tips;
};

const getExerciseSuggestion = (calories, phaseName, userName) => {
  const name = userName || 'there';

  if (calories > 2000) {
    return `${name}, you've eaten quite a lot today! Try a 30 min walk this evening 🚶 Even a slow walk around your neighbourhood counts!`;
  } else if (calories > 1600) {
    return `${name}, a 20 min walk today would be great for your metabolism and PCOS management 🌸`;
  } else if (phaseName === 'Ovulatory') {
    return `${name}, you're in your ovulatory phase — best time for exercise! Try a 30-45 min workout today 💪`;
  } else if (phaseName === 'Luteal') {
    return `${name}, a gentle 20 min walk will help with bloating and mood changes from your luteal phase 🌿`;
  } else {
    return `${name}, try to get at least 20 mins of light movement today — a walk, yoga, or stretching. It really helps PCOS! 🌸`;
  }
};

const calculateHealthScore = (data) => {
  let score = 0;

  if (data.nutrition && data.nutrition.total_calories > 0) {
    score += Math.min(30, (data.nutrition.total_calories / 1800) * 30);
  }

  if (data.periodLogs && data.periodLogs.length >= 2) score += 25;
  else if (data.periodLogs && data.periodLogs.length === 1) score += 12;

  if (data.riskLevel === 'Low') score += 25;
  else if (data.riskLevel === 'Medium') score += 15;
  else if (data.riskLevel === 'High') score += 5;

  if (data.logStreak >= 7) score += 20;
  else if (data.logStreak >= 3) score += 12;
  else if (data.logStreak >= 1) score += 5;

  return Math.round(Math.min(100, score));
};

module.exports = {
  getCyclePhaseTip,
  getWeatherTip,
  getFoodAnalysisTips,
  getExerciseSuggestion,
  calculateHealthScore
};