import test from 'node:test';
import assert from 'node:assert/strict';
import { FOOD_DATASET, DiaryEntry } from './nutritionData';
import {
  aggregateWeeklySeries,
  generateRecommendations,
  matchPredictedLabelToFood,
  scaleNutrition,
  summarizeEntries,
  validateFoodUploadMeta,
} from './nutritionCalc';

test('scaleNutrition accurately scales calories, macros, and grams', () => {
  const idli = FOOD_DATASET.find((f) => f.id === 'indian_idli')!;
  const scaled = scaleNutrition(idli, 1.5);
  assert.equal(scaled.calories, 234);
  assert.equal(scaled.protein_g, 7.8);
  assert.equal(scaled.carbs_g, 47.1);
  assert.equal(scaled.fat_g, 1.2);
  assert.equal(scaled.grams, 210);
});

test('summarizeEntries computes totals, meal breakdown, and macro shares', () => {
  const entries: DiaryEntry[] = [
    {
      id: 1,
      food_id: 'indian_idli',
      food_name: 'Idli',
      meal_category: 'Breakfast',
      serving_multiplier: 1,
      serving_label: '2 pieces',
      calories: 156,
      protein_g: 5.2,
      carbs_g: 31.4,
      fat_g: 0.8,
      fiber_g: 2.1,
      entry_date: '2026-11-14',
      notes: '',
      created_at: '2026-11-14T08:00:00Z',
    },
    {
      id: 2,
      food_id: 'indian_dal',
      food_name: 'Dal',
      meal_category: 'Lunch',
      serving_multiplier: 1,
      serving_label: '1 bowl',
      calories: 215,
      protein_g: 11.4,
      carbs_g: 29.8,
      fat_g: 5.4,
      fiber_g: 6.8,
      entry_date: '2026-11-14',
      notes: '',
      created_at: '2026-11-14T13:00:00Z',
    },
  ];

  const summary = summarizeEntries(entries);
  assert.equal(summary.totalCalories, 371);
  assert.equal(summary.totalProtein, 16.6);
  assert.equal(summary.totalCarbs, 61.2);
  assert.equal(summary.totalFat, 6.2);
  assert.equal(summary.byMeal.Breakfast.calories, 156);
  assert.equal(summary.byMeal.Lunch.calories, 215);
  assert.equal(summary.byMeal.Dinner.count, 0);
  assert.equal(
    summary.macroPercentages.proteinPct +
      summary.macroPercentages.carbsPct +
      summary.macroPercentages.fatPct,
    100
  );
});

test('aggregateWeeklySeries maps saved entries onto a 7-day timeline', () => {
  const entries: DiaryEntry[] = [
    {
      id: 1,
      food_id: 'indian_poha',
      food_name: 'Poha',
      meal_category: 'Breakfast',
      serving_multiplier: 1,
      serving_label: '1 bowl',
      calories: 230,
      protein_g: 4.9,
      carbs_g: 41.8,
      fat_g: 5.1,
      fiber_g: 2.7,
      entry_date: '2026-11-12',
      notes: '',
      created_at: '2026-11-12T08:00:00Z',
    },
    {
      id: 2,
      food_id: 'indian_biryani',
      food_name: 'Biryani',
      meal_category: 'Lunch',
      serving_multiplier: 1,
      serving_label: '1 plate',
      calories: 510,
      protein_g: 24.5,
      carbs_g: 58,
      fat_g: 19.2,
      fiber_g: 3.1,
      entry_date: '2026-11-14',
      notes: '',
      created_at: '2026-11-14T13:00:00Z',
    },
  ];

  const series = aggregateWeeklySeries(entries, '2026-11-14', 7);
  assert.equal(series.length, 7);
  assert.equal(series[0].date, '2026-11-08');
  assert.equal(series[4].calories, 230);
  assert.equal(series[6].calories, 510);
});

test('generateRecommendations filters dietary, mealType, and focus accurately', () => {
  const vegHighProtein = generateRecommendations(FOOD_DATASET, {
    dietary: 'vegetarian',
    focus: 'high-protein',
    mealType: 'Lunch',
  });
  assert.ok(vegHighProtein.length > 0);
  assert.ok(vegHighProtein.every((r) => r.food.dietaryType === 'vegetarian'));
  assert.ok(vegHighProtein.every((r) => r.food.mealTypes.includes('Lunch')));

  const indianBreakfast = generateRecommendations(FOOD_DATASET, {
    focus: 'indian-cuisine',
    mealType: 'Breakfast',
  });
  assert.ok(indianBreakfast.some((r) => r.food.name === 'Idli'));
  assert.ok(indianBreakfast.every((r) => r.food.category === 'Indian'));
});

test('matchPredictedLabelToFood handles Food-101 snake_case and Indian dishes', () => {
  assert.equal(matchPredictedLabelToFood('masala_dosa')?.id, 'indian_masala_dosa');
  assert.equal(matchPredictedLabelToFood('Paneer Butter Masala')?.id, 'indian_paneer_curry');
  assert.equal(matchPredictedLabelToFood('caesar_salad')?.id, 'f101_caesar_salad');
  assert.equal(matchPredictedLabelToFood('unknown_abstract_object'), null);
});

test('validateFoodUploadMeta rejects invalid types and oversized files', () => {
  assert.equal(validateFoodUploadMeta('image/jpeg', 1024).valid, true);
  assert.equal(validateFoodUploadMeta('application/pdf', 1024).valid, false);
  assert.equal(validateFoodUploadMeta('image/png', 12 * 1024 * 1024).valid, false);
  assert.equal(validateFoodUploadMeta('image/webp', 0).valid, false);
});
