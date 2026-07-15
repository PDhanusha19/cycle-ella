"""
MODEL 1: PCOS Detector + Risk Level  (symptom-only version)
==============================================================
Cycle Ella only asks things a woman already knows — no blood
test or ultrasound needed:
    Age, Weight, Height, Period regularity, Cycle length,
    Weight gain, Hair growth, Skin darkening, Hair loss,
    Pimples/acne, Fast food habit, Regular exercise

One model gives two answers:
    1. Likely PCOS or not (Yes/No + confidence %)
    2. Risk level: Low / Medium / High

Trained on 541 real patients from 10 hospitals in Kerala, India
(open clinical dataset, widely used in published PCOS research).

Run:
    python train_model1_pcos.py
"""

import pandas as pd
import numpy as np
import joblib
import json
import os
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ----------------------------------------------------------------------
# 1. LOAD DATA
# ----------------------------------------------------------------------
DATA_PATH = os.path.join(BASE_DIR, "data", "PCOS_data_without_infertility.xlsx")
df = pd.read_excel(DATA_PATH, sheet_name="Full_new")
df.columns = df.columns.str.strip()
print(f"Loaded {len(df)} real patients (Kerala, India clinical dataset)")
print(df["PCOS (Y/N)"].value_counts())

# ----------------------------------------------------------------------
# 2. FEATURES — only things a woman can self-report, no lab test needed
# ----------------------------------------------------------------------
FEATURE_COLS = [
    "Age (yrs)",
    "Weight (Kg)",
    "Height(Cm)",
    "BMI",
    "Cycle(R/I)",           # 2 = Regular, 4 = Irregular in source data
    "Cycle length(days)",
    "Weight gain(Y/N)",
    "hair growth(Y/N)",
    "Skin darkening (Y/N)",
    "Hair loss(Y/N)",
    "Pimples(Y/N)",
    "Fast food (Y/N)",
    "Reg.Exercise(Y/N)",
]

df = df.dropna(subset=FEATURE_COLS + ["PCOS (Y/N)"]).copy()

# One row in the source data has Cycle(R/I) = 5, a data-entry typo
# (valid values are only 2=Regular or 4=Irregular). Drop that row.
df = df[df["Cycle(R/I)"].isin([2, 4])].copy()

X = df[FEATURE_COLS].copy()
y = df["PCOS (Y/N)"].astype(int)

print(f"\nUsable rows after cleaning: {len(df)}")

# ----------------------------------------------------------------------
# 3. TRAIN / TEST SPLIT
# ----------------------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# PCOS cases are the minority class (~33%). Balance so the model
# doesn't lean lazily toward "No".
sample_weight = compute_sample_weight(class_weight="balanced", y=y_train)

# ----------------------------------------------------------------------
# 4. TRAIN MODEL
# ----------------------------------------------------------------------
model = RandomForestClassifier(
    n_estimators=300,
    max_depth=6,
    min_samples_leaf=4,
    max_features="sqrt",
    class_weight="balanced",
    random_state=42,
)
model.fit(X_train, y_train, sample_weight=sample_weight)

# ----------------------------------------------------------------------
# 5. EVALUATE HONESTLY
# ----------------------------------------------------------------------
y_pred = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

test_acc = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
auc = roc_auc_score(y_test, y_proba)
cm = confusion_matrix(y_test, y_pred)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_scores = cross_val_score(model, X, y, cv=cv)

print("\n=== MODEL 1 RESULTS (symptom-only) ===")
print(f"Test Accuracy:  {test_acc*100:.1f}%")
print(f"Precision (PCOS=Yes): {precision*100:.1f}%")
print(f"Recall (PCOS=Yes):    {recall*100:.1f}%")
print(f"F1 Score:       {f1*100:.1f}%")
print(f"AUC (ranking quality): {auc*100:.1f}%")
print(f"5-fold CV Accuracy: {cv_scores.mean()*100:.1f}% (+/- {cv_scores.std()*100:.1f}%)")
print("\nConfusion Matrix:")
print(f"                Predicted No   Predicted Yes")
print(f"Actual No       {cm[0][0]:<14} {cm[0][1]}")
print(f"Actual Yes      {cm[1][0]:<14} {cm[1][1]}")
print("\n" + classification_report(y_test, y_pred, target_names=["No PCOS", "PCOS"]))

importance = sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: -x[1])
print("Top symptoms that matter most:")
for feat, imp in importance:
    print(f"  {feat}: {imp*100:.1f}%")

# ----------------------------------------------------------------------
# 6. SAVE MODEL + METADATA (no encoders needed — all inputs are numeric/Y-N)
# ----------------------------------------------------------------------
joblib.dump(model, os.path.join(MODELS_DIR, "pcos_model.pkl"))

metadata = {
    "feature_order": FEATURE_COLS,
    "cycle_encoding": {"Regular": 2, "Irregular": 4},
    "binary_encoding": {"No": 0, "Yes": 1},
    "trained_on": {
        "total_patients": int(len(df)),
        "source": "Kerala, India clinical dataset (10 hospitals), 541 patients",
    },
    "metrics": {
        "test_accuracy": round(test_acc * 100, 1),
        "precision": round(precision * 100, 1),
        "recall": round(recall * 100, 1),
        "f1_score": round(f1 * 100, 1),
        "auc": round(auc * 100, 1),
        "cv_accuracy": round(cv_scores.mean() * 100, 1),
    },
    "risk_level_thresholds": {
        "low": "probability < 0.33",
        "medium": "0.33 <= probability < 0.66",
        "high": "probability >= 0.66",
    },
    "top_symptoms": [feat for feat, _ in importance[:5]],
}
with open(os.path.join(MODELS_DIR, "pcos_model_metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\nSaved:")
print(f"  models/pcos_model.pkl            <- the model itself")
print(f"  models/pcos_model_metadata.json  <- plain info about the model")    