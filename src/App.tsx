import { useCallback, useEffect, useState } from 'react';
import {
  DiaryEntry,
  FOOD_DATASET,
  FoodItem,
  MealSlot,
  ScanRecord,
} from './lib/nutritionData';
import { DiarySummary, RecommendedFood } from './lib/nutritionCalc';
import {
  AnalyticsApiResponse,
  createDiaryEntry,
  fetchAnalytics,
  fetchDiary,
  fetchFoods,
  fetchHealth,
  fetchRecentScans,
  fetchRecommendations,
  patchDiaryEntry,
  removeDiaryEntry,
} from './lib/api';
import { AppRoute } from './lib/routes';
import { AppShell } from './components/AppShell';
import { DashboardView } from './components/DashboardView';
import { FoodRecognitionView } from './components/FoodRecognitionView';
import { NutritionAnalysisView } from './components/NutritionAnalysisView';
import { RecommendationsView } from './components/RecommendationsView';
import { MealPlannerView } from './components/MealPlannerView';
import { FoodDiaryView } from './components/FoodDiaryView';
import { AnalyticsView } from './components/AnalyticsView';

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const EMPTY_SUMMARY: DiarySummary = {
  totalCalories: 0,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  totalFiber: 0,
  entryCount: 0,
  macroPercentages: { proteinPct: 0, carbsPct: 0, fatPct: 0 },
  byMeal: {
    Breakfast: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, count: 0 },
    Lunch: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, count: 0 },
    'Evening Snacks': { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, count: 0 },
    Dinner: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, count: 0 },
  },
};

const ROUTE_META: Record<AppRoute, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Upload a food image to identify your meal and track daily nutrition',
  },
  recognition: {
    title: 'Food Scanner',
    subtitle: 'Upload a food image or test a sample plate to identify the dish and log nutrition',
  },
  nutrition: {
    title: 'Nutrition Information',
    subtitle: 'Inspect calories, macronutrients, and fiber across Indian & Food-101 dishes',
  },
  recommendations: {
    title: 'Recommendations',
    subtitle: 'Balanced vegetarian, non-vegetarian, protein-rich, and Indian meal suggestions',
  },
  'meal-planner': {
    title: 'Meal Planner',
    subtitle: 'Organize Breakfast, Lunch, Evening Snacks, and Dinner in SQLite',
  },
  diary: {
    title: 'Food Diary',
    subtitle: 'Add, edit, and remove saved SQLite meal entries with daily & weekly summaries',
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Interactive Chart.js visualizations generated from your SQLite diary records',
  },
};

