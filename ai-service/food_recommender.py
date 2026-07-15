"""
MODEL 2: Personalized Food Recommendation Engine
===================================================
Content-based filtering — recommends foods based on YOUR actual
profile (risk level, cycle phase, BMI, health conditions), not
fake "users like you" data.

Every recommendation comes with a reason, so it's transparent,
not a black box.
"""

import json
import os
import numpy as np
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FOODS_PATH = os.path.join(BASE_DIR, "data", "foods.json")

with open(FOODS_PATH) as f:
    FOODS = json.load(f)

# ============================================
# KNN NUTRITIONAL SIMILARITY (cosine similarity)
# Treats each food's [calories, protein, carbs, fats] as a vector
# and finds the nutritionally-closest foods to any given one.
# Real ML technique (K-Nearest Neighbors), computed on real food
# data — no fake users, no training data needed beyond the foods
# themselves.
# ============================================
_food_ids = [f["id"] for f in FOODS]
_feature_matrix = np.array([
    [f["calories"], f["protein"], f["carbs"], f["fats"]] for f in FOODS
])

_scaler = StandardScaler()
_scaled_features = _scaler.fit_transform(_feature_matrix)

_knn = NearestNeighbors(n_neighbors=min(4, len(FOODS)), metric="cosine")
_knn.fit(_scaled_features)


def find_similar_foods(food_id, n=3):
    """Returns the n foods nutritionally most similar to the given food_id
    (excluding the food itself), using cosine similarity on
    [calories, protein, carbs, fats]."""
    try:
        idx = _food_ids.index(food_id)
    except ValueError:
        return []

    distances, indices = _knn.kneighbors([_scaled_features[idx]], n_neighbors=min(n + 1, len(FOODS)))

    similar = []
    for dist, i in zip(distances[0], indices[0]):
        if _food_ids[i] == food_id:
            continue
        food = FOODS[i]
        similarity_pct = round((1 - dist) * 100, 1)  # cosine distance -> similarity %
        similar.append({**food, "similarity_percent": similarity_pct})
        if len(similar) >= n:
            break
    return similar


def get_bmi_category(bmi):
    if bmi < 18.5:
        return "underweight"
    if bmi < 25:
        return "normal"
    if bmi < 30:
        return "overweight"
    return "obese"


# Diabetes severity -> max carbs per food (grams). Stricter control
# needs a lower ceiling. 'None' means no diabetes-related limit.
DIABETES_CARB_LIMITS = {
    "None": None,
    "Pre-diabetic": 45,
    "Diet-controlled": 35,
    "Insulin-dependent": 25,
}


def normalize_diabetes_level(diabetes):
    """Accepts either the new severity strings ('None', 'Pre-diabetic',
    'Diet-controlled', 'Insulin-dependent') or the old True/False
    boolean for backward compatibility with older callers."""
    if isinstance(diabetes, bool):
        return "Diet-controlled" if diabetes else "None"
    if diabetes in DIABETES_CARB_LIMITS:
        return diabetes
    return "None"  # unrecognized value -> safest default, no filter


def passes_hard_filters(food, diabetes_level, cholesterol):
    """Foods that are medically unsuitable get excluded entirely,
    not just deprioritized."""
    carb_limit = DIABETES_CARB_LIMITS.get(diabetes_level)
    if carb_limit is not None and food["carbs"] > carb_limit:
        return False
    if cholesterol and food["fats"] > 10:
        return False
    return True


