// ============================================
// CYCLE ELLA — ALGORITHM 2
// Neural Network using Synaptic.js
// Predicts PCOS Risk Level more accurately
// ============================================

const synaptic = require('synaptic');
const Neuron = synaptic.Neuron;
const Layer = synaptic.Layer;
const Network = synaptic.Network;
const Trainer = synaptic.Trainer;
const Architect = synaptic.Architect;

// Create Neural Network
// Input: 6 features
// Hidden: 8 neurons
// Output: 3 (Low, Moderate, High)
const createNetwork = () => {
  return new Architect.Perceptron(6, 8, 3);
};

// Training data based on PCOS research
// Input features (normalized 0-1):
// [bmi, menstrual_score, hormonal_score, physical_score, lifestyle_score, age_factor]
// Output: [low, moderate, high]
const trainingData = [
  // Low risk cases
  { input: [0.3, 0.1, 0.1, 0.1, 0.1, 0.4], output: [1, 0, 0] },
  { input: [0.4, 0.2, 0.1, 0.2, 0.1, 0.5], output: [1, 0, 0] },
  { input: [0.3, 0.1, 0.2, 0.1, 0.2, 0.3], output: [1, 0, 0] },
  { input: [0.5, 0.2, 0.2, 0.1, 0.1, 0.4], output: [1, 0, 0] },
  { input: [0.2, 0.1, 0.1, 0.1, 0.1, 0.3], output: [1, 0, 0] },
  { input: [0.4, 0.3, 0.2, 0.2, 0.2, 0.5], output: [1, 0, 0] },

  // Moderate risk cases
  { input: [0.6, 0.5, 0.4, 0.5, 0.4, 0.5], output: [0, 1, 0] },
  { input: [0.7, 0.4, 0.5, 0.4, 0.5, 0.6], output: [0, 1, 0] },
  { input: [0.5, 0.6, 0.4, 0.5, 0.3, 0.5], output: [0, 1, 0] },
  { input: [0.6, 0.5, 0.5, 0.4, 0.4, 0.4], output: [0, 1, 0] },
  { input: [0.7, 0.4, 0.6, 0.5, 0.5, 0.6], output: [0, 1, 0] },
  { input: [0.5, 0.5, 0.4, 0.6, 0.4, 0.5], output: [0, 1, 0] },

  // High risk cases
  { input: [0.8, 0.8, 0.7, 0.8, 0.7, 0.7], output: [0, 0, 1] },
  { input: [0.9, 0.7, 0.8, 0.7, 0.8, 0.8], output: [0, 0, 1] },
  { input: [0.8, 0.9, 0.8, 0.9, 0.7, 0.7], output: [0, 0, 1] },
  { input: [0.7, 0.8, 0.9, 0.8, 0.8, 0.8], output: [0, 0, 1] },
  { input: [0.9, 0.8, 0.8, 0.7, 0.9, 0.9], output: [0, 0, 1] },
  { input: [0.8, 0.7, 0.7, 0.8, 0.8, 0.7], output: [0, 0, 1] },
];

// Train the network
const trainNetwork = () => {
  const network = createNetwork();
  const trainer = new Trainer(network);

  trainer.train(trainingData, {
    rate: 0.1,
    iterations: 20000,
    error: 0.005,
    shuffle: true,
    log: false,
    cost: Trainer.cost.CROSS_ENTROPY
  });

  return network;
};

// Global trained network
let trainedNetwork = null;

const getNetwork = () => {
  if (!trainedNetwork) {
    console.log('Training PCOS Neural Network... 🧠');
    trainedNetwork = trainNetwork();
    console.log('Neural Network ready! ✅');
  }
  return trainedNetwork;
};

// Normalize BMI to 0-1
const normalizeBMI = (bmi) => {
  if (bmi < 18.5) return 0.2;
  if (bmi < 25)   return 0.4;
  if (bmi < 30)   return 0.6;
  if (bmi < 35)   return 0.8;
  return 1.0;
};

// Normalize score to 0-1
const normalizeScore = (score, maxScore) => {
  return Math.min(1, score / maxScore);
};

// PREDICT PCOS RISK using Neural Network
const predictPCOSRisk = (userData) => {
  try {
    const network = getNetwork();

    const {
      bmi = 22,
      menstrual_score = 0,
      hormonal_score = 0,
      physical_score = 0,
      lifestyle_score = 0,
      age = 25
    } = userData;

    // Normalize all inputs to 0-1
    const input = [
      normalizeBMI(bmi),
      normalizeScore(menstrual_score, 12),
      normalizeScore(hormonal_score, 12),
      normalizeScore(physical_score, 12),
      normalizeScore(lifestyle_score, 12),
      normalizeScore(age - 15, 25)
    ];

    // Run prediction
    const output = network.activate(input);

    // Get risk level from output
    const maxIndex = output.indexOf(Math.max(...output));
    const riskLevels = ['Low', 'Moderate', 'High'];
    const riskLevel = riskLevels[maxIndex];

    // Calculate confidence
    const confidence = Math.round(output[maxIndex] * 100);

    return {
      risk_level: riskLevel,
      confidence: confidence,
      scores: {
        low: Math.round(output[0] * 100),
        moderate: Math.round(output[1] * 100),
        high: Math.round(output[2] * 100)
      },
      algorithm: 'Neural Network (Synaptic.js)'
    };

  } catch (err) {
    console.error('Neural network error:', err.message);
    return null;
  }
};

module.exports = { predictPCOSRisk };