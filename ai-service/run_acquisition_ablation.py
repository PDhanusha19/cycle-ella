"""
run_acquisition_ablation.py
==================================================================
Rigorous acquisition-aware feature ablation for PCOS risk screening.

This script replaces run_tiered_ablation.py and addresses the
methodological corrections requested in supervisory review:

  #8   identical subject set across all four tiers (complete cases)
  #9   all preprocessing fitted INSIDE each cross-validation fold
  #10  repeated stratified CV instead of a single 80:20 split
  #11  95% confidence intervals and paired tier comparisons
  #12  sensitivity, specificity, PPV, NPV, PR-AUC and Brier score
  #14  classifier robustness check across all tiers

USAGE
    cd C:\\Users\\USER\\cycle-ella\\ai-service
    python run_acquisition_ablation.py

The data path is resolved relative to this file, not the current
working directory, so it also works if you run it from elsewhere.

REQUIRES
    pandas, numpy, scikit-learn, scipy, openpyxl
"""

import os
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.metrics import (roc_auc_score, average_precision_score,
                             brier_score_loss, confusion_matrix)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE_DIR, "data", "PCOS_data_without_infertility.xlsx")
SEED = 42
N_SPLITS, N_REPEATS = 10, 5          # 50 fits per configuration
TARGET = "PCOS (Y/N)"

# ------------------------------------------------------------------ tiers
TIER1 = [
    " Age (yrs)", "Weight (Kg)", "Height(Cm) ", "BMI",
    "Cycle(R/I)", "Cycle length(days)",
    "Weight gain(Y/N)", "hair growth(Y/N)", "Skin darkening (Y/N)",
    "Hair loss(Y/N)", "Pimples(Y/N)", "Fast food (Y/N)", "Reg.Exercise(Y/N)",
]
TIER2_ADD = [
    "Pulse rate(bpm) ", "RR (breaths/min)", "Hip(inch)", "Waist(inch)",
    "Waist:Hip Ratio", "BP _Systolic (mmHg)", "BP _Diastolic (mmHg)",
]
TIER3_ADD = [
    "Hb(g/dl)", "  I   beta-HCG(mIU/mL)", "II    beta-HCG(mIU/mL)",
    "FSH(mIU/mL)", "LH(mIU/mL)", "FSH/LH", "TSH (mIU/L)", "AMH(ng/mL)",
    "PRL(ng/mL)", "Vit D3 (ng/mL)", "PRG(ng/mL)", "RBS(mg/dl)",
]
TIER4_ADD = [
    "Follicle No. (L)", "Follicle No. (R)",
    "Avg. F size (L) (mm)", "Avg. F size (R) (mm)", "Endometrium (mm)",
]

TIERS = [
    ("T1  self-reportable", TIER1),
    ("T2  + home-measurable", TIER1 + TIER2_ADD),
    ("T3  + laboratory", TIER1 + TIER2_ADD + TIER3_ADD),
    ("T4  + ultrasound", TIER1 + TIER2_ADD + TIER3_ADD + TIER4_ADD),
]

ALL_FEATS = TIER1 + TIER2_ADD + TIER3_ADD + TIER4_ADD


def load():
    df = pd.read_excel(DATA, sheet_name="Full_new")
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    n_raw = len(df)
    for c in ALL_FEATS + [TARGET]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    bad = ~df["Cycle(R/I)"].isin([2, 4])
    df = df[~bad]

    # SAME subject set for every tier: complete cases across ALL features
    df = df.dropna(subset=ALL_FEATS + [TARGET])

    pos = int(df[TARGET].sum())
    print(f"raw records                : {n_raw}")
    print(f"removed, invalid cycle code: {int(bad.sum())}")
    print(f"complete cases (ALL tiers) : {len(df)}")
    print(f"positive / negative        : {pos} / {len(df)-pos}"
          f"  ({pos/len(df)*100:.1f}% positive)")
    print()
    print("Every tier is evaluated on this identical subject set, so the")
    print("only quantity that varies between tiers is feature availability.")
    return df


def make_model(kind):
    """Scaler is inside the pipeline, so it is refitted within every fold."""
    if kind == "lr":
        clf = LogisticRegression(max_iter=5000, random_state=SEED,
                                 class_weight="balanced")
    elif kind == "rf":
        clf = RandomForestClassifier(n_estimators=300, random_state=SEED,
                                     class_weight="balanced")
    else:
        clf = SVC(probability=True, random_state=SEED, class_weight="balanced")
    return Pipeline([("scale", StandardScaler()), ("clf", clf)])


def evaluate(X, y, kind="lr"):
    """Returns per-fold metric arrays across repeated stratified CV."""
    cv = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS,
                                 random_state=SEED)
    out = {k: [] for k in ("acc", "sens", "spec", "ppv", "npv",
                           "auc", "prauc", "brier")}
    for tr, te in cv.split(X, y):
        m = make_model(kind)
        m.fit(X[tr], y[tr])
        pred = m.predict(X[te])
        prob = m.predict_proba(X[te])[:, 1]
        tn, fp, fn, tp = confusion_matrix(y[te], pred, labels=[0, 1]).ravel()
        out["acc"].append((tp + tn) / (tp + tn + fp + fn) * 100)
        out["sens"].append(tp / (tp + fn) * 100 if (tp + fn) else np.nan)
        out["spec"].append(tn / (tn + fp) * 100 if (tn + fp) else np.nan)
        out["ppv"].append(tp / (tp + fp) * 100 if (tp + fp) else np.nan)
        out["npv"].append(tn / (tn + fn) * 100 if (tn + fn) else np.nan)
        out["auc"].append(roc_auc_score(y[te], prob) * 100)
        out["prauc"].append(average_precision_score(y[te], prob) * 100)
        out["brier"].append(brier_score_loss(y[te], prob))
    return {k: np.array(v) for k, v in out.items()}