def score_food(food, risk_level, phase, bmi_category, diabetes_level="None"):
    """
    Returns (score, reasons) — a transparent, explainable score.
    Higher score = better fit for this specific person right now.
    """
    score = 0
    reasons = []

    # --- Cycle phase match ---
    if "all" in food["phase"] or phase in food["phase"]:
        score += 3
        if phase in food["phase"]:
            reasons.append(f"good for your {phase.lower()} phase")

    # --- BMI suitability match ---
    if "all" in food["suitable_for"] or bmi_category in food["suitable_for"]:
        score += 2

    # --- PCOS risk-level adjustments ---
    # Higher PCOS risk benefits from more protein/fiber, less
    # refined carbs/sugar (standard PCOS dietary guidance:
    # lower glycemic load helps manage insulin resistance).
    if risk_level in ("High", "Medium"):
        if food["category"] in ("protein", "vegetable"):
            score += 3
            reasons.append("high in protein/fiber, good for managing PCOS symptoms")
        if food["category"] == "carbs" and food["carbs"] > 35:
            score -= 2
        if food["category"] == "fruit" and food["carbs"] > 20:
            score -= 1
        if food["category"] == "snack" and food["carbs"] > 15:
            score -= 1

    if risk_level == "High":
        # Extra weight on protein for high risk specifically
        if food["protein"] >= 10:
            score += 2
            reasons.append("high protein content")

    # --- Diabetes severity adjustments ---
    # Beyond the hard carb-limit filter, more severe diabetes gets
    # an extra preference for lower-carb, higher-protein foods —
    # not just "allowed", but actively favored.
    if diabetes_level == "Insulin-dependent":
        if food["carbs"] <= 10:
            score += 3
            reasons.append("low-carb, suitable for insulin-dependent diabetes")
        if food["protein"] >= 8:
            score += 1
    elif diabetes_level == "Diet-controlled":
        if food["carbs"] <= 20:
            score += 2
            reasons.append("moderate-carb, suitable for diet-controlled diabetes")
    elif diabetes_level == "Pre-diabetic":
        if food["carbs"] <= 30:
            score += 1

    return score, reasons


def recommend_foods(risk_level="Medium", phase="Follicular", bmi=22,
                     diabetes="None", cholesterol=False, top_n=8):
    bmi_category = get_bmi_category(bmi)
    diabetes_level = normalize_diabetes_level(diabetes)

    scored = []
    for food in FOODS:
        if not passes_hard_filters(food, diabetes_level, cholesterol):
            continue
        score, reasons = score_food(food, risk_level, phase, bmi_category, diabetes_level)
        scored.append({**food, "score": score, "reasons": reasons})

    scored.sort(key=lambda f: -f["score"])
    top = scored[:top_n]

    # Attach nutritionally-similar alternatives to each top pick using KNN
    for food in top:
        food["similar_alternatives"] = find_similar_foods(food["id"], n=2)

    return {
        "recommendations": top,
        "algorithm": "Content-Based Filtering + K-Nearest Neighbors (nutritional similarity)",
        "based_on": {
            "risk_level": risk_level,
            "cycle_phase": phase,
            "bmi_category": bmi_category,
            "diabetes_level": diabetes_level,
            "cholesterol_filter_applied": bool(cholesterol),
        },
    }


def generate_meal_plan(risk_level="Medium", phase="Follicular", bmi=22,
                        diabetes="None", cholesterol=False):
    """Builds a simple breakfast/lunch/dinner/snack plan using the
    same scoring, picking the best-scoring food per category slot."""
    bmi_category = get_bmi_category(bmi)
    diabetes_level = normalize_diabetes_level(diabetes)

    def best_of_category(category, exclude_ids, n=1):
        candidates = [
            f for f in FOODS
            if f["category"] == category
            and f["id"] not in exclude_ids
            and passes_hard_filters(f, diabetes_level, cholesterol)
        ]
        scored = []
        for food in candidates:
            score, reasons = score_food(food, risk_level, phase, bmi_category, diabetes_level)
            scored.append({**food, "score": score, "reasons": reasons})
        scored.sort(key=lambda f: -f["score"])
        return scored[:n]

    used_ids = set()

    def pick(category, n=1):
        picks = best_of_category(category, used_ids, n)
        for p in picks:
            used_ids.add(p["id"])
        return picks

    breakfast = pick("carbs", 1) + pick("protein", 1) + pick("drink", 1)
    lunch = pick("carbs", 1) + pick("protein", 1) + pick("vegetable", 2)
    dinner = pick("vegetable", 1) + pick("protein", 1)
    snacks = pick("fruit", 1) + pick("snack", 1)

    all_meals = breakfast + lunch + dinner + snacks
    totals = {
        "calories": sum(f["calories"] for f in all_meals),
        "protein": round(sum(f["protein"] for f in all_meals), 1),
        "carbs": round(sum(f["carbs"] for f in all_meals), 1),
        "fats": round(sum(f["fats"] for f in all_meals), 1),
    }

    return {
        "meal_plan": {
            "breakfast": breakfast, "lunch": lunch,
            "dinner": dinner, "snacks": snacks,
        },
        "total_nutrition": totals,
        "algorithm": "Content-Based Meal Planning",
        "based_on": {
            "risk_level": risk_level, "cycle_phase": phase,
            "bmi_category": bmi_category,
        },
    }


def search_foods(query):
    q = query.lower()
    return [f for f in FOODS if q in f["name"].lower()]


def get_all_foods():
    return FOODS