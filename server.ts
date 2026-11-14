import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import dotenv from 'dotenv';
import {
  addDiaryEntry,
  clearAllDiaryEntries,
  deleteDiaryEntry,
  getDb,
  getDiaryEntries,
  getMealPlan,
  getRecentScans,
  listFoods,
  saveMealPlanForDay,
  saveScanRecord,
  updateDiaryEntry,
  upsertFoodItem,
} from './server/db.ts';
import { classifyFoodImage } from './server/classifier.ts';
import {
  aggregateWeeklySeries,
  generateRecommendations,
  summarizeEntries,
  validateFoodUploadMeta,
} from './src/lib/nutritionCalc.ts';
import { DAYS_OF_WEEK, MEAL_SLOTS } from './src/lib/nutritionData.ts';
import type { MealSlot } from './src/lib/nutritionData.ts';

dotenv.config();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const SAMPLE_IMAGES: Record<string, { file: string; mime: string }> = {
  masala_dosa: {
    file: 'src/assets/images/sample_masala_dosa_1794673824999.jpg',
    mime: 'image/jpeg',
  },
  paneer_bowl: {
    file: 'src/assets/images/sample_paneer_bowl_1794673826200.jpg',
    mime: 'image/jpeg',
  },
  grilled_salad: {
    file: 'src/assets/images/sample_grilled_salad_1794673825806.jpg',
    mime: 'image/jpeg',
  },
};

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function startServer() {
  // Ensure SQLite database & seed data initialize on boot
  getDb();

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    const hasGemini = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
        process.env.GEMINI_API_KEY.trim().length >= 10
    );
    res.json({
      ok: true,
      database: 'sqlite',
      classifierMode: hasGemini ? 'gemini-vision' : 'demonstration',
    });
  });

  app.get('/api/foods', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const category =
      typeof req.query.category === 'string' ? req.query.category : undefined;
    const dietary =
      typeof req.query.dietary === 'string' ? req.query.dietary : undefined;
    const foods = listFoods(q, category, dietary);
    res.json({ foods });
  });

  app.get('/api/scans', (_req, res) => {
    const scans = getRecentScans(8);
    res.json({ scans });
  });

  app.post('/api/predict', upload.single('image'), async (req, res) => {
    try {
      let imageBuffer: Buffer;
      let mimeType: string;
      let imageUrl: string;
      let sampleKey: string | undefined;

      if (req.file) {
        const validation = validateFoodUploadMeta(
          req.file.mimetype,
          req.file.size
        );
        if (!validation.valid) {
          res.status(400).json({ error: validation.error });
          return;
        }
        imageBuffer = req.file.buffer;
        mimeType = req.file.mimetype;
        const ext =
          mimeType === 'image/png'
            ? '.png'
            : mimeType === 'image/webp'
            ? '.webp'
            : '.jpg';
        const filename = `scan_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), imageBuffer);
        imageUrl = `/uploads/${filename}`;
      } else if (req.body && typeof req.body.sampleKey === 'string') {
        const sample = SAMPLE_IMAGES[req.body.sampleKey];
        if (!sample) {
          res.status(400).json({ error: 'Invalid sample dish selected.' });
          return;
        }
        const absSamplePath = path.resolve(process.cwd(), sample.file);
        imageBuffer = fs.readFileSync(absSamplePath);
        mimeType = sample.mime;
        imageUrl = `/${sample.file}`;
        sampleKey = req.body.sampleKey;
      } else {
        res.status(400).json({
          error: 'Please upload a food image file (JPG, PNG, or WebP) before running identification.',
        });
        return;
      }

      const prediction = await classifyFoodImage({
        imageBuffer,
        mimeType,
        sampleKey,
      });

      if (prediction.matchedFood && prediction.nutritionSource === 'ai-estimate') {
        upsertFoodItem(prediction.matchedFood);
      }

      const savedScan = saveScanRecord({
        image_url: imageUrl,
        predicted_label: prediction.predictedLabel,
        food_id: prediction.matchedFood?.id ?? null,
        food_name: prediction.matchedFood?.name ?? null,
        confidence: prediction.confidence,
        mode: prediction.mode,
        status: prediction.status,
        message: prediction.message,
      });

      res.json({
        prediction,
        scan: savedScan,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to classify food image.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/diary', (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const range = typeof req.query.range === 'string' ? req.query.range : undefined;

    if (range === 'week') {
      const entries = getDiaryEntries(undefined, 7);
      const summary = summarizeEntries(entries);
      res.json({ entries, summary });
      return;
    }

    const targetDate = date || todayISO();
    const entries = getDiaryEntries(targetDate);
    const summary = summarizeEntries(entries);
    res.json({ date: targetDate, entries, summary });
  });

  app.post('/api/diary', (req, res) => {
    try {
      const { food_id, meal_category, serving_multiplier, entry_date, notes } =
        req.body ?? {};
      if (!food_id || typeof food_id !== 'string') {
        res.status(400).json({ error: 'Please select a valid food item.' });
        return;
      }
      if (!MEAL_SLOTS.includes(meal_category as MealSlot)) {
        res.status(400).json({ error: 'Please select a valid meal category.' });
        return;
      }
      const mult = Number(serving_multiplier ?? 1);
      const entry = addDiaryEntry({
        food_id,
        meal_category: meal_category as MealSlot,
        serving_multiplier: mult,
        entry_date,
        notes,
      });
      res.status(201).json({ entry });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save diary entry.';
      res.status(400).json({ error: msg });
    }
  });

  app.put('/api/diary/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid diary entry ID.' });
        return;
      }
      const { meal_category, serving_multiplier, notes } = req.body ?? {};
      if (meal_category && !MEAL_SLOTS.includes(meal_category as MealSlot)) {
        res.status(400).json({ error: 'Invalid meal category.' });
        return;
      }
      const updated = updateDiaryEntry(id, {
        meal_category,
        serving_multiplier:
          serving_multiplier !== undefined
            ? Number(serving_multiplier)
            : undefined,
        notes,
      });
      if (!updated) {
        res.status(404).json({ error: 'Diary entry not found.' });
        return;
      }
      res.json({ entry: updated });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update diary entry.';
      res.status(400).json({ error: msg });
    }
  });

  app.delete('/api/diary/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid diary entry ID.' });
      return;
    }
    const deleted = deleteDiaryEntry(id);
    if (!deleted) {
      res.status(404).json({ error: 'Diary entry not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  app.delete('/api/diary', (_req, res) => {
    clearAllDiaryEntries();
    res.json({ cleared: true });
  });

  app.get('/api/recommendations', (req, res) => {
    const dietary =
      req.query.dietary === 'vegetarian' || req.query.dietary === 'non-vegetarian'
        ? req.query.dietary
        : 'all';
    const focus =
      req.query.focus === 'high-protein' ||
      req.query.focus === 'indian-cuisine' ||
      req.query.focus === 'weight-management'
        ? req.query.focus
        : 'balanced';
    const mealType = MEAL_SLOTS.includes(req.query.mealType as MealSlot)
      ? (req.query.mealType as MealSlot)
      : 'all';
    const cuisine =
      typeof req.query.cuisine === 'string' && req.query.cuisine.trim()
        ? req.query.cuisine.trim()
        : 'all';

    const foods = listFoods();
    const recommendations = generateRecommendations(foods, {
      dietary,
      focus,
      mealType,
      cuisine,
    });
    res.json({ recommendations });
  });

  app.get('/api/meal-plan', (req, res) => {
    const day =
      typeof req.query.day === 'string' &&
      DAYS_OF_WEEK.includes(req.query.day as (typeof DAYS_OF_WEEK)[number])
        ? req.query.day
        : undefined;
    const items = getMealPlan(day);
    res.json({ items });
  });

  app.post('/api/meal-plan', (req, res) => {
    const { day_of_week, items } = req.body ?? {};
    if (
      !day_of_week ||
      !DAYS_OF_WEEK.includes(day_of_week as (typeof DAYS_OF_WEEK)[number])
    ) {
      res.status(400).json({ error: 'Please select a valid day of the week.' });
      return;
    }
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Meal plan items must be a list.' });
      return;
    }
    const saved = saveMealPlanForDay(day_of_week, items);
    res.json({ items: saved, savedAt: new Date().toISOString() });
  });

  app.get('/api/analytics', (req, res) => {
    const targetDate =
      typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : todayISO();
    const dayEntries = getDiaryEntries(targetDate);
    const weekEntries = getDiaryEntries(undefined, 7);

    const dailySummary = summarizeEntries(dayEntries);
    const weeklySeries = aggregateWeeklySeries(weekEntries, targetDate, 7);
    const weeklySummary = summarizeEntries(weekEntries);

    res.json({
      date: targetDate,
      hasData: weekEntries.length > 0 || dayEntries.length > 0,
      dailySummary,
      weeklySummary,
      weeklySeries,
    });
  });

  const distDir = path.resolve(process.cwd(), 'dist');
  const hasDistBuild = fs.existsSync(path.join(distDir, 'index.html'));
  const useViteDev =
    process.env.NODE_ENV === 'development' ||
    (process.env.NODE_ENV !== 'production' && !hasDistBuild);

  if (useViteDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const srcAssetsDir = path.resolve(process.cwd(), 'src/assets');
    if (fs.existsSync(srcAssetsDir)) {
      app.use('/src/assets', express.static(srcAssetsDir));
    }
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NutriScan AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NutriScan AI server:', err);
  process.exit(1);
});
