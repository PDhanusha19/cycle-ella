"""
run_supplementary.py
------------------------------------------------------------------
Reproduces Section 6.4 of the thesis: the two supplementary feature
experiments that justify (a) excluding waist-to-hip ratio and
(b) retaining pregnant records in training.

These figures were NOT previously reproducible on your machine.
Run this, then send the output so the thesis can be corrected to
match what your data actually shows.

WHERE IT LIVES
    cycle-ella\\
      ai-service\\
        run_supplementary.py       <- here
        data\\PCOS_data_without_infertility.xlsx

HOW TO RUN
    cd C:\\Users\\USER\\cycle-ella\\ai-service
    python run_supplementary.py

The data path is resolved relative to this file, not the current
working directory, so it also works if you run it from elsewhere.
"""

import os
import warnings
warnings.filterwarnings("ignore")

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_validate

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE_DIR, "data", "PCOS_data_without_infertility.xlsx")
SEED = 42
TARGET = "PCOS (Y/N)"

TIER1 = [
    " Age (yrs)", "Weight (Kg)", "Height(Cm) ", "BMI",
    "Cycle(R/I)", "Cycle length(days)",
    "Weight gain(Y/N)", "hair growth(Y/N)", "Skin darkening (Y/N)",
    "Hair loss(Y/N)", "Pimples(Y/N)", "Fast food (Y/N)", "Reg.Exercise(Y/N)",
]


def cv(data, feats, seed=SEED):
    """Ten-fold stratified CV, same configuration as the ablation."""
    X = data[feats].values
    y = data[TARGET].values.astype(int)
    pipe = Pipeline([
        ("scale", StandardScaler()),
        ("clf", LogisticRegression(max_iter=5000, random_state=seed,
                                   class_weight="balanced")),
    ])
    r = cross_validate(pipe, X, y,
                       cv=StratifiedKFold(10, shuffle=True, random_state=seed),
                       scoring=["accuracy", "recall", "roc_auc"])
    return (r["test_accuracy"].mean() * 100,
            r["test_recall"].mean() * 100,
            r["test_roc_auc"].mean() * 100)


def main():
    df = pd.read_excel(DATA, sheet_name="Full_new")
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    extra = ["Waist:Hip Ratio", "Pregnant(Y/N)"]
    for c in TIER1 + extra + [TARGET]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df[df["Cycle(R/I)"].isin([2, 4])]
    base = df.dropna(subset=TIER1 + [TARGET])

    print("=" * 72)
    print("SUPPLEMENTARY EXPERIMENTS  (thesis Section 6.4)")
    print("=" * 72)

    # -------------------------------------------------- dataset description
    pos = int(base[TARGET].sum())
    n = len(base)
    print()
    print("DATASET  (Tier 1 feature set)")
    print(f"  records          : {n}")
    print(f"  positive (PCOS)  : {pos}")
    print(f"  negative         : {n - pos}")
    print(f"  positive class   : {pos/n*100:.1f}%")
    print(f"  cycle length mean: {base['Cycle length(days)'].mean():.2f} days"
          f"   (a flow duration, not an inter-period interval)")

    # -------------------------------------------------- experiment 1
    print()
    print("-" * 72)
    print("EXPERIMENT 1  Should waist-to-hip ratio be added?")
    print("-" * 72)
    wh = base.dropna(subset=["Waist:Hip Ratio"])
    print(f"  records with a waist:hip value: {len(wh)} of {n}")
    print("  Both models are evaluated on this SAME subset, so the only")
    print("  difference between them is the extra attribute.")
    print()
    a0, r0, u0 = cv(wh, TIER1)
    a1, r1, u1 = cv(wh, TIER1 + ["Waist:Hip Ratio"])
    print(f"  {'':<22}{'Acc':>9}{'Recall':>9}{'AUC':>9}")
    print(f"  {'13 attributes':<22}{a0:>8.1f}%{r0:>8.1f}%{u0:>9.1f}")
    print(f"  {'+ waist:hip (14)':<22}{a1:>8.1f}%{r1:>8.1f}%{u1:>9.1f}")
    print(f"  {'difference':<22}{a1-a0:>+8.1f} {r1-r0:>+8.1f} {u1-u0:>+8.1f}")

    print()
    print("  Normal-BMI subgroup (18.5 <= BMI < 25):")
    nb = wh[(wh["BMI"] >= 18.5) & (wh["BMI"] < 25)]
    m1 = nb[nb[TARGET] == 1]["Waist:Hip Ratio"].mean()
    m0 = nb[nb[TARGET] == 0]["Waist:Hip Ratio"].mean()
    print(f"    n = {len(nb)}")
    print(f"    mean waist:hip, PCOS      = {m1:.4f}")
    print(f"    mean waist:hip, non-PCOS  = {m0:.4f}")
    print(f"    difference                = {m1-m0:+.4f}")
    print("    A positive difference would support the measurement; a negative")
    print("    or near-zero one does not.")

    # -------------------------------------------------- experiment 2
    print()
    print("-" * 72)
    print("EXPERIMENT 2  Should pregnant records be kept in training?")
    print("-" * 72)
    preg = base[base["Pregnant(Y/N)"] == 1]
    non = base[base["Pregnant(Y/N)"] == 0]
    print(f"  pregnant records      : {len(preg)} of {n} ({len(preg)/n*100:.0f}%)")
    print(f"  PCOS rate, pregnant   : {preg[TARGET].mean()*100:.1f}%")
    print(f"  PCOS rate, not pregnant: {non[TARGET].mean()*100:.1f}%")
    print()
    print("  Evaluated on non-pregnant records only, since the artefact")
    print("  excludes pregnant users. Training set is the only thing varied.")
    print()

    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, recall_score, roc_auc_score

    Xn = non[TIER1].values
    yn = non[TARGET].values.astype(int)
    Xtr_n, Xte, ytr_n, yte = train_test_split(
        Xn, yn, test_size=0.25, stratify=yn, random_state=SEED)

    def fit_eval(Xtr, ytr, tag):
        p = Pipeline([("s", StandardScaler()),
                      ("c", LogisticRegression(max_iter=5000, random_state=SEED,
                                               class_weight="balanced"))])
        p.fit(Xtr, ytr)
        pr = p.predict(Xte)
        pb = p.predict_proba(Xte)[:, 1]
        print(f"  {tag:<34}{accuracy_score(yte,pr)*100:>7.1f}%"
              f"{recall_score(yte,pr)*100:>9.1f}%{roc_auc_score(yte,pb)*100:>8.1f}")

    print(f"  {'Training set':<34}{'Acc':>8}{'Recall':>9}{'AUC':>8}")
    fit_eval(Xtr_n, ytr_n, f"non-pregnant only (n={len(Xtr_n)})")
    Xall = pd.concat([non.iloc[[]], preg])[TIER1].values
    yall = pd.concat([non.iloc[[]], preg])[TARGET].values.astype(int)
    import numpy as np
    Xboth = np.vstack([Xtr_n, Xall])
    yboth = np.concatenate([ytr_n, yall])
    fit_eval(Xboth, yboth, f"non-pregnant + pregnant (n={len(Xboth)})")
    print(f"  fixed test set: {len(yte)} non-pregnant records")
    print()
    print("  If adding pregnant records raises recall, keep them in training")
    print("  and treat pregnancy as a usage exclusion instead.")


if __name__ == "__main__":
    main()