def ci95(a):
    """95% confidence interval of the mean across folds."""
    a = a[~np.isnan(a)]
    m = a.mean()
    h = stats.t.ppf(0.975, len(a) - 1) * a.std(ddof=1) / np.sqrt(len(a))
    return m, m - h, m + h


def main():
    print("=" * 78)
    print("ACQUISITION-AWARE FEATURE ABLATION")
    print(f"logistic regression | {N_SPLITS}-fold stratified CV x {N_REPEATS} repeats"
          f" = {N_SPLITS*N_REPEATS} fits per tier")
    print("=" * 78)
    df = load()
    y = df[TARGET].values.astype(int)

    # ---------------------------------------------------- primary results
    res = {}
    for label, feats in TIERS:
        res[label] = evaluate(df[feats].values, y, "lr")

    print()
    print("PRIMARY RESULTS  (mean [95% CI] across 50 folds)")
    print("-" * 78)
    print(f"{'Tier':<24}{'k':>4}{'AUC':>20}{'Sensitivity':>20}{'Specificity':>20}")
    for label, feats in TIERS:
        r = res[label]
        a = ci95(r["auc"]); s = ci95(r["sens"]); p = ci95(r["spec"])
        print(f"{label:<24}{len(feats):>4}"
              f"{a[0]:>9.1f} [{a[1]:.1f},{a[2]:.1f}]"
              f"{s[0]:>9.1f} [{s[1]:.1f},{s[2]:.1f}]"
              f"{p[0]:>9.1f} [{p[1]:.1f},{p[2]:.1f}]")

    print()
    print(f"{'Tier':<24}{'Accuracy':>18}{'PPV':>12}{'NPV':>12}{'PR-AUC':>12}{'Brier':>10}")
    for label, feats in TIERS:
        r = res[label]
        print(f"{label:<24}{r['acc'].mean():>11.1f}       "
              f"{r['ppv'].mean():>8.1f}{r['npv'].mean():>12.1f}"
              f"{r['prauc'].mean():>12.1f}{r['brier'].mean():>10.3f}")

    # ---------------------------------------------- paired tier comparison
    print()
    print("PAIRED COMPARISONS ON AUC  (same folds; Wilcoxon signed-rank)")
    print("-" * 78)
    print(f"{'Comparison':<34}{'delta AUC':>12}{'95% CI of delta':>24}{'p':>8}")
    pairs = [(0, 1, "T1 -> T2  effect of home measures"),
             (1, 2, "T2 -> T3  effect of laboratory"),
             (2, 3, "T3 -> T4  effect of ultrasound"),
             (0, 3, "T1 -> T4  full clinical benefit"),
             (0, 2, "T1 -> T3  cumulative non-imaging")]
    for i, j, name in pairs:
        a = res[TIERS[i][0]]["auc"]
        b = res[TIERS[j][0]]["auc"]
        d = b - a
        m, lo, hi = ci95(d)
        try:
            _, p = stats.wilcoxon(a, b)
        except ValueError:
            p = float("nan")
        print(f"{name:<34}{m:>+11.2f}{('[' + f'{lo:+.2f}' + ', ' + f'{hi:+.2f}' + ']'):>24}"
              f"{p:>8.4f}")
    print()
    print("A confidence interval for the delta that includes zero indicates no")
    print("detectable difference between those tiers under this protocol.")

    # ------------------------------------------------ robustness by model
    print()
    print("ROBUSTNESS: does the tier pattern hold across classifiers? (AUC)")
    print("-" * 78)
    print(f"{'Tier':<24}{'LogReg':>14}{'RandomForest':>16}{'SVM':>12}")
    for label, feats in TIERS:
        X = df[feats].values
        row = [res[label]["auc"].mean()]
        for kind in ("rf", "svm"):
            row.append(evaluate(X, y, kind)["auc"].mean())
        print(f"{label:<24}{row[0]:>13.1f}{row[1]:>16.1f}{row[2]:>12.1f}")
    print()
    print("If the ordering across tiers is preserved for all three classifiers,")
    print("the pattern is attributable to feature availability rather than to")
    print("the choice of model.")

    # ---------------------------------------------- retention, non-inferiority
    print()
    print("PERFORMANCE RETENTION")
    print("-" * 78)
    t1, t4 = res[TIERS[0][0]]["auc"], res[TIERS[3][0]]["auc"]
    d = t4 - t1
    m, lo, hi = ci95(d)
    print(f"  Tier 1 AUC {t1.mean():.1f}   Tier 4 AUC {t4.mean():.1f}")
    print(f"  AUC retained by self-reportable tier: "
          f"{t1.mean()/t4.mean()*100:.2f}%  (report to 1 dp as "
          f"{t1.mean()/t4.mean()*100:.1f}%)")
    print(f"  Mean AUC deficit: {m:.2f} points, 95% CI [{lo:.2f}, {hi:.2f}]")
    print()
    print("  Pre-specify a non-inferiority margin BEFORE interpreting this.")
    print("  If the upper bound of the deficit CI falls below the margin, the")
    print("  self-reportable tier is non-inferior at that margin.")
    print()
    print("NOTE: Tier 4 includes follicle counts, which approximate a defining")
    print("diagnostic criterion. Treat Tier 4 as an upper bound, not a neutral")
    print("comparator.")


if __name__ == "__main__":
    main()