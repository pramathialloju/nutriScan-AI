import React, { useMemo, useState } from 'react';
import { CheckCircle2, Info, Plus, Search } from 'lucide-react';
import { FoodItem, MEAL_SLOTS, MealSlot } from '../lib/nutritionData';
import { scaleNutrition } from '../lib/nutritionCalc';

interface NutritionAnalysisViewProps {
  foods: FoodItem[];
  onAddToDiary: (payload: {
    food_id: string;
    meal_category: MealSlot;
    serving_multiplier: number;
  }) => Promise<void>;
}

const SERVING_OPTIONS = [
  { label: '0.5x Half', value: 0.5 },
  { label: '1.0x Standard', value: 1 },
  { label: '1.5x Large', value: 1.5 },
  { label: '2.0x Double', value: 2 },
  { label: '2.5x Extra', value: 2.5 },
];

export function NutritionAnalysisView({
  foods,
  onAddToDiary,
}: NutritionAnalysisViewProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Indian' | 'Food-101'>('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'vegetarian' | 'non-vegetarian'>('all');
  const [selectedId, setSelectedId] = useState<string>(
    foods.find((f) => f.id === 'indian_masala_dosa')?.id || foods[0]?.id || ''
  );
  const [multiplier, setMultiplier] = useState<number>(1);
  const [mealSlot, setMealSlot] = useState<MealSlot>('Lunch');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const filteredFoods = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods.filter((f) => {
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (dietaryFilter !== 'all' && f.dietaryType !== dietaryFilter) return false;
      if (q) {
        const hay = `${f.name} ${f.aliases.join(' ')} ${f.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [foods, query, categoryFilter, dietaryFilter]);

  const selectedFood =
    foods.find((f) => f.id === selectedId) || filteredFoods[0] || foods[0];

  const scaled = selectedFood ? scaleNutrition(selectedFood, multiplier) : null;

  const handleLog = async () => {
    if (!selectedFood) return;
    await onAddToDiary({
      food_id: selectedFood.id,
      meal_category: mealSlot,
      serving_multiplier: multiplier,
    });
    setSavedNotice(
      `Logged ${multiplier}x ${selectedFood.name} (${scaled?.calories ?? 0} kcal) to ${mealSlot}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Idli, Masala Dosa, Dal, Biryani, Salmon..."
              aria-label="Search food nutrition database"
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#F8FAF9] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'Indian', 'Food-101'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'all' ? 'All Cuisines' : cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'vegetarian', 'non-vegetarian'] as const).map((diet) => (
                <button
                  key={diet}
                  type="button"
                  onClick={() => setDietaryFilter(diet)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    dietaryFilter === diet
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {diet === 'all'
                    ? 'All Diets'
                    : diet === 'vegetarian'
                    ? 'Vegetarian'
                    : 'Non-Veg'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Structured Food Table */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Food Nutrition Dataset ({filteredFoods.length} items)
            </h2>
            <span className="text-xs text-slate-500">Click any dish to inspect</span>
          </div>

          {filteredFoods.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No dishes matched your search or filters.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F8FAF9] sticky top-0 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="py-3 px-4">Dish</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Calories</th>
                    <th className="py-3 px-3 text-right">Protein</th>
                    <th className="py-3 px-3 text-right">Carbs</th>
                    <th className="py-3 px-4 text-right">Fat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredFoods.map((item) => {
                    const active = selectedFood?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          active ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(item.id);
                              setSavedNotice(null);
                            }}
                            className="text-left font-medium text-slate-900 hover:text-emerald-700 cursor-pointer"
                          >
                            {item.name}
                          </button>
                          <p className="text-xs text-slate-500">{item.servingLabel}</p>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600">
                          {item.category} ·{' '}
                          {item.dietaryType === 'vegetarian' ? 'Veg' : 'Non-Veg'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num text-slate-900">
                          {item.calories}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700">
                          {item.protein_g}g
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                          {item.carbs_g}g
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num text-slate-700">
                          {item.fat_g}g
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right: Detailed Nutrition Breakdown + Serving Scaler */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5 h-fit">
          {selectedFood && scaled && (
            <>
              <div className="pb-4 border-b border-slate-100">
                <p className="text-xs text-slate-500">
                  {selectedFood.category} ·{' '}
                  {selectedFood.dietaryType === 'vegetarian'
                    ? 'Vegetarian'
                    : 'Non-Vegetarian'}
                </p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  {selectedFood.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Standard serving: {selectedFood.servingLabel}
                </p>
              </div>

              {/* Serving Size Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Select Serving Size ({scaled.grams}g estimated)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SERVING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setMultiplier(opt.value);
                        setSavedNotice(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        multiplier === opt.value
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nutrition Values */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#F8FAF9] flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    Estimated Calories
                  </span>
                  <span className="text-lg font-bold text-slate-900 font-mono-num">
                    {scaled.calories} kcal
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Protein</span>
                  <span className="font-semibold text-emerald-700 font-mono-num">
                    {scaled.protein_g} g
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Carbohydrates</span>
                  <span className="font-semibold text-slate-900 font-mono-num">
                    {scaled.carbs_g} g
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total Fat</span>
                  <span className="font-semibold text-slate-900 font-mono-num">
                    {scaled.fat_g} g
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Dietary Fiber</span>
                  <span className="font-semibold text-slate-900 font-mono-num">
                    {scaled.fiber_g} g
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Sugars</span>
                  <span className="font-medium text-slate-700 font-mono-num">
                    {scaled.sugar_g} g
                  </span>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Sodium</span>
                  <span className="font-medium text-slate-700 font-mono-num">
                    {scaled.sodium_mg} mg
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-600 bg-[#F8FAF9] border border-slate-200 rounded-lg p-3">
                <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  {selectedFood.notes} All nutrition figures are estimates and vary
                  according to ingredients, oil/ghee, and preparation method.
                </span>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <select
                  aria-label="Meal category for diary log"
                  value={mealSlot}
                  onChange={(e) => setMealSlot(e.target.value as MealSlot)}
                  className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  {MEAL_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleLog()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log to Diary</span>
                </button>
              </div>

              {savedNotice && (
                <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{savedNotice}</span>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
