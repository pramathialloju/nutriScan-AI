import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  DAYS_OF_WEEK,
  FOOD_DATASET,
  MEAL_SLOTS,
} from '../src/lib/nutritionData.ts';
import type {
  DiaryEntry,
  FoodItem,
  MealPlanItem,
  MealSlot,
  ScanRecord,
} from '../src/lib/nutritionData.ts';
import { scaleNutrition } from '../src/lib/nutritionCalc.ts';

const DEFAULT_INSTANCE_DIR = path.resolve(process.cwd(), 'instance');

let dbInstance: DatabaseSync | null = null;

function resolveDbPath(): string {
  try {
    fs.mkdirSync(DEFAULT_INSTANCE_DIR, { recursive: true });
    fs.accessSync(DEFAULT_INSTANCE_DIR, fs.constants.W_OK);
    return path.join(DEFAULT_INSTANCE_DIR, 'nutriscan.db');
  } catch {
    const tmpDir = '/tmp/nutriscan-instance';
    fs.mkdirSync(tmpDir, { recursive: true });
    return path.join(tmpDir, 'nutriscan.db');
  }
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function offsetDateISO(daysAgo: number): string {
  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath();
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dietary_preference TEXT NOT NULL DEFAULT 'all',
      goal_note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS foods (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      dietary_type TEXT NOT NULL,
      meal_types_json TEXT NOT NULL,
      serving_label TEXT NOT NULL,
      serving_grams REAL NOT NULL,
      calories REAL NOT NULL,
      protein_g REAL NOT NULL,
      carbs_g REAL NOT NULL,
      fat_g REAL NOT NULL,
      fiber_g REAL NOT NULL,
      sodium_mg REAL NOT NULL,
      sugar_g REAL NOT NULL,
      protein_rich INTEGER NOT NULL,
      balanced_weight_friendly INTEGER NOT NULL,
      aliases_json TEXT NOT NULL,
      notes TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      predicted_label TEXT NOT NULL,
      food_id TEXT,
      food_name TEXT,
      confidence REAL NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS food_diary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id TEXT NOT NULL,
      food_name TEXT NOT NULL,
      meal_category TEXT NOT NULL,
      serving_multiplier REAL NOT NULL,
      serving_label TEXT NOT NULL,
      calories REAL NOT NULL,
      protein_g REAL NOT NULL,
      carbs_g REAL NOT NULL,
      fat_g REAL NOT NULL,
      fiber_g REAL NOT NULL,
      entry_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      meal_slot TEXT NOT NULL,
      food_id TEXT NOT NULL,
      food_name TEXT NOT NULL,
      serving_multiplier REAL NOT NULL DEFAULT 1,
      serving_label TEXT NOT NULL,
      calories REAL NOT NULL,
      protein_g REAL NOT NULL,
      carbs_g REAL NOT NULL,
      fat_g REAL NOT NULL,
      fiber_g REAL NOT NULL,
      saved_at TEXT NOT NULL
    );
  `);

  seedInitialData(db);
  dbInstance = db;
  return db;
}

function upsertFoodRow(db: DatabaseSync, f: FoodItem): void {
  db.prepare(`
    INSERT INTO foods (
      id, slug, name, category, dietary_type, meal_types_json,
      serving_label, serving_grams, calories, protein_g, carbs_g,
      fat_g, fiber_g, sodium_mg, sugar_g, protein_rich,
      balanced_weight_friendly, aliases_json, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      dietary_type = excluded.dietary_type,
      meal_types_json = excluded.meal_types_json,
      serving_label = excluded.serving_label,
      serving_grams = excluded.serving_grams,
      calories = excluded.calories,
      protein_g = excluded.protein_g,
      carbs_g = excluded.carbs_g,
      fat_g = excluded.fat_g,
      fiber_g = excluded.fiber_g,
      sodium_mg = excluded.sodium_mg,
      sugar_g = excluded.sugar_g,
      protein_rich = excluded.protein_rich,
      balanced_weight_friendly = excluded.balanced_weight_friendly,
      aliases_json = excluded.aliases_json,
      notes = excluded.notes
  `).run(
    f.id,
    f.slug,
    f.name,
    f.category,
    f.dietaryType,
    JSON.stringify(f.mealTypes),
    f.servingLabel,
    f.servingGrams,
    f.calories,
    f.protein_g,
    f.carbs_g,
    f.fat_g,
    f.fiber_g,
    f.sodium_mg,
    f.sugar_g,
    f.proteinRich ? 1 : 0,
    f.balancedWeightFriendly ? 1 : 0,
    JSON.stringify(f.aliases),
    f.notes
  );
}

export function upsertFoodItem(food: FoodItem): void {
  const db = getDb();
  upsertFoodRow(db, food);
}

function seedInitialData(db: DatabaseSync) {
  // Always ensure foods table is populated/synced with FOOD_DATASET
  for (const f of FOOD_DATASET) {
    upsertFoodRow(db, f);
  }

  const profileRow = db
    .prepare('SELECT COUNT(*) as cnt FROM user_profile')
    .get() as { cnt: number };
  if (profileRow.cnt === 0) {
    db.prepare(
      'INSERT INTO user_profile (name, dietary_preference, goal_note, updated_at) VALUES (?, ?, ?, ?)'
    ).run(
      'Student Researcher',
      'all',
      'Balanced daily nutrition tracking across Indian & Food-101 meals',
      new Date().toISOString()
    );
  }

  // Seed initial diary entries only once when diary is completely empty on first init
  const diaryCount = db
    .prepare('SELECT COUNT(*) as cnt FROM food_diary')
    .get() as { cnt: number };
  if (diaryCount.cnt === 0) {
    const seedItems: Array<{
      foodId: string;
      meal: MealSlot;
      mult: number;
      daysAgo: number;
      notes: string;
    }> = [
      { foodId: 'indian_idli', meal: 'Breakfast', mult: 1, daysAgo: 0, notes: 'Morning breakfast with chutney' },
      { foodId: 'indian_sambar', meal: 'Breakfast', mult: 1, daysAgo: 0, notes: 'Warm vegetable sambar' },
      { foodId: 'indian_chapati', meal: 'Lunch', mult: 1, daysAgo: 0, notes: '2 whole wheat chapatis' },
      { foodId: 'indian_dal', meal: 'Lunch', mult: 1, daysAgo: 0, notes: 'Home-style yellow dal' },
      { foodId: 'indian_sprouts_chaat', meal: 'Evening Snacks', mult: 1, daysAgo: 0, notes: 'Evening snack' },
      { foodId: 'indian_poha', meal: 'Breakfast', mult: 1, daysAgo: 1, notes: '' },
      { foodId: 'indian_paneer_curry', meal: 'Lunch', mult: 1, daysAgo: 1, notes: '' },
      { foodId: 'indian_rice', meal: 'Lunch', mult: 1, daysAgo: 1, notes: '' },
      { foodId: 'f101_grilled_salmon_bowl', meal: 'Dinner', mult: 1, daysAgo: 1, notes: '' },
      { foodId: 'indian_upma', meal: 'Breakfast', mult: 1, daysAgo: 2, notes: '' },
      { foodId: 'indian_biryani', meal: 'Lunch', mult: 1, daysAgo: 2, notes: '' },
      { foodId: 'indian_curd_rice', meal: 'Dinner', mult: 1, daysAgo: 2, notes: '' },
      { foodId: 'f101_oatmeal_berries', meal: 'Breakfast', mult: 1, daysAgo: 3, notes: '' },
      { foodId: 'indian_masala_dosa', meal: 'Lunch', mult: 1, daysAgo: 3, notes: '' },
      { foodId: 'indian_dal', meal: 'Dinner', mult: 1.5, daysAgo: 3, notes: '' },
      { foodId: 'f101_eggs_toast', meal: 'Breakfast', mult: 1, daysAgo: 4, notes: '' },
      { foodId: 'f101_chickpea_bowl', meal: 'Lunch', mult: 1, daysAgo: 4, notes: '' },
      { foodId: 'indian_roasted_makhana', meal: 'Evening Snacks', mult: 1, daysAgo: 4, notes: '' },
      { foodId: 'indian_dosa', meal: 'Breakfast', mult: 1.5, daysAgo: 5, notes: '' },
      { foodId: 'indian_palak_paneer', meal: 'Dinner', mult: 1, daysAgo: 5, notes: '' },
    ];

    const insertDiary = db.prepare(`
      INSERT INTO food_diary (
        food_id, food_name, meal_category, serving_multiplier,
        serving_label, calories, protein_g, carbs_g, fat_g,
        fiber_g, entry_date, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of seedItems) {
      const food = FOOD_DATASET.find((f) => f.id === s.foodId);
      if (!food) continue;
      const scaled = scaleNutrition(food, s.mult);
      const dt = offsetDateISO(s.daysAgo);
      insertDiary.run(
        food.id,
        food.name,
        s.meal,
        s.mult,
        food.servingLabel,
        scaled.calories,
        scaled.protein_g,
        scaled.carbs_g,
        scaled.fat_g,
        scaled.fiber_g,
        dt,
        s.notes,
        `${dt}T09:00:00.000Z`
      );
    }
  }

  // Seed default meal plans if empty
  const planCount = db
    .prepare('SELECT COUNT(*) as cnt FROM meal_plans')
    .get() as { cnt: number };
  if (planCount.cnt === 0) {
    const defaultSlots: Record<MealSlot, string[]> = {
      Breakfast: ['indian_idli', 'indian_sambar'],
      Lunch: ['indian_chapati', 'indian_dal'],
      'Evening Snacks': ['indian_sprouts_chaat'],
      Dinner: ['indian_palak_paneer', 'indian_rice'],
    };
    const insertPlan = db.prepare(`
      INSERT INTO meal_plans (
        day_of_week, meal_slot, food_id, food_name, serving_multiplier,
        serving_label, calories, protein_g, carbs_g, fat_g, fiber_g, saved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const day of DAYS_OF_WEEK) {
      for (const slot of MEAL_SLOTS) {
        const ids = defaultSlots[slot];
        for (const id of ids) {
          const food = FOOD_DATASET.find((f) => f.id === id);
          if (!food) continue;
          insertPlan.run(
            day,
            slot,
            food.id,
            food.name,
            1,
            food.servingLabel,
            food.calories,
            food.protein_g,
            food.carbs_g,
            food.fat_g,
            food.fiber_g,
            now
          );
        }
      }
    }
  }
}

export function listFoods(query?: string, category?: string, dietary?: string): FoodItem[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM foods ORDER BY category DESC, name ASC').all() as Array<
    Record<string, unknown>
  >;

  const foods: FoodItem[] = rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    category: String(r.category) as FoodItem['category'],
    dietaryType: String(r.dietary_type) as FoodItem['dietaryType'],
    mealTypes: JSON.parse(String(r.meal_types_json)),
    servingLabel: String(r.serving_label),
    servingGrams: Number(r.serving_grams),
    calories: Number(r.calories),
    protein_g: Number(r.protein_g),
    carbs_g: Number(r.carbs_g),
    fat_g: Number(r.fat_g),
    fiber_g: Number(r.fiber_g),
    sodium_mg: Number(r.sodium_mg),
    sugar_g: Number(r.sugar_g),
    proteinRich: Boolean(r.protein_rich),
    balancedWeightFriendly: Boolean(r.balanced_weight_friendly),
    aliases: JSON.parse(String(r.aliases_json)),
    notes: String(r.notes),
  }));

  return foods.filter((f) => {
    if (category && category !== 'all' && f.category !== category) return false;
    if (dietary && dietary !== 'all' && f.dietaryType !== dietary) return false;
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = `${f.name} ${f.category} ${f.aliases.join(' ')} ${f.notes}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function getFoodById(id: string): FoodItem | null {
  const all = listFoods();
  return all.find((f) => f.id === id) ?? null;
}

export function getDiaryEntries(date?: string, daysBack?: number): DiaryEntry[] {
  const db = getDb();
  if (date) {
    return db
      .prepare('SELECT * FROM food_diary WHERE entry_date = ? ORDER BY id DESC')
      .all(date) as unknown as DiaryEntry[];
  }
  if (daysBack && daysBack > 0) {
    const startDate = offsetDateISO(daysBack - 1);
    return db
      .prepare('SELECT * FROM food_diary WHERE entry_date >= ? ORDER BY entry_date DESC, id DESC')
      .all(startDate) as unknown as DiaryEntry[];
  }
  return db
    .prepare('SELECT * FROM food_diary ORDER BY entry_date DESC, id DESC')
    .all() as unknown as DiaryEntry[];
}

export function addDiaryEntry(input: {
  food_id: string;
  meal_category: MealSlot;
  serving_multiplier: number;
  entry_date?: string;
  notes?: string;
}): DiaryEntry {
  const db = getDb();
  const food = getFoodById(input.food_id);
  if (!food) {
    throw new Error('Selected food item was not found in the nutrition database.');
  }
  const mult = Number(input.serving_multiplier);
  if (!Number.isFinite(mult) || mult <= 0 || mult > 20) {
    throw new Error('Serving multiplier must be between 0.25 and 20.');
  }
  const scaled = scaleNutrition(food, mult);
  const entryDate = input.entry_date && /^\d{4}-\d{2}-\d{2}$/.test(input.entry_date)
    ? input.entry_date
    : todayISO();
  const now = new Date().toISOString();

  const res = db
    .prepare(
      `INSERT INTO food_diary (
        food_id, food_name, meal_category, serving_multiplier,
        serving_label, calories, protein_g, carbs_g, fat_g,
        fiber_g, entry_date, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      food.id,
      food.name,
      input.meal_category,
      mult,
      food.servingLabel,
      scaled.calories,
      scaled.protein_g,
      scaled.carbs_g,
      scaled.fat_g,
      scaled.fiber_g,
      entryDate,
      (input.notes ?? '').trim(),
      now
    );

  return db
    .prepare('SELECT * FROM food_diary WHERE id = ?')
    .get(Number(res.lastInsertRowid)) as unknown as DiaryEntry;
}

export function updateDiaryEntry(
  id: number,
  updates: { meal_category?: MealSlot; serving_multiplier?: number; notes?: string }
): DiaryEntry | null {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM food_diary WHERE id = ?')
    .get(id) as unknown as DiaryEntry | undefined;
  if (!existing) return null;

  const food = getFoodById(existing.food_id);
  const newMult =
    updates.serving_multiplier !== undefined
      ? Number(updates.serving_multiplier)
      : existing.serving_multiplier;
  if (!Number.isFinite(newMult) || newMult <= 0 || newMult > 20) {
    throw new Error('Serving multiplier must be between 0.25 and 20.');
  }

  const newMeal = updates.meal_category ?? existing.meal_category;
  const newNotes = updates.notes !== undefined ? updates.notes.trim() : existing.notes;

  let calories = existing.calories;
  let protein_g = existing.protein_g;
  let carbs_g = existing.carbs_g;
  let fat_g = existing.fat_g;
  let fiber_g = existing.fiber_g;

  if (food) {
    const scaled = scaleNutrition(food, newMult);
    calories = scaled.calories;
    protein_g = scaled.protein_g;
    carbs_g = scaled.carbs_g;
    fat_g = scaled.fat_g;
    fiber_g = scaled.fiber_g;
  }

  db.prepare(
    `UPDATE food_diary SET
      meal_category = ?,
      serving_multiplier = ?,
      calories = ?,
      protein_g = ?,
      carbs_g = ?,
      fat_g = ?,
      fiber_g = ?,
      notes = ?
    WHERE id = ?`
  ).run(newMeal, newMult, calories, protein_g, carbs_g, fat_g, fiber_g, newNotes, id);

  return db
    .prepare('SELECT * FROM food_diary WHERE id = ?')
    .get(id) as unknown as DiaryEntry;
}

export function deleteDiaryEntry(id: number): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM food_diary WHERE id = ?').run(id);
  return res.changes > 0;
}

export function clearAllDiaryEntries(): void {
  const db = getDb();
  db.prepare('DELETE FROM food_diary').run();
}

export function saveScanRecord(record: Omit<ScanRecord, 'id' | 'created_at'>): ScanRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const res = db
    .prepare(
      `INSERT INTO scan_history (
        image_url, predicted_label, food_id, food_name,
        confidence, mode, status, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.image_url,
      record.predicted_label,
      record.food_id,
      record.food_name,
      record.confidence,
      record.mode,
      record.status,
      record.message,
      now
    );

  return db
    .prepare('SELECT * FROM scan_history WHERE id = ?')
    .get(Number(res.lastInsertRowid)) as unknown as ScanRecord;
}

export function getRecentScans(limit = 8): ScanRecord[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM scan_history ORDER BY id DESC LIMIT ?')
    .all(limit) as unknown as ScanRecord[];
}

export function getMealPlan(dayOfWeek?: string): MealPlanItem[] {
  const db = getDb();
  if (dayOfWeek) {
    return db
      .prepare('SELECT * FROM meal_plans WHERE day_of_week = ? ORDER BY id ASC')
      .all(dayOfWeek) as unknown as MealPlanItem[];
  }
  return db
    .prepare('SELECT * FROM meal_plans ORDER BY id ASC')
    .all() as unknown as MealPlanItem[];
}

export function saveMealPlanForDay(
  dayOfWeek: string,
  items: Array<{ meal_slot: MealSlot; food_id: string; serving_multiplier?: number }>
): MealPlanItem[] {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare('DELETE FROM meal_plans WHERE day_of_week = ?').run(dayOfWeek);

  const insert = db.prepare(`
    INSERT INTO meal_plans (
      day_of_week, meal_slot, food_id, food_name, serving_multiplier,
      serving_label, calories, protein_g, carbs_g, fat_g, fiber_g, saved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of items) {
    const food = getFoodById(item.food_id);
    if (!food) continue;
    const mult = item.serving_multiplier && item.serving_multiplier > 0 ? item.serving_multiplier : 1;
    const scaled = scaleNutrition(food, mult);
    insert.run(
      dayOfWeek,
      item.meal_slot,
      food.id,
      food.name,
      mult,
      food.servingLabel,
      scaled.calories,
      scaled.protein_g,
      scaled.carbs_g,
      scaled.fat_g,
      scaled.fiber_g,
      now
    );
  }

  return getMealPlan(dayOfWeek);
}
