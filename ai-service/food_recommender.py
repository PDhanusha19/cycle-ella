"""
MODEL 2: Personalized Food Recommendation Engine (v2 — real data)
=====================================================================
Now reads your REAL 83-food MySQL database instead of a small
hardcoded list. Uses your real glycemic_index and pcos_friendly
columns for more accurate, medically-grounded scoring.

Honest limitation: your foods table has no cycle-phase tagging,
so that specific bonus from the earlier version is gone. BMI
category is handled without needing a tagging column — it nudges
scoring using each food's own calorie/protein values instead.
Everything else (risk-level scoring, diabetes severity, cholesterol
filtering, KNN similarity) uses your real data and is more accurate
than before.

If MySQL is unreachable, falls back to a small built-in backup
list so the service doesn't go down entirely — same safety net
your original app.py had.
"""

import os
import numpy as np
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

try:
    import mysql.connector
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False

try:
    from dotenv import load_dotenv
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(BASE_DIR, ".env"))
except ImportError:
    pass

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "user": os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", ""),
    "database": os.environ.get("DB_NAME", "cycleella"),
}

# Small backup list, used ONLY if MySQL is unreachable, so the
# service degrades gracefully instead of crashing entirely.
BACKUP_FOODS = [
    {"id": 1, "name": "Red Rice", "calories": 216, "protein": 5, "carbs": 45, "fats": 1.6,
     "category": "carbs", "glycemic_index": "medium", "pcos_friendly": 1},
    {"id": 2, "name": "Dhal Curry", "calories": 220, "protein": 12, "carbs": 35, "fats": 3,
     "category": "protein", "glycemic_index": "low", "pcos_friendly": 1},
    {"id": 3, "name": "Boiled Eggs", "calories": 78, "protein": 6, "carbs": 0.6, "fats": 5,
     "category": "protein", "glycemic_index": "low", "pcos_friendly": 1},
    {"id": 4, "name": "Gotukola Sambol", "calories": 45, "protein": 2, "carbs": 8, "fats": 0.5,
     "category": "vegetable", "glycemic_index": "low", "pcos_friendly": 1},
]


def load_foods_from_db():
    """Loads the real 83-food database from MySQL. Falls back to a
    small backup list if the connection fails for any reason."""
    if not MYSQL_AVAILABLE:
        print("mysql-connector not installed — using backup food list")
        return BACKUP_FOODS

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, name, calories, protein, carbs, fats, category, "
                        "glycemic_index, pcos_friendly, cuisine, sinhala_name, tamil_name FROM foods")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        if not rows:
            print("foods table is empty — using backup food list")
            return BACKUP_FOODS
        print(f"Loaded {len(rows)} real foods from MySQL")
        return rows
    except Exception as e:
        print(f"MySQL connection failed ({e}) — using backup food list")
        return BACKUP_FOODS


FOODS = load_foods_from_db()

# ============================================
# KNN NUTRITIONAL SIMILARITY (cosine similarity)
# ============================================
_food_ids = [f["id"] for f in FOODS]
_feature_matrix = np.array([
    [float(f["calories"]), float(f["protein"]), float(f["carbs"]), float(f["fats"])] for f in FOODS
])

_scaler = StandardScaler()
_scaled_features = _scaler.fit_transform(_feature_matrix)

_knn = NearestNeighbors(n_neighbors=min(4, len(FOODS)), metric="cosine")
_knn.fit(_scaled_features)


def find_similar_foods(food_id, n=3):
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
        similarity_pct = round((1 - dist) * 100, 1)
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


# Diabetes severity -> which glycemic-index levels are allowed at all.
# Real GI data is a better clinical signal than a raw carb-gram cutoff.
DIABETES_ALLOWED_GI = {
    "None": {"low", "medium", "high"},
    "Pre-diabetic": {"low", "medium", "high"},   # allowed, but high GI deprioritized in scoring
    "Diet-controlled": {"low", "medium"},
    "Insulin-dependent": {"low"},
}


def normalize_diabetes_level(diabetes):
    if isinstance(diabetes, bool):
        return "Diet-controlled" if diabetes else "None"
    if diabetes in DIABETES_ALLOWED_GI:
        return diabetes
    return "None"


def passes_hard_filters(food, diabetes_level, cholesterol):
    allowed_gi = DIABETES_ALLOWED_GI.get(diabetes_level, {"low", "medium", "high"})
    if food.get("glycemic_index") not in allowed_gi:
        return False
    if cholesterol and float(food["fats"]) > 10:
        return False
    return True


