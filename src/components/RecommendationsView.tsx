import React, { useEffect, useState } from 'react';
import { CheckCircle2, Info, Plus } from 'lucide-react';
import { FoodItem, MEAL_SLOTS, MealSlot } from '../lib/nutritionData';
import { RecommendedFood } from '../lib/nutritionCalc';
import { fetchRecommendations } from '../lib/api';

interface RecommendationsViewProps {
  initialRecommendations: RecommendedFood[];
  onAddToDiary: (payload: {
    food_id: string;
    meal_category: MealSlot;
    serving_multiplier: number;
  }) => Promise<void>;
}

export function RecommendationsView({
  initialRecommendations,
  onAddToDiary,
}: RecommendationsViewProps) {
  const [dietary, setDietary] = useState<'all' | 'vegetarian' | 'non-vegetarian'>('all');
  const [focus, setFocus] = useState<
    'balanced' | 'high-protein' | 'indian-cuisine' | 'weight-management'
  >('balanced');
  const [mealType, setMealType] = useState<'all' | MealSlot>('all');
  const [items, setItems] = useState<RecommendedFood[]>(initialRecommendations);
  const [loading, setLoading] = useState(false);
  const [loggedId, setLoggedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchRecommendations({ dietary, focus, mealType })
      .then((recs) => {
        if (active) setItems(recs);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dietary, focus, mealType]);

  const handleLog = async (food: FoodItem) => {
    const targetMeal =
      mealType !== 'all' ? mealType : food.mealTypes[0] || 'Lunch';
    await onAddToDiary({
      food_id: food.id,
      meal_category: targetMeal,
      serving_multiplier: 1,
    });
    setLoggedId(food.id);
  };

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Personalize Meal Suggestions
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Generated dynamically from the Indian and Food-101 nutrition dataset
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="rec-dietary"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Dietary Preference
            </label>
            <select
              id="rec-dietary"
              value={dietary}
              onChange={(e) =>
                setDietary(
                  e.target.value as 'all' | 'vegetarian' | 'non-vegetarian'
                )
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">All Foods (Veg &amp; Non-Veg)</option>
              <option value="vegetarian">Vegetarian Only</option>
              <option value="non-vegetarian">Non-Vegetarian Only</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="rec-focus"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Nutritional Focus
            </label>
            <select
              id="rec-focus"
              value={focus}
              onChange={(e) =>
                setFocus(
                  e.target.value as
                    | 'balanced'
                    | 'high-protein'
                    | 'indian-cuisine'
                    | 'weight-management'
                )
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="balanced">Balanced Everyday Meals</option>
              <option value="high-protein">Protein-Rich Suggestions</option>
              <option value="indian-cuisine">Indian Meal Suggestions</option>
              <option value="weight-management">
                Healthy Weight Management (Nutrient-Dense)
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="rec-meal-type"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Meal Slot
            </label>
            <select
              id="rec-meal-type"
              value={mealType}
              onChange={(e) => setMealType(e.target.value as 'all' | MealSlot)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">All Meals</option>
              {MEAL_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-xs text-slate-600 bg-[#F8FAF9] border border-slate-200 rounded-lg p-3">
          <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>
            NutriScan AI promotes sustainable, balanced meal variety across whole grains,
            proteins, lentils, and vegetables rather than restrictive diets or rigid
            calorie limits.
          </span>
        </div>
      </section>

      {/* Recommendations Grid */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Generating recommendations from food dataset...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          No dishes match that exact filter combination. Try broadening the meal slot or
          dietary filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(({ food, reason }) => (
            <article
              key={food.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  {food.category} ·{' '}
                  {food.dietaryType === 'vegetarian' ? 'Vegetarian' : 'Non-Vegetarian'} ·{' '}
                  {food.mealTypes.join(' / ')}
                </p>
                <h3 className="text-base font-bold text-slate-900">{food.name}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{reason}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="grid grid-cols-4 gap-2 text-center font-mono-num">
                  <div className="bg-[#F8FAF9] rounded-lg py-2">
                    <p className="text-xs font-bold text-slate-900">{food.calories}</p>
                    <p className="text-[11px] text-slate-500">kcal</p>
                  </div>
                  <div className="bg-[#F8FAF9] rounded-lg py-2">
                    <p className="text-xs font-bold text-emerald-700">{food.protein_g}g</p>
                    <p className="text-[11px] text-slate-500">Prot</p>
                  </div>
                  <div className="bg-[#F8FAF9] rounded-lg py-2">
                    <p className="text-xs font-bold text-slate-900">{food.carbs_g}g</p>
                    <p className="text-[11px] text-slate-500">Carb</p>
                  </div>
                  <div className="bg-[#F8FAF9] rounded-lg py-2">
                    <p className="text-xs font-bold text-slate-900">{food.fat_g}g</p>
                    <p className="text-[11px] text-slate-500">Fat</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleLog(food)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                >
                  {loggedId === food.id ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Logged to Diary</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Serving to Diary</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
