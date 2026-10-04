"""
run_corrected_inference.py
==================================================================
Corrected statistical inference for the paired tier comparisons
reported in Table IV.

WHY THIS SCRIPT EXISTS
Repeated k-fold cross-validation produces fold-level scores that are
NOT independent: each of the 537 subjects appears in roughly 45 of
the 50 training sets, so the 50 AUC values are overlapping views of
the same subjects rather than 50 separate experiments. A plain
Wilcoxon signed-rank test treats them as independent and can report
a smaller, over-confident p-value than the data actually supports.

This script applies the Nadeau-Bengio corrected resampled t-test
[Nadeau & Bengio, "Inference for the Generalization Error",
Machine Learning 52(3):239-281, 2003], which inflates the variance
estimate by a factor that accounts for the train/test overlap
between folds. It reports both the naive test you already have and
the corrected test, side by side, so the difference is visible.

CRITICAL: this script generates the SAME 50 folds for every tier
(one RepeatedStratifiedKFold object, reused across all four tiers),
so the four AUC values produced in each fold are genuinely paired
observations on the same train/test split. That pairing is what
makes the correction valid.

USAGE
    cd C:\\Users\\USER\\cycle-ella
    python run_corrected_inference.py

REQUIRES
    pandas, numpy, scikit-learn, scipy, openpyxl
"""

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.metrics import roc_auc_score

import os

def locate_data():
    """Find the dataset whether this script sits in ai-service/ (where your
    other run_*.py scripts live) or in the cycle-ella root."""
    candidates = [
        os.path.join("data", "PCOS_data_without_infertility.xlsx"),           # cwd = ai-service
        os.path.join("ai-service", "data", "PCOS_data_without_infertility.xlsx"),  # cwd = cycle-ella
    ]
    here = os.path.dirname(os.path.abspath(__file__))
    candidates += [os.path.join(here, c) for c in list(candidates)]
    for c in candidates:
        if os.path.exists(c):
            return c
    print("Could not find PCOS_data_without_infertility.xlsx in any of:")
    for c in candidates:
        print(" -", os.path.abspath(c))
    print("Place this script in the same ai-service folder as your other")
    print("run_*.py scripts, or edit DATA below to point at the file directly.")
    raise SystemExit(1)

DATA = locate_data()
SEED = 42
N_SPLITS, N_REPEATS = 10, 5
TARGET = "PCOS (Y/N)"

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
ALL_FEATS = TIER1 + TIER2_ADD + TIER3_ADD + TIER4_ADD

TIERS = [
    ("T1", TIER1),
    ("T2", TIER1 + TIER2_ADD),
    ("T3", TIER1 + TIER2_ADD + TIER3_ADD),
    ("T4", TIER1 + TIER2_ADD + TIER3_ADD + TIER4_ADD),
]


def load():
    df = pd.read_excel(DATA, sheet_name="Full_new")
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    for c in ALL_FEATS + [TARGET]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df[df["Cycle(R/I)"].isin([2, 4])]
    df = df.dropna(subset=ALL_FEATS + [TARGET])
    print(f"complete cases (identical subject set for all tiers): {len(df)}")
    return df


def make_model():
    """Matches the hyperparameters now stated in the paper: L2 penalty,
    C = 1.0, lbfgs solver, iteration limit raised for convergence,
    balanced class weighting, fixed seed."""
    return Pipeline([
        ("scale", StandardScaler()),
        ("clf", LogisticRegression(
            penalty="l2", C=1.0, solver="lbfgs",
            max_iter=5000, class_weight="balanced", random_state=SEED)),
    ])


