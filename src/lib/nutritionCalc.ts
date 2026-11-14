import {
  FOOD_DATASET,
  MEAL_SLOTS,
} from './nutritionData.ts';
import type {
  DiaryEntry,
  FoodItem,
  MealSlot,
} from './nutritionData.ts';

export interface ScaledNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  sugar_g: number;
  grams: number;
}

export interface DiarySummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  entryCount: number;
  macroPercentages: {
    proteinPct: number;
    carbsPct: number;
    fatPct: number;
  };
  byMeal: Record<
    MealSlot,
    {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      fiber_g: number;
      count: number;
    }
  >;
}

export interface DailySeriesPoint {
  date: string;
  label: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  entries: number;
}

export interface RecommendationFilter {
  dietary?: 'all' | 'vegetarian' | 'non-vegetarian';
  focus?: 'balanced' | 'high-protein' | 'indian-cuisine' | 'weight-management';
  mealType?: 'all' | MealSlot;
  cuisine?: string;
}

export interface RecommendedFood {
  food: FoodItem;
  reason: string;
  score: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function scaleNutrition(food: FoodItem, multiplier: number): ScaledNutrition {
  const safeMult = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return {
    calories: Math.round(food.calories * safeMult),
    protein_g: round1(food.protein_g * safeMult),
    carbs_g: round1(food.carbs_g * safeMult),
    fat_g: round1(food.fat_g * safeMult),
    fiber_g: round1(food.fiber_g * safeMult),
    sodium_mg: Math.round(food.sodium_mg * safeMult),
    sugar_g: round1(food.sugar_g * safeMult),
    grams: Math.round(food.servingGrams * safeMult),
  };
}

export function summarizeEntries(entries: DiaryEntry[]): DiarySummary {
  const byMeal = {
    Breakfast: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, count: 0 },
    Lunch: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, count: 0 },
    'Evening Snacks': { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, count: 0 },
    Dinner: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, count: 0 },
  } as DiarySummary['byMeal'];

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  for (const entry of entries) {
    totalCalories += entry.calories;
    totalProtein += entry.protein_g;
    totalCarbs += entry.carbs_g;
    totalFat += entry.fat_g;
    totalFiber += entry.fiber_g;

    const slot = MEAL_SLOTS.includes(entry.meal_category)
      ? entry.meal_category
      : 'Lunch';
    byMeal[slot].calories += entry.calories;
    byMeal[slot].protein_g = round1(byMeal[slot].protein_g + entry.protein_g);
    byMeal[slot].carbs_g = round1(byMeal[slot].carbs_g + entry.carbs_g);
    byMeal[slot].fat_g = round1(byMeal[slot].fat_g + entry.fat_g);
    byMeal[slot].fiber_g = round1(byMeal[slot].fiber_g + entry.fiber_g);
    byMeal[slot].count += 1;
  }

  const proteinKcal = totalProtein * 4;
  const carbsKcal = totalCarbs * 4;
  const fatKcal = totalFat * 9;
  const macroKcalTotal = proteinKcal + carbsKcal + fatKcal;

  const macroPercentages =
    macroKcalTotal > 0
      ? {
          proteinPct: Math.round((proteinKcal / macroKcalTotal) * 100),
          carbsPct: Math.round((carbsKcal / macroKcalTotal) * 100),
          fatPct: Math.round((fatKcal / macroKcalTotal) * 100),
        }
      : { proteinPct: 0, carbsPct: 0, fatPct: 0 };

  return {
    totalCalories: Math.round(totalCalories),
    totalProtein: round1(totalProtein),
    totalCarbs: round1(totalCarbs),
    totalFat: round1(totalFat),
    totalFiber: round1(totalFiber),
    entryCount: entries.length,
    macroPercentages,
    byMeal,
  };
}

export function aggregateWeeklySeries(
  entries: DiaryEntry[],
  endDateStr: string,
  days = 7
): DailySeriesPoint[] {
  const [y, m, d] = endDateStr.split('-').map(Number);
  const endDate = new Date(Date.UTC(y, m - 1, d));
  const buckets = new Map<string, DailySeriesPoint>();

  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(endDate.getTime() - i * 86400000);
    const iso = dt.toISOString().slice(0, 10);
    const label = dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    buckets.set(iso, {
      date: iso,
      label,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      entries: 0,
    });
  }

  for (const entry of entries) {
    const bucket = buckets.get(entry.entry_date);
    if (!bucket) continue;
    bucket.calories += Math.round(entry.calories);
    bucket.protein_g = round1(bucket.protein_g + entry.protein_g);
    bucket.carbs_g = round1(bucket.carbs_g + entry.carbs_g);
    bucket.fat_g = round1(bucket.fat_g + entry.fat_g);
    bucket.fiber_g = round1(bucket.fiber_g + entry.fiber_g);
    bucket.entries += 1;
  }

  return Array.from(buckets.values());
}

