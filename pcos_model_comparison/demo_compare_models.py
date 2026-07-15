"""
DEMO — run this in front of your supervisor.
Loads all 3 already-trained models, shows their comparison table,
then runs one example prediction through all 3 so you can show them
agreeing (or disagreeing) live.

Run:
    python demo_compare_models.py
"""

import joblib
import json
import os
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

FEATURE_COLS = [
    "Age (yrs)", "Weight (Kg)", "Height(Cm)", "BMI", "Cycle(R/I)",
    "Cycle length(days)", "Weight gain(Y/N)", "hair growth(Y/N)",
    "Skin darkening (Y/N)", "Hair loss(Y/N)", "Pimples(Y/N)",
    "Fast food (Y/N)", "Reg.Exercise(Y/N)",
]

# ----------------------------------------------------------------------
# 1. LOAD EVERYTHING
# ----------------------------------------------------------------------
rf_model = joblib.load(os.path.join(MODELS_DIR, "pcos_model_random_forest.pkl"))
lr_model = joblib.load(os.path.join(MODELS_DIR, "pcos_model_logistic_regression.pkl"))
svm_model = joblib.load(os.path.join(MODELS_DIR, "pcos_model_svm.pkl"))
scaler = joblib.load(os.path.join(MODELS_DIR, "pcos_feature_scaler.pkl"))

with open(os.path.join(MODELS_DIR, "algorithm_comparison.json")) as f:
    comparison = json.load(f)

# ----------------------------------------------------------------------
# 2. PRINT COMPARISON TABLE
# ----------------------------------------------------------------------
print("\n" + "=" * 78)
print("CYCLE ELLA — PCOS DETECTION: ALGORITHM COMPARISON")
print("=" * 78)
print(f"Dataset: {comparison['dataset']['total_patients']} real patients "
      f"(Kerala, India clinical dataset)")
print(f"Train/Test split: {comparison['dataset']['train_size']} / "
      f"{comparison['dataset']['test_size']} patients\n")

header = f"{'Algorithm':<25}{'Accuracy':<10}{'Precision':<11}{'Recall':<9}{'F1':<8}{'AUC':<8}"
print(header)
print("-" * 78)
for name, m in comparison["results"].items():
    print(f"{name:<25}{m['test_accuracy']:<10}{m['precision']:<11}{m['recall']:<9}{m['f1_score']:<8}{m['auc']:<8}")
print()

# ----------------------------------------------------------------------
# 3. LIVE EXAMPLE PREDICTION — same patient through all 3 models
# ----------------------------------------------------------------------
example_patient = {
    "Age (yrs)": 26, "Weight (Kg)": 72, "Height(Cm)": 158, "BMI": 28.8,
    "Cycle(R/I)": 4,               # Irregular
    "Cycle length(days)": 7,       # period lasts 7 days (normal range: 2-12 in this dataset)
    "Weight gain(Y/N)": 1, "hair growth(Y/N)": 1, "Skin darkening (Y/N)": 1,
    "Hair loss(Y/N)": 0, "Pimples(Y/N)": 1, "Fast food (Y/N)": 1,
    "Reg.Exercise(Y/N)": 0,
}

X_demo = pd.DataFrame([example_patient], columns=FEATURE_COLS)
X_demo_scaled = scaler.transform(X_demo)

print("=" * 78)
print("LIVE EXAMPLE — same patient run through all 3 models")
print("=" * 78)
print("Patient profile: 26yo, irregular cycle, 7-day period, weight gain,")
print("hair growth, skin darkening, acne, fast food habit, no exercise\n")

for name, model, X_input in [
    ("Random Forest", rf_model, X_demo),
    ("Logistic Regression", lr_model, X_demo_scaled),
    ("Support Vector Machine", svm_model, X_demo_scaled),
]:
    pred = model.predict(X_input)[0]
    proba = model.predict_proba(X_input)[0][1]
    risk = "Low" if proba < 0.33 else ("Medium" if proba < 0.66 else "High")
    result = "PCOS likely" if pred == 1 else "PCOS unlikely"
    print(f"{name:<25} -> {result:<15} ({proba*100:.1f}% probability, {risk} risk)")

print("\n" + "=" * 78)
print("Full metric definitions and dataset details: models/algorithm_comparison.json")
print("=" * 78 + "\n")
