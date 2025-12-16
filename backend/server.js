require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OpenAI = require('openai'); // OpenAI 불러오기
const app = express();
const port = process.env.PORT || 3001; 
app.use(express.json({ limit: '50mb' })); // JSON 데이터 해석 & 용량 제한 늘리기
app.use(express.urlencoded({ limit: '50mb', extended: true })); // URL 인코딩 데이터 해석
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dieter01.netlify.app';
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'https://dieter-pproject-ai-server.onrender.com';

// CORS 설정
app.use(cors({ origin: FRONTEND_URL }));

// --- OpenAI 설정 ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY가 없습니다. .env 파일을 확인하세요!');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const RECOMMENDED_INTAKE = {
  male: { calories: 2500, carbs: 324, protein: 60, fat: 54, sugar: 50, sodium: 2000 },
  female: { calories: 2000, carbs: 270, protein: 50, fat: 45, sugar: 50, sodium: 2000 }
};

// 🔥 숫자만 추출하는 함수 (안전장치)
function extractNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const strVal = String(value);
    const match = strVal.match(/[0-9]+(\.[0-9]+)?/);
    return match ? Number(match[0]) : 0;
}

// ----------------------------------------------------------------
// 1. 이미지 분석 API (GPT-4o Vision)
// ----------------------------------------------------------------
app.post('/analyze-image', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) return res.status(400).json({ error: 'Missing image' });
    
    console.log("📤 GPT-4o에게 사진 분석 요청 중...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `
                이 음식 사진을 분석해줘.
                1. 음식 이름은 한국어로 적어줘.
                2. 영양소(칼로리, 탄수화물, 단백질, 지방, 당류, 나트륨)를 추정해줘.
                
                [중요] 응답은 무조건 아래 JSON 형식(Key는 영어)을 지켜야 해:
                {
                    "foodName": "음식이름(한국어)",
                    "calories": 숫자,
                    "nutrients": {
                        "protein": 숫자,
                        "fat": 숫자,
                        "carbohydrates": 숫자,
                        "sugar": 숫자,
                        "sodium": 숫자
                    }
                }
                단위(g, kcal)나 설명은 빼고 숫자만 넣어.
              `
            },
            {
              type: "image_url",
              image_url: {
                "url": `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" }, 
    });

    const content = response.choices[0].message.content;
    console.log("✅ GPT-4o 응답(이미지):", content);

    const jsonData = JSON.parse(content);

    // GPT가 혹시라도 한글 키를 줄까 봐 2중, 3중으로 받아주는 안전장치
    const safeData = {
        foodName: jsonData.foodName || jsonData['음식 이름'] || "음식명 없음",
        calories: extractNumber(jsonData.calories || jsonData['칼로리']),
        nutrients: {
            protein: extractNumber(jsonData.nutrients?.protein || jsonData['영양소']?.['단백질']),
            fat: extractNumber(jsonData.nutrients?.fat || jsonData['영양소']?.['지방']),
            carbohydrates: extractNumber(jsonData.nutrients?.carbohydrates || jsonData['영양소']?.['탄수화물']),
            sugar: extractNumber(jsonData.nutrients?.sugar || jsonData['영양소']?.['당류']),
            sodium: extractNumber(jsonData.nutrients?.sodium || jsonData['영양소']?.['나트륨'])
        }
    };

    res.status(200).json(safeData);

  } catch (error) {
    console.error('❌ Image Analysis Error:', error);
    res.status(200).json({
        foodName: "분석 실패 (오류)",
        calories: 0,
        nutrients: { protein: 0, fat: 0, carbohydrates: 0, sugar: 0, sodium: 0 }
    });
  }
});

