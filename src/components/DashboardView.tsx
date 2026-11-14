import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  Database,
  Loader2,
  Plus,
  Upload,
} from 'lucide-react';
import { DiaryEntry, MEAL_SLOTS, MealSlot } from '../lib/nutritionData';
import { DiarySummary } from '../lib/nutritionCalc';
import { PredictionApiResponse, predictFoodUpload } from '../lib/api';
import { AppRoute } from '../lib/routes';

interface DashboardViewProps {
  todayEntries: DiaryEntry[];
  summary: DiarySummary;
  onNavigate: (route: AppRoute) => void;
  onScanComplete: () => Promise<void>;
  onAddToDiary: (payload: {
    food_id: string;
    meal_category: MealSlot;
    serving_multiplier: number;
    notes?: string;
  }) => Promise<void>;
}

export function DashboardView({
  todayEntries,
  summary,
  onNavigate,
  onScanComplete,
  onAddToDiary,
}: DashboardViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionApiResponse | null>(null);

  const [mealCategory, setMealCategory] = useState<MealSlot>('Lunch');
  const [savingDiary, setSavingDiary] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMsg(null);
    setSavedNotice(null);
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg('Please upload a JPG, PNG, or WebP food image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image exceeds 10 MB. Please choose a smaller photo.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const handleIdentify = async () => {
    if (!selectedFile) {
      setErrorMsg('Please upload a food image first.');
      return;
    }
    setErrorMsg(null);
    setSavedNotice(null);
    setIdentifying(true);
    try {
      const res = await predictFoodUpload(selectedFile);
      setResult(res);
      await onScanComplete();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to identify food image.'
      );
    } finally {
      setIdentifying(false);
    }
  };

  const handleLogMatched = async () => {
    const food = result?.prediction.matchedFood;
    if (!food) return;
    setSavingDiary(true);
    setSavedNotice(null);
    try {
      await onAddToDiary({
        food_id: food.id,
        meal_category: mealCategory,
        serving_multiplier: 1,
        notes: 'Scanned from Dashboard',
      });
      setSavedNotice(`Added ${food.name} to ${mealCategory} in your Food Diary.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save meal to diary.'
      );
    } finally {
      setSavingDiary(false);
    }
  };

  const matchedFood = result?.prediction.matchedFood ?? null;

  return (
    <div className="space-y-6">
      {/* Top Heading + Primary Food Scanner Focus */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              What are you eating today?
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Upload a photo of your meal to identify the dish and view estimated nutrition.
            </p>
          </div>

          <div className="shrink-0">
            <input
              ref={fileInputRef}
              id="dashboard-food-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelected}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Food Image</span>
            </button>
          </div>
        </div>

        {/* Upload Drop Area / Active Preview + Result */}
        {!previewUrl ? (
          <label
            htmlFor="dashboard-food-upload"
            className="block border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl py-10 px-6 text-center bg-[#F8FAF9] cursor-pointer transition-colors"
          >
            <Camera className="w-8 h-8 text-emerald-700 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-800">
              Click to select a meal photo (JPG, PNG, or WebP)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports multi-cuisine dishes across Indian, Italian, Asian, Mexican, Mediterranean, and American meals
            </p>
          </label>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2 border-t border-slate-100">
            {/* Image Preview + Identify Action */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-[#F8FAF9]">
                <img
                  src={previewUrl}
                  alt="Uploaded food preview"
                  className="w-full h-60 object-cover"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleIdentify()}
                  disabled={identifying}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 rounded-lg transition-colors cursor-pointer"
                >
                  {identifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Identifying...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Identify Food</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Prediction Result */}
            <div className="lg:col-span-7 space-y-4">
              {!result && !identifying && (
                <div className="bg-[#F8FAF9] border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
                  Image ready. Click <span className="font-semibold text-slate-900">Identify Food</span> to detect the dish and calculate estimated calories, protein, carbohydrates, and fats.
                </div>
              )}

              {identifying && (
                <div className="bg-[#F8FAF9] border border-slate-200 rounded-xl p-8 flex items-center gap-3 text-sm text-slate-700">
                  <Loader2 className="w-5 h-5 text-emerald-700 animate-spin shrink-0" />
                  <span>Analyzing meal photograph and matching nutrition data...</span>
                </div>
              )}

              {result && !identifying && (
                <div className="bg-[#F8FAF9] border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500 font-mono-num">
                        Predicted Dish · {Math.round(result.prediction.confidence * 100)}% confidence
                      </p>
                      <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                        {matchedFood ? matchedFood.name : result.prediction.predictedLabel}
                      </h2>
                    </div>
                    {matchedFood && (
                      <span className="text-xs text-slate-500">
                        {matchedFood.servingLabel}
                      </span>
                    )}
                  </div>

                  {result.prediction.status !== 'matched' || !matchedFood ? (
                    <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{result.prediction.message}</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Estimated Calories</p>
                          <p className="text-lg font-bold text-slate-900 font-mono-num mt-0.5 whitespace-nowrap">
                            {matchedFood.calories}{' '}
                            <span className="text-xs font-normal text-slate-500">kcal</span>
                          </p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Protein</p>
                          <p className="text-lg font-bold text-emerald-700 font-mono-num mt-0.5 whitespace-nowrap">
                            {matchedFood.protein_g}{' '}
                            <span className="text-xs font-normal text-slate-500">g</span>
                          </p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Carbohydrates</p>
                          <p className="text-lg font-bold text-sky-700 font-mono-num mt-0.5 whitespace-nowrap">
                            {matchedFood.carbs_g}{' '}
                            <span className="text-xs font-normal text-slate-500">g</span>
                          </p>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Fats</p>
                          <p className="text-lg font-bold text-amber-700 font-mono-num mt-0.5 whitespace-nowrap">
                            {matchedFood.fat_g}{' '}
                            <span className="text-xs font-normal text-slate-500">g</span>
                          </p>
                        </div>
                      </div>

                      {result.prediction.nutritionSource === 'ai-estimate' && (
                        <p className="text-xs text-slate-500">
                          Visual nutrition estimate (not in curated dataset) · varies by brand and portion size.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <select
                          aria-label="Meal category"
                          value={mealCategory}
                          onChange={(e) => setMealCategory(e.target.value as MealSlot)}
                          className="px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg"
                        >
                          {MEAL_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleLogMatched()}
                          disabled={savingDiary}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{savingDiary ? 'Saving...' : 'Add to Food Diary'}</span>
                        </button>
                      </div>

                      {savedNotice && (
                        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{savedNotice}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {/* Four Compact Navigation Cards */}
      <section aria-label="Quick navigation">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('recognition')}
            className="text-left bg-white border border-slate-200 hover:border-emerald-600 rounded-xl p-4 flex items-center gap-3.5 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Food Recognition</p>
              <p className="text-xs text-slate-500 truncate">Scan &amp; sample dishes</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('nutrition')}
            className="text-left bg-white border border-slate-200 hover:border-emerald-600 rounded-xl p-4 flex items-center gap-3.5 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Nutrition Information</p>
              <p className="text-xs text-slate-500 truncate">Multi-cuisine nutrition lookup</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('meal-planner')}
            className="text-left bg-white border border-slate-200 hover:border-emerald-600 rounded-xl p-4 flex items-center gap-3.5 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Meal Planner</p>
              <p className="text-xs text-slate-500 truncate">Daily &amp; weekly schedule</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('diary')}
            className="text-left bg-white border border-slate-200 hover:border-emerald-600 rounded-xl p-4 flex items-center gap-3.5 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Food Diary</p>
              <p className="text-xs text-slate-500 truncate">Recorded meals &amp; log</p>
            </div>
          </button>
        </div>
      </section>

      {/* Small Today's Nutrition Summary Section */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Today&apos;s Nutrition Summary
            </h2>
            <p className="text-xs text-slate-500">
              Estimated totals from {summary.entryCount}{' '}
              {summary.entryCount === 1 ? 'recorded meal' : 'recorded meals'} today
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('diary')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
          >
            View Food Diary
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
            <p className="text-xs font-medium text-slate-500">Calories</p>
            <p className="text-lg font-bold text-slate-900 font-mono-num mt-0.5 whitespace-nowrap">
              {summary.totalCalories}{' '}
              <span className="text-xs font-normal text-slate-500">kcal</span>
            </p>
          </div>
          <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
            <p className="text-xs font-medium text-slate-500">Protein</p>
            <p className="text-lg font-bold text-emerald-700 font-mono-num mt-0.5 whitespace-nowrap">
              {summary.totalProtein}{' '}
              <span className="text-xs font-normal text-slate-500">g</span>
            </p>
          </div>
          <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
            <p className="text-xs font-medium text-slate-500">Carbohydrates</p>
            <p className="text-lg font-bold text-sky-700 font-mono-num mt-0.5 whitespace-nowrap">
              {summary.totalCarbs}{' '}
              <span className="text-xs font-normal text-slate-500">g</span>
            </p>
          </div>
          <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
            <p className="text-xs font-medium text-slate-500">Fats</p>
            <p className="text-lg font-bold text-amber-700 font-mono-num mt-0.5 whitespace-nowrap">
              {summary.totalFat}{' '}
              <span className="text-xs font-normal text-slate-500">g</span>
            </p>
          </div>
        </div>

        {todayEntries.length > 0 && (
          <div className="pt-2 border-t border-slate-100 divide-y divide-slate-100">
            {todayEntries.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className="py-2 flex items-center justify-between gap-4 text-xs sm:text-sm"
              >
                <span className="text-slate-800 font-medium truncate">
                  {entry.food_name}{' '}
                  <span className="text-slate-500 font-normal">
                    · {entry.meal_category}
                  </span>
                </span>
                <span className="text-slate-700 font-mono-num whitespace-nowrap shrink-0">
                  {entry.calories} kcal
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