def nadeau_bengio(diffs, n_train, n_test):
    """Corrected resampled t-test for a set of paired fold differences
    produced by repeated k-fold cross-validation.

    diffs   : array of per-fold paired differences (e.g. AUC_T2 - AUC_T1)
    n_train : number of training examples per fold
    n_test  : number of test examples per fold

    Returns: mean_diff, corrected_se, t_stat, p_value, ci_low, ci_high
    """
    diffs = np.asarray(diffs, dtype=float)
    n = len(diffs)
    mean_diff = diffs.mean()
    var_diff = diffs.var(ddof=1)

    rho = n_test / n_train  # accounts for train/test overlap across folds
    corrected_var = var_diff * (1.0 / n + rho)
    corrected_se = np.sqrt(corrected_var)

    if corrected_se == 0:
        return mean_diff, 0.0, np.inf, 0.0, mean_diff, mean_diff

    t_stat = mean_diff / corrected_se
    df = n - 1
    p_value = 2 * (1 - stats.t.cdf(abs(t_stat), df=df))
    t_crit = stats.t.ppf(0.975, df=df)
    ci_low = mean_diff - t_crit * corrected_se
    ci_high = mean_diff + t_crit * corrected_se

    return mean_diff, corrected_se, t_stat, p_value, ci_low, ci_high


def main():
    print("=" * 78)
    print("CORRECTED STATISTICAL INFERENCE FOR REPEATED CROSS-VALIDATION")
    print("Nadeau-Bengio corrected resampled t-test vs. naive Wilcoxon")
    print("=" * 78)
    df = load()
    y_all = df[TARGET].values.astype(int)
    n = len(df)

    cv = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS,
                                 random_state=SEED)

    # collect the SAME fold indices once, then evaluate all four tiers
    # on those exact splits so results are genuinely paired
    splits = list(cv.split(df[TIER1].values, y_all))
    n_test_per_fold = n / N_SPLITS       # size of one fold's held-out set
    n_train_per_fold = n - n_test_per_fold

    print(f"folds: {N_SPLITS} x {N_REPEATS} repeats = {len(splits)} total")
    print(f"per-fold: ~{n_train_per_fold:.0f} train, ~{n_test_per_fold:.0f} test")
    print(f"rho (test/train ratio, used in the correction): "
          f"{n_test_per_fold / n_train_per_fold:.4f}")
    print()

    scores = {label: [] for label, _ in TIERS}
    for label, feats in TIERS:
        X = df[feats].values
        for tr, te in splits:
            m = make_model()
            m.fit(X[tr], y_all[tr])
            prob = m.predict_proba(X[te])[:, 1]
            scores[label].append(roc_auc_score(y_all[te], prob) * 100)
        scores[label] = np.array(scores[label])

    print("MEAN AUC PER TIER (sanity check against Table III)")
    print("-" * 78)
    for label, _ in TIERS:
        print(f"  {label}: {scores[label].mean():.1f}")
    print()

    comparisons = [
        ("T1", "T2", "T1 -> T2  effect of home measures"),
        ("T2", "T3", "T2 -> T3  effect of laboratory"),
        ("T3", "T4", "T3 -> T4  effect of ultrasound"),
        ("T1", "T4", "T1 -> T4  full clinical benefit"),
    ]

    print("COMPARISON: NAIVE WILCOXON  vs.  NADEAU-BENGIO CORRECTED")
    print("-" * 78)
    for a, b, name in comparisons:
        diffs = scores[b] - scores[a]

        try:
            _, p_wilcoxon = stats.wilcoxon(scores[a], scores[b])
        except ValueError:
            p_wilcoxon = float("nan")

        mean_d, se, t_stat, p_corrected, lo, hi = nadeau_bengio(
            diffs, n_train_per_fold, n_test_per_fold)

        print(f"\n  {name}")
        print(f"    mean delta AUC        : {mean_d:+.2f}")
        print(f"    naive Wilcoxon p      : {p_wilcoxon:.4f}")
        print(f"    corrected t-statistic : {t_stat:.3f}  (df = {len(diffs)-1})")
        print(f"    corrected p-value     : {p_corrected:.4f}")
        print(f"    corrected 95% CI      : [{lo:+.2f}, {hi:+.2f}]")
        sig = "excludes zero (difference supported)" if (lo > 0) == (hi > 0) else "includes zero (no difference supported)"
        print(f"    interpretation        : {sig}")

    print()
    print("=" * 78)
    print("Report the corrected values in Table IV, not the naive Wilcoxon ones.")
    print("Cite: Nadeau, C. and Bengio, Y., 'Inference for the generalization")
    print("error', Machine Learning, 52(3), pp.239-281, 2003.")
    print("=" * 78)


if __name__ == "__main__":
    main()