// ----------------------------------------------------------------
// 2. 텍스트 분석 API (GPT-4o Text)
// ----------------------------------------------------------------
app.post('/analyze-text', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Text required' });

        console.log(`📝 GPT-4o 텍스트 분석 요청: "${text}"`);

        const prompt = `
            사용자가 입력한 음식 텍스트: "${text}"
            
            이 내용을 바탕으로 음식 이름(한국어)과 영양소를 추정해줘.
            양이 명시되어 있다면(예: 2인분, 두 그릇) 영양소를 곱해서 계산해줘.

            [중요] 응답은 무조건 아래 JSON 형식(Key는 영어)을 지켜야 해:
            {
                "foodName": "음식이름 (양 포함)",
                "calories": 숫자,
                "nutrients": {
                    "protein": 숫자,
                    "fat": 숫자,
                    "carbohydrates": 숫자,
                    "sugar": 숫자,
                    "sodium": 숫자
                }
            }
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const content = response.choices[0].message.content;
        console.log("✅ GPT-4o 응답(텍스트):", content);
        
        const jsonData = JSON.parse(content);

        const safeData = {
            foodName: jsonData.foodName || jsonData['음식 이름'] || text,
            calories: extractNumber(jsonData.calories || jsonData['칼로리']),
            nutrients: {
                protein: extractNumber(jsonData.nutrients?.protein || jsonData['영양소']?.['단백질']),
                fat: extractNumber(jsonData.nutrients?.fat || jsonData['영양소']?.['지방']),
                carbohydrates: extractNumber(jsonData.nutrients?.carbohydrates || jsonData['영양소']?.['탄수화물']),
                sugar: extractNumber(jsonData.nutrients?.sugar || jsonData['영양소']?.['당류']),
                sodium: extractNumber(jsonData.nutrients?.sodium || jsonData['영양소']?.['나트륨'])
            }
        };

        res.status(200).json(safeData);

    } catch (error) {
        console.error('❌ Text Analysis Error:', error);
        res.status(200).json({
            foodName: "검색 실패",
            calories: 0,
            nutrients: { protein: 0, fat: 0, carbohydrates: 0, sugar: 0, sodium: 0 }
        });
    }
});

// ----------------------------------------------------------------
// 3. 메뉴 추천 API (파이썬 연결 - 기존 유지)
// ----------------------------------------------------------------
app.post('/get-recommendation', async (req, res) => {
  try {
    const { gender, currentIntake, foodList } = req.body;
    
    // 1. 환경 변수 가져오기
    // 배포 환경에서는 process.env.PYTHON_API_URL이 사용됩니다.
    // 로컬 환경을 위해 뒤에 || 'http://...' 를 붙여줍니다.
    const pythonBaseUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:5000';

    // [디버깅 로그] 실제 사용되는 URL이 무엇인지 Render 로그창에서 확인하세요!
    console.log("👉 Target Python URL:", pythonBaseUrl); 

    // URL 유효성 검사 (안전장치)
    if (!pythonBaseUrl.startsWith('http')) {
        throw new Error(`Invalid URL Configuration: ${pythonBaseUrl}`);
    }

    // 2. 요청 보내기
    const response = await axios.post(`${pythonBaseUrl}/recommend`, {
      user_state: {
          // ... 기존 user_state 로직 그대로 ...
          "rec_cal": 2500, // (예시) 필요한 데이터 매핑 확인
          // ...
          ...req.body.currentIntake // 혹은 필요한 데이터 구조에 맞게
      },
      recent_food_names: foodList || []
    });
	
    const recommendations = response.data; 
	
    if (recommendations && recommendations.length > 0) {
        const safeList = recommendations.map(item => {  
            
            // 1. Clean the name (Logic we added)
            let cleanName = item.recommend_menu;
            if (cleanName && cleanName.includes('_')) {
                cleanName = cleanName.split('_').reverse().join(' ');
            }

            // 2. Return the object explicitly
            return {  
                menuName: cleanName, 
                calories: extractNumber(item.calorie),
                reason: item.reason,
                score: extractNumber(item.score)
            };
        }); 
	
        const combinedTitle = safeList.map((item, idx) => `${idx+1}. ${item.menuName}`).join(' / ');
        const combinedReason = safeList.map((item, idx) => 
            `[${idx+1}위] ${item.menuName} (${item.calories}kcal)\n👉 ${item.reason}`
        ).join('\n\n');

        res.status(200).json({
            menuName: combinedTitle,
            calories: safeList[0].calories,
            reason: combinedReason
        });
    } else {
        res.status(200).json({ menuName: "추천 불가", calories: 0, reason: "조건에 맞는 메뉴가 없습니다." });
    }

  } catch (error) {
    // 에러 로그를 더 자세히 출력
    console.error('❌ Recommendation Error:', error.message);
    if (error.config) {
        console.error('   Requested URL:', error.config.url); // 어떤 주소로 쏘다가 죽었는지 확인
    }
    res.status(500).json({ error: 'Python Server connection failed' });
  }
});


app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Node.js Server listening on port ${port}`);
});