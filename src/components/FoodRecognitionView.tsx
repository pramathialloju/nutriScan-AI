import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Upload,
} from 'lucide-react';
import {
  MEAL_SLOTS,
  MealSlot,
  ScanRecord,
} from '../lib/nutritionData';
import { scaleNutrition } from '../lib/nutritionCalc';
import {
  PredictionApiResponse,
  predictFoodUpload,
  predictSampleDish,
} from '../lib/api';
import masalaDosaImg from '../assets/images/sample_masala_dosa_1794673824999.jpg';
import paneerBowlImg from '../assets/images/sample_paneer_bowl_1794673826200.jpg';
import grilledSaladImg from '../assets/images/sample_grilled_salad_1794673825806.jpg';

interface FoodRecognitionViewProps {
  pendingFile: File | null;
  pendingSampleKey: 'masala_dosa' | 'paneer_bowl' | 'grilled_salad' | null;
  onClearPending: () => void;
  classifierMode: 'gemini-vision' | 'demonstration';
  recentScans: ScanRecord[];
  onScanComplete: () => Promise<void>;
  onAddToDiary: (payload: {
    food_id: string;
    meal_category: MealSlot;
    serving_multiplier: number;
    notes?: string;
  }) => Promise<void>;
}

const SAMPLE_CARDS = [
  {
    key: 'masala_dosa' as const,
    title: 'Masala Dosa',
    subtitle: 'Indian · Breakfast / Dinner',
    img: masalaDosaImg,
  },
  {
    key: 'paneer_bowl' as const,
    title: 'Paneer Curry & Chapati',
    subtitle: 'Indian · Vegetarian',
    img: paneerBowlImg,
  },
  {
    key: 'grilled_salad' as const,
    title: 'Grilled Salmon & Quinoa',
    subtitle: 'Food-101 · High Protein',
    img: grilledSaladImg,
  },
];

