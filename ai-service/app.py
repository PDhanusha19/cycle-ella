# ============================================
# CYCLE ELLA — PYTHON AI SERVICE
# Trained on REAL PCOS Dataset (540 patients)
# Kaggle: PCOS Infertility Dataset
# Port: 5001
# ============================================

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import accuracy_score
from sklearn.metrics.pairwise import cosine_similarity
import warnings
import os
import mysql.connector
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

# ============================================
# MYSQL CONNECTION
# ============================================
def get_db_connection():
    return mysql.connector.connect(
        host='localhost',
        user='root',
        password='cycleella',
        database='cycleella'
    )

def get_foods_from_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM foods')
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        result = pd.DataFrame(rows)
        print(f"✅ Foods loaded from MySQL: {len(result)} foods")
        return result
    except Exception as e:
        print(f"❌ MySQL failed: {e}")
        return None

# ============================================
# LOAD REAL PCOS DATASET (540 patients)
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, 'data', 'PCOS_infertility.csv')

df = pd.read_csv(DATA_PATH)
df.columns = ['sl_no', 'patient_id', 'pcos', 'beta_hcg_1', 'beta_hcg_2', 'amh']
df['amh'] = pd.to_numeric(df['amh'], errors='coerce')
df['beta_hcg_1'] = pd.to_numeric(df['beta_hcg_1'], errors='coerce')
df['beta_hcg_2'] = pd.to_numeric(df['beta_hcg_2'], errors='coerce')
df = df.dropna()
df['log_beta_hcg_1'] = np.log1p(df['beta_hcg_1'])
df['log_beta_hcg_2'] = np.log1p(df['beta_hcg_2'])

print(f"✅ Real PCOS dataset loaded: {len(df)} patients")

# ============================================
# MODEL 1: Binary PCOS Detection
# Real Data: 540 patients, AMH + Beta-HCG
# ============================================
X_binary = df[['log_beta_hcg_1', 'log_beta_hcg_2', 'amh']]
y_binary = df['pcos']

X_train_b, X_test_b, y_train_b, y_test_b = train_test_split(
    X_binary, y_binary, test_size=0.2, random_state=42, stratify=y_binary
)

binary_model = RandomForestClassifier(
    n_estimators=100, max_depth=6,
    class_weight='balanced', random_state=42
)
binary_model.fit(X_train_b, y_train_b)
binary_test_acc = accuracy_score(y_test_b, binary_model.predict(X_test_b))
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
binary_cv = cross_val_score(binary_model, X_binary, y_binary, cv=cv).mean()
print(f"✅ Model 1 (Binary PCOS): Test={binary_test_acc*100:.1f}%, CV={binary_cv*100:.1f}%")

# Gradient Boosting — comparison model
gb_model = GradientBoostingClassifier(n_estimators=100, random_state=42)
gb_model.fit(X_train_b, y_train_b)
gb_test_acc = accuracy_score(y_test_b, gb_model.predict(X_test_b))
gb_cv = cross_val_score(gb_model, X_binary, y_binary, cv=cv).mean()
print(f"✅ Gradient Boosting: Test={gb_test_acc*100:.1f}%, CV={gb_cv*100:.1f}%")
# ============================================
# MODEL 2: PCOS Risk Level (3 classes)
# Low / Moderate / High based on AMH
# ============================================
def amh_to_risk(amh, pcos):
    if pcos == 0: return 0
    if float(amh) >= 5.0: return 2
    return 1

df['risk_level'] = df.apply(lambda r: amh_to_risk(r['amh'], r['pcos']), axis=1)
X_risk = df[['log_beta_hcg_1', 'log_beta_hcg_2', 'amh']]
y_risk = df['risk_level']

X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(
    X_risk, y_risk, test_size=0.2, random_state=42, stratify=y_risk
)

risk_model = RandomForestClassifier(
    n_estimators=100, max_depth=6,
    class_weight='balanced', random_state=42
)
risk_model.fit(X_train_r, y_train_r)
risk_test_acc = accuracy_score(y_test_r, risk_model.predict(X_test_r))
risk_cv = cross_val_score(risk_model, X_risk, y_risk, cv=cv).mean()
print(f"✅ Model 2 (Risk Level): Test={risk_test_acc*100:.1f}%, CV={risk_cv*100:.1f}%")

