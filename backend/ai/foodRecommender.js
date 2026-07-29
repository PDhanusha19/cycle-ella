// ============================================
// CYCLE ELLA — ALGORITHM 3
// Collaborative Filtering
// Recommends foods based on similar users
// ============================================

// Sri Lankan food database with nutrition values
const sriLankanFoods = [
  // Rice & Carbs
  { id: 1, name: 'White Rice', calories: 206, protein: 4.3, carbs: 45, fats: 0.4, category: 'carbs', phase: ['Follicular', 'Ovulatory'], suitable_for: ['normal', 'underweight'] },
  { id: 2, name: 'Red Rice', calories: 216, protein: 5, carbs: 45, fats: 1.6, category: 'carbs', phase: ['Follicular', 'Ovulatory', 'Luteal'], suitable_for: ['all'] },
  { id: 3, name: 'String Hoppers', calories: 180, protein: 4, carbs: 38, fats: 0.5, category: 'carbs', phase: ['Follicular'], suitable_for: ['all'] },
  { id: 4, name: 'Roti', calories: 150, protein: 4, carbs: 30, fats: 2, category: 'carbs', phase: ['Follicular', 'Menstrual'], suitable_for: ['all'] },
  { id: 5, name: 'Pittu', calories: 170, protein: 4.5, carbs: 35, fats: 1, category: 'carbs', phase: ['Follicular'], suitable_for: ['all'] },

  // Proteins
  { id: 6, name: 'Dhal Curry', calories: 220, protein: 12, carbs: 35, fats: 3, category: 'protein', phase: ['all'], suitable_for: ['all'] },
  { id: 7, name: 'Boiled Eggs', calories: 78, protein: 6, carbs: 0.6, fats: 5, category: 'protein', phase: ['all'], suitable_for: ['all'] },
  { id: 8, name: 'Chicken Curry', calories: 280, protein: 25, carbs: 5, fats: 15, category: 'protein', phase: ['Follicular', 'Ovulatory'], suitable_for: ['all'] },
  { id: 9, name: 'Fish Curry', calories: 250, protein: 22, carbs: 3, fats: 14, category: 'protein', phase: ['all'], suitable_for: ['all'] },
  { id: 10, name: 'Groundnuts', calories: 160, protein: 7, carbs: 6, fats: 14, category: 'protein', phase: ['all'], suitable_for: ['all'] },
  { id: 11, name: 'Tempe Curry', calories: 190, protein: 15, carbs: 10, fats: 8, category: 'protein', phase: ['all'], suitable_for: ['all'] },

  // Vegetables
  { id: 12, name: 'Gotukola Sambol', calories: 45, protein: 2, carbs: 8, fats: 0.5, category: 'vegetable', phase: ['Menstrual', 'Luteal'], suitable_for: ['all'] },
  { id: 13, name: 'Spinach Curry', calories: 60, protein: 3, carbs: 9, fats: 1, category: 'vegetable', phase: ['Menstrual', 'Luteal'], suitable_for: ['all'] },
  { id: 14, name: 'Pumpkin Curry', calories: 80, protein: 2, carbs: 15, fats: 1, category: 'vegetable', phase: ['Luteal'], suitable_for: ['all'] },
  { id: 15, name: 'Beetroot Curry', calories: 75, protein: 2, carbs: 14, fats: 1, category: 'vegetable', phase: ['Menstrual'], suitable_for: ['all'] },
  { id: 16, name: 'Green Beans', calories: 50, protein: 2, carbs: 10, fats: 0.3, category: 'vegetable', phase: ['all'], suitable_for: ['all'] },
  { id: 17, name: 'Brinjal Curry', calories: 70, protein: 1.5, carbs: 12, fats: 2, category: 'vegetable', phase: ['all'], suitable_for: ['all'] },
  { id: 18, name: 'Mukunuwenna', calories: 40, protein: 3, carbs: 6, fats: 0.5, category: 'vegetable', phase: ['Menstrual', 'Luteal'], suitable_for: ['all'] },

  // Fruits
  { id: 19, name: 'Banana', calories: 89, protein: 1.1, carbs: 23, fats: 0.3, category: 'fruit', phase: ['Luteal', 'Menstrual'], suitable_for: ['all'] },
  { id: 20, name: 'Papaya', calories: 55, protein: 0.6, carbs: 14, fats: 0.4, category: 'fruit', phase: ['all'], suitable_for: ['all'] },
  { id: 21, name: 'Mango', calories: 99, protein: 1.4, carbs: 25, fats: 0.6, category: 'fruit', phase: ['Follicular', 'Ovulatory'], suitable_for: ['normal'] },
  { id: 22, name: 'Wood Apple', calories: 134, protein: 7, carbs: 18, fats: 3.7, category: 'fruit', phase: ['all'], suitable_for: ['all'] },
  { id: 23, name: 'Avocado', calories: 160, protein: 2, carbs: 9, fats: 15, category: 'fruit', phase: ['Ovulatory'], suitable_for: ['all'] },

  // Drinks
  { id: 24, name: 'Coconut Water', calories: 46, protein: 1.7, carbs: 9, fats: 0.5, category: 'drink', phase: ['all'], suitable_for: ['all'] },
  { id: 25, name: 'Ginger Tea', calories: 5, protein: 0, carbs: 1, fats: 0, category: 'drink', phase: ['Menstrual', 'Luteal'], suitable_for: ['all'] },
  { id: 26, name: 'Herbal Tea', calories: 3, protein: 0, carbs: 0.5, fats: 0, category: 'drink', phase: ['Luteal', 'Menstrual'], suitable_for: ['all'] },

  // Snacks
  { id: 27, name: 'Dark Chocolate', calories: 170, protein: 2, carbs: 18, fats: 12, category: 'snack', phase: ['Luteal', 'Menstrual'], suitable_for: ['all'] },
  { id: 28, name: 'Almonds', calories: 164, protein: 6, carbs: 6, fats: 14, category: 'snack', phase: ['all'], suitable_for: ['all'] },
  { id: 29, name: 'Coconut Sambol', calories: 120, protein: 1, carbs: 5, fats: 11, category: 'snack', phase: ['all'], suitable_for: ['normal'] },
];

