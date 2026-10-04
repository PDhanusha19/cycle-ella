"""
run_tiered_ablation.py
------------------------------------------------------------------
Reproduces Table 6.2 of the thesis (Table III of the ICAC paper):
the tiered feature ablation for PCOS risk screening.

Run this yourself so you have your own console output as an audit
trail. Every number in the thesis should be traceable to a run you
performed on your own machine.

USAGE
    python run_tiered_ablation.py

REQUIRES
    pandas, numpy, scikit-learn, openpyxl
"""

import os

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_validate

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE_DIR, "data", "PCOS_data_without_infertility.xlsx")
SEED = 42

# ---------------------------------------------------------------- tiers
# Tier 1: answerable with no instrument and no clinical contact
TIER1 = [
    " Age (yrs)", "Weight (Kg)", "Height(Cm) ", "BMI",
    "Cycle(R/I)", "Cycle length(days)",
    "Weight gain(Y/N)", "hair growth(Y/N)", "Skin darkening (Y/N)",
    "Hair loss(Y/N)", "Pimples(Y/N)", "Fast food (Y/N)", "Reg.Exercise(Y/N)",
]

# Tier 2 adds: obtainable with a household instrument
TIER2_ADD = [
    "Pulse rate(bpm) ", "RR (breaths/min)",
    "Hip(inch)", "Waist(inch)", "Waist:Hip Ratio",
    "BP _Systolic (mmHg)", "BP _Diastolic (mmHg)",
]

# Tier 3 adds: laboratory assay
TIER3_ADD = [
    "Hb(g/dl)", "  I   beta-HCG(mIU/mL)", "II    beta-HCG(mIU/mL)",
    "FSH(mIU/mL)", "LH(mIU/mL)", "FSH/LH", "TSH (mIU/L)", "AMH(ng/mL)",
    "PRL(ng/mL)", "Vit D3 (ng/mL)", "PRG(ng/mL)", "RBS(mg/dl)",
]

# Tier 4 adds: ultrasound imaging
TIER4_ADD = [
    "Follicle No. (L)", "Follicle No. (R)",
    "Avg. F size (L) (mm)", "Avg. F size (R) (mm)", "Endometrium (mm)",
]

TARGET = "PCOS (Y/N)"


def load():
    """Load and clean. Missing values are dropped PER TIER, so each tier keeps
    every record complete for its own feature set. Tiers 1 and 2 therefore
    retain 539 records; tiers 3 and 4 retain 537, because two records are
    missing a laboratory value. Report the n for each tier separately."""
    df = pd.read_excel(DATA, sheet_name="Full_new")
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    n_raw = len(df)

    # coerce every analytic column to numeric; non-numeric entries become NaN
    cols = TIER1 + TIER2_ADD + TIER3_ADD + TIER4_ADD + [TARGET]
    for c in cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Cycle(R/I) is coded 2 or 4; anything else is a data entry error
    bad_cycle = ~df["Cycle(R/I)"].isin([2, 4])
    n_bad = int(bad_cycle.sum())
    df = df[~bad_cycle]

    print(f"raw records            : {n_raw}")
    print(f"removed, bad Cycle(R/I): {n_bad}")
    print(f"after cleaning         : {len(df)}")
    return df


def evaluate(df, feats, label):
    # per-tier listwise deletion: keep records complete for THIS feature set
    sub = df.dropna(subset=feats + [TARGET])
    X = sub[feats].values
    y = sub[TARGET].values.astype(int)

    # class_weight="balanced" reweights the 32.6% positive class. This raises
    # recall at some cost to accuracy, consistent with the stated priority of
    # recall over precision for a screening instrument. It is NOT oversampling:
    # no synthetic records are created, so no leakage across CV folds arises.
    pipe = Pipeline([
        ("scale", StandardScaler()),
        ("clf", LogisticRegression(max_iter=5000, random_state=SEED,
                                   class_weight="balanced")),
    ])
    cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=SEED)
    res = cross_validate(
        pipe, X, y, cv=cv,
        scoring=["accuracy", "precision", "recall", "f1", "roc_auc"],
    )
    pos = int(y.sum())
    row = dict(
        label=label, k=len(feats), n=len(sub), pos=pos,
        acc=res["test_accuracy"].mean() * 100,
        acc_sd=res["test_accuracy"].std() * 100,
        prec=res["test_precision"].mean() * 100,
        rec=res["test_recall"].mean() * 100,
        rec_sd=res["test_recall"].std() * 100,
        f1=res["test_f1"].mean() * 100,
        auc=res["test_roc_auc"].mean() * 100,
        auc_sd=res["test_roc_auc"].std() * 100,
    )
    return row


def main():
    print("=" * 74)
    print("TIERED FEATURE ABLATION  -  logistic regression, 10-fold stratified CV")
    print("=" * 74)
    df = load()
    print()

    t1 = TIER1
    t2 = TIER1 + TIER2_ADD
    t3 = t2 + TIER3_ADD
    t4 = t3 + TIER4_ADD

    rows = [
        evaluate(df, t1, "1  Self-reportable"),
        evaluate(df, t2, "2  + home-measurable"),
        evaluate(df, t3, "3  + laboratory assays"),
        evaluate(df, t4, "4  + ultrasound"),
    ]

    print(f"{'Tier':<24}{'k':>4}{'n':>6}{'Acc':>9}{'Prec':>9}{'Rec':>9}{'F1':>9}{'AUC':>9}")
    print("-" * 80)
    for r in rows:
        print(f"{r['label']:<24}{r['k']:>4}{r['n']:>6}{r['acc']:>8.1f}%{r['prec']:>8.1f}%"
              f"{r['rec']:>8.1f}%{r['f1']:>8.1f}%{r['auc']:>9.1f}")
    print("-" * 80)
    print()
    print("WITH DISPERSION (mean +/- SD across the ten folds)")
    print(f"{'Tier':<24}{'Accuracy':>18}{'Recall':>18}{'AUC':>18}")
    print("-" * 80)
    for r in rows:
        print(f"{r['label']:<24}"
              f"{r['acc']:>11.1f} +/-{r['acc_sd']:>4.1f}"
              f"{r['rec']:>11.1f} +/-{r['rec_sd']:>4.1f}"
              f"{r['auc']:>11.1f} +/-{r['auc_sd']:>4.1f}")
    print("-" * 80)
    print("Report SD alongside point estimates; reviewers expect a dispersion")
    print("measure, and it shows whether inter-tier differences exceed fold noise.")
    print("n differs by tier: two records lack a laboratory value, so tiers 3")
    print("and 4 are evaluated on 537 records rather than 539.")

    t1r, t2r, t3r, t4r = rows
    print()
    print("DERIVED CLAIMS")
    print(f"  Tier 1 retains {t1r['acc']/t4r['acc']*100:.1f}% of Tier 4 accuracy")
    print(f"  Cost of withholding all clinical inputs: "
          f"{t4r['acc']-t1r['acc']:.1f} percentage points")
    print(f"  Laboratory assays (T2 -> T3): accuracy {t3r['acc']-t2r['acc']:+.1f} pts, "
          f"recall {t3r['rec']-t2r['rec']:+.1f} pts")
    print(f"  Ultrasound (T3 -> T4):        accuracy {t4r['acc']-t3r['acc']:+.1f} pts, "
          f"recall {t4r['rec']-t3r['rec']:+.1f} pts")
    print()
    print("NOTE: Tier 4 includes follicle counts, which are close to definitional")
    print("under the Rotterdam criteria. Read Tier 4 as an upper bound.")


if __name__ == "__main__":
    main()