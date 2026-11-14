import {
  DiaryEntry,
  FoodItem,
  MealPlanItem,
  MealSlot,
  ScanRecord,
} from './nutritionData';
import {
  DailySeriesPoint,
  DiarySummary,
  RecommendedFood,
} from './nutritionCalc';

export interface PredictionApiResponse {
  prediction: {
    predictedLabel: string;
    confidence: number;
    isFood: boolean;
    status: 'matched' | 'low_confidence' | 'unsupported';
    mode: 'gemini-vision' | 'demonstration';
    nutritionSource?: 'dataset' | 'ai-estimate';
    reasoning: string;
    matchedFood: FoodItem | null;
    message: string;
  };
  scan: ScanRecord;
}

export interface AnalyticsApiResponse {
  date: string;
  hasData: boolean;
  dailySummary: DiarySummary;
  weeklySummary: DiarySummary;
  weeklySeries: DailySeriesPoint[];
}

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`
    );
  }
  return data as T;
}

export async function fetchHealth(): Promise<{
  ok: boolean;
  database: string;
  classifierMode: 'gemini-vision' | 'demonstration';
}> {
  const res = await fetch('/api/health');
  return handleJson(res);
}

export async function fetchFoods(params?: {
  q?: string;
  category?: string;
  dietary?: string;
}): Promise<FoodItem[]> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.category) sp.set('category', params.category);
  if (params?.dietary) sp.set('dietary', params.dietary);
  const res = await fetch(`/api/foods?${sp.toString()}`);
  const data = await handleJson<{ foods: FoodItem[] }>(res);
  return data.foods;
}

export async function fetchRecentScans(): Promise<ScanRecord[]> {
  const res = await fetch('/api/scans');
  const data = await handleJson<{ scans: ScanRecord[] }>(res);
  return data.scans;
}

export async function predictFoodUpload(file: File): Promise<PredictionApiResponse> {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch('/api/predict', {
    method: 'POST',
    body: form,
  });
  return handleJson(res);
}

export async function predictSampleDish(
  sampleKey: 'masala_dosa' | 'paneer_bowl' | 'grilled_salad'
): Promise<PredictionApiResponse> {
  const res = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sampleKey }),
  });
  return handleJson(res);
}

export async function fetchDiary(params?: {
  date?: string;
  range?: 'day' | 'week';
}): Promise<{ entries: DiaryEntry[]; summary: DiarySummary; date?: string }> {
  const sp = new URLSearchParams();
  if (params?.date) sp.set('date', params.date);
  if (params?.range) sp.set('range', params.range);
  const res = await fetch(`/api/diary?${sp.toString()}`);
  return handleJson(res);
}

export async function createDiaryEntry(payload: {
  food_id: string;
  meal_category: MealSlot;
  serving_multiplier: number;
  entry_date?: string;
  notes?: string;
}): Promise<DiaryEntry> {
  const res = await fetch('/api/diary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ entry: DiaryEntry }>(res);
  return data.entry;
}

export async function patchDiaryEntry(
  id: number,
  payload: {
    meal_category?: MealSlot;
    serving_multiplier?: number;
    notes?: string;
  }
): Promise<DiaryEntry> {
  const res = await fetch(`/api/diary/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ entry: DiaryEntry }>(res);
  return data.entry;
}

export async function removeDiaryEntry(id: number): Promise<void> {
  const res = await fetch(`/api/diary/${id}`, { method: 'DELETE' });
  await handleJson(res);
}

export async function clearDiaryEntries(): Promise<void> {
  const res = await fetch('/api/diary', { method: 'DELETE' });
  await handleJson(res);
}

export async function fetchRecommendations(params: {
  dietary: string;
  focus: string;
  mealType: string;
  cuisine?: string;
}): Promise<RecommendedFood[]> {
  const sp = new URLSearchParams(params);
  const res = await fetch(`/api/recommendations?${sp.toString()}`);
  const data = await handleJson<{ recommendations: RecommendedFood[] }>(res);
  return data.recommendations;
}

export async function fetchMealPlan(day?: string): Promise<MealPlanItem[]> {
  const sp = new URLSearchParams();
  if (day) sp.set('day', day);
  const res = await fetch(`/api/meal-plan?${sp.toString()}`);
  const data = await handleJson<{ items: MealPlanItem[] }>(res);
  return data.items;
}

export async function saveMealPlan(
  dayOfWeek: string,
  items: Array<{
    meal_slot: MealSlot;
    food_id: string;
    serving_multiplier: number;
  }>
): Promise<{ items: MealPlanItem[]; savedAt: string }> {
  const res = await fetch('/api/meal-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day_of_week: dayOfWeek, items }),
  });
  return handleJson(res);
}

export async function fetchAnalytics(date?: string): Promise<AnalyticsApiResponse> {
  const sp = new URLSearchParams();
  if (date) sp.set('date', date);
  const res = await fetch(`/api/analytics?${sp.toString()}`);
  return handleJson(res);
}
