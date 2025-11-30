require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3001;

// --- Security & Middleware ---
// Ideally, use environment variables for the origin in production
app.use(cors({ origin: 'http://localhost:5173' })); 
app.use(express.json({ limit: '10mb' }));

// --- API Key Setup ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set. Please check your .env file.');
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash-preview-09-2025' 
});

// --- API Endpoint: /analyze-image ---
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
    
    // Prompt asks for 6 nutrients
    const prompt = "Analyze this food item and return ONLY a valid JSON object with foodName, calories, and a nutrients object containing: protein (g), fat (g), carbohydrates (g), sugar (g), and sodium (mg).";
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();

    console.log('--- Raw text from Gemini (Image) ---');
    console.log(text);
    console.log('--- End raw text (Image) ---');

    let jsonData;
    let jsonText;

    try {
      const markdownMatch = text.match(/```json([\s\S]*)```/);
      if (markdownMatch && markdownMatch[1]) {
        jsonText = markdownMatch[1];
      } else {
        const rawJsonMatch = text.match(/\{[\s\S]*\}/);
        if (rawJsonMatch && rawJsonMatch[0]) {
          jsonText = rawJsonMatch[0];
        } else {
          throw new Error('Gemini API returned non-JSON response.');
        }
      }
      
      const cleanedJsonText = jsonText.replace(/[^\S \t\r\n\f\v{}[\]":,0-9.truefalsenull-]/g, '');
      jsonData = JSON.parse(cleanedJsonText);

    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      return res.status(500).json({ error: 'Gemini API returned malformed JSON.', details: text });
    }

    res.status(200).json(jsonData);

  } catch (error) {
    console.error('Error in /analyze-image:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

// --- API Endpoint: /get-recommendation ---
// SIMPLIFIED: No longer accepts or uses userProfile
app.post('/get-recommendation', async (req, res) => {
  try {
    const { foodList, totals, rda } = req.body;

    const userQuery =
      foodList.length > 0
        ? `Today I have eaten: ${foodList}. My daily targets are: ${rda.calories} kcal, ${rda.protein}g Protein, ${rda.carbohydrates}g Carbs, ${rda.fat}g Fat, ${rda.sugar}g Sugar, ${rda.sodium}mg Sodium. My current totals are: ${totals.calories} kcal, ${totals.protein}g Protein, ${totals.carbohydrates}g Carbs, ${totals.fat}g Fat, ${totals.sugar}g Sugar, ${totals.sodium}mg Sodium. What specific food should I eat next to balance this?`
        : `I haven't eaten anything yet today. My daily target is ${rda.calories} kcal. Recommend a balanced first meal.`;

    const systemPrompt =
      "You are a helpful nutrition coach. Provide a short (2-3 sentences) recommendation. Do NOT list the numbers back to the user; just give advice.";
    
    const fullPrompt = `${systemPrompt}\n\nUser query: ${userQuery}`;

    // Using generateContent for simpler text generation
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    console.log('--- Raw text from Gemini (Recommendation) ---');
    console.log(text);
    console.log('--- End raw text (Recommendation) ---');

    res.status(200).json({ recommendation: text });

  } catch (error) {
    console.error('Error in /get-recommendation:', error);
    res.status(500).json({ error: 'Failed to get recommendation' });
  }
});

app.listen(port, () => {
  console.log(`Dieter backend listening on http://localhost:${port}`);
});