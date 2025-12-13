require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3001;

// CORS 설정
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------------------
// 1. Gemini 설정 (이미지 분석용)
// ----------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY가 .env 파일에 없습니다!');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// 모델: 프리뷰 버전 (만약 503 에러 자주 뜨면 'gemini-1.5-flash'로 변경 추천)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' });

// 권장 섭취량
const RECOMMENDED_INTAKE = {
  male: { calories: 2500, carbs: 324, protein: 60, fat: 54, sugar: 50, sodium: 2000 },
  female: { calories: 2000, carbs: 270, protein: 50, fat: 45, sugar: 50, sodium: 2000 }
};

// 🔥 [필수] 개떡 같은 데이터에서 숫자만 뽑아내는 함수 (방탄조끼)
function extractNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const strVal = String(value);
    const match = strVal.match(/[0-9]+(\.[0-9]+)?/);
    return match ? Number(match[0]) : 0;
}

// ----------------------------------------------------------------
// 2. 이미지 분석 API (Gemini 사용)
// ----------------------------------------------------------------
app.post('/analyze-image', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) return res.status(400).json({ error: 'Missing image' });
    
    console.log("📤 Sending image to Gemini...");

    const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
    const prompt = "이 음식 사진을 분석하여 다음 JSON으로 반환: foodName(한국어), calories, nutrients(protein, fat, carbohydrates, sugar, sodium). 오직 JSON만 출력해.";
    
    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();

    // JSON 파싱
    let jsonText = text.match(/```json([\s\S]*)```/)?.[1] || text.match(/\{[\s\S]*\}/)?.[0] || text;
    const jsonData = JSON.parse(jsonText.replace(/[^\S \t\r\n\f\v{}[\]":,0-9.truefalsenull-가-힣a-zA-Z]/g, ''));
    
    console.log("✅ Gemini Analysis Result:", jsonData.foodName);

    // 🔥 숫자 강제 변환 (Gemini가 '약 300kcal'라고 해도 300으로 저장)
    const safeData = {
        foodName: jsonData.foodName || "음식명 없음",
        calories: extractNumber(jsonData.calories),
        nutrients: {
            protein: extractNumber(jsonData.nutrients?.protein),
            fat: extractNumber(jsonData.nutrients?.fat),
            carbohydrates: extractNumber(jsonData.nutrients?.carbohydrates),
            sugar: extractNumber(jsonData.nutrients?.sugar),
            sodium: extractNumber(jsonData.nutrients?.sodium)
        }
    };

    res.status(200).json(safeData);

  } catch (error) {
    console.error('❌ Image Analysis Error:', error.message);
    // 구글 서버 터지거나 에러 나도 프론트엔드 안 죽게 '가짜 데이터' 전송
    res.status(200).json({
        foodName: "분석 지연(다시 시도)",
        calories: 0,
        nutrients: { protein: 0, fat: 0, carbohydrates: 0, sugar: 0, sodium: 0 }
    });
  }
});

// ----------------------------------------------------------------
// 3. 메뉴 추천 API (Python 연결 + 3개 다 보여주기)
// ----------------------------------------------------------------
app.post('/get-recommendation', async (req, res) => {
  try {
    const { gender, currentIntake, foodList } = req.body;
    if (!gender || !currentIntake) return res.status(400).json({ error: 'Missing data' });

    const standard = RECOMMENDED_INTAKE[gender];
    
    // 파이썬으로 보낼 데이터 (숫자만 추출)
    const user_state = {
      "rec_cal": standard.calories, "rec_carb": standard.carbs, "rec_pro": standard.protein,
      "rec_fat": standard.fat, "rec_sugar": standard.sugar, "rec_na": standard.sodium,
      "cur_cal": extractNumber(currentIntake.calories),
      "cur_carb": extractNumber(currentIntake.carbs),
      "cur_pro": extractNumber(currentIntake.protein),
      "cur_fat": extractNumber(currentIntake.fat),
      "cur_sugar": extractNumber(currentIntake.sugar),
      "cur_na": extractNumber(currentIntake.sodium)
    };

    console.log("📤 Requesting Recommendation from Python...");
    
    // 파이썬 서버 호출
    const response = await axios.post('http://127.0.0.1:5000/recommend', {
      user_state: user_state,
      recent_food_names: foodList || []
    });

    const recommendations = response.data;
    console.log("📥 Recommendations Received:", recommendations.length);

    if (recommendations.length > 0) {
        // 데이터 정리
        const safeList = recommendations.map(item => ({
            menuName: item.recommend_menu,
            calories: extractNumber(item.calorie),
            reason: item.reason,
            score: extractNumber(item.score)
        }));

        // 🔥 [핵심] 프론트엔드 UI 하나에 3개 정보를 텍스트로 합쳐서 보여주기
        const combinedTitle = safeList.map((item, idx) => `${idx+1}. ${item.menuName}`).join(' / ');
        const combinedReason = safeList.map((item, idx) => 
            `[${idx+1}위] ${item.menuName} (${item.calories}kcal)\n👉 ${item.reason}`
        ).join('\n\n');

        res.status(200).json({
            menuName: combinedTitle,
            calories: safeList[0].calories, // 칼로리는 1위 기준
            reason: combinedReason
        });

    } else {
        res.status(200).json({ menuName: "추천 불가", calories: 0, reason: "조건에 맞는 메뉴가 없습니다." });
    }

  } catch (error) {
    console.error('❌ Recommendation Error:', error.message);
    res.status(500).json({ error: 'Python Server connection failed' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Dieter Server listening on http://localhost:${port}`);
});