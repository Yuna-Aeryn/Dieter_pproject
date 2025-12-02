require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3001;

app.use(cors({ origin: 'http://localhost:5173' })); 
app.use(express.json({ limit: '10mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set. Please check your .env file.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash-preview-09-2025' 
});

const RECOMMENDED_INTAKE = {
  male: { calories: 2500, carbs: 324, protein: 60, fat: 54, sugar: 50, sodium: 2000 },
  female: { calories: 2000, carbs: 270, protein: 50, fat: 45, sugar: 50, sodium: 2000 }
};

app.post('/analyze-image', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Missing imageBase64 or mimeType' });
    }
    
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    };
    
    // [수정됨] 프롬프트: 음식 이름을 한국어로 반환하도록 요청
    const prompt = "이 음식 사진을 분석하여 다음 필드를 가진 유효한 JSON 객체만 반환해 주세요: foodName(음식 이름은 반드시 한국어로), calories(칼로리 숫자), nutrients 객체(protein(단백질 g), fat(지방 g), carbohydrates(탄수화물 g), sugar(당류 g), sodium(나트륨 mg)).";
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();

    console.log('--- Raw text from Gemini (Image) ---');
    console.log(text);

    let jsonData;
    try {
      let jsonText = text;
      const markdownMatch = text.match(/```json([\s\S]*)```/);
      if (markdownMatch && markdownMatch[1]) {
        jsonText = markdownMatch[1];
      } else {
        const rawJsonMatch = text.match(/\{[\s\S]*\}/);
        if (rawJsonMatch) jsonText = rawJsonMatch[0];
      }
      
      const cleanedJsonText = jsonText.replace(/[^\S \t\r\n\f\v{}[\]":,0-9.truefalsenull-가-힣a-zA-Z]/g, ''); // 한글 허용 Regex
      jsonData = JSON.parse(cleanedJsonText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      return res.status(500).json({ error: 'Gemini API returned malformed JSON.', details: text });
    }

    res.status(200).json(jsonData);

  } catch (error) {
    console.error('Error in /analyze-image:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

app.post('/get-recommendation', async (req, res) => {
  try {
    const { gender, currentIntake, foodList } = req.body;

    if (!gender || !['male', 'female'].includes(gender)) return res.status(400).json({ error: 'Invalid gender' });
    if (!currentIntake) return res.status(400).json({ error: 'Missing currentIntake data' });

    const standard = RECOMMENDED_INTAKE[gender];
    const eatenFoods = foodList ? `(오늘 먹은 음식: ${foodList.join(', ')})` : '';

    const prompt = `
      당신은 전문 영양사입니다. 
      아래 [사용자 권장 섭취량]과 [오늘 실제 섭취량]을 비교하여,
      부족하거나 과한 영양소를 고려한 **최적의 저녁 메뉴 1가지**를 추천해주세요.
      ${eatenFoods}

      [1. 권장 섭취량 (${gender === 'male' ? '남성' : '여성'})]
      - 칼로리: ${standard.calories}kcal, 탄수화물: ${standard.carbs}g, 단백질: ${standard.protein}g, 지방: ${standard.fat}g, 당류: ${standard.sugar}g, 나트륨: ${standard.sodium}mg

      [2. 오늘 섭취량]
      - 칼로리: ${currentIntake.calories}kcal, 탄수화물: ${currentIntake.carbs}g, 단백질: ${currentIntake.protein}g, 지방: ${currentIntake.fat}g, 당류: ${currentIntake.sugar}g, 나트륨: ${currentIntake.sodium}mg

      [응답 형식 (JSON Only)]
      {
        "menuName": "메뉴 이름 (한국어)",
        "calories": 숫자,
        "reason": "추천 이유 한 문장 (한국어)"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const recommendation = JSON.parse(text);
    
    res.status(200).json(recommendation);

  } catch (error) {
    console.error('Error in /get-recommendation:', error);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

app.listen(port, () => {
  console.log(`Dieter backend listening on http://localhost:${port}`);
});