export function FoodRecognitionView({
  pendingFile,
  pendingSampleKey,
  onClearPending,
  classifierMode,
  recentScans,
  onScanComplete,
  onAddToDiary,
}: FoodRecognitionViewProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeSample, setActiveSample] = useState<
    'masala_dosa' | 'paneer_bowl' | 'grilled_salad' | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionApiResponse | null>(null);

  // Add-to-diary controls after prediction
  const [mealCategory, setMealCategory] = useState<MealSlot>('Lunch');
  const [servingMultiplier, setServingMultiplier] = useState<number>(1);
  const [diarySavedMsg, setDiarySavedMsg] = useState<string | null>(null);
  const [savingDiary, setSavingDiary] = useState(false);
  const [showModelGuide, setShowModelGuide] = useState(false);

  const runSamplePrediction = async (
    key: 'masala_dosa' | 'paneer_bowl' | 'grilled_salad'
  ) => {
    setErrorMsg(null);
    setDiarySavedMsg(null);
    setActiveSample(key);
    setSelectedFile(null);
    const sampleCard = SAMPLE_CARDS.find((c) => c.key === key);
    if (sampleCard) setPreviewUrl(sampleCard.img);

    setLoading(true);
    try {
      const res = await predictSampleDish(key);
      setResult(res);
      await onScanComplete();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to classify food sample.'
      );
    } finally {
      setLoading(false);
    }
  };

  const runFilePrediction = async (file: File) => {
    setErrorMsg(null);
    setDiarySavedMsg(null);
    setActiveSample(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    setLoading(true);
    try {
      const res = await predictFoodUpload(file);
      setResult(res);
      await onScanComplete();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Food classification failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pendingFile) {
      void runFilePrediction(pendingFile);
      onClearPending();
    } else if (pendingSampleKey) {
      void runSamplePrediction(pendingSampleKey);
      onClearPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFile, pendingSampleKey]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMsg(null);
    setDiarySavedMsg(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg(
        'Unsupported image format. Please choose a JPG, PNG, or WebP photograph.'
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File exceeds 10 MB limit. Please choose a smaller image.');
      return;
    }
    setSelectedFile(file);
    setActiveSample(null);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const handleIdentify = async () => {
    if (selectedFile) {
      await runFilePrediction(selectedFile);
      return;
    }
    if (activeSample) {
      await runSamplePrediction(activeSample);
      return;
    }
    setErrorMsg('Please upload a food image or choose a sample dish first.');
  };

  const handleSaveToDiary = async () => {
    const food = result?.prediction.matchedFood;
    if (!food) return;
    setSavingDiary(true);
    setDiarySavedMsg(null);
    try {
      await onAddToDiary({
        food_id: food.id,
        meal_category: mealCategory,
        serving_multiplier: servingMultiplier,
        notes: 'Logged from AI Food Recognition',
      });
      setDiarySavedMsg(
        `Added ${servingMultiplier}x ${food.name} to ${mealCategory} in your SQLite food diary.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save to food diary.'
      );
    } finally {
      setSavingDiary(false);
    }
  };

  const matchedFood = result?.prediction.matchedFood ?? null;
  const scaled = matchedFood
    ? scaleNutrition(matchedFood, servingMultiplier)
    : null;

  return (
    <div className="space-y-6">
      {/* Transparent Engine Info Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs sm:text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Inference Engine: </span>
          {classifierMode === 'gemini-vision'
            ? 'Live Multimodal Vision Classifier mapped to Multi-Cuisine & Food-101 Nutrition Dataset (MobileNetV2/ResNet50 Python pipeline included in NutriScan_AI/)'
            : 'Demonstration Sample Mode active (connect GEMINI_API_KEY or trained MobileNetV2 .keras model in NutriScan_AI/models/ for arbitrary photo inference)'}
        </div>
        <button
          type="button"
          onClick={() => setShowModelGuide((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>CNN Model Integration Guide</span>
          {showModelGuide ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {showModelGuide && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 text-sm text-slate-700">
          <h3 className="text-base font-semibold text-slate-900">
            MobileNetV2 / ResNet50 Transfer Learning Structure
          </h3>
          <p>
            The academic Python Flask + TensorFlow codebase is located in{' '}
            <code className="font-mono-num text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              NutriScan_AI/
            </code>
            . Image preprocessing resizes inputs to{' '}
            <code className="font-mono-num text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              224x224
            </code>
            , applies MobileNetV2 normalization, loads saved weights from{' '}
            <code className="font-mono-num text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              models/nutriscan_mobilenetv2.keras
            </code>
            , and maps predicted Food-101 + Indian food classes to{' '}
            <code className="font-mono-num text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              nutrition.py
            </code>
            .
          </p>
        </div>
      )}

      {/* Main Two-Column Upload & Prediction Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Image Upload + Sample Picker */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              1. Upload or Select a Food Image
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Supports JPG, PNG, and WebP up to 10 MB
            </p>
          </div>

          <label className="block border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-5 text-center cursor-pointer transition-colors bg-[#F8FAF9]">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFilePick}
              aria-label="Upload food image"
              className="sr-only"
            />
            {previewUrl ? (
              <div className="space-y-3">
                <img
                  src={previewUrl}
                  alt="Uploaded food preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-56 object-cover rounded-lg border border-slate-200"
                />
                <p className="text-xs text-emerald-700 font-medium">
                  Click here to choose a different image
                </p>
              </div>
            ) : (
              <div className="py-8 space-y-2">
                <Upload className="w-8 h-8 text-emerald-700 mx-auto" />
                <p className="text-sm font-medium text-slate-800">
                  Choose a meal photograph from your device
                </p>
                <p className="text-xs text-slate-500">
                  Idli, Masala Dosa, Biryani, Ramen, Tacos, Pasta, Falafel, Pizza, and more
                </p>
              </div>
            )}
          </label>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleIdentify()}
            disabled={loading || (!selectedFile && !activeSample)}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing Food Image...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                <span>Identify Food</span>
              </>
            )}
          </button>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <p className="text-xs font-medium text-slate-600">
              Quick Test Sample Dishes
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {SAMPLE_CARDS.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => void runSamplePrediction(card.key)}
                  disabled={loading}
                  className={`text-left rounded-lg border p-2 transition-colors cursor-pointer ${
                    activeSample === card.key
                      ? 'border-emerald-600 bg-emerald-50/60'
                      : 'border-slate-200 hover:border-emerald-400 bg-white'
                  }`}
                >
                  <img
                    src={card.img}
                    alt={card.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-16 object-cover rounded mb-1.5"
                  />
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {card.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Classification Result & Nutrition Mapping */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-14 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Ready for Food Recognition
              </h3>
              <p className="text-sm text-slate-500 max-w-md">
                Upload a meal photo and click Identify Food, or click one of the curated
                sample dishes to inspect predicted food labels, confidence score, and
                per-serving nutrition.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-14 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-700 animate-spin" />
              <p className="text-sm font-medium text-slate-700">
                Running image preprocessing &amp; dish classification...
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-xs font-medium text-slate-500 font-mono-num">
                    {result.prediction.mode === 'gemini-vision'
                      ? 'Vision Classifier'
                      : 'Demonstration Mode'}{' '}
                    · Confidence {Math.round(result.prediction.confidence * 100)}%
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900 mt-1">
                    {matchedFood ? matchedFood.name : result.prediction.predictedLabel}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {result.prediction.reasoning}
                  </p>
                </div>
                {result.scan?.image_url && (
                  <img
                    src={result.scan.image_url}
                    alt={result.prediction.predictedLabel}
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                )}
              </div>

              {result.prediction.status !== 'matched' || !matchedFood || !scaled ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      {result.prediction.status === 'low_confidence'
                        ? 'Low Confidence or Non-Food Image'
                        : 'Unsupported Dish or Offline Model'}
                    </span>
                  </div>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    {result.prediction.message}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {matchedFood.category} ·{' '}
                        {matchedFood.dietaryType === 'vegetarian'
                          ? 'Vegetarian'
                          : 'Non-Vegetarian'}{' '}
                        · Base serving: {matchedFood.servingLabel}
                      </span>
                      <span className="font-mono-num">
                        Scaled weight: {scaled.grams}g
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                      <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
                        <p className="text-xs text-slate-500">Calories</p>
                        <p className="text-lg font-bold text-slate-900 font-mono-num mt-0.5">
                          {scaled.calories}
                        </p>
                        <p className="text-[11px] text-slate-500">kcal est.</p>
                      </div>
                      <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
                        <p className="text-xs text-slate-500">Protein</p>
                        <p className="text-lg font-bold text-emerald-700 font-mono-num mt-0.5">
                          {scaled.protein_g}g
                        </p>
                      </div>
                      <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
                        <p className="text-xs text-slate-500">Carbs</p>
                        <p className="text-lg font-bold text-sky-700 font-mono-num mt-0.5">
                          {scaled.carbs_g}g
                        </p>
                      </div>
                      <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
                        <p className="text-xs text-slate-500">Fat</p>
                        <p className="text-lg font-bold text-amber-700 font-mono-num mt-0.5">
                          {scaled.fat_g}g
                        </p>
                      </div>
                      <div className="bg-[#F8FAF9] border border-slate-200 rounded-lg p-3.5">
                        <p className="text-xs text-slate-500">Fiber</p>
                        <p className="text-lg font-bold text-slate-900 font-mono-num mt-0.5">
                          {scaled.fiber_g}g
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 pt-1">
                      {matchedFood.notes}
                      {result.prediction.nutritionSource === 'ai-estimate'
                        ? ' Visual nutrition estimate (not in curated dataset).'
                        : ' Nutrition values are estimates and vary by ingredients and preparation.'}
                    </p>
                  </div>

                  {/* Log to SQLite Food Diary */}
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Add Identified Meal to Food Diary
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label
                          htmlFor="scan-meal-category"
                          className="block text-xs font-medium text-slate-600 mb-1"
                        >
                          Meal Category
                        </label>
                        <select
                          id="scan-meal-category"
                          value={mealCategory}
                          onChange={(e) => setMealCategory(e.target.value as MealSlot)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                          {MEAL_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="scan-serving-size"
                          className="block text-xs font-medium text-slate-600 mb-1"
                        >
                          Serving Size
                        </label>
                        <select
                          id="scan-serving-size"
                          value={servingMultiplier}
                          onChange={(e) =>
                            setServingMultiplier(Number(e.target.value))
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                          <option value={0.5}>0.5x (Half serving)</option>
                          <option value={1}>1.0x (Standard)</option>
                          <option value={1.5}>1.5x (Large)</option>
                          <option value={2}>2.0x (Double)</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSaveToDiary()}
                        disabled={savingDiary}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{savingDiary ? 'Saving...' : 'Add to Food Diary'}</span>
                      </button>
                    </div>

                    {diarySavedMsg && (
                      <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{diarySavedMsg}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Recent Scans Strip */}
      {recentScans.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Recent Recognition History
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentScans.slice(0, 4).map((scan) => (
              <div
                key={scan.id}
                className="border border-slate-200 rounded-lg p-3 flex items-center gap-3"
              >
                <img
                  src={scan.image_url}
                  alt={scan.predicted_label}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {scan.food_name || scan.predicted_label}
                  </p>
                  <p className="text-xs text-slate-500 font-mono-num">
                    {Math.round(scan.confidence * 100)}% · {scan.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
