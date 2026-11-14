import { GoogleGenAI, Type } from '@google/genai';
import { CUISINE_CATEGORIES, FOOD_DATASET } from '../src/lib/nutritionData.ts';
import type { FoodCategory, FoodItem } from '../src/lib/nutritionData.ts';
import { matchPredictedLabelToFood } from '../src/lib/nutritionCalc.ts';

export interface FoodPredictionResult {
  predictedLabel: string;
  confidence: number;
  isFood: boolean;
  status: 'matched' | 'low_confidence' | 'unsupported';
  mode: 'gemini-vision' | 'demonstration';
  nutritionSource?: 'dataset' | 'ai-estimate';
  reasoning: string;
  matchedFood: FoodItem | null;
  message: string;
}

const KNOWN_DISH_NAMES = FOOD_DATASET.map((f) => f.name).join(', ');

const round1 = (n: number): number => Math.round(n * 10) / 10;

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function buildAiEstimatedFoodItem(parsed: {
  predictedLabel: string;
  servingLabel?: string;
  servingGrams?: number;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  dietaryType?: string;
  category?: string;
  notes?: string;
}): FoodItem {
  const name = parsed.predictedLabel.trim() || 'Recognized Dish';
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'custom_dish';

  const protein_g = round1(clampNumber(parsed.protein_g, 0, 200, 4));
  const carbs_g = round1(clampNumber(parsed.carbs_g, 0, 400, 25));
  const fat_g = round1(clampNumber(parsed.fat_g, 0, 200, 8));
  const fiber_g = round1(clampNumber(parsed.fiber_g, 0, 100, 1.5));
  const macroCalories = Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
  const rawCalories = Math.round(clampNumber(parsed.calories, 0, 3500, macroCalories));
  const calories = rawCalories > 0 ? rawCalories : Math.max(10, macroCalories);
  const servingGrams = Math.round(clampNumber(parsed.servingGrams, 10, 2500, 150));
  const sugar_g = round1(clampNumber(parsed.sugar_g, 0, 200, 0));
  const sodium_mg = Math.round(clampNumber(parsed.sodium_mg, 0, 5000, 180));
  const servingLabel =
    parsed.servingLabel && parsed.servingLabel.trim().length > 0
      ? parsed.servingLabel.trim()
      : `1 serving (${servingGrams}g)`;
  const dietaryType =
    parsed.dietaryType?.toLowerCase() === 'non-vegetarian'
      ? 'non-vegetarian'
      : 'vegetarian';
  const matchedCategory = CUISINE_CATEGORIES.find(
    (c) => c.toLowerCase() === (parsed.category ?? '').trim().toLowerCase()
  );
  const category: FoodCategory = matchedCategory ?? 'Food-101';
  const extraNote = parsed.notes ? `${parsed.notes.trim()} ` : '';

  return {
    id: `ai_${slug}`,
    slug,
    name,
    category,
    dietaryType,
    mealTypes: ['Breakfast', 'Lunch', 'Evening Snacks', 'Dinner'],
    servingLabel,
    servingGrams,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    sodium_mg,
    sugar_g,
    proteinRich: protein_g >= 15,
    balancedWeightFriendly: calories <= 400 && fiber_g >= 3,
    aliases: [name.toLowerCase()],
    notes: `${extraNote}AI visual nutrition estimate; actual values vary by brand, ingredients, and portion size.`,
  };
}

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
          nutritionSource: 'dataset',
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
    'You are the food image classification and nutrition estimation engine for NutriScan AI.',
    'Analyze the uploaded image carefully, identify the food or beverage shown, and estimate its standard single-serving nutrition.',
    `Preferred canonical dish labels in our multi-cuisine nutrition database (Indian, Italian, Asian, Mexican, Mediterranean, American & Desserts): ${KNOWN_DISH_NAMES}.`,
    'Rules:',
    '1. If the image is NOT food (e.g., an object, person, landscape, text screenshot, blank image), set isFood=false, confidence <= 0.3, predictedLabel="Not a food item", and 0 for nutritional values.',
    '2. If the image IS food and clearly matches one of the canonical dish labels above, return that exact canonical dish name in predictedLabel.',
    '3. If the image IS food and is another recognizable dish, snack, dessert, or drink not in the canonical list (e.g., "Chocolate Ice Cream Bar", "Croissant", "Momos", "Tacos"), return its accurate dish name in predictedLabel.',
    '4. For every valid food image, provide realistic per-serving nutritional estimates: servingLabel (e.g., "1 bar (85g)" or "1 bowl (250g)"), servingGrams, calories (kcal), protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, dietaryType ("vegetarian" or "non-vegetarian"), category (one of: "Indian", "Italian", "Asian", "Mexican", "Mediterranean", "American", "Desserts & Snacks"), and a brief 1-sentence preparation/nutrition note in notes.',
    '5. Provide a realistic confidence score between 0.0 and 1.0 based on visual clarity.',
    '6. Provide a concise 1-sentence visual description in reasoning.',
  ].join('\n');

  const callVisionModel = async (model: string) =>
    ai.models.generateContent({
      model,
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
            servingLabel: { type: Type.STRING },
            servingGrams: { type: Type.NUMBER },
            calories: { type: Type.NUMBER },
            protein_g: { type: Type.NUMBER },
            carbs_g: { type: Type.NUMBER },
            fat_g: { type: Type.NUMBER },
            fiber_g: { type: Type.NUMBER },
            sugar_g: { type: Type.NUMBER },
            sodium_mg: { type: Type.NUMBER },
            dietaryType: { type: Type.STRING },
            category: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: [
            'isFood',
            'predictedLabel',
            'confidence',
            'reasoning',
            'servingLabel',
            'servingGrams',
            'calories',
            'protein_g',
            'carbs_g',
            'fat_g',
            'fiber_g',
          ],
        },
      },
    });

  let response;
  try {
    response = await callVisionModel('gemini-4-hydrogen');
  } catch (primaryErr) {
    try {
      response = await callVisionModel('gemini-3.1-flash-lite');
    } catch (fallbackErr) {
      if (params.sampleKey) {
        const sampleMap: Record<string, string> = {
          masala_dosa: 'indian_masala_dosa',
          paneer_bowl: 'indian_paneer_curry',
          grilled_salad: 'f101_grilled_salmon_bowl',
        };
        const matched = FOOD_DATASET.find((f) => f.id === sampleMap[params.sampleKey!]) ?? null;
        if (matched) {
          return {
            predictedLabel: matched.name,
            confidence: 0.94,
            isFood: true,
            status: 'matched',
            mode: 'demonstration',
            nutritionSource: 'dataset',
            reasoning:
              'Using curated sample dish nutrition profile while live Vision API quota is temporarily exhausted.',
            matchedFood: matched,
            message: `Identified ${matched.name} via curated sample mapping.`,
          };
        }
      }
      const errText =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : primaryErr instanceof Error
          ? primaryErr.message
          : '';
      if (errText.includes('429') || errText.includes('RESOURCE_EXHAUSTED') || errText.toLowerCase().includes('quota')) {
        throw new Error(
          'Daily Gemini Vision API quota was exceeded on this key. Please retry after quota resets or test a curated sample dish in Food Scanner.'
        );
      }
      throw fallbackErr;
    }
  }

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as {
    isFood: boolean;
    predictedLabel: string;
    confidence: number;
    reasoning: string;
    servingLabel?: string;
    servingGrams?: number;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
    dietaryType?: string;
    category?: string;
    notes?: string;
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
    const estimatedFood = buildAiEstimatedFoodItem(parsed);
    return {
      predictedLabel: estimatedFood.name,
      confidence,
      isFood: true,
      status: 'matched',
      mode: 'gemini-vision',
      nutritionSource: 'ai-estimate',
      reasoning: parsed.reasoning,
      matchedFood: estimatedFood,
      message: `Identified ${estimatedFood.name} (${Math.round(confidence * 100)}% confidence) with visual nutrition estimate.`,
    };
  }

  return {
    predictedLabel: matched.name,
    confidence,
    isFood: true,
    status: 'matched',
    mode: 'gemini-vision',
    nutritionSource: 'dataset',
    reasoning: parsed.reasoning,
    matchedFood: matched,
    message: `Identified ${matched.name} (${Math.round(confidence * 100)}% confidence).`,
  };
}
