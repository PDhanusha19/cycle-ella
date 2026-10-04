"""
Filter-impact analysis for Model 2 (ai-service/food_recommender.py).

Measures how much passes_hard_filters() and score_food() actually change
recommender output, given the real 83-food dataset is heavily skewed
(glycemic_index: low 66 / medium 15 / high 2; pcos_friendly: true 79 / false 4).

Read-only replication, not an import: importing food_recommender.py would
run its module-level `FOODS = load_foods_from_db()`, which calls
mysql.connector.connect() at import time (mysql-connector-python is
installed in this venv) -- that's a live DB dependency this script must
not have. The filter/scoring logic below is copied verbatim from
food_recommender.py (checked against the file each run is meaningful for;
if that file changes, re-sync this copy by hand) and food_recommender.py
itself is never touched.

Run with: python analyze_filter_impact.py
"""

import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SEED_PATH = os.path.join(BASE_DIR, "..", "backend", "data", "foods_seed.json")
AUDITED_PATH = os.path.join(BASE_DIR, "..", "backend", "data", "foods_seed_audited.json")

TOP_N = 10

# ============================================================
# Replicated from food_recommender.py -- do not edit that file
# from here, edit there and re-sync.
# ============================================================

DIABETES_ALLOWED_GI = {
    "None": {"low", "medium", "high"},
    "Pre-diabetic": {"low", "medium", "high"},
    "Diet-controlled": {"low", "medium"},
    "Insulin-dependent": {"low"},
}
DIABETES_LEVELS = ["None", "Pre-diabetic", "Diet-controlled", "Insulin-dependent"]


def passes_gi_gate(food, diabetes_level):
    allowed_gi = DIABETES_ALLOWED_GI.get(diabetes_level, {"low", "medium", "high"})
    return food["_gi"] in allowed_gi


def passes_cholesterol_gate(food, cholesterol):
    if cholesterol and float(food["fats"]) > 10:
        return False
    return True


def passes_hard_filters(food, diabetes_level, cholesterol):
    return passes_gi_gate(food, diabetes_level) and passes_cholesterol_gate(food, cholesterol)


def score_food(food, risk_level, diabetes_level="None", bmi_category="normal"):
    """Score arithmetic copied verbatim from score_food() in
    food_recommender.py. The `reasons` list it also builds is dropped --
    this script only needs the numeric score, not the human-readable text."""
    score = 0
    gi = food["_gi"]
    calories = float(food["calories"])

    if food.get("pcos_friendly") in (1, True):
        score += 2

    if gi == "low":
        score += 3
    elif gi == "high":
        score -= 2

    if risk_level in ("High", "Medium") and food["category"] in ("protein", "vegetable"):
        score += 3

    if risk_level == "High" and float(food["protein"]) >= 10:
        score += 2

    if diabetes_level in ("Insulin-dependent", "Diet-controlled") and gi == "low":
        score += 2
    elif diabetes_level == "Pre-diabetic" and gi == "high":
        score -= 1

    if bmi_category in ("overweight", "obese"):
        if calories <= 150:
            score += 2
        elif calories > 300:
            score -= 2
    elif bmi_category == "underweight":
        if calories >= 250:
            score += 2
        elif float(food["protein"]) >= 10:
            score += 1

    return score


# ============================================================
# Synthetic profile grid
# ============================================================

RISK_LEVELS = ["Low", "Medium", "High"]

# get_bmi_category() in food_recommender.py can only ever produce these 4
# labels (thresholds: <18.5, <25, <30, >=30) -- there is no 3-band variant
# anywhere in the codebase. The task asked for "3 BMI bands" while the
# original grid spec asked for these same 4; using all 4 here since that's
# what the real system can actually produce. Flagged in the summary too.
BMI_CATEGORIES = ["underweight", "normal", "overweight", "obese"]

# Confirmed mapping from the synthetic-profile vocabulary to the exact
# strings normalize_diabetes_level() recognizes (anything else silently
# falls through to "None").
DIABETES_LABEL_MAP = {
    "none": "None",
    "prediabetic": "Pre-diabetic",
    "type2_controlled": "Diet-controlled",
    "type2_severe": "Insulin-dependent",
}

CHOLESTEROL_LEVELS = [("normal", False), ("high", True)]


def profile_grid():
    for risk in RISK_LEVELS:
        for bmi in BMI_CATEGORIES:
            for diab_label, diab_level in DIABETES_LABEL_MAP.items():
                for chol_label, chol_flag in CHOLESTEROL_LEVELS:
                    yield {
                        "risk_level": risk,
                        "bmi_category": bmi,
                        "diabetes_label": diab_label,
                        "diabetes_level": diab_level,
                        "cholesterol_label": chol_label,
                        "cholesterol": chol_flag,
                    }


# ============================================================
# Data loading
# ============================================================


