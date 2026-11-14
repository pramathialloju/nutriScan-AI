import React, { useState } from 'react';
import {
  Check,
  Edit3,
  Info,
  Plus,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import {
  DiaryEntry,
  FoodItem,
  MEAL_SLOTS,
  MealSlot,
} from '../lib/nutritionData';
import { DiarySummary } from '../lib/nutritionCalc';

interface FoodDiaryViewProps {
  foods: FoodItem[];
  selectedDate: string;
  onChangeDate: (date: string) => void;
  viewRange: 'day' | 'week';
  onChangeRange: (range: 'day' | 'week') => void;
  entries: DiaryEntry[];
  summary: DiarySummary;
  onAddEntry: (payload: {
    food_id: string;
    meal_category: MealSlot;
    serving_multiplier: number;
    entry_date: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateEntry: (
    id: number,
    payload: { meal_category: MealSlot; serving_multiplier: number; notes?: string }
  ) => Promise<void>;
  onDeleteEntry: (id: number) => Promise<void>;
}

export function FoodDiaryView({
  foods,
  selectedDate,
  onChangeDate,
  viewRange,
  onChangeRange,
  entries,
  summary,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
}: FoodDiaryViewProps) {
  const [foodId, setFoodId] = useState<string>(foods[0]?.id || '');
  const [mealCategory, setMealCategory] = useState<MealSlot>('Lunch');
  const [servingMultiplier, setServingMultiplier] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editing row state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMeal, setEditMeal] = useState<MealSlot>('Lunch');
  const [editMult, setEditMult] = useState<number>(1);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!foodId) {
      setErrorMsg('Please select a food item.');
      return;
    }
    setSubmitting(true);
    try {
      await onAddEntry({
        food_id: foodId,
        meal_category: mealCategory,
        serving_multiplier: servingMultiplier,
        entry_date: selectedDate,
        notes,
      });
      setNotes('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to add diary entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (entry: DiaryEntry) => {
    setEditingId(entry.id);
    setEditMeal(entry.meal_category);
    setEditMult(entry.serving_multiplier);
  };

  const handleSaveEdit = async (id: number) => {
    await onUpdateEntry(id, {
      meal_category: editMeal,
      serving_multiplier: editMult,
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Informational Energy Summary + Date/Range Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onChangeRange('day')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  viewRange === 'day'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily View
              </button>
              <button
                type="button"
                onClick={() => onChangeRange('week')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  viewRange === 'week'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly Summary (7 Days)
              </button>
            </div>

            {viewRange === 'day' && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="diary-date"
                  className="text-xs font-medium text-slate-600"
                >
                  Date:
                </label>
                <input
                  id="diary-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => onChangeDate(e.target.value)}
                  className="px-3 py-1.5 text-xs sm:text-sm bg-[#F8FAF9] border border-slate-200 rounded-lg font-mono-num"
                />
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>
              Energy &amp; macro totals are informational estimates—no restrictive calorie
              caps applied.
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
            <p className="text-xs font-medium text-slate-500">Est. Energy</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 font-mono-num whitespace-nowrap">
              {summary.totalCalories} <span className="text-xs font-normal text-slate-500">kcal</span>
            </p>
          </div>
          <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
            <p className="text-xs font-medium text-slate-500">Protein</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-700 mt-1 font-mono-num whitespace-nowrap">
              {summary.totalProtein} <span className="text-xs font-normal text-slate-500">g</span>
            </p>
          </div>
          <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
            <p className="text-xs font-medium text-slate-500">Carbs</p>
            <p className="text-lg sm:text-xl font-bold text-sky-700 mt-1 font-mono-num whitespace-nowrap">
              {summary.totalCarbs} <span className="text-xs font-normal text-slate-500">g</span>
            </p>
          </div>
          <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
            <p className="text-xs font-medium text-slate-500">Fat</p>
            <p className="text-lg sm:text-xl font-bold text-amber-700 mt-1 font-mono-num whitespace-nowrap">
              {summary.totalFat} <span className="text-xs font-normal text-slate-500">g</span>
            </p>
          </div>
          <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5 col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-slate-500">Fiber</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 font-mono-num whitespace-nowrap">
              {summary.totalFiber} <span className="text-xs font-normal text-slate-500">g</span>
            </p>
          </div>
        </div>
      </section>

      {/* Add Food Entry Form */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Log Food Entry to SQLite Diary
        </h2>
        <form onSubmit={(e) => void handleAdd(e)} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label
              htmlFor="diary-food-select"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Food Item
            </label>
            <select
              id="diary-food-select"
              value={foodId}
              onChange={(e) => setFoodId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              {foods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.calories} kcal / {f.servingLabel})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="diary-meal-select"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Meal Category
            </label>
            <select
              id="diary-meal-select"
              value={mealCategory}
              onChange={(e) => setMealCategory(e.target.value as MealSlot)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              {MEAL_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="diary-serving-select"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Serving Size
            </label>
            <select
              id="diary-serving-select"
              value={servingMultiplier}
              onChange={(e) => setServingMultiplier(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
              <option value={2.5}>2.5x</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="diary-notes-input"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Notes (Optional)
            </label>
            <input
              id="diary-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Less oil"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Adding...' : 'Add Entry'}</span>
            </button>
          </div>
        </form>

        {errorMsg && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}
      </section>

      {/* Saved Entries Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Recorded Meals ({entries.length})
          </h3>
          <span className="text-xs text-slate-500">Stored in SQLite</span>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Utensils className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-700">
              No food diary entries found for this period.
            </p>
            <p className="text-xs text-slate-500">
              Use the form above or identify a meal photo in Food Recognition to log your
              first entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#F8FAF9] border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4">Food</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Meal</th>
                  <th className="py-3 px-3">Serving</th>
                  <th className="py-3 px-3 text-right">Calories</th>
                  <th className="py-3 px-3 text-right">Protein</th>
                  <th className="py-3 px-3 text-right">Carbs</th>
                  <th className="py-3 px-3 text-right">Fat</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const isEditing = editingId === entry.id;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{entry.food_name}</p>
                        {entry.notes && (
                          <p className="text-xs text-slate-500">{entry.notes}</p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 font-mono-num">
                        {entry.entry_date}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-700">
                        {isEditing ? (
                          <select
                            aria-label="Edit meal category"
                            value={editMeal}
                            onChange={(e) => setEditMeal(e.target.value as MealSlot)}
                            className="px-2 py-1 text-xs border border-slate-300 rounded"
                          >
                            {MEAL_SLOTS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          entry.meal_category
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-700 font-mono-num">
                        {isEditing ? (
                          <select
                            aria-label="Edit serving multiplier"
                            value={editMult}
                            onChange={(e) => setEditMult(Number(e.target.value))}
                            className="px-2 py-1 text-xs border border-slate-300 rounded"
                          >
                            <option value={0.5}>0.5x</option>
                            <option value={1}>1.0x</option>
                            <option value={1.5}>1.5x</option>
                            <option value={2}>2.0x</option>
                            <option value={2.5}>2.5x</option>
                          </select>
                        ) : (
                          `${entry.serving_multiplier}x`
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900">
                        {entry.calories} kcal
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-emerald-700">
                        {entry.protein_g}g
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-700">
                        {entry.carbs_g}g
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-700">
                        {entry.fat_g}g
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleSaveEdit(entry.id)}
                                aria-label={`Save changes for ${entry.food_name}`}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                aria-label={`Cancel editing ${entry.food_name}`}
                                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(entry)}
                                aria-label={`Edit ${entry.food_name}`}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void onDeleteEntry(entry.id)}
                                aria-label={`Delete ${entry.food_name}`}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
