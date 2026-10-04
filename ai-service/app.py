# ============================================
# CYCLE ELLA — PYTHON AI SERVICE v5.0 (clean)
# Model 1: PCOS Detector + Risk Level
#   - Symptom-only questions, no lab test needed
#   - Trained on 539 real patients (Kerala, India)
#   - 80.6% accuracy, catches ~83% of real PCOS cases
# Port: 5001
# ============================================

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import json
import os
import pandas as pd
from food_recommender import recommend_foods, generate_meal_plan, search_foods, get_all_foods, find_similar_foods

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

# ============================================
# LOAD MODEL 1 (Logistic Regression)
# ============================================
pcos_model = joblib.load(os.path.join(MODELS_DIR, "pcos_model_logistic_regression.pkl"))
feature_scaler = joblib.load(os.path.join(MODELS_DIR, "pcos_feature_scaler.pkl"))
with open(os.path.join(MODELS_DIR, "pcos_model_metadata.json")) as f:
    pcos_metadata = json.load(f)

pcos_metrics = pcos_metadata["metrics"]
FEATURE_ORDER = pcos_metadata["feature_order"]
print(f"Model 1 loaded (Logistic Regression). Test accuracy: {pcos_metrics['test_accuracy']}%")

# ============================================
# HELPERS
# ============================================
def compute_bmi(weight_kg, height_cm):
    height_m = height_cm / 100
    return round(weight_kg / (height_m ** 2), 1)


def get_risk_level(probability):
    if probability < 0.33:
        return "Low"
    elif probability < 0.66:
        return "Medium"
    else:
        return "High"


def yn_to_int(value):
    """Accepts True/False, 'Yes'/'No', 1/0 and converts to 1/0."""
    if isinstance(value, str):
        return 1 if value.strip().lower() in ("yes", "y", "true", "1") else 0
    return int(bool(value))


def build_feature_row(data):
    """
    Turns the JSON the app sends into the exact 13 numbers the model
    expects, in the exact order it expects them.
    """
    weight = float(data.get("weight_kg"))
    height = float(data.get("height_cm"))
    bmi = data.get("bmi")
    bmi = float(bmi) if bmi is not None else compute_bmi(weight, height)

    cycle_regular = str(data.get("cycle_regularity", "Regular")).strip().lower()
    cycle_code = 2 if cycle_regular.startswith("reg") else 4

    row = {
        "Age (yrs)": float(data.get("age")),
        "Weight (Kg)": weight,
        "Height(Cm)": height,
        "BMI": bmi,
        "Cycle(R/I)": cycle_code,
        "Cycle length(days)": float(data.get("period_duration_days", 5)),
        "Weight gain(Y/N)": yn_to_int(data.get("weight_gain", False)),
        "hair growth(Y/N)": yn_to_int(data.get("hair_growth", False)),
        "Skin darkening (Y/N)": yn_to_int(data.get("skin_darkening", False)),
        "Hair loss(Y/N)": yn_to_int(data.get("hair_loss", False)),
        "Pimples(Y/N)": yn_to_int(data.get("pimples", False)),
        "Fast food (Y/N)": yn_to_int(data.get("fast_food", False)),
        "Reg.Exercise(Y/N)": yn_to_int(data.get("regular_exercise", False)),
    }
    return pd.DataFrame([[row[col] for col in FEATURE_ORDER]], columns=FEATURE_ORDER)


# ============================================
# API ROUTES
# ============================================
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "message": "Cycle Ella AI Service v5.0",
        "model_1": {
            "name": "PCOS Detector + Risk Level (Logistic Regression)",
            "test_accuracy": f"{pcos_metrics['test_accuracy']}%",
            "recall": f"{pcos_metrics['recall']}% (catches this % of real cases)",
            "trained_on": pcos_metadata["trained_on"],
        },
    })


@app.route("/predict-pcos", methods=["POST"])
def predict_pcos():
    """
    Expects JSON like:
    {
      "age": 24,
      "weight_kg": 65,
      "height_cm": 160,
      "cycle_regularity": "Irregular",
      "period_duration_days": 6,
      "weight_gain": true,
      "hair_growth": true,
      "skin_darkening": false,
      "hair_loss": false,
      "pimples": true,
      "fast_food": true,
      "regular_exercise": false
    }
    """
    try:
        data = request.get_json()
        features = build_feature_row(data)
        features_scaled = feature_scaler.transform(features)

        prediction = pcos_model.predict(features_scaled)[0]
        probabilities = pcos_model.predict_proba(features_scaled)[0]
        pcos_probability = float(probabilities[1])

        risk_level = get_risk_level(pcos_probability)

        coefficients = list(zip(FEATURE_ORDER, pcos_model.coef_[0]))
        coefficients.sort(key=lambda x: -abs(x[1]))
        top_factors = [f[0] for f in coefficients[:3]]

        return jsonify({
            "pcos_detected": bool(prediction),
            "pcos_probability_percent": round(pcos_probability * 100, 1),
            "risk_level": risk_level,
            "top_contributing_factors": top_factors,
            "model_accuracy": f"{pcos_metrics['test_accuracy']}%",
            "disclaimer": "This is a screening tool, not a medical diagnosis. Please consult a doctor for confirmation.",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# MODEL 2 — PERSONALIZED FOOD RECOMMENDATIONS
# Content-based filtering (no fake user data)
# ============================================
@app.route("/recommend-foods", methods=["POST"])
def recommend_foods_endpoint():
    """
    Expects JSON like:
    {
      "risk_level": "High",
      "phase": "Luteal",
      "bmi": 27,
      "diabetes": false,
      "cholesterol": false
    }
    """
    try:
        data = request.get_json()
        result = recommend_foods(
            risk_level=data.get("risk_level", "Medium"),
            phase=data.get("phase", "Follicular"),
            bmi=float(data.get("bmi", 22)),
            diabetes=data.get("diabetes", "None"),
            cholesterol=bool(data.get("cholesterol", False)),
            top_n=int(data.get("top_n", 8)),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/meal-plan", methods=["POST"])
def meal_plan_endpoint():
    try:
        data = request.get_json()
        result = generate_meal_plan(
            risk_level=data.get("risk_level", "Medium"),
            phase=data.get("phase", "Follicular"),
            bmi=float(data.get("bmi", 22)),
            diabetes=data.get("diabetes", "None"),
            cholesterol=bool(data.get("cholesterol", False)),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/foods/search", methods=["GET"])
def search_foods_endpoint():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"foods": get_all_foods()})
    return jsonify({"foods": search_foods(query)})


@app.route("/foods/all", methods=["GET"])
def all_foods_endpoint():
    return jsonify({"foods": get_all_foods(), "count": len(get_all_foods())})


@app.route("/foods/<int:food_id>/similar", methods=["GET"])
def similar_foods_endpoint(food_id):
    n = int(request.args.get("n", 3))
    similar = find_similar_foods(food_id, n=n)
    if not similar and food_id not in [f["id"] for f in get_all_foods()]:
        return jsonify({"error": f"No food found with id {food_id}"}), 404
    return jsonify({"food_id": food_id, "similar_foods": similar, "algorithm": "K-Nearest Neighbors (cosine similarity)"})


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("Cycle Ella AI Service v5.1")
    print("Running on http://localhost:5001")
    print(f"Model 1 (PCOS Detector - Logistic Regression): {pcos_metrics['test_accuracy']}% accuracy")
    print("=" * 50 + "\n")
    app.run(host="0.0.0.0", port=5001, debug=True)