def load_dataset(path, gi_field, required):
    """Returns (foods, error_message). For an optional dataset (required=False),
    a missing/empty/malformed file is reported back as an error message rather
    than raised, so the caller can skip that table gracefully. A required
    dataset raises SystemExit instead, since the rest of the script can't run
    without it. Either way, a row with a missing/null gi_field value is always
    a hard stop -- that's an audit gap, not a file-availability problem, and
    shouldn't be silently skipped."""
    norm = os.path.normpath(path)

    if not os.path.exists(path):
        if required:
            raise SystemExit(f"Cannot find {norm}. Run backend/export_foods.js first.")
        return None, f"not found at {norm}"

    with open(path, "r", encoding="utf-8") as fh:
        raw = fh.read()

    if not raw.strip():
        if required:
            raise SystemExit(f"{norm} exists but is empty.")
        return None, f"exists but is empty (0 bytes) at {norm}"

    try:
        rows = json.loads(raw)
    except json.JSONDecodeError as e:
        if required:
            raise SystemExit(f"{norm} is not valid JSON: {e}")
        return None, f"is not valid JSON at {norm} ({e})"

    if not isinstance(rows, list) or len(rows) == 0:
        if required:
            raise SystemExit(f"{norm} contains no rows.")
        return None, f"contains no rows at {norm}"

    foods = []
    for r in rows:
        f = dict(r)
        f["_gi"] = f.get(gi_field)
        foods.append(f)

    missing = [f.get("name", f.get("id", "?")) for f in foods if f["_gi"] is None]
    if missing:
        raise SystemExit(
            f"'{gi_field}' is missing/null for {len(missing)} food(s) in {norm}: "
            f"{', '.join(str(m) for m in missing)}. Stopping rather than guessing a value."
        )
    return foods, None


# ============================================================
# Per-profile analysis
# ============================================================


def analyze_profile(foods, profile):
    diabetes_level = profile["diabetes_level"]
    cholesterol = profile["cholesterol"]
    risk = profile["risk_level"]
    bmi = profile["bmi_category"]

    gi_excluded = [f for f in foods if not passes_gi_gate(f, diabetes_level)]
    chol_excluded = [f for f in foods if not passes_cholesterol_gate(f, cholesterol)]
    survivors = [f for f in foods if passes_hard_filters(f, diabetes_level, cholesterol)]

    top_with = sorted(survivors, key=lambda f: -score_food(f, risk, diabetes_level, bmi))[:TOP_N]
    top_without = sorted(foods, key=lambda f: -score_food(f, risk, diabetes_level, bmi))[:TOP_N]

    without_ids = {f["id"] for f in top_without}
    overlap = sum(1 for f in top_with if f["id"] in without_ids)

    return {
        "profile": profile,
        "n_total": len(foods),
        "n_gi_excluded": len(gi_excluded),
        "n_chol_excluded": len(chol_excluded),
        "n_survivors": len(survivors),
        "top_with_n": len(top_with),
        "overlap": overlap,
        "identical": len(top_with) == TOP_N and overlap == TOP_N,
        "gi_excluded_names": {f["name"] for f in gi_excluded},
        "chol_excluded_names": {f["name"] for f in chol_excluded},
    }


def profile_label(p):
    return (
        f"risk={p['risk_level']:<6} bmi={p['bmi_category']:<11} "
        f"diabetes={p['diabetes_label']:<17} chol={p['cholesterol_label']:<6}"
    )


# ============================================================
# Report sections
# ============================================================


