"""
run_filter_impact.py
------------------------------------------------------------------
Reproduces Table 6.3 of the thesis (Table IV of the ICAC paper):
how many foods each hard filter removes.

Run this yourself so you have your own console output as an audit
trail, the same way you did for the ablation.

WHERE TO PUT IT
    cycle-ella\\
      run_filter_impact.py          <- here
      backend\\
        data\\
          foods_seed.json           <- reads this

If backend/data/foods_seed.json does not exist yet, run your
export_foods.js first to create it.

HOW TO RUN
    cd C:\\Users\\USER\\cycle-ella
    python run_filter_impact.py

This script only READS your data. It changes nothing and never
connects to MySQL.
"""

import json
import os
import sys

# Default reads the ORIGINAL database. Pass --audited to read the corrected
# file produced by apply_food_audit.js, which uses the gi_proposed field.
AUDITED = "--audited" in sys.argv
FILENAME = "foods_seed_audited.json" if AUDITED else "foods_seed.json"
GI_FIELD = "gi_proposed" if AUDITED else "glycemic_index"

VERSION = "v2 (supports --audited)"


def locate(filename):
    """Find the data file whether run from the repo root or from ai-service."""
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join("backend", "data", filename),            # cwd = repo root
        os.path.join("..", "backend", "data", filename),      # cwd = ai-service
        os.path.join(here, "backend", "data", filename),      # beside this script
        os.path.join(here, "..", "backend", "data", filename),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return os.path.abspath(candidates[0])


DATA = locate(FILENAME)

# The GI levels each diabetes status is allowed to receive.
# This mirrors DIABETES_ALLOWED_GI in ai-service/food_recommender.py
DIABETES_ALLOWED_GI = {
    "None":              {"low", "medium", "high"},
    "Pre-diabetic":      {"low", "medium", "high"},
    "Diet-controlled":   {"low", "medium"},
    "Insulin-dependent": {"low"},
}

FAT_LIMIT = 10.0   # cholesterol gate: excluded when fats > 10 g


def load():
    if not os.path.exists(DATA):
        print(f"Cannot find {DATA}")
        if AUDITED:
            print("Run:  node backend/apply_food_audit.js")
        else:
            print("Run export_foods.js first to produce it.")
        sys.exit(1)
    rows = json.load(open(DATA, encoding="utf-8"))
    label = "AUDITED (gi_proposed)" if AUDITED else "ORIGINAL (glycemic_index)"
    print(f"loaded {len(rows)} food records from {DATA}")
    print(f"reading GI from field: {GI_FIELD}   -> dataset {label}")
    return rows


def gi_of(food):
    return str(food.get(GI_FIELD, "")).strip().lower()


def main():
    print("=" * 70)
    print("HARD FILTER REACH  -  how many foods each filter removes")
    print("script " + VERSION)
    print("=" * 70)
    foods = load()
    total = len(foods)

    # ---------------- GI distribution: this is what drives the whole table
    dist = {}
    for f in foods:
        dist[gi_of(f)] = dist.get(gi_of(f), 0) + 1
    print()
    print("Glycaemic index distribution")
    for level in ("low", "medium", "high"):
        print(f"  {level:<8}{dist.get(level, 0):>4}")
    other = {k: v for k, v in dist.items() if k not in ("low", "medium", "high")}
    if other:
        print(f"  UNRECOGNISED: {other}   <- these bypass the filter, check them")
    print(f"  {'total':<8}{total:>4}")

    # ---------------- GI gate, per diabetes status
    print()
    print("Filter 1: glycaemic index gate, by declared diabetes status")
    print(f"{'Declared status':<22}{'Allowed GI':<26}{'Excluded':>9}{'Of total':>10}")
    print("-" * 70)
    for status, allowed in DIABETES_ALLOWED_GI.items():
        excluded = [f for f in foods if gi_of(f) not in allowed]
        pct = len(excluded) / total * 100
        allow_str = ", ".join(sorted(allowed, key=lambda x: ["low","medium","high"].index(x)))
        print(f"{status:<22}{allow_str:<26}{len(excluded):>9}{pct:>9.1f}%")
        if 0 < len(excluded) <= 20:
            for f in excluded:
                print(f"        - {f['name']}  (GI {gi_of(f)})")

    # ---------------- cholesterol gate
    print()
    print("Filter 2: cholesterol gate, applied when elevated cholesterol declared")
    high_fat = [f for f in foods if float(f.get("fats", 0) or 0) > FAT_LIMIT]
    print(f"  foods above {FAT_LIMIT:.0f} g fat: {len(high_fat)}"
          f"  ({len(high_fat)/total*100:.1f}% of {total})")
    for f in sorted(high_fat, key=lambda x: -float(x.get("fats", 0) or 0)):
        print(f"        - {f['name']:<28}{float(f['fats']):>6.1f} g fat")

    # ---------------- summary in the shape of the thesis table
    print()
    print("=" * 70)
    print("TABLE AS IT APPEARS IN THE THESIS")
    print("=" * 70)
    print(f"{'Declared status':<26}{'Excluded':>10}{'Of ' + str(total):>10}")
    print("-" * 70)
    for status, allowed in DIABETES_ALLOWED_GI.items():
        n = len([f for f in foods if gi_of(f) not in allowed])
        print(f"{status:<26}{n:>10}{n/total*100:>9.1f}%")
    print(f"{'Elevated cholesterol':<26}{len(high_fat):>10}{len(high_fat)/total*100:>9.1f}%")
    print()
    print("NOTE: the cholesterol gate filters on TOTAL fat, because the database")
    print("records no saturated fat value. It therefore removes nuts, avocado and")
    print("oily fish, which are predominantly unsaturated. This is reported as a")
    print("negative finding, not a defect to be hidden.")
    if not AUDITED:
        print()
        print("This was the ORIGINAL database. To see the corrected figures, run:")
        print("    python run_filter_impact.py --audited")


if __name__ == "__main__":
    main()