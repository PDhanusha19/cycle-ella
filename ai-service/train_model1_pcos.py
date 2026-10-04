"""
MODEL 1: PCOS Detector + Risk Level  (symptom-only version)
==============================================================
Cycle Ella only asks things a woman already knows — no blood
test or ultrasound needed:
    Age, Weight, Height, Period regularity, Period duration,
    Weight gain, Hair growth, Skin darkening, Hair loss,
    Pimples/acne, Fast food habit, Regular exercise

One model gives two answers:
    1. Likely PCOS or not (Yes/No + confidence %)
    2. Risk level: Low / Medium / High

Trained on 539 real patients from 10 hospitals in Kerala, India
(open clinical dataset, widely used in published PCOS research;
541 raw rows, 2 dropped during cleaning — see step 2 below).

Algorithm: Logistic Regression + StandardScaler. This is what
app.py actually loads at runtime (pcos_model_logistic_regression.pkl
+ pcos_feature_scaler.pkl) — keep this script and those filenames
in sync so re-running training reproduces the deployed model
instead of silently producing something app.py never loads.

Run:
    python train_model1_pcos.py
"""

import pandas as pd
import numpy as np
import joblib
import json
import os
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
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
# NOTE: despite the column name, "Cycle length(days)" in this dataset is
# how many days the period itself lasts (mean ~5 days), not the number
# of days between periods. app.py maps this to `period_duration_days`
# for exactly that reason — keep that mapping in sync with this column.
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

# ----------------------------------------------------------------------
# 4. SCALE + TRAIN MODEL
# Logistic Regression needs scaled features (unlike tree models), so
# the scaler is fit on the train split only and saved alongside the
# model — app.py needs both to make a prediction.
# ----------------------------------------------------------------------
scaler = StandardScaler().fit(X_train)
X_train_scaled = scaler.transform(X_train)
X_test_scaled = scaler.transform(X_test)

# PCOS cases are the minority class (~33%). Balance so the model
# doesn't lean lazily toward "No".
model = LogisticRegression(
    C=1.0,
    class_weight="balanced",
    max_iter=1000,
    solver="lbfgs",
    random_state=42,
)
model.fit(X_train_scaled, y_train)

# ----------------------------------------------------------------------
# 5. EVALUATE HONESTLY
# ----------------------------------------------------------------------
y_pred = model.predict(X_test_scaled)
y_proba = model.predict_proba(X_test_scaled)[:, 1]

test_acc = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
auc = roc_auc_score(y_test, y_proba)
cm = confusion_matrix(y_test, y_pred)

# Cross-validate on a fresh scaler-per-fold pipeline so CV accuracy
# isn't optimistic from fitting the scaler on all the data up front.
from sklearn.pipeline import make_pipeline
cv_pipeline = make_pipeline(
    StandardScaler(),
    LogisticRegression(C=1.0, class_weight="balanced", max_iter=1000, solver="lbfgs", random_state=42),
)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_scores = cross_val_score(cv_pipeline, X, y, cv=cv)

print("\n=== MODEL 1 RESULTS (symptom-only, Logistic Regression) ===")
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

# Logistic Regression doesn't have feature_importances_ like a tree
# model — rank by the absolute size of each coefficient instead.
importance = sorted(zip(FEATURE_COLS, np.abs(model.coef_[0])), key=lambda x: -x[1])
print("Top symptoms that matter most:")
for feat, imp in importance:
    print(f"  {feat}: {imp:.3f}")

# ----------------------------------------------------------------------
# 6. SAVE MODEL + SCALER + METADATA
# Filenames must match what app.py loads.
# ----------------------------------------------------------------------
joblib.dump(model, os.path.join(MODELS_DIR, "pcos_model_logistic_regression.pkl"))
joblib.dump(scaler, os.path.join(MODELS_DIR, "pcos_feature_scaler.pkl"))

metadata = {
    "feature_order": FEATURE_COLS,
    "cycle_encoding": {"Regular": 2, "Irregular": 4},
    "binary_encoding": {"No": 0, "Yes": 1},
    "trained_on": {
        "total_patients": int(len(df)),
        "source": "Kerala, India clinical dataset (10 hospitals), 539 patients",
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
    "algorithm": "Logistic Regression",
}
with open(os.path.join(MODELS_DIR, "pcos_model_metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\nSaved:")
print(f"  models/pcos_model_logistic_regression.pkl  <- the model itself")
print(f"  models/pcos_feature_scaler.pkl              <- the StandardScaler app.py needs")
print(f"  models/pcos_model_metadata.json             <- plain info about the model")
