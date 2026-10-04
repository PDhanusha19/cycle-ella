// Small shared health-math helpers with zero dependencies on any
// controller — kept dependency-free so both profileController.js and
// nutritionController.js can require it without a circular require
// between the two of them.

const getBMICategory = (bmi) => {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal Weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
};

module.exports = { getBMICategory };
