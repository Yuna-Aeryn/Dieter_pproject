require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3001;

// CORS 설정 (로컬 프론트엔드 주소 허용)
app.use(cors({ origin: 'http://localhost:5173' })); 
app.use(express.json({ limit: '10mb' }));

// --- Gemini 설정 ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set. Please check your .env file.');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// 구글 서버 과부하(503)가 잦으면 'gemini-1.5-flash'로 변경 고려
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' });

// --- 권장 섭취량 기준표 ---
const RECOMMENDED_INTAKE = {
  male: { calories: 2500, carbs: 324, protein: 60, fat: 54, sugar: 50, sodium: 2000 },
  female: { calories: 2000, carbs: 270, protein: 50, fat: 45, sugar: 50, sodium: 2000 }
};

// 🔥 [핵심 기능] 개떡 같은 데이터("약 20g", "1인분")에서 숫자만 뽑아내는 함수
function extractNumber(value) {
    if (typeof value === 'number') return value; // 이미 숫자면 통과
    if (!value) return 0; // 없으면 0
    
    // 문자열로 바꾸고 정규식으로 숫자(소수점 포함)만 찾기
    const strVal = String(value);
    const match = strVal.match(/[0-9]+(\.[0-9]+)?/); 
    
    return match ? Number(match[0]) : 0; // 찾으면 숫자 변환, 못 찾으면 0
}

// --- 1. 이미지 분석 API ---
app.post('/analyze-image', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) return res.status(400).json({ error: 'Missing image' });
    
    const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
    const prompt = "이 음식 사진을 분석하여 다음 JSON으로 반환: foodName(한국어), calories, nutrients(protein, fat, carbohydrates, sugar, sodium).";
    
    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();

    // JSON 파싱 (마크다운 제거 등 전처리)
    let jsonText = text.match(/```json([\s\S]*)```/)?.[1] || text.match(/\{[\s\S]*\}/)?.[0] || text;
    const jsonData = JSON.parse(jsonText.replace(/[^\S \t\r\n\f\v{}[\]":,0-9.truefalsenull-가-힣a-zA-Z]/g, ''));
    
    // 🔥 [숫자 강제 변환] "20g"이 들어와도 20으로 바꿔서 프론트 사망 방지
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
    console.error('Image Analysis Error:', error);
    // 구글 서버 터졌을 때도 프론트엔드가 안 죽도록 가짜 데이터 전송
    res.status(200).json({
        foodName: "분석 지연(잠시 후 시도)",
        calories: 0,
        nutrients: { protein: 0, fat: 0, carbohydrates: 0, sugar: 0, sodium: 0 }
    });
  }
});

// --- 2. 메뉴 추천 API (3개 다 보여주기 버전) ---
app.post('/get-recommendation', async (req, res) => {
  try {
    const { gender, currentIntake, foodList } = req.body;
    if (!gender || !currentIntake) return res.status(400).json({ error: 'Missing data' });

    const standard = RECOMMENDED_INTAKE[gender];
    
    // 파이썬으로 보낼 데이터 (여기도 숫자만 뽑아서 보냄)
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

    console.log("Sending data to Python Server...");
    
    // 파이썬 서버 호출
    const response = await axios.post('http://127.0.0.1:5000/recommend', {
      user_state: user_state,
      recent_food_names: foodList || []
    });

    const recommendations = response.data;
    console.log("AI Response (Count):", recommendations.length);

    if (recommendations.length > 0) {
        // 1. 받은 데이터 안전하게 정리
        const safeList = recommendations.map(item => ({
            menuName: item.recommend_menu,
            calories: extractNumber(item.calorie),
            reason: item.reason,
            score: extractNumber(item.score)
        }));

        // 2. [핵심] 프론트를 안 고치고 3개를 다 보여주는 꼼수!
        // 제목: "1. 메뉴A / 2. 메뉴B / 3. 메뉴C"
        const combinedTitle = safeList.map((item, idx) => `${idx+1}. ${item.menuName}`).join(' / ');

        // 내용: 줄바꿈(\n)을 써서 3개 상세 정보를 다 적음
        const combinedReason = safeList.map((item, idx) => 
            `[${idx+1}위] ${item.menuName} (${item.calories}kcal)\n👉 ${item.reason}`
        ).join('\n\n');

        // 프론트엔드로 전송
        res.status(200).json({
            menuName: combinedTitle,   // 제목에 3개 다 나옴
            calories: safeList[0].calories, // 칼로리는 1등 기준
            reason: combinedReason     // 설명에 3개 상세 정보 다 나옴
        });

    } else {
        res.status(200).json({ menuName: "추천 불가", calories: 0, reason: "조건에 맞는 메뉴가 없습니다." });
    }

  } catch (error) {
    console.error('Recommendation Error:', error.message);
    res.status(500).json({ error: 'Python Server connection failed' });
  }
});

app.listen(port, () => {
  console.log(`Dieter Node.js Server listening on http://localhost:${port}`);
});