// Simulated user profiles for collaborative filtering
// In production this grows from real user data
const userProfiles = [
  {
    id: 'u1',
    bmi_range: 'normal',
    risk_level: 'Low',
    phase: 'Menstrual',
    liked_foods: [6, 7, 12, 13, 25, 19],
    health_score_change: +8
  },
  {
    id: 'u2',
    bmi_range: 'overweight',
    risk_level: 'Moderate',
    phase: 'Luteal',
    liked_foods: [6, 10, 14, 27, 28, 26],
    health_score_change: +6
  },
  {
    id: 'u3',
    bmi_range: 'normal',
    risk_level: 'Moderate',
    phase: 'Follicular',
    liked_foods: [2, 8, 16, 23, 24, 10],
    health_score_change: +10
  },
  {
    id: 'u4',
    bmi_range: 'overweight',
    risk_level: 'High',
    phase: 'Luteal',
    liked_foods: [6, 7, 13, 18, 25, 28],
    health_score_change: +7
  },
  {
    id: 'u5',
    bmi_range: 'normal',
    risk_level: 'Low',
    phase: 'Ovulatory',
    liked_foods: [2, 9, 23, 21, 24, 10],
    health_score_change: +9
  },
  {
    id: 'u6',
    bmi_range: 'underweight',
    risk_level: 'Low',
    phase: 'Follicular',
    liked_foods: [1, 6, 7, 20, 24, 11],
    health_score_change: +5
  },
];

// Get BMI range category
const getBMIRange = (bmi) => {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25)   return 'normal';
  if (bmi < 30)   return 'overweight';
  return 'obese';
};

// Calculate similarity between two users (Cosine Similarity)
const calculateSimilarity = (user1, user2) => {
  let score = 0;

  // BMI range match
  if (user1.bmi_range === user2.bmi_range) score += 3;

  // Risk level match
  if (user1.risk_level === user2.risk_level) score += 4;

  // Phase match
  if (user1.phase === user2.phase) score += 3;

  return score;
};

// MAIN FUNCTION — Get food recommendations
const getFoodRecommendations = (userData) => {
  const {
    bmi = 22,
    risk_level = 'Moderate',
    phase = 'Follicular',
    diabetes = 'No',
    cholesterol = 'No'
  } = userData;

  const currentUser = {
    bmi_range: getBMIRange(bmi),
    risk_level,
    phase
  };

  // Find most similar users
  const similarities = userProfiles.map(profile => ({
    profile,
    similarity: calculateSimilarity(currentUser, profile)
  }));

  // Sort by similarity (highest first)
  similarities.sort((a, b) => b.similarity - a.similarity);

  // Get top 3 similar users
  const topSimilarUsers = similarities.slice(0, 3);

  // Collect recommended food IDs from similar users
  const foodScores = {};
  topSimilarUsers.forEach(({ profile, similarity }) => {
    profile.liked_foods.forEach(foodId => {
      if (!foodScores[foodId]) foodScores[foodId] = 0;
      foodScores[foodId] += similarity * profile.health_score_change;
    });
  });

  // Sort foods by score
  const sortedFoodIds = Object.keys(foodScores)
    .sort((a, b) => foodScores[b] - foodScores[a])
    .map(id => parseInt(id));

  // Get food details and filter
  let recommendations = sortedFoodIds
    .map(id => sriLankanFoods.find(f => f.id === id))
    .filter(food => {
      if (!food) return false;

      // Filter for diabetes
      if (diabetes === 'Yes' && food.carbs > 40) return false;

      // Filter for cholesterol
      if (cholesterol === 'Yes' && food.fats > 10) return false;

      // Filter by phase
      if (food.phase.includes('all') || food.phase.includes(phase)) return true;

      return false;
    })
    .slice(0, 6);

  // Add phase-specific foods if recommendations are less than 3
  if (recommendations.length < 3) {
    const phaseFoods = sriLankanFoods.filter(food =>
      food.phase.includes(phase) || food.phase.includes('all')
    ).slice(0, 6);

    phaseFoods.forEach(food => {
      if (!recommendations.find(r => r.id === food.id)) {
        recommendations.push(food);
      }
    });
  }

  return {
    recommendations: recommendations.slice(0, 6),
    based_on: `${topSimilarUsers[0]?.profile?.id || 'similar users'}`,
    algorithm: 'Collaborative Filtering',
    phase_context: phase,
    similar_users_found: topSimilarUsers.length
  };
};

// Search food from database
const searchFood = (query) => {
  const results = sriLankanFoods.filter(food =>
    food.name.toLowerCase().includes(query.toLowerCase())
  );
  return results;
};

// Get all foods
const getAllFoods = () => sriLankanFoods;

module.exports = {
  getFoodRecommendations,
  searchFood,
  getAllFoods
};