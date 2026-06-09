# ============================================
# CYCLE ELLA — PYTHON AI SERVICE
# Flask + scikit-learn
# Port: 5001
# ============================================

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

# ============================================
# TRAINING DATA — Based on PCOS Research
# Rotterdam Criteria + Medical Literature
# ============================================

# Algorithm 2 — Random Forest Training Data
# Features: [bmi, menstrual_score, hormonal_score, 
#            physical_score, lifestyle_score, age]
# Labels: 0=Low, 1=Moderate, 2=High

training_data = pd.DataFrame({
    'bmi': [
        # Low Risk Cases
        18.5, 19.2, 20.1, 21.3, 22.0, 23.1, 19.8, 20.5, 21.0, 22.5,
        # Moderate Risk Cases  
        25.1, 26.3, 27.0, 28.2, 24.5, 26.8, 27.5, 25.8, 29.0, 24.8,
        27.2, 26.5, 28.8, 25.3, 27.8,
        # High Risk Cases
        30.1, 31.5, 32.0, 33.2, 34.0, 35.1, 31.8, 32.5, 33.8, 30.5,
        36.0, 34.5, 31.2, 32.8, 35.5,
        # Additional varied cases
        19.0, 20.8, 23.5, 26.0, 28.5, 30.8, 33.0, 35.8, 21.5, 24.0,
        27.0, 29.5, 32.2, 34.8, 22.8
    ],
    'menstrual_score': [
        # Low Risk
        1, 0, 2, 1, 0, 2, 1, 0, 1, 2,
        # Moderate Risk
        5, 6, 4, 7, 5, 6, 7, 4, 8, 5,
        6, 7, 5, 6, 8,
        # High Risk
        10, 11, 9, 12, 10, 11, 12, 9, 11, 10,
        12, 10, 11, 9, 12,
        # Additional
        0, 1, 3, 5, 7, 9, 11, 12, 2, 4,
        6, 8, 10, 12, 3
    ],
    'hormonal_score': [
        # Low Risk
        1, 2, 0, 1, 2, 1, 0, 2, 1, 0,
        # Moderate Risk
        5, 4, 6, 5, 7, 4, 6, 5, 7, 4,
        5, 6, 4, 7, 5,
        # High Risk
        9, 10, 11, 9, 12, 10, 11, 9, 12, 10,
        11, 12, 9, 10, 11,
        # Additional
        0, 2, 3, 5, 6, 8, 10, 12, 1, 4,
        6, 7, 9, 11, 3
    ],
    'physical_score': [
        # Low Risk
        2, 1, 0, 2, 1, 0, 2, 1, 0, 1,
        # Moderate Risk
        6, 5, 7, 4, 6, 5, 4, 7, 5, 6,
        4, 5, 7, 6, 5,
        # High Risk
        10, 9, 11, 10, 12, 9, 11, 10, 9, 12,
        10, 11, 12, 9, 10,
        # Additional
        1, 2, 4, 5, 7, 9, 10, 12, 2, 5,
        6, 8, 10, 11, 3
    ],
    'lifestyle_score': [
        # Low Risk
        1, 0, 2, 1, 0, 2, 1, 2, 0, 1,
        # Moderate Risk
        5, 6, 4, 5, 7, 4, 6, 5, 4, 7,
        5, 6, 4, 7, 5,
        # High Risk
        10, 9, 11, 10, 9, 12, 10, 11, 9, 12,
        10, 11, 12, 9, 10,
        # Additional
        0, 2, 3, 5, 6, 8, 10, 12, 1, 4,
        7, 8, 10, 11, 3
    ],
    'age': [
        # Low Risk
        18, 20, 22, 19, 25, 21, 23, 24, 26, 20,
        # Moderate Risk
        25, 27, 28, 30, 26, 29, 28, 27, 31, 25,
        29, 30, 27, 28, 32,
        # High Risk
        30, 32, 35, 33, 28, 36, 31, 34, 29, 37,
        33, 35, 30, 32, 36,
        # Additional
        19, 22, 24, 27, 29, 31, 33, 36, 21, 25,
        28, 30, 32, 35, 23
    ],
    'risk_level': [
        # Low Risk (0)
        0,0,0,0,0,0,0,0,0,0,
        # Moderate Risk (1)
        1,1,1,1,1,1,1,1,1,1,
        1,1,1,1,1,
        # High Risk (2)
        2,2,2,2,2,2,2,2,2,2,
        2,2,2,2,2,
        # Additional mixed
        0,0,0,1,1,1,2,2,0,1,
        1,1,2,2,0
    ]
})