def score_food(food, risk_level, diabetes_level="None", bmi_category="normal"):
    """
    Returns (score, reasons). No phase-suitability bonus — your real
    database doesn't tag foods that way, so that dimension is honestly
    left out rather than faked. BMI category nudges scoring toward
    calorie-appropriate choices (lighter foods when managing weight
    down, denser foods when managing weight up) using each food's own
    calorie/protein values — no separate tagging needed for this one.
    """
    score = 0
    reasons = []
    gi = food.get("glycemic_index")
    calories = float(food["calories"])

    # --- Real pcos_friendly flag ---
    if food.get("pcos_friendly") in (1, True):
        score += 2
        reasons.append("tagged PCOS-friendly")

    # --- Real glycemic index ---
    if gi == "low":
        score += 3
        reasons.append("low glycemic index")
    elif gi == "high":
        score -= 2

    # --- PCOS risk-level adjustments ---
    if risk_level in ("High", "Medium"):
        if food["category"] in ("protein", "vegetable"):
            score += 3
            reasons.append("high in protein/fiber, good for managing PCOS symptoms")

    if risk_level == "High" and float(food["protein"]) >= 10:
        score += 2
        reasons.append("high protein content")

    # --- Diabetes severity extra weighting (beyond the hard filter) ---
    if diabetes_level in ("Insulin-dependent", "Diet-controlled") and gi == "low":
        score += 2
        reasons.append(f"low-GI, suitable for {diabetes_level.lower()} diabetes")
    elif diabetes_level == "Pre-diabetic" and gi == "high":
        score -= 1

    # --- BMI category adjustments ---
    if bmi_category in ("overweight", "obese"):
        if calories <= 150:
            score += 2
            reasons.append("lower-calorie, good fit while managing weight")
        elif calories > 300:
            score -= 2
    elif bmi_category == "underweight":
        if calories >= 250:
            score += 2
            reasons.append("calorie-dense, helpful for healthy weight gain")
        elif float(food["protein"]) >= 10:
            score += 1
            reasons.append("protein-rich to support weight gain")

    return score, reasons


def recommend_foods(risk_level="Medium", phase="Follicular", bmi=22,
                     diabetes="None", cholesterol=False, top_n=8):
    """`phase` is accepted for API compatibility but no longer affects
    scoring — your real food data has no phase tagging."""
    bmi_category = get_bmi_category(bmi)
    diabetes_level = normalize_diabetes_level(diabetes)

    scored = []
    for food in FOODS:
        if not passes_hard_filters(food, diabetes_level, cholesterol):
            continue
        score, reasons = score_food(food, risk_level, diabetes_level, bmi_category)
        scored.append({**food, "score": score, "reasons": reasons})

    scored.sort(key=lambda f: -f["score"])
    top = scored[:top_n]

    for food in top:
        food["similar_alternatives"] = find_similar_foods(food["id"], n=2)

    return {
        "recommendations": top,
        "algorithm": "Content-Based Filtering + K-Nearest Neighbors (real MySQL data)",
        "based_on": {
            "risk_level": risk_level,
            "bmi_category": bmi_category,
            "diabetes_level": diabetes_level,
            "cholesterol_filter_applied": bool(cholesterol),
            "total_foods_available": len(FOODS),
        },
    }


def generate_meal_plan(risk_level="Medium", phase="Follicular", bmi=22,
                        diabetes="None", cholesterol=False):
    """`phase` is accepted for API compatibility but no longer affects
    the plan — your real food data has no phase tagging."""
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
            score, reasons = score_food(food, risk_level, diabetes_level, bmi_category)
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
    dinner = pick("traditional", 1) + pick("protein", 1) + pick("vegetable", 1)
    snacks = pick("fruit", 1) + pick("snack", 1)

    all_meals = breakfast + lunch + dinner + snacks
    totals = {
        "calories": sum(float(f["calories"]) for f in all_meals),
        "protein": round(sum(float(f["protein"]) for f in all_meals), 1),
        "carbs": round(sum(float(f["carbs"]) for f in all_meals), 1),
        "fats": round(sum(float(f["fats"]) for f in all_meals), 1),
    }

    return {
        "meal_plan": {"breakfast": breakfast, "lunch": lunch, "dinner": dinner, "snacks": snacks},
        "total_nutrition": totals,
        "algorithm": "Content-Based Meal Planning (real MySQL data)",
        "based_on": {"risk_level": risk_level, "bmi_category": bmi_category, "diabetes_level": diabetes_level},
    }


def search_foods(query):
    q = query.lower()
    return [f for f in FOODS if q in f["name"].lower()]


def get_all_foods():
    return FOODS