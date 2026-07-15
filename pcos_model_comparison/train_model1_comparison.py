"""
MODEL 1 — ALGORITHM COMPARISON
================================
Same data, same features, same train/test split as the Random Forest
model — only the algorithm changes. This makes the comparison fair,
which is what a research paper needs.

Algorithms compared:
    1. Random Forest       (already built — tree ensemble / bagging)
    2. Logistic Regression (linear / statistical baseline)
    3. Support Vector Machine (margin-based)

Run:
    python train_model1_comparison.py
"""

import pandas as pd
import numpy as np
import joblib
import json
import os
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ----------------------------------------------------------------------
# 1. LOAD DATA — identical to train_model1_pcos.py
# ----------------------------------------------------------------------
DATA_PATH = os.path.join(BASE_DIR, "data", "PCOS_data_without_infertility.xlsx")
df = pd.read_excel(DATA_PATH, sheet_name="Full_new")
df.columns = df.columns.str.strip()

FEATURE_COLS = [
    "Age (yrs)", "Weight (Kg)", "Height(Cm)", "BMI", "Cycle(R/I)",
    "Cycle length(days)",  # NOTE: this is period DURATION (days of bleeding, ~2-12), NOT full cycle length
    "Weight gain(Y/N)", "hair growth(Y/N)",
    "Skin darkening (Y/N)", "Hair loss(Y/N)", "Pimples(Y/N)",
    "Fast food (Y/N)", "Reg.Exercise(Y/N)",
]

df = df.dropna(subset=FEATURE_COLS + ["PCOS (Y/N)"]).copy()
df = df[df["Cycle(R/I)"].isin([2, 4])].copy()

X = df[FEATURE_COLS].copy()
y = df["PCOS (Y/N)"].astype(int)

# SAME random_state=42 and SAME split ratio as Model 1 -> same patients
# end up in train/test for every algorithm we compare.
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
sample_weight = compute_sample_weight(class_weight="balanced", y=y_train)
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# Logistic Regression and SVM are distance/weight-based, so unlike
# Random Forest they need features on the same scale (e.g. "Age" in
# years vs "Weight" in kg would otherwise unfairly dominate).
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)
X_scaled_full = scaler.transform(X)  # for cross-validation on full data

results = {}


def evaluate(name, model, X_tr, X_te, use_scaled_cv=False):
    y_pred = model.predict(X_te)
    y_proba = model.predict_proba(X_te)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred)

    cv_data = X_scaled_full if use_scaled_cv else X
    cv_scores = cross_val_score(model, cv_data, y, cv=cv)

    print(f"\n=== {name} ===")
    print(f"Test Accuracy:  {acc*100:.1f}%")
    print(f"Precision:      {prec*100:.1f}%")
    print(f"Recall:         {rec*100:.1f}%")
    print(f"F1 Score:       {f1*100:.1f}%")
    print(f"AUC:            {auc*100:.1f}%")
    print(f"5-fold CV Acc:  {cv_scores.mean()*100:.1f}% (+/- {cv_scores.std()*100:.1f}%)")
    print(f"Confusion Matrix: TN={cm[0][0]} FP={cm[0][1]} FN={cm[1][0]} TP={cm[1][1]}")

    results[name] = {
        "test_accuracy": round(acc * 100, 1),
        "precision": round(prec * 100, 1),
        "recall": round(rec * 100, 1),
        "f1_score": round(f1 * 100, 1),
        "auc": round(auc * 100, 1),
        "cv_accuracy": round(cv_scores.mean() * 100, 1),
        "cv_std": round(cv_scores.std() * 100, 1),
        "confusion_matrix": {
            "true_negative": int(cm[0][0]), "false_positive": int(cm[0][1]),
            "false_negative": int(cm[1][0]), "true_positive": int(cm[1][1]),
        },
    }


# ----------------------------------------------------------------------
# 2. MODEL A — RANDOM FOREST (re-trained here too, for a clean side-by-side)
# ----------------------------------------------------------------------
rf_model = RandomForestClassifier(
    n_estimators=300, max_depth=6, min_samples_leaf=4,
    max_features="sqrt", class_weight="balanced", random_state=42,
)
rf_model.fit(X_train, y_train, sample_weight=sample_weight)
evaluate("Random Forest", rf_model, X_train, X_test, use_scaled_cv=False)
joblib.dump(rf_model, os.path.join(MODELS_DIR, "pcos_model_random_forest.pkl"))

# ----------------------------------------------------------------------
# 3. MODEL B — LOGISTIC REGRESSION
# ----------------------------------------------------------------------
lr_model = LogisticRegression(
    class_weight="balanced", max_iter=1000, random_state=42,
)
lr_model.fit(X_train_scaled, y_train, sample_weight=sample_weight)
evaluate("Logistic Regression", lr_model, X_train_scaled, X_test_scaled, use_scaled_cv=True)
joblib.dump(lr_model, os.path.join(MODELS_DIR, "pcos_model_logistic_regression.pkl"))

# ----------------------------------------------------------------------
# 4. MODEL C — SUPPORT VECTOR MACHINE
# ----------------------------------------------------------------------
svm_model = SVC(
    kernel="rbf", probability=True, class_weight="balanced", random_state=42,
)
svm_model.fit(X_train_scaled, y_train, sample_weight=sample_weight)
evaluate("Support Vector Machine", svm_model, X_train_scaled, X_test_scaled, use_scaled_cv=True)
joblib.dump(svm_model, os.path.join(MODELS_DIR, "pcos_model_svm.pkl"))

# Save the scaler too — needed to preprocess new inputs for LR and SVM
joblib.dump(scaler, os.path.join(MODELS_DIR, "pcos_feature_scaler.pkl"))

# ----------------------------------------------------------------------
# 5. COMPARISON TABLE — ready to drop into a research paper
# ----------------------------------------------------------------------
print("\n" + "=" * 70)
print("COMPARISON TABLE")
print("=" * 70)
header = f"{'Algorithm':<25}{'Accuracy':<10}{'Precision':<11}{'Recall':<9}{'F1':<8}{'AUC':<8}{'CV Acc':<8}"
print(header)
print("-" * 70)
for name, m in results.items():
    print(f"{name:<25}{m['test_accuracy']:<10}{m['precision']:<11}{m['recall']:<9}{m['f1_score']:<8}{m['auc']:<8}{m['cv_accuracy']:<8}")

with open(os.path.join(MODELS_DIR, "algorithm_comparison.json"), "w") as f:
    json.dump({
        "dataset": {
            "total_patients": int(len(df)),
            "features": FEATURE_COLS,
            "train_size": int(len(X_train)),
            "test_size": int(len(X_test)),
            "random_state": 42,
        },
        "results": results,
    }, f, indent=2)

print(f"\nSaved comparison data -> models/algorithm_comparison.json")
print("Saved models -> pcos_model_random_forest.pkl, pcos_model_logistic_regression.pkl, pcos_model_svm.pkl")