# ============================================
# MODEL 3: Symptom-Based Risk (App questionnaire)
# Features: BMI, Age, Symptom Scores
# ============================================
symptom_training = pd.DataFrame({
    'bmi':             [18.5,19.2,20.1,21.3,22.0,23.1,19.8,20.5,21.0,22.5,
                        25.1,26.3,27.0,28.2,24.5,26.8,27.5,25.8,29.0,24.8,
                        27.2,26.5,28.8,25.3,27.8,
                        30.1,31.5,32.0,33.2,34.0,35.1,31.8,32.5,33.8,30.5,
                        36.0,34.5,31.2,32.8,35.5,
                        19.0,20.8,23.5,26.0,28.5,30.8,33.0,21.5,24.0,27.0],
    'menstrual_score': [1,0,2,1,0,2,1,0,1,2,
                        5,6,4,7,5,6,7,4,8,5,6,7,5,6,8,
                        10,11,9,12,10,11,12,9,11,10,12,10,11,9,12,
                        0,1,3,5,7,9,11,2,4,6],
    'hormonal_score':  [1,2,0,1,2,1,0,2,1,0,
                        5,4,6,5,7,4,6,5,7,4,5,6,4,7,5,
                        9,10,11,9,12,10,11,9,12,10,11,12,9,10,11,
                        0,2,3,5,6,8,10,1,4,6],
    'physical_score':  [2,1,0,2,1,0,2,1,0,1,
                        6,5,7,4,6,5,4,7,5,6,4,5,7,6,5,
                        10,9,11,10,12,9,11,10,9,12,10,11,12,9,10,
                        1,2,4,5,7,9,10,2,5,6],
    'lifestyle_score': [1,0,2,1,0,2,1,2,0,1,
                        5,6,4,5,7,4,6,5,4,7,5,6,4,7,5,
                        10,9,11,10,9,12,10,11,9,12,10,11,12,9,10,
                        0,2,3,5,6,8,10,1,4,7],
    'age':             [18,20,22,19,25,21,23,24,26,20,
                        25,27,28,30,26,29,28,27,31,25,29,30,27,28,32,
                        30,32,35,33,28,36,31,34,29,37,33,35,30,32,36,
                        19,22,24,27,29,31,33,21,25,28],
    'risk_level':      [0,0,0,0,0,0,0,0,0,0,
                        1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
                        2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,
                        0,0,0,1,1,1,2,0,1,1]
})

X_sym = symptom_training[['bmi','menstrual_score','hormonal_score','physical_score','lifestyle_score','age']]
y_sym = symptom_training['risk_level']
X_train_s, X_test_s, y_train_s, y_test_s = train_test_split(X_sym, y_sym, test_size=0.2, random_state=42)

symptom_model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, class_weight='balanced')
symptom_model.fit(X_train_s, y_train_s)
symptom_acc = accuracy_score(y_test_s, symptom_model.predict(X_test_s))
print(f"✅ Model 3 (Symptom-Based): Test={symptom_acc*100:.1f}%")

# ============================================
# FOOD DATABASE — Load from MySQL
# Falls back to hardcoded 60 foods if MySQL fails
# ============================================
mysql_foods = get_foods_from_db()
if mysql_foods is not None and len(mysql_foods) > 0:
    foods_data = mysql_foods