export function generateRecommendations(
  foods: FoodItem[],
  filter: RecommendationFilter = {}
): RecommendedFood[] {
  const {
    dietary = 'all',
    focus = 'balanced',
    mealType = 'all',
    cuisine = 'all',
  } = filter;

  let candidates = foods.filter((f) => {
    if (dietary !== 'all' && f.dietaryType !== dietary) return false;
    if (mealType !== 'all' && !f.mealTypes.includes(mealType)) return false;
    if (cuisine !== 'all' && f.category !== cuisine) return false;
    return true;
  });

  if (focus === 'indian-cuisine') {
    const indianOnly = candidates.filter((f) => f.category === 'Indian');
    if (indianOnly.length > 0) candidates = indianOnly;
  } else if (focus === 'high-protein') {
    const highProt = candidates.filter((f) => f.proteinRich || f.protein_g >= 12);
    if (highProt.length > 0) candidates = highProt;
  } else if (focus === 'weight-management') {
    const balanced = candidates.filter((f) => f.balancedWeightFriendly);
    if (balanced.length > 0) candidates = balanced;
  }

  const scored: RecommendedFood[] = candidates.map((food) => {
    let score = 50;
    const reasons: string[] = [];

    if (focus === 'high-protein') {
      score += food.protein_g * 2;
      reasons.push(`Provides ${food.protein_g}g protein per serving`);
    } else if (focus === 'indian-cuisine') {
      score += food.category === 'Indian' ? 30 : 0;
      score += food.fiber_g * 2;
      reasons.push(`Traditional Indian preparation with ${food.protein_g}g protein and ${food.fiber_g}g fiber`);
    } else if (focus === 'weight-management') {
      score += food.fiber_g * 4 + food.protein_g * 1.5 - food.fat_g * 0.5;
      reasons.push(
        `Nutrient-dense, satiating option (${food.fiber_g}g fiber, ${food.protein_g}g protein) to support balanced meals`
      );
    } else {
      // Balanced meal scoring favors fiber + moderate protein + reasonable macros
      const proteinShare = food.calories > 0 ? (food.protein_g * 4) / food.calories : 0;
      score += food.fiber_g * 3 + proteinShare * 40;
      reasons.push(
        `Balanced carbohydrate, protein (${food.protein_g}g), and fiber (${food.fiber_g}g) profile`
      );
    }

    if (food.dietaryType === 'vegetarian') {
      reasons.push('Vegetarian');
    }

    return {
      food,
      score: Math.round(score),
      reason: reasons.join(' · '),
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export function validateFoodUploadMeta(
  mimeType: string,
  sizeBytes: number
): { valid: true } | { valid: false; error: string } {
  if (!ALLOWED_IMAGE_MIME.has(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: 'Unsupported file type. Please upload a JPG, PNG, or WebP food photo.',
    };
  }
  if (sizeBytes <= 0) {
    return { valid: false, error: 'The uploaded image file is empty.' };
  }
  if (sizeBytes > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: 'Image size exceeds 10 MB. Please choose a smaller food image.',
    };
  }
  return { valid: true };
}

export function matchPredictedLabelToFood(
  predictedLabel: string,
  foods: FoodItem[] = FOOD_DATASET
): FoodItem | null {
  const normalized = predictedLabel
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  // 1. Exact name or slug match
  for (const food of foods) {
    if (
      food.name.toLowerCase() === normalized ||
      food.slug.replace(/_/g, ' ') === normalized
    ) {
      return food;
    }
  }

  // 2. Exact alias match
  for (const food of foods) {
    if (food.aliases.some((a) => a.toLowerCase() === normalized)) {
      return food;
    }
  }

  // 3. Partial containment match (prefer longest alias match)
  let bestFood: FoodItem | null = null;
  let bestLen = 0;
  for (const food of foods) {
    const terms = [food.name.toLowerCase(), ...food.aliases.map((a) => a.toLowerCase())];
    for (const term of terms) {
      if (normalized.includes(term) || term.includes(normalized)) {
        if (term.length > bestLen) {
          bestLen = term.length;
          bestFood = food;
        }
      }
    }
  }

  return bestFood;
}
