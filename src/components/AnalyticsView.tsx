import React, { useMemo } from 'react';
import { BarChart3, Camera, Plus } from 'lucide-react';
import { AnalyticsApiResponse } from '../lib/api';
import { MEAL_SLOTS } from '../lib/nutritionData';
import { ChartCanvas } from './ChartCanvas';
import { AppRoute } from '../lib/routes';

interface AnalyticsViewProps {
  analytics: AnalyticsApiResponse | null;
  loading: boolean;
  onNavigate: (route: AppRoute) => void;
}

export function AnalyticsView({
  analytics,
  loading,
  onNavigate,
}: AnalyticsViewProps) {
  const dailySummary = analytics?.dailySummary;
  const weeklySeries = analytics?.weeklySeries ?? [];

  // 1. Daily Nutrition Summary Bar Chart
  const dailyBarConfig = useMemo(
    () => ({
      type: 'bar' as const,
      data: {
        labels: ['Protein (g)', 'Carbohydrates (g)', 'Fat (g)', 'Fiber (g)'],
        datasets: [
          {
            label: 'Grams Today',
            data: [
              dailySummary?.totalProtein ?? 0,
              dailySummary?.totalCarbs ?? 0,
              dailySummary?.totalFat ?? 0,
              dailySummary?.totalFiber ?? 0,
            ],
            backgroundColor: ['#15803D', '#0EA5E9', '#D97706', '#64748B'],
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false } },
        },
      },
    }),
    [dailySummary]
  );

  // 2. Protein, Carbs & Fat Distribution Doughnut Chart
  const macroDoughnutConfig = useMemo(
    () => ({
      type: 'doughnut' as const,
      data: {
        labels: [
          `Protein (${dailySummary?.macroPercentages.proteinPct ?? 0}%)`,
          `Carbs (${dailySummary?.macroPercentages.carbsPct ?? 0}%)`,
          `Fat (${dailySummary?.macroPercentages.fatPct ?? 0}%)`,
        ],
        datasets: [
          {
            data: [
              dailySummary?.totalProtein ?? 0,
              dailySummary?.totalCarbs ?? 0,
              dailySummary?.totalFat ?? 0,
            ],
            backgroundColor: ['#15803D', '#0EA5E9', '#D97706'],
            borderWidth: 2,
            borderColor: '#FFFFFF',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom' as const,
            labels: { boxWidth: 12, padding: 14, color: '#334155' },
          },
        },
      },
    }),
    [dailySummary]
  );

  // 3. Weekly Food Intake Overview Line/Bar Chart
  const weeklyOverviewConfig = useMemo(
    () => ({
      type: 'line' as const,
      data: {
        labels: weeklySeries.map((d) => d.label),
        datasets: [
          {
            label: 'Estimated Energy (kcal)',
            data: weeklySeries.map((d) => d.calories),
            borderColor: '#15803D',
            backgroundColor: 'rgba(21, 128, 61, 0.10)',
            fill: true,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: '#15803D',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' as const },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false } },
        },
      },
    }),
    [weeklySeries]
  );

  // 4. Meal-wise Nutrition Comparison Grouped Bar Chart
  const mealComparisonConfig = useMemo(() => {
    const byMeal = dailySummary?.byMeal;
    return {
      type: 'bar' as const,
      data: {
        labels: MEAL_SLOTS,
        datasets: [
          {
            label: 'Protein (g)',
            data: MEAL_SLOTS.map((m) => byMeal?.[m]?.protein_g ?? 0),
            backgroundColor: '#15803D',
            borderRadius: 4,
          },
          {
            label: 'Carbs (g)',
            data: MEAL_SLOTS.map((m) => byMeal?.[m]?.carbs_g ?? 0),
            backgroundColor: '#0EA5E9',
            borderRadius: 4,
          },
          {
            label: 'Fat (g)',
            data: MEAL_SLOTS.map((m) => byMeal?.[m]?.fat_g ?? 0),
            backgroundColor: '#D97706',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' as const },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false } },
        },
      },
    };
  }, [dailySummary]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
        Loading SQLite nutrition analytics...
      </div>
    );
  }

  if (!analytics || !analytics.hasData) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          No Saved Nutrition Data Yet
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Analytics charts are computed directly from your saved SQLite food diary
          records. Log a meal or scan a food photo to populate your charts.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('diary')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log First Entry</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('recognition')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Scan Food Photo</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Today&apos;s Logged Energy</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 font-mono-num whitespace-nowrap">
            {dailySummary?.totalCalories ?? 0}{' '}
            <span className="text-sm font-normal text-slate-500">kcal</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">7-Day Logged Energy</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 font-mono-num whitespace-nowrap">
            {analytics.weeklySummary.totalCalories}{' '}
            <span className="text-sm font-normal text-slate-500">kcal</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">7-Day Total Protein</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1.5 font-mono-num whitespace-nowrap">
            {analytics.weeklySummary.totalProtein}{' '}
            <span className="text-sm font-normal text-slate-500">g</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">7-Day Recorded Meals</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 font-mono-num whitespace-nowrap">
            {analytics.weeklySummary.entryCount}
          </p>
        </div>
      </section>

      {/* 4 Interactive Chart.js Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              1. Daily Nutrition Summary
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Protein, carbohydrates, fat, and dietary fiber logged for {analytics.date}
            </p>
          </div>
          {dailySummary && dailySummary.entryCount > 0 ? (
            <ChartCanvas
              config={dailyBarConfig}
              testId="chart-daily-summary"
              heightClass="h-64"
              ariaLabel="Daily nutrition summary bar chart"
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              No entries recorded specifically for {analytics.date} yet.
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              2. Protein, Carbohydrate &amp; Fat Distribution
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Caloric share across macronutrients from today&apos;s saved diary entries
            </p>
          </div>
          {dailySummary && dailySummary.entryCount > 0 ? (
            <ChartCanvas
              config={macroDoughnutConfig}
              testId="chart-macro-distribution"
              heightClass="h-64"
              ariaLabel="Macronutrient distribution doughnut chart"
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              Log a meal today to inspect macro distribution.
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              3. Weekly Food Intake Overview
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              7-day daily estimated energy intake computed from SQLite records
            </p>
          </div>
          <ChartCanvas
            config={weeklyOverviewConfig}
            testId="chart-weekly-overview"
            heightClass="h-64"
            ariaLabel="Weekly food intake line chart"
          />
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              4. Meal-wise Nutrition Comparison
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Macronutrients across Breakfast, Lunch, Evening Snacks, and Dinner
            </p>
          </div>
          <ChartCanvas
            config={mealComparisonConfig}
            testId="chart-meal-comparison"
            heightClass="h-64"
            ariaLabel="Meal-wise nutrition comparison bar chart"
          />
        </section>
      </div>
    </div>
  );
}