function getInitialRoute(): AppRoute {
  if (typeof window === 'undefined') return 'dashboard';
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') as AppRoute | null;
  if (view && view in ROUTE_META) {
    return view;
  }
  return 'dashboard';
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(getInitialRoute);
  const [foods, setFoods] = useState<FoodItem[]>(FOOD_DATASET);
  const [classifierMode, setClassifierMode] = useState<'gemini-vision' | 'demonstration'>('demonstration');
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [diaryRange, setDiaryRange] = useState<'day' | 'week'>('day');

  const [todayEntries, setTodayEntries] = useState<DiaryEntry[]>([]);
  const [todaySummary, setTodaySummary] = useState<DiarySummary>(EMPTY_SUMMARY);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diarySummary, setDiarySummary] = useState<DiarySummary>(EMPTY_SUMMARY);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedFood[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsApiResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingSampleKey, setPendingSampleKey] = useState<
    'masala_dosa' | 'paneer_bowl' | 'grilled_salad' | null
  >(null);

  const refreshTodayAndScans = useCallback(async () => {
    const [todayRes, scansRes] = await Promise.all([
      fetchDiary({ date: todayISO() }),
      fetchRecentScans(),
    ]);
    setTodayEntries(todayRes.entries);
    setTodaySummary(todayRes.summary);
    setRecentScans(scansRes);
  }, []);

  const refreshDiaryView = useCallback(async () => {
    const res =
      diaryRange === 'week'
        ? await fetchDiary({ range: 'week' })
        : await fetchDiary({ date: selectedDate });
    setDiaryEntries(res.entries);
    setDiarySummary(res.summary);
  }, [diaryRange, selectedDate]);

  const refreshAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await fetchAnalytics(selectedDate);
      setAnalytics(data);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void (async () => {
      try {
        const [healthRes, foodsRes, recsRes] = await Promise.all([
          fetchHealth(),
          fetchFoods(),
          fetchRecommendations({ dietary: 'all', focus: 'balanced', mealType: 'all' }),
        ]);
        setClassifierMode(healthRes.classifierMode);
        if (foodsRes.length > 0) setFoods(foodsRes);
        setRecommendations(recsRes);
      } catch {
        // Initial fallback to static dataset if server is restarting
      }
      await refreshTodayAndScans().catch(() => {});
    })();
  }, [refreshTodayAndScans]);

  useEffect(() => {
    void refreshDiaryView().catch(() => {});
  }, [refreshDiaryView]);

  useEffect(() => {
    if (route === 'analytics') {
      void refreshAnalytics().catch(() => {});
    }
  }, [route, refreshAnalytics]);

  const navigate = (nextRoute: AppRoute) => {
    setRoute(nextRoute);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('autostart');
      if (nextRoute === 'dashboard') {
        url.searchParams.delete('view');
      } else {
        url.searchParams.set('view', nextRoute);
      }
      window.history.replaceState(null, '', url.toString());
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleAddToDiary = async (payload: {
    food_id: string;
    meal_category: MealSlot;
    serving_multiplier: number;
    entry_date?: string;
    notes?: string;
  }) => {
    await createDiaryEntry({
      ...payload,
      entry_date: payload.entry_date || todayISO(),
    });
    await Promise.all([
      refreshTodayAndScans(),
      refreshDiaryView(),
      refreshAnalytics(),
    ]);
  };

  const handleUpdateDiary = async (
    id: number,
    payload: { meal_category: MealSlot; serving_multiplier: number; notes?: string }
  ) => {
    await patchDiaryEntry(id, payload);
    await Promise.all([
      refreshTodayAndScans(),
      refreshDiaryView(),
      refreshAnalytics(),
    ]);
  };

  const handleDeleteDiary = async (id: number) => {
    await removeDiaryEntry(id);
    await Promise.all([
      refreshTodayAndScans(),
      refreshDiaryView(),
      refreshAnalytics(),
    ]);
  };

  const meta = ROUTE_META[route];

  return (
    <AppShell
      currentRoute={route}
      onNavigate={navigate}
      pageTitle={meta.title}
      pageSubtitle={meta.subtitle}
    >
      {route === 'dashboard' && (
        <DashboardView
          todayEntries={todayEntries}
          summary={todaySummary}
          onNavigate={navigate}
          onScanComplete={refreshTodayAndScans}
          onAddToDiary={handleAddToDiary}
        />
      )}

      {route === 'recognition' && (
        <FoodRecognitionView
          pendingFile={pendingFile}
          pendingSampleKey={pendingSampleKey}
          onClearPending={() => {
            setPendingFile(null);
            setPendingSampleKey(null);
          }}
          classifierMode={classifierMode}
          recentScans={recentScans}
          onScanComplete={refreshTodayAndScans}
          onAddToDiary={handleAddToDiary}
        />
      )}

      {route === 'nutrition' && (
        <NutritionAnalysisView foods={foods} onAddToDiary={handleAddToDiary} />
      )}

      {route === 'recommendations' && (
        <RecommendationsView
          initialRecommendations={recommendations}
          onAddToDiary={handleAddToDiary}
        />
      )}

      {route === 'meal-planner' && <MealPlannerView foods={foods} />}

      {route === 'diary' && (
        <FoodDiaryView
          foods={foods}
          selectedDate={selectedDate}
          onChangeDate={setSelectedDate}
          viewRange={diaryRange}
          onChangeRange={setDiaryRange}
          entries={diaryEntries}
          summary={diarySummary}
          onAddEntry={handleAddToDiary}
          onUpdateEntry={handleUpdateDiary}
          onDeleteEntry={handleDeleteDiary}
        />
      )}

      {route === 'analytics' && (
        <AnalyticsView
          analytics={analytics}
          loading={analyticsLoading}
          onNavigate={navigate}
        />
      )}
    </AppShell>
  );
}