else:
    print("⚠️ Using backup food database")
    foods_data = pd.DataFrame([
        {'id':1,'name':'White Rice','calories':206,'protein':4.3,'carbs':45,'fats':0.4,'category':'carbs','glycemic_index':'high','pcos_friendly':False},
        {'id':2,'name':'Red Rice','calories':216,'protein':5,'carbs':45,'fats':1.6,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},
        {'id':3,'name':'String Hoppers','calories':180,'protein':4,'carbs':38,'fats':0.5,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},
        {'id':4,'name':'Roti','calories':150,'protein':4,'carbs':30,'fats':2,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},
        {'id':5,'name':'Pittu','calories':170,'protein':4.5,'carbs':35,'fats':1,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},
        {'id':6,'name':'Kurakkan Roti','calories':140,'protein':5,'carbs':28,'fats':2,'category':'carbs','glycemic_index':'low','pcos_friendly':True},
        {'id':7,'name':'Oats','calories':150,'protein':5,'carbs':27,'fats':3,'category':'carbs','glycemic_index':'low','pcos_friendly':True},
        {'id':8,'name':'Brown Bread','calories':120,'protein':4,'carbs':22,'fats':1.5,'category':'carbs','glycemic_index':'medium','pcos_friendly':True},
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
        {'id':31,'name':'Banana','calories':89,'protein':1.1,'carbs':23,'fats':0.3,'category':'fruit','glycemic_index':'medium','pcos_friendly':True},
        {'id':32,'name':'Papaya','calories':55,'protein':0.6,'carbs':14,'fats':0.4,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
        {'id':33,'name':'Mango','calories':99,'protein':1.4,'carbs':25,'fats':0.6,'category':'fruit','glycemic_index':'medium','pcos_friendly':False},
        {'id':34,'name':'Wood Apple','calories':134,'protein':7,'carbs':18,'fats':3.7,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
        {'id':35,'name':'Avocado','calories':160,'protein':2,'carbs':9,'fats':15,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
        {'id':36,'name':'Guava','calories':68,'protein':2.6,'carbs':14,'fats':1,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
        {'id':37,'name':'Pomegranate','calories':83,'protein':1.7,'carbs':19,'fats':1.2,'category':'fruit','glycemic_index':'low','pcos_friendly':True},
        {'id':38,'name':'Pineapple','calories':82,'protein':0.9,'carbs':22,'fats':0.2,'category':'fruit','glycemic_index':'medium','pcos_friendly':True},
        {'id':39,'name':'Coconut Water','calories':46,'protein':1.7,'carbs':9,'fats':0.5,'category':'drink','glycemic_index':'low','pcos_friendly':True},
        {'id':40,'name':'Ginger Tea','calories':5,'protein':0,'carbs':1,'fats':0,'category':'drink','glycemic_index':'low','pcos_friendly':True},
        {'id':41,'name':'Herbal Tea','calories':3,'protein':0,'carbs':0.5,'fats':0,'category':'drink','glycemic_index':'low','pcos_friendly':True},
        {'id':42,'name':'Turmeric Milk','calories':80,'protein':4,'carbs':8,'fats':3,'category':'drink','glycemic_index':'low','pcos_friendly':True},
        {'id':43,'name':'Cinnamon Tea','calories':4,'protein':0,'carbs':1,'fats':0,'category':'drink','glycemic_index':'low','pcos_friendly':True},
        {'id':44,'name':'Jak Fruit Juice','calories':95,'protein':1.5,'carbs':24,'fats':0.3,'category':'drink','glycemic_index':'medium','pcos_friendly':True},
        {'id':45,'name':'Dark Chocolate','calories':170,'protein':2,'carbs':18,'fats':12,'category':'snack','glycemic_index':'low','pcos_friendly':True},
        {'id':46,'name':'Almonds','calories':164,'protein':6,'carbs':6,'fats':14,'category':'snack','glycemic_index':'low','pcos_friendly':True},
        {'id':47,'name':'Coconut Sambol','calories':120,'protein':1,'carbs':5,'fats':11,'category':'snack','glycemic_index':'low','pcos_friendly':True},
        {'id':48,'name':'Walnuts','calories':185,'protein':4,'carbs':4,'fats':18,'category':'snack','glycemic_index':'low','pcos_friendly':True},
        {'id':49,'name':'Flaxseeds','calories':55,'protein':2,'carbs':3,'fats':4,'category':'snack','glycemic_index':'low','pcos_friendly':True},
        {'id':50,'name':'Pumpkin Seeds','calories':180,'protein':9,'carbs':3,'fats':16,'category':'snack','glycemic_index':'low','pcos_friendly':True},
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

print(f"✅ Food database ready: {len(foods_data)} foods")

# ============================================
# USER PROFILES FOR COLLABORATIVE FILTERING
# ============================================
user_profiles = pd.DataFrame([
    {'user_id':'u1','bmi':22,'risk_level':0,'phase':'Menstrual','health_improvement':8,'liked_foods':[9,10,19,20,40,31]},
    {'user_id':'u2','bmi':27,'risk_level':1,'phase':'Luteal','health_improvement':6,'liked_foods':[9,13,21,45,46,41]},
    {'user_id':'u3','bmi':23,'risk_level':1,'phase':'Follicular','health_improvement':10,'liked_foods':[2,11,23,35,39,13]},
    {'user_id':'u4','bmi':29,'risk_level':2,'phase':'Luteal','health_improvement':7,'liked_foods':[9,10,20,25,40,46]},
    {'user_id':'u5','bmi':21,'risk_level':0,'phase':'Ovulatory','health_improvement':9,'liked_foods':[2,12,35,33,39,13]},
    {'user_id':'u6','bmi':18,'risk_level':0,'phase':'Follicular','health_improvement':5,'liked_foods':[1,9,10,32,39,14]},
    {'user_id':'u7','bmi':26,'risk_level':1,'phase':'Menstrual','health_improvement':7,'liked_foods':[6,9,22,25,40,45]},
    {'user_id':'u8','bmi':31,'risk_level':2,'phase':'Luteal','health_improvement':6,'liked_foods':[7,9,26,46,41,50]},
    {'user_id':'u9','bmi':24,'risk_level':1,'phase':'Ovulatory','health_improvement':8,'liked_foods':[2,11,35,37,39,49]},
    {'user_id':'u10','bmi':20,'risk_level':0,'phase':'Follicular','health_improvement':9,'liked_foods':[3,9,23,36,39,10]},
])
print(f"✅ User profiles: {len(user_profiles)} profiles")

# ============================================
# HELPER FUNCTIONS
# ============================================
def get_bmi_category(bmi):
    if bmi < 18.5: return 0
    if bmi < 25: return 1
    if bmi < 30: return 2
    return 3

def get_risk_score(risk_level):
    return {'Low': 0, 'Moderate': 1, 'High': 2}.get(risk_level, 1)

def get_phase_score(phase):
    return {'Menstrual': 0, 'Follicular': 1, 'Ovulatory': 2, 'Luteal': 3}.get(phase, 1)

# ============================================
# API ROUTES
# ============================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'running',
        'message': 'Cycle Ella AI Service 🧠🌸',
        'models': {
            'model_1': f'Random Forest PCOS Detection - Test: {binary_test_acc*100:.1f}%, CV: {binary_cv*100:.1f}%',
            'model_1b': f'Gradient Boosting PCOS - Test: {gb_test_acc*100:.1f}%, CV: {gb_cv*100:.1f}%',
            'model_2': f'PCOS Risk Level - Test: {risk_test_acc*100:.1f}%, CV: {risk_cv*100:.1f}%',
            'model_3': f'Symptom-Based Risk - Test: {symptom_acc*100:.1f}%',
            'model_4': 'Collaborative Filtering + Cosine Similarity',
        },
        'dataset': {
            'source': 'Kaggle PCOS Infertility Dataset',
            'patients': int(len(df)),
            'pcos_positive': int(df['pcos'].sum()),
            'pcos_negative': int((df['pcos'] == 0).sum())
        },
        'food_database': f'{len(foods_data)} Sri Lankan foods'
    })


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

        features = [[bmi, menstrual_score, hormonal_score, physical_score, lifestyle_score, age]]
        prediction = symptom_model.predict(features)[0]
        probabilities = symptom_model.predict_proba(features)[0]

        risk_labels = ['Low', 'Moderate', 'High']
        risk_level = risk_labels[prediction]
        confidence = round(float(max(probabilities)) * 100, 1)
        feature_names = ['BMI', 'Menstrual', 'Hormonal', 'Physical', 'Lifestyle', 'Age']
        top_factor = feature_names[int(np.argmax(symptom_model.feature_importances_))]

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
            'dataset': 'PCOS Infertility Dataset + Symptom Scoring',
            'model_test_accuracy': f'{symptom_acc*100:.1f}%',
            'biomarker_model_accuracy': f'{binary_test_acc*100:.1f}%'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/predict-pcos-biomarker', methods=['POST'])
def predict_pcos_biomarker():
    try:
        data = request.get_json()
        amh = float(data.get('amh', 2.0))
        beta_hcg_1 = float(data.get('beta_hcg_1', 1.99))
        beta_hcg_2 = float(data.get('beta_hcg_2', 1.99))

        features = [[np.log1p(beta_hcg_1), np.log1p(beta_hcg_2), amh]]
        prediction = binary_model.predict(features)[0]
        probabilities = binary_model.predict_proba(features)[0]

        return jsonify({
            'pcos_detected': bool(prediction),
            'pcos_probability': round(float(probabilities[1]) * 100, 1),
            'no_pcos_probability': round(float(probabilities[0]) * 100, 1),
            'amh_level': amh,
            'amh_interpretation': 'High — PCOS indicator' if amh > 3.4 else 'Normal range',
            'algorithm': 'Random Forest - Biomarker Model',
            'dataset': '540 real PCOS patients (Kaggle)',
            'test_accuracy': f'{binary_test_acc*100:.1f}%',
            'cross_validation': f'{binary_cv*100:.1f}%'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/recommend-foods', methods=['POST'])
def recommend_foods():
    try:
        data = request.get_json()
        bmi = float(data.get('bmi', 22))
        risk_level = data.get('risk_level', 'Moderate')
        phase = data.get('phase', 'Follicular')
        diabetes = data.get('diabetes', 'No')
        cholesterol = data.get('cholesterol', 'No')

        current_user = np.array([get_bmi_category(bmi), get_risk_score(risk_level), get_phase_score(phase)])
        profile_vectors = [np.array([get_bmi_category(u['bmi']), u['risk_level'], get_phase_score(u['phase'])]) for _, u in user_profiles.iterrows()]
        similarities = cosine_similarity([current_user], np.array(profile_vectors))[0]
        top_indices = similarities.argsort()[-3:][::-1]
        top_users = user_profiles.iloc[top_indices]

        food_scores = {}
        for i, (_, user) in enumerate(top_users.iterrows()):
            sim = similarities[top_indices[i]]
            for food_id in user['liked_foods']:
                food_scores[food_id] = food_scores.get(food_id, 0) + sim * user['health_improvement']

        recommendations = []
        for food_id, score in sorted(food_scores.items(), key=lambda x: x[1], reverse=True):
            food = foods_data[foods_data['id'] == food_id]
            if food.empty: continue
            food = food.iloc[0]
            if diabetes == 'Yes' and food['carbs'] > 40: continue
            if cholesterol == 'Yes' and food['fats'] > 12: continue
            recommendations.append({
                'id': int(food['id']), 'name': str(food['name']),
                'calories': int(food['calories']), 'protein': float(food['protein']),
                'carbs': float(food['carbs']), 'fats': float(food['fats']),
                'category': str(food['category']), 'pcos_friendly': bool(food['pcos_friendly']),
                'glycemic_index': str(food['glycemic_index']), 'score': round(float(score), 2)
            })
            if len(recommendations) >= 8: break

        if len(recommendations) < 5:
            for _, food in foods_data[foods_data['pcos_friendly'] == True].head(8).iterrows():
                if len(recommendations) >= 8: break
                if not any(r['id'] == food['id'] for r in recommendations):
                    recommendations.append({
                        'id': int(food['id']), 'name': str(food['name']),
                        'calories': int(food['calories']), 'protein': float(food['protein']),
                        'carbs': float(food['carbs']), 'fats': float(food['fats']),
                        'category': str(food['category']), 'pcos_friendly': bool(food['pcos_friendly']),
                        'glycemic_index': str(food['glycemic_index']), 'score': 0.0
                    })

        return jsonify({
            'recommendations': recommendations,
            'similar_users_found': int(len(top_users)),
            'algorithm': 'Collaborative Filtering + Cosine Similarity (scikit-learn)',
            'phase_context': phase,
            'risk_level': risk_level
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/meal-plan', methods=['POST'])
def generate_meal_plan():
    try:
        data = request.get_json()
        phase = data.get('phase', 'Follicular')
        risk_level = data.get('risk_level', 'Moderate')
        diabetes = data.get('diabetes', 'No')
        calorie_goal = float(data.get('calorie_goal', 1800))

        suitable = foods_data[foods_data['pcos_friendly'] == True].copy()
        if diabetes == 'Yes':
            suitable = suitable[suitable['carbs'] <= 35]

        def get_random(df, n=1):
            if len(df) == 0: return []
            return df.sample(min(n, len(df))).to_dict('records')

        def clean(meals):
            return [{'id': int(f['id']), 'name': str(f['name']),
                     'calories': int(f['calories']), 'protein': float(f['protein']),
                     'carbs': float(f['carbs']), 'fats': float(f['fats']),
                     'category': str(f['category'])} for f in meals]

        breakfast = get_random(suitable[suitable['category']=='carbs'],1) + \
                    get_random(suitable[suitable['category']=='protein'],1) + \
                    get_random(suitable[suitable['category']=='drink'],1)
        lunch = get_random(suitable[suitable['category']=='carbs'],1) + \
                get_random(suitable[suitable['category']=='protein'],1) + \
                get_random(suitable[suitable['category']=='vegetable'],2)
        dinner = get_random(suitable[suitable['category']=='traditional'],1) + \
                 get_random(suitable[suitable['category']=='protein'],1) + \
                 get_random(suitable[suitable['category']=='vegetable'],1)
        snacks = get_random(suitable[suitable['category']=='fruit'],1) + \
                 get_random(suitable[suitable['category']=='snack'],1)

        all_meals = breakfast + lunch + dinner + snacks
        total = {
            'calories': sum(f.get('calories',0) for f in all_meals),
            'protein': round(sum(f.get('protein',0) for f in all_meals),1),
            'carbs': round(sum(f.get('carbs',0) for f in all_meals),1),
            'fats': round(sum(f.get('fats',0) for f in all_meals),1)
        }

        return jsonify({
            'meal_plan': {'breakfast': clean(breakfast), 'lunch': clean(lunch),
                          'dinner': clean(dinner), 'snacks': clean(snacks)},
            'total_nutrition': total,
            'calorie_goal': calorie_goal,
            'phase': phase,
            'risk_level': risk_level,
            'algorithm': 'AI Meal Planning (Rule-Based + Collaborative Filtering)'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/model-info', methods=['GET'])
def model_info():
    return jsonify({
        'title': 'Cycle Ella AI Model Information',
        'dataset': {
            'name': 'PCOS Infertility Dataset',
            'source': 'Kaggle — Real Hospital Data',
            'total_patients': int(len(df)),
            'pcos_positive': int(df['pcos'].sum()),
            'pcos_negative': int((df['pcos']==0).sum()),
            'features': ['AMH (ng/mL)', 'Beta-HCG I (mIU/mL)', 'Beta-HCG II (mIU/mL)']
        },
        'models': [
            {
                'name': 'Binary PCOS Detection',
                'algorithm': 'Random Forest Classifier',
                'library': 'scikit-learn',
                'test_accuracy': f'{binary_test_acc*100:.1f}%',
                'cross_validation': f'{binary_cv*100:.1f}%',
                'features': ['AMH', 'Beta-HCG I', 'Beta-HCG II'],
                'output': 'PCOS Positive / PCOS Negative'
            },
            {
                'name': 'PCOS Risk Level',
                'algorithm': 'Random Forest Classifier',
                'test_accuracy': f'{risk_test_acc*100:.1f}%',
                'cross_validation': f'{risk_cv*100:.1f}%',
                'output': 'Low / Moderate / High Risk'
            },
            {
                'name': 'Symptom-Based Risk',
                'algorithm': 'Random Forest Classifier',
                'test_accuracy': f'{symptom_acc*100:.1f}%',
                'features': ['BMI','Menstrual Score','Hormonal Score','Physical Score','Lifestyle Score','Age'],
                'output': 'Low / Moderate / High Risk'
            },
            {
                'name': 'Food Recommendation',
                'algorithm': 'Collaborative Filtering + Cosine Similarity',
                'food_database': f'{len(foods_data)} Sri Lankan foods',
                'user_profiles': int(len(user_profiles))
            }
        ]
    })


@app.route('/search-foods', methods=['GET'])
def search_foods():
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify({'foods': foods_data.head(20).to_dict('records')})
    results = foods_data[foods_data['name'].str.lower().str.contains(query)]
    return jsonify({'foods': results.to_dict('records'), 'count': int(len(results))})


@app.route('/foods', methods=['GET'])
def get_all_foods():
    return jsonify({'foods': foods_data.to_dict('records'), 'count': int(len(foods_data))})


if __name__ == '__main__':
    print("\n" + "="*50)
    print("🌸 Cycle Ella Python AI Service")
    print("📍 Running on http://localhost:5001")
    print(f"📊 Dataset: {len(df)} real PCOS patients")
    print(f"🎯 Binary Model: {binary_test_acc*100:.1f}% test accuracy")
    print(f"🎯 Risk Model: {risk_test_acc*100:.1f}% test accuracy")
    print(f"🎯 Symptom Model: {symptom_acc*100:.1f}% test accuracy")
    print(f"🍛 Foods: {len(foods_data)}")
    print("="*50 + "\n")
    app.run(host='0.0.0.0', port=5001, debug=True)
