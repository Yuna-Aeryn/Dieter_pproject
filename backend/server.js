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
  male: {
    calories: 2500,
    carbs: 324,
    protein: 60,
    fat: 54,
    sugar: 50,    
    sodium: 2000
  },
  female: {
    calories: 2000,
    carbs: 270,
    protein: 50,
    fat: 45,
    sugar: 50,    
    sodium: 2000
  }
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
    
   
    const prompt = "Analyze this food item and return ONLY a valid JSON object with foodName, calories, and a nutrients object containing: protein (g), fat (g), carbohydrates (g), sugar (g), and sodium (mg).";
    
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
      
      const cleanedJsonText = jsonText.replace(/[^\S \t\r\n\f\v{}[\]":,0-9.truefalsenull-]/g, '');
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

    if (!gender || !['male', 'female'].includes(gender)) {
      return res.status(400).json({ error: 'Invalid gender' });
    }
    if (!currentIntake) {
      return res.status(400).json({ error: 'Missing currentIntake data' });
    }

    const standard = RECOMMENDED_INTAKE[gender];
    const eatenFoods = foodList ? `(오늘 먹은 음식: ${foodList.join(', ')})` : '';

    console.log(`[추천 요청] 성별: ${gender}, 음식: ${eatenFoods}`);

    const prompt = `
      당신은 전문 영양사입니다. 
      아래 제공된 [사용자 권장 섭취량]과 [오늘 실제 섭취량]을 비교 분석하여,
      부족한 영양소를 채우거나 과잉을 조절할 수 있는 **저녁 메뉴 1가지**를 추천해주세요.
      ${eatenFoods}

      [1. 사용자 권장 섭취량 (${gender === 'male' ? '남성' : '여성'} 기준)]
      - 칼로리: ${standard.calories}kcal
      - 탄수화물: ${standard.carbs}g
      - 단백질: ${standard.protein}g
      - 지방: ${standard.fat}g
      - 당류: ${standard.sugar}g
      - 나트륨: ${standard.sodium}mg

      [2. 오늘 실제 섭취량]
      - 칼로리: ${currentIntake.calories || 0}kcal
      - 탄수화물: ${currentIntake.carbs || 0}g
      - 단백질: ${currentIntake.protein || 0}g
      - 지방: ${currentIntake.fat || 0}g
      - 당류: ${currentIntake.sugar || 0}g
      - 나트륨: ${currentIntake.sodium || 0}mg

      [요청 사항]
      1. 위 데이터를 바탕으로 최적의 한국식 저녁 메뉴를 선정하세요.
      2. **반드시 아래 JSON 형식으로만 응답하세요.** (Markdown이나 설명글 없이 오직 JSON만)

      {
        "menuName": "메뉴 이름",
        "calories": 숫자(kcal),
        "reason": "추천 이유 한 문장"
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