def section(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def report_gate_breakdown(foods, dataset_label):
    section(f"[{dataset_label}] Gate breakdown (N={len(foods)})")

    print("\n-- Cholesterol gate (fats > 10) --")
    print("Independent of diabetes/risk/bmi; only depends on the cholesterol flag.")
    excluded = [f for f in foods if not passes_cholesterol_gate(f, True)]
    print(f"When cholesterol=True: {len(excluded)} of {len(foods)} excluded")
    for f in sorted(excluded, key=lambda f: -float(f["fats"])):
        print(f"  {f['name']:<28} fats={f['fats']}")
    print("When cholesterol=False: 0 excluded (gate not applied)")

    print("\n-- GI gate, by diabetes level --")
    print("Independent of risk_level/bmi_category; only depends on diabetes_level.")
    for level in DIABETES_LEVELS:
        excluded = [f for f in foods if not passes_gi_gate(f, level)]
        allowed = sorted(DIABETES_ALLOWED_GI[level])
        print(f"  {level:<18} allowed GI={allowed}  excluded={len(excluded)} of {len(foods)}")
        for f in excluded:
            print(f"      {f['name']:<28} glycemic_index={f['_gi']}")


def report_survivor_matrix(foods, dataset_label):
    section(f"[{dataset_label}] Hard-filter survivors: diabetes x cholesterol")
    print(f"{'diabetes_level':<18} {'cholesterol':<10} survivors / {len(foods)}")
    for level in DIABETES_LEVELS:
        for chol_label, chol_flag in CHOLESTEROL_LEVELS:
            n = sum(1 for f in foods if passes_hard_filters(f, level, chol_flag))
            print(f"{level:<18} {chol_label:<10} {n}")
    print(
        "\nNote: passes_hard_filters() takes only (food, diabetes_level, cholesterol) --\n"
        "risk_level and bmi_category are never passed to it. Every (bmi_category,\n"
        "risk_level) cell for a fixed (diabetes_level, cholesterol) pair has this exact\n"
        "same survivor count; bmi/risk only re-rank survivors via score_food(), they\n"
        "never change how many foods survive. That fully answers 'is any profile left\n"
        "with too few foods' -- expanding this to a literal diabetes x bmi x risk table\n"
        "would just repeat each of the 8 rows above 6 or 12 times."
    )


def report_full_grid(foods_a, foods_b, dataset_b_label):
    section("Full grid: risk(3) x bmi(4) x diabetes(4) x cholesterol(2) = 96 profiles")
    header = f"{'profile':<62} {'surv_A':>7}"
    if foods_b is not None:
        header += f" {'surv_B':>7} {'delta':>6}"
    header += f" {'top10_A':>8} {'overlap_A':>10}"
    print(header)

    results_a = []
    results_b = []
    for profile in profile_grid():
        ra = analyze_profile(foods_a, profile)
        results_a.append(ra)
        line = f"{profile_label(profile):<62} {ra['n_survivors']:>7}"
        if foods_b is not None:
            rb = analyze_profile(foods_b, profile)
            results_b.append(rb)
            delta = rb["n_survivors"] - ra["n_survivors"]
            line += f" {rb['n_survivors']:>7} {delta:>+6}"
        line += f" {ra['top_with_n']:>8} {ra['overlap']:>7}/10"
        print(line)

    return results_a, results_b if foods_b is not None else None


def report_summary(results, dataset_label):
    section(f"[{dataset_label}] Summary across 96 profiles")
    survivors = [r["n_survivors"] for r in results]
    overlaps = [r["overlap"] for r in results]
    identical = [r for r in results if r["identical"]]
    most_restrictive = min(results, key=lambda r: r["n_survivors"])

    print(f"Surviving foods per profile: min={min(survivors)} max={max(survivors)} "
          f"mean={sum(survivors)/len(survivors):.1f}")
    print(f"Mean top-10 overlap (filtered vs unfiltered): {sum(overlaps)/len(overlaps):.1f} / 10")
    print(f"Profiles with an IDENTICAL top-10 (10/10 overlap, full 10 survivors): "
          f"{len(identical)} of {len(results)}")
    print(f"Most restrictive profile: {profile_label(most_restrictive['profile'])} "
          f"-> {most_restrictive['n_survivors']} survivors")

    all_excluded_names = set()
    for r in results:
        all_excluded_names |= r["gi_excluded_names"]
        all_excluded_names |= r["chol_excluded_names"]
    print(f"\nFoods excluded in at least one of the 96 profiles ({len(all_excluded_names)}):")
    for name in sorted(all_excluded_names):
        print(f"  {name}")


def report_delta(results_a, results_b):
    section("Delta in foods excluded per profile: (a) glycemic_index vs (b) gi_proposed")
    deltas = [rb["n_survivors"] - ra["n_survivors"] for ra, rb in zip(results_a, results_b)]
    print(f"Dataset A total foods: {results_a[0]['n_total']}   "
          f"Dataset B total foods: {results_b[0]['n_total']}")
    print(f"Survivor-count delta (B - A) per profile: min={min(deltas)} max={max(deltas)} "
          f"mean={sum(deltas)/len(deltas):.2f}")
    changed = sum(1 for d in deltas if d != 0)
    print(f"Profiles where the survivor count changed: {changed} of {len(deltas)}")


# ============================================================
# Main
# ============================================================


def main():
    foods_a, _ = load_dataset(SEED_PATH, "glycemic_index", required=True)
    print(f"Dataset A loaded: {len(foods_a)} foods from {os.path.normpath(SEED_PATH)} "
          f"(field: glycemic_index)")

    foods_b, err_b = load_dataset(AUDITED_PATH, "gi_proposed", required=False)
    if foods_b is None:
        print(f"Dataset B skipped -- {err_b}.\n"
              f"Run `node backend/apply_food_audit.js` (no --report flag) to produce it, "
              f"then re-run this script.")
    else:
        print(f"Dataset B loaded: {len(foods_b)} foods from {os.path.normpath(AUDITED_PATH)} "
              f"(field: gi_proposed)")

    report_gate_breakdown(foods_a, "Dataset A: glycemic_index")
    report_survivor_matrix(foods_a, "Dataset A: glycemic_index")
    if foods_b is not None:
        report_gate_breakdown(foods_b, "Dataset B: gi_proposed")
        report_survivor_matrix(foods_b, "Dataset B: gi_proposed")

    results_a, results_b = report_full_grid(foods_a, foods_b, "gi_proposed")
    report_summary(results_a, "Dataset A: glycemic_index")
    if results_b is not None:
        report_summary(results_b, "Dataset B: gi_proposed")
        report_delta(results_a, results_b)


if __name__ == "__main__":
    main()
