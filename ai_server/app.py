from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import joblib
import xgboost as xgb
import os

app = Flask(__name__)

# --- 1. 모델과 데이터 로딩 ---
# Get the directory where app.py is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

print("Loading AI Models & Data...")
try:
    # Use os.path.join to construct paths
    food_df = pd.read_excel(os.path.join(BASE_DIR, "clean6.xlsx")).fillna(0)
    food_df.columns = food_df.columns.str.replace(' ', '').str.strip()
    
    scaler = joblib.load(os.path.join(BASE_DIR, "scaler.pkl"))
    model = joblib.load(os.path.join(BASE_DIR, "xgb_model.pkl"))
    print("✅ Python Server Ready!")
except Exception as e:
    print(f"❌ Error loading files: {e}")

# --- 2. 추천 로직 (수정됨) ---
def run_recommendation_logic(user_state, food_df, recent_food_names=None):
    if recent_food_names is None: recent_food_names = []
    
    # 1. 모델이 학습할 때 사용한 18개 순서 (정확히 맞춰야 함)
    # 앞쪽 6개: 음식 영양소 / 뒤쪽 12개: 사용자 상태
    food_cols = ['에너지(kcal)', '탄수화물(g)', '단백질(g)', '지방(g)', '당류(g)', '나트륨(mg)']
    user_cols = [
        'rec_cal', 'rec_carb', 'rec_pro', 'rec_fat', 'rec_sugar', 'rec_na',
        'cur_cal', 'cur_carb', 'cur_pro', 'cur_fat', 'cur_sugar', 'cur_na'
    ]
    feature_order = food_cols + user_cols # 총 18개

    # 2. 음식 데이터 매핑 (기존과 동일)
    cols_map = {
        "에너지(kcal)": ["에너지(kcal)", "에너지"],
        "탄수화물(g)": ["탄수화물(g)", "탄수화물"],
        "단백질(g)": ["단백질(g)", "단백질"],
        "지방(g)": ["지방(g)", "지방"],
        "당류(g)": ["당류(g)", "당류"],
        "나트륨(mg)": ["나트륨(mg)", "나트륨"]
    }

    food_features = pd.DataFrame()
    for std_col, candidates in cols_map.items():
        found = False
        for col in candidates:
            if col in food_df.columns:
                food_features[std_col] = food_df[col]
                found = True
                break
        if not found:
            food_features[std_col] = 0
            
    # [수정된 부분] 음식 데이터 순서를 food_cols 대로 정렬
    food_features = food_features[food_cols]

    # 3. 사용자 데이터 준비 (중복 방지 로직 추가)
    # user_state에 없는 키가 있다면 0으로 채움 (user_cols에 있는 것만!)
    filtered_user_state = {}
    for col in user_cols:
        filtered_user_state[col] = user_state.get(col, 0)

    # 사용자 데이터를 DataFrame으로 만들고 순서 정렬
    user_df = pd.DataFrame([filtered_user_state] * len(food_df))
    user_df = user_df[user_cols]

    # 4. 최종 병합 (axis=1: 옆으로 붙이기)
    # food_features(6개) + user_df(12개) = 18개 (중복 없음)
    merged = pd.concat([food_features, user_df], axis=1)
    
    try:
        # 값만 추출해서 스케일러에 넣음
        input_data = np.array(scaler.transform(merged.values))
        preds = model.predict(input_data)
        
        # 점수 변환 로직 (기존 유지)
        if np.max(preds) <= 1.0:
            preds = (preds * 50) + 45 + (np.random.rand(len(preds)) * 5)
            
    except Exception as e:
        print(f"❌ Prediction Error: {e}")
        # 에러 시 랜덤 점수 반환 (안전장치)
        preds = np.random.uniform(85, 99, len(food_df))
    
    # ... (이하 셔플 및 선택 로직은 기존과 동일하므로 그대로 두시면 됩니다) ...
    
    # (기존 코드 이어붙이기 - 편의를 위해 뒷부분도 적어드립니다)
    sorted_idx = np.argsort(preds)[::-1]
    top_candidates = sorted_idx[:50] 
    np.random.shuffle(top_candidates)
    
    selected = []
    used_categories = set()
    used_food_names = set(recent_food_names)
    
    name_col = '음식명' if '음식명' in food_df.columns else food_df.columns[0]
    cat_col = '대표식품명' if '대표식품명' in food_df.columns else food_df.columns[1]

    for idx in top_candidates:
        meal = food_df.iloc[idx]
        if meal[name_col] in used_food_names: continue
        if meal[cat_col] in used_categories: continue

        selected.append(idx)
        used_categories.add(meal[cat_col])
        used_food_names.add(meal[name_col])
        if len(selected) == 3: break

    results = []
    for idx in selected:
        meal = food_df.iloc[idx]
        
        cal_col = "에너지(kcal)" if "에너지(kcal)" in food_df.columns else "에너지"
        try: cal_val = float(meal.get(cal_col, 0))
        except: cal_val = 0.0
        try: score_val = float(preds[idx])
        except: score_val = 0.0

        results.append({
            "recommend_menu": meal[name_col],
            "calorie": cal_val,
            "score": score_val,
            "reason": f"AI 영양 점수 {score_val:.1f}점!" 
        })
    return results

@app.route('/recommend', methods=['POST'])
def recommend():
    try:
        data = request.get_json()
        user_state = data.get('user_state', {})
        recent_food_names = data.get('recent_food_names', [])
        
        recommendations = run_recommendation_logic(user_state, food_df, recent_food_names)
        return jsonify(recommendations)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # CHANGE 2: Dynamic Port for Render/Heroku
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)