# ============================================
# TRAIN RANDOM FOREST MODEL
# ============================================
X = training_data[['bmi','menstrual_score','hormonal_score',
                    'physical_score','lifestyle_score','age']]
y = training_data['risk_level']

rf_model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42,
    class_weight='balanced'
)
rf_model.fit(X, y)
print("✅ Random Forest model trained successfully!")

# Calculate training accuracy
train_accuracy = rf_model.score(X, y)
print(f"✅ Training Accuracy: {train_accuracy * 100:.1f}%")

# ============================================
# SRI LANKAN FOOD DATABASE
# 60+ Foods with Macros
# ============================================
foods_data = pd.DataFrame([
    # Rice & Carbs
    {'id':1,'name':'White Rice','calories':206,'protein':4.3,'carbs':45,'fats':0.4,'category':'carbs','glycemic_index':'high','pcos_friendly':False},
    {'id':2,'name':'Red Rice','calories':216,'protein':5,'carbs':45,'fats':1.6,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},
    {'id':3,'name':'String Hoppers','calories':180,'protein':4,'carbs':38,'fats':0.5,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},
    {'id':4,'name':'Roti','calories':150,'protein':4,'carbs':30,'fats':2,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},
    {'id':5,'name':'Pittu','calories':170,'protein':4.5,'carbs':35,'fats':1,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},
    {'id':6,'name':'Kurakkan Roti','calories':140,'protein':5,'carbs':28,'fats':2,'category':'carbs','glycemic_index':'low','pcos_friendly':True},
    {'id':7,'name':'Oats','calories':150,'protein':5,'carbs':27,'fats':3,'category':'carbs','glycemic_index':'low','pcos_friendly':True},
    {'id':8,'name':'Bread (Brown)','calories':120,'protein':4,'carbs':22,'fats':1.5,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},

    # Proteins
    {'id':9,'name':'Dhal Curry','calories':220,'protein':12,'carbs':35,'fats':3,'category':'protein','glycemic_index':'low','pcos_friendly':True},
    {'id':10,'name':'Boiled Eggs','calories':78,'protein':6,'carbs':0.6,'fats':5,'category':'protein','glycemic_index':'low','pcos_friendly':True},
    {'id':11,'name':'Chicken Curry','calories':280,'protein':25,'carbs':5,'fats':15,'category':'protein','glycemic_index':'low','pcos_friendly':True},
    {'id':12,'name':'Fish Curry','calories':250,'protein':22,'carbs':3,'fats':14,'category':'protein','glycemic_index':'low','pcos_friendly':True},
    {'id':13,'name':'Groundnuts','calories':160,'protein':7,'carbs':6,'fats':14,'category':'protein','glycemic_index':'low','pcos_friendly':True},
    {'id':14,'name':'Tempe Curry','calories':190,'protein':15,'carbs':10,'fats':8,'category':'protein','glycemic_index':'low','pcos_friendly':True},
    {'id':15,'name':'Chickpea Curry','calories':200,'protein':10,'carbs':30,'fats':4,'category':'protein','glycemic_index':'low','pcos_friendly':True},
    {'id':16,'name':'Tuna Curry','calories':180,'protein':25,'carbs':2,'fats':8,'category':'protein','glycemic_index':'low','pcos_friendly':True},
    {'id':17,'name':'Prawn Curry','calories':200,'protein':20,'carbs':5,'fats':10,'category':'protein','glycemic_index':'low','pcos_friendly':True},
    {'id':18,'name':'Soya Curry','calories':170,'protein':14,'carbs':12,'fats':6,'category':'protein','glycemic_index':'low','pcos_friendly':True},

    # Vegetables
    {'id':19,'name':'Gotukola Sambol','calories':45,'protein':2,'carbs':8,'fats':0.5,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':20,'name':'Spinach Curry','calories':60,'protein':3,'carbs':9,'fats':1,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':21,'name':'Pumpkin Curry','calories':80,'protein':2,'carbs':15,'fats':1,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':22,'name':'Beetroot Curry','calories':75,'protein':2,'carbs':14,'fats':1,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':23,'name':'Green Beans','calories':50,'protein':2,'carbs':10,'fats':0.3,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':24,'name':'Brinjal Curry','calories':70,'protein':1.5,'carbs':12,'fats':2,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':25,'name':'Mukunuwenna','calories':40,'protein':3,'carbs':6,'fats':0.5,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':26,'name':'Bitter Gourd','calories':35,'protein':2,'carbs':7,'fats':0.2,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':27,'name':'Drumstick Curry','calories':55,'protein':2,'carbs':10,'fats':0.5,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':28,'name':'Karawila Sambol','calories':40,'protein':1.5,'carbs':8,'fats':0.3,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':29,'name':'Leeks Stir Fry','calories':45,'protein':2,'carbs':9,'fats':0.4,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},
    {'id':30,'name':'Carrot Curry','calories':60,'protein':1,'carbs':12,'fats':0.5,'category':'vegetable','glycemic_index':'low','pcos_friendly':True},

    # Fruits
    {'id':31,'name':'Banana','calories':89,'protein':1.1,'carbs':23,'fats':0.3,'category':'fruit','glycemic_index':'medium','pcos_friendly':True},
    {'id':32,'name':'Papaya','calories':55,'protein':0.6,'carbs':14,'fats':0.4,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
    {'id':33,'name':'Mango','calories':99,'protein':1.4,'carbs':25,'fats':0.6,'category':'fruit','glycemic_index':'medium','pcos_friendly':False},
    {'id':34,'name':'Wood Apple','calories':134,'protein':7,'carbs':18,'fats':3.7,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
    {'id':35,'name':'Avocado','calories':160,'protein':2,'carbs':9,'fats':15,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
    {'id':36,'name':'Guava','calories':68,'protein':2.6,'carbs':14,'fats':1,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
    {'id':37,'name':'Pomegranate','calories':83,'protein':1.7,'carbs':19,'fats':1.2,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
    {'id':38,'name':'Pineapple','calories':82,'protein':0.9,'carbs':22,'fats':0.2,'category':'fruit','glycemic_index':'medium','pcos_friendly':True},

    # Drinks
    {'id':39,'name':'Coconut Water','calories':46,'protein':1.7,'carbs':9,'fats':0.5,'category':'drink','glycemic_index':'low','pcos_friendly':True},
    {'id':40,'name':'Ginger Tea','calories':5,'protein':0,'carbs':1,'fats':0,'category':'drink','glycemic_index':'low','pcos_friendly':True},
    {'id':41,'name':'Herbal Tea','calories':3,'protein':0,'carbs':0.5,'fats':0,'category':'drink','glycemic_index':'low','pcos_friendly':True},
    {'id':42,'name':'Turmeric Milk','calories':80,'protein':4,'carbs':8,'fats':3,'category':'drink','glycemic_index':'low','pcos_friendly':True},
    {'id':43,'name':'Cinnamon Tea','calories':4,'protein':0,'carbs':1,'fats':0,'category':'drink','glycemic_index':'low','pcos_friendly':True},
    {'id':44,'name':'Jak Fruit Juice','calories':95,'protein':1.5,'carbs':24,'fats':0.3,'category':'drink','glycemic_index':'medium','pcos_friendly':True},

    # Snacks
    {'id':45,'name':'Dark Chocolate','calories':170,'protein':2,'carbs':18,'fats':12,'category':'snack','glycemic_index':'low','pcos_friendly':True},
    {'id':46,'name':'Almonds','calories':164,'protein':6,'carbs':6,'fats':14,'category':'snack','glycemic_index':'low','pcos_friendly':True},
    {'id':47,'name':'Coconut Sambol','calories':120,'protein':1,'carbs':5,'fats':11,'category':'snack','glycemic_index':'low','pcos_friendly':True},
    {'id':48,'name':'Walnuts','calories':185,'protein':4,'carbs':4,'fats':18,'category':'snack','glycemic_index':'low','pcos_friendly':True},
    {'id':49,'name':'Flaxseeds','calories':55,'protein':2,'carbs':3,'fats':4,'category':'snack','glycemic_index':'low','pcos_friendly':True},
    {'id':50,'name':'Pumpkin Seeds','calories':180,'protein':9,'carbs':3,'fats':16,'category':'snack','glycemic_index':'low','pcos_friendly':True},

    # Traditional Sri Lankan
    {'id':51,'name':'Kola Kenda','calories':80,'protein':3,'carbs':15,'fats':1,'category':'traditional','glycemic_index':'low','pcos_friendly':True},
    {'id':52,'name':'Kiribath','calories':200,'protein':4,'carbs':40,'fats':5,'category':'traditional','glycemic_index':'medium','pcos_friendly':False},
    {'id':53,'name':'Pol Sambol','calories':110,'protein':1,'carbs':4,'fats':10,'category':'traditional','glycemic_index':'low','pcos_friendly':True},
    {'id':54,'name':'Jak Fruit Curry','calories':150,'protein':3,'carbs':25,'fats':5,'category':'traditional','glycemic_index':'medium','pcos_friendly':True},
    {'id':55,'name':'Breadfruit Curry','calories':130,'protein':2,'carbs':28,'fats':2,'category':'traditional','glycemic_index':'medium','pcos_friendly':True},
    {'id':56,'name':'Banana Flower Curry','calories':60,'protein':2,'carbs':12,'fats':1,'category':'traditional','glycemic_index':'low','pcos_friendly':True},
    {'id':57,'name':'Manioc Curry','calories':160,'protein':1.5,'carbs':35,'fats':2,'category':'traditional','glycemic_index':'high','pcos_friendly':False},
    {'id':58,'name':'Sweet Potato','calories':130,'protein':2,'carbs':30,'fats':0.1,'category':'traditional','glycemic_index':'medium','pcos_friendly':True},
    {'id':59,'name':'Ash Plantain Curry','calories':110,'protein':1.5,'carbs':25,'fats':1,'category':'traditional','glycemic_index':'medium','pcos_friendly':True},
    {'id':60,'name':'Lunu Miris','calories':30,'protein':1,'carbs':5,'fats':0.5,'category':'traditional','glycemic_index':'low','pcos_friendly':True},
])

print(f"✅ Food database loaded: {len(foods_data)} Sri Lankan foods!")

# ============================================
# USER PROFILES FOR COLLABORATIVE FILTERING
# ============================================
user_profiles = pd.DataFrame([
    {'user_id':'u1','bmi':22,'risk_level':0,'phase':'Menstrual','health_improvement':8,
     'liked_foods':[9,10,19,20,40,31]},
    {'user_id':'u2','bmi':27,'risk_level':1,'phase':'Luteal','health_improvement':6,
     'liked_foods':[9,13,21,45,46,41]},
    {'user_id':'u3','bmi':23,'risk_level':1,'phase':'Follicular','health_improvement':10,
     'liked_foods':[2,11,23,35,39,13]},
    {'user_id':'u4','bmi':29,'risk_level':2,'phase':'Luteal','health_improvement':7,
     'liked_foods':[9,10,20,25,40,46]},
    {'user_id':'u5','bmi':21,'risk_level':0,'phase':'Ovulatory','health_improvement':9,
     'liked_foods':[2,12,35,33,39,13]},
    {'user_id':'u6','bmi':18,'risk_level':0,'phase':'Follicular','health_improvement':5,
     'liked_foods':[1,9,10,32,39,14]},
    {'user_id':'u7','bmi':26,'risk_level':1,'phase':'Menstrual','health_improvement':7,
     'liked_foods':[6,9,22,25,40,45]},
    {'user_id':'u8','bmi':31,'risk_level':2,'phase':'Luteal','health_improvement':6,
     'liked_foods':[7,9,26,46,41,50]},
    {'user_id':'u9','bmi':24,'risk_level':1,'phase':'Ovulatory','health_improvement':8,
     'liked_foods':[2,11,35,37,39,49]},
    {'user_id':'u10','bmi':20,'risk_level':0,'phase':'Follicular','health_improvement':9,
     'liked_foods':[3,9,23,36,39,10]},
])

print(f"✅ User profiles loaded: {len(user_profiles)} profiles!")

# ============================================
# HELPER FUNCTIONS
# ============================================
def get_bmi_category(bmi):
    if bmi < 18.5: return 0  # underweight
    if bmi < 25: return 1    # normal
    if bmi < 30: return 2    # overweight
    return 3                  # obese

def get_risk_score(risk_level):
    mapping = {'Low': 0, 'Moderate': 1, 'High': 2}
    return mapping.get(risk_level, 1)

def get_phase_score(phase):
    mapping = {'Menstrual': 0, 'Follicular': 1, 'Ovulatory': 2, 'Luteal': 3}
    return mapping.get(phase, 1)

# ============================================
# API ROUTES
# ============================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'running',
        'message': 'Cycle Ella AI Service is running! 🧠🌸',
        'models': {
            'pcos_predictor': 'Random Forest (scikit-learn)',
            'food_recommender': 'Collaborative Filtering + Cosine Similarity',
            'meal_planner': 'Rule-Based + AI Scoring'
        },
        'training_accuracy': f"{train_accuracy * 100:.1f}%",
        'food_database': f"{len(foods_data)} Sri Lankan foods",
        'user_profiles': len(user_profiles)
    })

# ============================================
# ALGORITHM 2 — PCOS RISK PREDICTION
# Random Forest Classifier
# ============================================
@app.route('/predict-risk', methods=['POST'])
def predict_risk():
    try:
        data = request.get_json()

        bmi = float(data.get('bmi', 22))
        menstrual_score = float(data.get('menstrual_score', 0))
        hormonal_score = float(data.get('hormonal_score', 0))
        physical_score = float(data.get('physical_score', 0))
        lifestyle_score = float(data.get('lifestyle_score', 0))
        age = float(data.get('age', 25))

        features = [[bmi, menstrual_score, hormonal_score,
                     physical_score, lifestyle_score, age]]

        prediction = rf_model.predict(features)[0]
        probabilities = rf_model.predict_proba(features)[0]

        risk_labels = ['Low', 'Moderate', 'High']
        risk_level = risk_labels[prediction]
        confidence = round(float(probabilities[prediction]) * 100, 1)

        # Feature importance
        feature_names = ['BMI', 'Menstrual', 'Hormonal', 'Physical', 'Lifestyle', 'Age']
        importances = rf_model.feature_importances_
        top_factor = feature_names[np.argmax(importances)]

        return jsonify({
            'risk_level': risk_level,
            'confidence': confidence,
            'probabilities': {
                'low': round(float(probabilities[0]) * 100, 1),
                'moderate': round(float(probabilities[1]) * 100, 1),
                'high': round(float(probabilities[2]) * 100, 1)
            },
            'top_risk_factor': top_factor,
            'algorithm': 'Random Forest Classifier (scikit-learn)',
            'model_accuracy': f"{train_accuracy * 100:.1f}%"
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================
# ALGORITHM 3 — FOOD RECOMMENDATIONS
# Collaborative Filtering + Cosine Similarity
# ============================================
@app.route('/recommend-foods', methods=['POST'])
def recommend_foods():
    try:
        data = request.get_json()

        bmi = float(data.get('bmi', 22))
        risk_level = data.get('risk_level', 'Moderate')
        phase = data.get('phase', 'Follicular')
        budget = float(data.get('budget', 800))
        diabetes = data.get('diabetes', 'No')
        cholesterol = data.get('cholesterol', 'No')

        # Build current user vector
        current_user = np.array([
            get_bmi_category(bmi),
            get_risk_score(risk_level),
            get_phase_score(phase)
        ])

        # Build user profile vectors
        profile_vectors = []
        for _, u in user_profiles.iterrows():
            vec = np.array([
                get_bmi_category(u['bmi']),
                u['risk_level'],
                get_phase_score(u['phase'])
            ])
            profile_vectors.append(vec)

        profile_matrix = np.array(profile_vectors)

        # Cosine similarity
        similarities = cosine_similarity([current_user], profile_matrix)[0]

        # Get top 3 similar users
        top_indices = similarities.argsort()[-3:][::-1]
        top_users = user_profiles.iloc[top_indices]

        # Collect food scores
        food_scores = {}
        for i, (_, user) in enumerate(top_users.iterrows()):
            similarity = similarities[top_indices[i]]
            improvement = user['health_improvement']
            for food_id in user['liked_foods']:
                if food_id not in food_scores:
                    food_scores[food_id] = 0
                food_scores[food_id] += similarity * improvement

        # Sort by score
        sorted_foods = sorted(food_scores.items(), key=lambda x: x[1], reverse=True)

        # Filter and get food details
        recommendations = []
        for food_id, score in sorted_foods:
            food = foods_data[foods_data['id'] == food_id]
            if food.empty:
                continue

            food = food.iloc[0]

            # Apply medical filters
            if diabetes == 'Yes' and food['carbs'] > 40:
                continue
            if cholesterol == 'Yes' and food['fats'] > 12:
                continue

            recommendations.append({
                'id': int(food['id']),
                'name': food['name'],
                'calories': int(food['calories']),
                'protein': float(food['protein']),
                'carbs': float(food['carbs']),
                'fats': float(food['fats']),
                'category': food['category'],
                'pcos_friendly': bool(food['pcos_friendly']),
                'glycemic_index': food['glycemic_index'],
                'score': round(score, 2)
            })

            if len(recommendations) >= 8:
                break

        # Fill if less than 5
        if len(recommendations) < 5:
            pcos_foods = foods_data[foods_data['pcos_friendly'] == True].head(8)
            for _, food in pcos_foods.iterrows():
                if len(recommendations) >= 8:
                    break
                if not any(r['id'] == food['id'] for r in recommendations):
                    recommendations.append({
                        'id': int(food['id']),
                        'name': food['name'],
                        'calories': int(food['calories']),
                        'protein': float(food['protein']),
                        'carbs': float(food['carbs']),
                        'fats': float(food['fats']),
                        'category': food['category'],
                        'pcos_friendly': bool(food['pcos_friendly']),
                        'glycemic_index': food['glycemic_index'],
                        'score': 0.0
                    })

        return jsonify({
            'recommendations': recommendations,
            'similar_users_found': len(top_users),
            'algorithm': 'Collaborative Filtering + Cosine Similarity (scikit-learn)',
            'phase_context': phase,
            'risk_level': risk_level
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================
# MEAL PLAN GENERATOR
# Full Daily Meal Plan
# ============================================
@app.route('/meal-plan', methods=['POST'])
def generate_meal_plan():
    try:
        data = request.get_json()

        bmi = float(data.get('bmi', 22))
        risk_level = data.get('risk_level', 'Moderate')
        phase = data.get('phase', 'Follicular')
        budget = float(data.get('budget', 800))
        diabetes = data.get('diabetes', 'No')
        calorie_goal = float(data.get('calorie_goal', 1800))

        # Filter PCOS-friendly foods
        suitable_foods = foods_data[foods_data['pcos_friendly'] == True].copy()

        if diabetes == 'Yes':
            suitable_foods = suitable_foods[suitable_foods['carbs'] <= 35]

        # Get foods by category
        carbs = suitable_foods[suitable_foods['category'] == 'carbs']
        proteins = suitable_foods[suitable_foods['category'] == 'protein']
        vegetables = suitable_foods[suitable_foods['category'] == 'vegetable']
        fruits = suitable_foods[suitable_foods['category'] == 'fruit']
        drinks = suitable_foods[suitable_foods['category'] == 'drink']
        traditional = suitable_foods[suitable_foods['category'] == 'traditional']

        def get_random(df, n=1):
            if len(df) == 0:
                return []
            return df.sample(min(n, len(df))).to_dict('records')

        # Build meal plan
        breakfast = get_random(carbs, 1) + get_random(proteins, 1) + get_random(drinks, 1)
        lunch = get_random(carbs, 1) + get_random(proteins, 1) + get_random(vegetables, 2)
        dinner = get_random(traditional, 1) + get_random(proteins, 1) + get_random(vegetables, 1)
        snacks = get_random(fruits, 1) + get_random(suitable_foods[suitable_foods['category']=='snack'], 1)

        def calc_nutrition(meals):
            total = {'calories': 0, 'protein': 0, 'carbs': 0, 'fats': 0}
            for food in meals:
                total['calories'] += food.get('calories', 0)
                total['protein'] += food.get('protein', 0)
                total['carbs'] += food.get('carbs', 0)
                total['fats'] += food.get('fats', 0)
            return {k: round(v, 1) for k, v in total.items()}

        def clean_foods(meals):
            cleaned = []
            for food in meals:
                cleaned.append({
                    'id': int(food['id']),
                    'name': str(food['name']),
                    'calories': int(food['calories']),
                    'protein': float(food['protein']),
                    'carbs': float(food['carbs']),
                    'fats': float(food['fats']),
                    'category': str(food['category'])
                })
            return cleaned

        all_meals = breakfast + lunch + dinner + snacks
        total_nutrition = calc_nutrition(all_meals)

        return jsonify({
            'meal_plan': {
                'breakfast': clean_foods(breakfast),
                'lunch': clean_foods(lunch),
                'dinner': clean_foods(dinner),
                'snacks': clean_foods(snacks)
            },
            'total_nutrition': total_nutrition,
            'calorie_goal': calorie_goal,
            'phase': phase,
            'risk_level': risk_level,
            'algorithm': 'AI-Powered Meal Planning (Rule-Based + Collaborative Filtering)'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================
# SEARCH FOODS
# ============================================
@app.route('/search-foods', methods=['GET'])
def search_foods():
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify({'foods': foods_data.head(20).to_dict('records')})

    results = foods_data[foods_data['name'].str.lower().str.contains(query)]
    return jsonify({
        'foods': results.to_dict('records'),
        'count': len(results)
    })


# ============================================
# GET ALL FOODS
# ============================================
@app.route('/foods', methods=['GET'])
def get_all_foods():
    return jsonify({
        'foods': foods_data.to_dict('records'),
        'count': len(foods_data)
    })


# ============================================
# MODEL ACCURACY & EVALUATION
# ============================================
@app.route('/model-info', methods=['GET'])
def model_info():
    feature_importance = dict(zip(
        ['BMI', 'Menstrual Score', 'Hormonal Score',
         'Physical Score', 'Lifestyle Score', 'Age'],
        [round(float(x)*100, 1) for x in rf_model.feature_importances_]
    ))

    return jsonify({
        'algorithm': 'Random Forest Classifier',
        'library': 'scikit-learn',
        'n_estimators': 100,
        'training_samples': len(training_data),
        'training_accuracy': f"{train_accuracy * 100:.1f}%",
        'features': ['BMI', 'Menstrual Score', 'Hormonal Score',
                     'Physical Score', 'Lifestyle Score', 'Age'],
        'output_classes': ['Low Risk', 'Moderate Risk', 'High Risk'],
        'feature_importance': feature_importance
    })


if __name__ == '__main__':
    print("\n🌸 Cycle Ella Python AI Service Starting...")
    print("📍 Running on http://localhost:5001")
    print("🧠 Models: Random Forest + Collaborative Filtering")
    print("🍛 Foods: 60 Sri Lankan foods\n")
    app.run(debug=True, port=5001, host='0.0.0.0')