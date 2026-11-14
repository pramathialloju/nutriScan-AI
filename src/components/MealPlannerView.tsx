import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import {
  DAYS_OF_WEEK,
  FoodItem,
  MEAL_SLOTS,
  MealPlanItem,
  MealSlot,
} from '../lib/nutritionData';
import { scaleNutrition } from '../lib/nutritionCalc';
import { fetchMealPlan, saveMealPlan } from '../lib/api';

interface MealPlannerViewProps {
  foods: FoodItem[];
}

export function MealPlannerView({ foods }: MealPlannerViewProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [planItems, setPlanItems] = useState<MealPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Per-slot add/replace dropdown state
  const [slotSelections, setSlotSelections] = useState<Record<MealSlot, string>>({
    Breakfast: foods.find((f) => f.mealTypes.includes('Breakfast'))?.id || foods[0]?.id || '',
    Lunch: foods.find((f) => f.mealTypes.includes('Lunch'))?.id || foods[0]?.id || '',
    'Evening Snacks':
      foods.find((f) => f.mealTypes.includes('Evening Snacks'))?.id || foods[0]?.id || '',
    Dinner: foods.find((f) => f.mealTypes.includes('Dinner'))?.id || foods[0]?.id || '',
  });

  const loadPlans = async () => {
    setLoading(true);
    try {
      const items = await fetchMealPlan();
      setPlanItems(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const dayItems = useMemo(
    () => planItems.filter((p) => p.day_of_week === selectedDay),
    [planItems, selectedDay]
  );

  const dayTotals = useMemo(() => {
    return dayItems.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: Math.round((acc.protein + item.protein_g) * 10) / 10,
        carbs: Math.round((acc.carbs + item.carbs_g) * 10) / 10,
        fat: Math.round((acc.fat + item.fat_g) * 10) / 10,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [dayItems]);

  const handleAddToSlot = (slot: MealSlot) => {
    const foodId = slotSelections[slot];
    const food = foods.find((f) => f.id === foodId);
    if (!food) return;

    const scaled = scaleNutrition(food, 1);
    const newItem: MealPlanItem = {
      day_of_week: selectedDay,
      meal_slot: slot,
      food_id: food.id,
      food_name: food.name,
      serving_multiplier: 1,
      serving_label: food.servingLabel,
      calories: scaled.calories,
      protein_g: scaled.protein_g,
      carbs_g: scaled.carbs_g,
      fat_g: scaled.fat_g,
      fiber_g: scaled.fiber_g,
    };

    setPlanItems((prev) => [...prev, newItem]);
    setSavedMsg(null);
  };

  const handleReplaceSlotItem = (slot: MealSlot, indexInDay: number, newFoodId: string) => {
    const food = foods.find((f) => f.id === newFoodId);
    if (!food) return;
    const scaled = scaleNutrition(food, 1);

    let seen = -1;
    setPlanItems((prev) =>
      prev.map((item) => {
        if (item.day_of_week === selectedDay && item.meal_slot === slot) {
          seen += 1;
          if (seen === indexInDay) {
            return {
              ...item,
              food_id: food.id,
              food_name: food.name,
              serving_label: food.servingLabel,
              calories: scaled.calories,
              protein_g: scaled.protein_g,
              carbs_g: scaled.carbs_g,
              fat_g: scaled.fat_g,
              fiber_g: scaled.fiber_g,
            };
          }
        }
        return item;
      })
    );
    setSavedMsg(null);
  };

  const handleRemoveSlotItem = (slot: MealSlot, indexInSlot: number) => {
    let seen = -1;
    setPlanItems((prev) =>
      prev.filter((item) => {
        if (item.day_of_week === selectedDay && item.meal_slot === slot) {
          seen += 1;
          return seen !== indexInSlot;
        }
        return true;
      })
    );
    setSavedMsg(null);
  };

  const handleSaveDayPlan = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const payload = dayItems.map((i) => ({
        meal_slot: i.meal_slot,
        food_id: i.food_id,
        serving_multiplier: i.serving_multiplier || 1,
      }));
      const res = await saveMealPlan(selectedDay, payload);
      setPlanItems((prev) => [
        ...prev.filter((p) => p.day_of_week !== selectedDay),
        ...res.items,
      ]);
      setSavedMsg(`${selectedDay} meal plan saved to SQLite.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Meal Planner
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly Overview
            </button>
          </div>

          {viewMode === 'daily' && (
            <div className="flex flex-wrap items-center gap-1">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    setSavedMsg(null);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    selectedDay === day
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {viewMode === 'daily' && (
            <>
              <div className="text-xs font-mono-num text-slate-600">
                <span className="font-semibold text-slate-900">{dayTotals.calories} kcal</span> · P{' '}
                {dayTotals.protein}g · C {dayTotals.carbs}g · F {dayTotals.fat}g
              </div>
              <button
                type="button"
                onClick={() => void handleSaveDayPlan()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Meal Plan'}</span>
              </button>
            </>
          )}
        </div>
      </section>

      {savedMsg && (
        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Loading saved meal plans...
        </div>
      ) : viewMode === 'daily' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MEAL_SLOTS.map((slot) => {
            const slotItems = dayItems.filter((i) => i.meal_slot === slot);
            const slotCalories = slotItems.reduce((s, i) => s + i.calories, 0);

            return (
              <section
                key={slot}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900">{slot}</h3>
                    <span className="text-xs font-semibold text-emerald-700 font-mono-num">
                      {slotCalories} kcal est.
                    </span>
                  </div>

                  {slotItems.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">
                      No food items assigned to {slot}. Add an item below.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {slotItems.map((item, idx) => (
                        <div
                          key={`${item.food_id}-${idx}`}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <select
                              aria-label={`Replace ${item.food_name} in ${slot}`}
                              value={item.food_id}
                              onChange={(e) =>
                                handleReplaceSlotItem(slot, idx, e.target.value)
                              }
                              className="w-full text-sm font-medium text-slate-900 bg-transparent border border-slate-200 rounded-md px-2 py-1"
                            >
                              {foods.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name} ({f.calories} kcal)
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-slate-500 mt-1 font-mono-num">
                              P {item.protein_g}g · C {item.carbs_g}g · F {item.fat_g}g · Fiber{' '}
                              {item.fiber_g}g
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSlotItem(slot, idx)}
                            aria-label={`Remove ${item.food_name} from ${slot}`}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add item to this slot */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <select
                    aria-label={`Choose food to add to ${slot}`}
                    value={slotSelections[slot]}
                    onChange={(e) =>
                      setSlotSelections((prev) => ({ ...prev, [slot]: e.target.value }))
                    }
                    className="flex-1 text-xs sm:text-sm bg-[#F8FAF9] border border-slate-200 rounded-lg px-3 py-2"
                  >
                    {foods.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.calories} kcal)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAddToSlot(slot)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* Weekly Overview Table */
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Weekly Meal Plan Overview
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any day to customize and save its meal schedule
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#F8FAF9] border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4">Day</th>
                  {MEAL_SLOTS.map((s) => (
                    <th key={s} className="py-3 px-4">
                      {s}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">Est. Energy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DAYS_OF_WEEK.map((day) => {
                  const items = planItems.filter((p) => p.day_of_week === day);
                  const totalKcal = items.reduce((sum, i) => sum + i.calories, 0);
                  return (
                    <tr key={day} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDay(day);
                            setViewMode('daily');
                          }}
                          className="text-emerald-700 hover:underline cursor-pointer"
                        >
                          {day}
                        </button>
                      </td>
                      {MEAL_SLOTS.map((slot) => {
                        const slotNames = items
                          .filter((i) => i.meal_slot === slot)
                          .map((i) => i.food_name);
                        return (
                          <td key={slot} className="py-3 px-4 text-xs text-slate-700">
                            {slotNames.length > 0 ? slotNames.join(', ') : '—'}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-900">
                        {totalKcal} kcal
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
