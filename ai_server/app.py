from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import joblib
import xgboost as xgb

app = Flask(__name__)

# --- 1. 모델과 데이터 로딩 ---
print("Loading AI Models & Data...")
try:
    # 엑셀 파일 읽기 (빈 값은 0으로 채움)
    food_df = pd.read_excel("./clean6.xlsx").fillna(0)
    
    # 모델과 스케일러 로딩
    scaler = joblib.load("./scaler.pkl")
    model = joblib.load("./xgb_model.pkl")
    print("✅ All resources loaded successfully!")
    
except Exception as e:
    print(f"❌ Error loading files: {e}")
    print("파일이 ai_server 폴더 안에 다 있는지 확인해주세요!")

# --- 2. 추천 로직 함수 ---
def run_recommendation_logic(user_state, food_df, recent_food_names=None):
    if recent_food_names is None:
        recent_food_names = []

    # 학습 때 사용한 Feature 순서
    feature_order = [
        '에너지(kcal)', '탄수화물(g)', '단백질(g)', '지방(g)', '당류(g)', '나트륨(mg)',
        'rec_cal', 'rec_carb', 'rec_pro', 'rec_fat', 'rec_sugar', 'rec_na',
        'cur_cal', 'cur_carb', 'cur_pro', 'cur_fat', 'cur_sugar', 'cur_na'
    ]

    # 음식 데이터 준비
    food_features = food_df[[
        "에너지(kcal)", "탄수화물(g)", "단백질(g)",
        "지방(g)", "당류(g)", "나트륨(mg)"
    ]]

    # 사용자 상태 준비 (누락값 0 처리)
    for col in feature_order:
        if col not in food_features.columns and col not in user_state:
            user_state[col] = 0

    # 데이터 합치기 & 스케일링
    user_df = pd.DataFrame([user_state] * len(food_df))
    merged = pd.concat([food_features, user_df], axis=1)[feature_order]
    merged_scaled = scaler.transform(merged)
    
    # 예측 (점수 계산)
    preds = model.predict(merged_scaled)
    sorted_idx = np.argsort(preds)[::-1]

    # 필터링 (최근 먹은 음식 & 중복 카테고리 제외)
    selected = []
    used_categories = set()
    used_food_names = set(recent_food_names)

    for idx in sorted_idx:
        meal = food_df.iloc[idx]
        if meal["음식명"] in used_food_names: continue
        if meal["대표식품명"] in used_categories: continue

        selected.append(idx)
        used_categories.add(meal["대표식품명"])
        used_food_names.add(meal["음식명"])

        if len(selected) == 3: # TOP 3 뽑기
            break

    # --- [핵심] 결과 포맷팅 (철벽 방어 구간) ---
    results = []
    for idx in selected:
        meal = food_df.iloc[idx]
        
        # 1. 무조건 float(실수)로 변환 시도
        try:
            cal_val = float(meal["에너지(kcal)"])
        except:
            cal_val = 0.0 # 실패하면 0.0

        try:
            score_val = float(preds[idx])
        except:
            score_val = 0.0

        # 2. NaN(Not a Number)이나 무한대(Inf) 체크
        if np.isnan(cal_val) or np.isinf(cal_val): cal_val = 0.0
        if np.isnan(score_val) or np.isinf(score_val): score_val = 0.0

        results.append({
            "recommend_menu": meal["음식명"],
            "calorie": cal_val,   # 👈 무조건 깨끗한 숫자만 나감
            "score": score_val,
            "reason": f"AI 영양 점수 {score_val:.1f}점으로 선정된 메뉴입니다."
        })

    return results

# --- 3. API 엔드포인트 ---
@app.route('/recommend', methods=['POST'])
def recommend():
    try:
        data = request.get_json()
        user_state = data.get('user_state', {})
        recent_food_names = data.get('recent_food_names', [])

        print(f"📡 Request Received! User Cal Gap: {user_state.get('rec_cal', 0) - user_state.get('cur_cal', 0)}")

        recommendations = run_recommendation_logic(user_state, food_df, recent_food_names)
        return jsonify(recommendations)

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)