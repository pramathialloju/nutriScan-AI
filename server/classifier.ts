import { GoogleGenAI, Type } from '@google/genai';
import { FOOD_DATASET } from '../src/lib/nutritionData.ts';
import type { FoodItem } from '../src/lib/nutritionData.ts';
import { matchPredictedLabelToFood } from '../src/lib/nutritionCalc.ts';

export interface FoodPredictionResult {
  predictedLabel: string;
  confidence: number;
  isFood: boolean;
  status: 'matched' | 'low_confidence' | 'unsupported';
  mode: 'gemini-vision' | 'demonstration';
  reasoning: string;
  matchedFood: FoodItem | null;
  message: string;
}

const KNOWN_DISH_NAMES = FOOD_DATASET.map((f) => f.name).join(', ');

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function classifyFoodImage(params: {
  imageBuffer: Buffer;
  mimeType: string;
  sampleKey?: string;
}): Promise<FoodPredictionResult> {
  const ai = getGeminiClient();

  if (!ai) {
    // Explicit, transparent Demonstration Mode when live vision API / local CNN weights are unavailable
    if (params.sampleKey) {
      const sampleMap: Record<string, string> = {
        masala_dosa: 'indian_masala_dosa',
        paneer_bowl: 'indian_paneer_curry',
        grilled_salad: 'f101_grilled_salmon_bowl',
      };
      const foodId = sampleMap[params.sampleKey];
      const matched = FOOD_DATASET.find((f) => f.id === foodId) ?? null;
      if (matched) {
        return {
          predictedLabel: matched.name,
          confidence: 0.94,
          isFood: true,
          status: 'matched',
          mode: 'demonstration',
          reasoning:
            'Demonstration sample mode active (live Vision API key or trained MobileNetV2 .keras weights not loaded).',
          matchedFood: matched,
          message:
            'Identified using curated Demonstration Sample mapping. Connect GEMINI_API_KEY or trained MobileNetV2 weights in models/ for live inference on arbitrary uploads.',
        };
      }
    }

    return {
      predictedLabel: 'Model Unavailable',
      confidence: 0,
      isFood: false,
      status: 'unsupported',
      mode: 'demonstration',
      reasoning:
        'Live image classification model is currently unavailable (no trained MobileNetV2 model file or GEMINI_API_KEY configured).',
      matchedFood: null,
      message:
        'Demonstration Mode: Arbitrary photo inference requires either the live vision model or trained MobileNetV2/ResNet50 weights in NutriScan_AI/models/. Try one of the 3 curated sample dishes or follow the model integration guide below.',
    };
  }

  const base64Image = params.imageBuffer.toString('base64');

  const prompt = [
    'You are the food image classification engine for NutriScan AI.',
    'Analyze the uploaded image carefully and classify what dish is shown.',
    `Preferred canonical dish labels in our Indian + Food-101 nutrition database: ${KNOWN_DISH_NAMES}.`,
    'Rules:',
    '1. If the image is NOT food (e.g., an object, person, landscape, text screenshot, blank image), set isFood=false, confidence <= 0.3, and predictedLabel="Not a food item".',
    '2. If the image IS food and matches or closely corresponds to one of the canonical dish labels above, return that exact canonical dish name in predictedLabel.',
    '3. If the image is food but not in the canonical list, return the honest dish name (e.g., "Samosa" or "Fruit Salad") so the system can report unsupported dish cleanly.',
    '4. Provide a realistic confidence score between 0.0 and 1.0 based on visual clarity.',
    '5. Provide a concise 1-sentence visual description in reasoning.',
  ].join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: base64Image,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isFood: { type: Type.BOOLEAN },
          predictedLabel: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ['isFood', 'predictedLabel', 'confidence', 'reasoning'],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as {
    isFood: boolean;
    predictedLabel: string;
    confidence: number;
    reasoning: string;
  };

  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

  if (!parsed.isFood || confidence < 0.55) {
    return {
      predictedLabel: parsed.predictedLabel || 'Uncertain image',
      confidence,
      isFood: Boolean(parsed.isFood),
      status: 'low_confidence',
      mode: 'gemini-vision',
      reasoning:
        parsed.reasoning ||
        'The uploaded image did not clearly show a supported food dish.',
      matchedFood: null,
      message: !parsed.isFood
        ? 'This image does not appear to contain a recognizable food dish. Please upload a clear photo of a meal.'
        : 'Prediction confidence was too low to reliably identify this dish. Try a clearer, well-lit photo.',
    };
  }

  const matched = matchPredictedLabelToFood(parsed.predictedLabel, FOOD_DATASET);

  if (!matched) {
    return {
      predictedLabel: parsed.predictedLabel,
      confidence,
      isFood: true,
      status: 'unsupported',
      mode: 'gemini-vision',
      reasoning: parsed.reasoning,
      matchedFood: null,
      message: `Detected "${parsed.predictedLabel}", which is not yet in our Indian & Food-101 nutrition dataset. You can still browse or log similar dishes in Nutrition Analysis.`,
    };
  }

  return {
    predictedLabel: matched.name,
    confidence,
    isFood: true,
    status: 'matched',
    mode: 'gemini-vision',
    reasoning: parsed.reasoning,
    matchedFood: matched,
    message: `Identified ${matched.name} (${Math.round(confidence * 100)}% confidence).`,
  };
}
