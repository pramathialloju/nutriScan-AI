"""
NutriScan AI - SQLite Database Layer (instance/nutriscan.db)
"""
import os
import sqlite3
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from nutrition import FOOD_DATASET, scale_nutrition

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
DB_PATH = os.path.join(INSTANCE_DIR, "nutriscan.db")


def get_connection() -> sqlite3.Connection:
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            dietary_preference TEXT NOT NULL DEFAULT 'all',
            updated_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS foods (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            dietary_type TEXT NOT NULL,
            serving_label TEXT NOT NULL,
            calories REAL NOT NULL,
            protein_g REAL NOT NULL,
            carbs_g REAL NOT NULL,
            fat_g REAL NOT NULL,
            fiber_g REAL NOT NULL,
            notes TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
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
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS meal_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            day_of_week TEXT NOT NULL,
            meal_slot TEXT NOT NULL,
            food_id TEXT NOT NULL,
            food_name TEXT NOT NULL,
            calories REAL NOT NULL,
            protein_g REAL NOT NULL,
            carbs_g REAL NOT NULL,
            fat_g REAL NOT NULL,
            saved_at TEXT NOT NULL
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS scan_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_url TEXT NOT NULL,
            predicted_label TEXT NOT NULL,
            confidence REAL NOT NULL,
            mode TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    for food in FOOD_DATASET:
        cur.execute(
            """
            INSERT INTO foods (
                id, name, category, dietary_type, serving_label,
                calories, protein_g, carbs_g, fat_g, fiber_g, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                category = excluded.category,
                dietary_type = excluded.dietary_type,
                serving_label = excluded.serving_label,
                calories = excluded.calories,
                protein_g = excluded.protein_g,
                carbs_g = excluded.carbs_g,
                fat_g = excluded.fat_g,
                fiber_g = excluded.fiber_g,
                notes = excluded.notes
            """,
            (
                food["id"],
                food["name"],
                food["category"],
                food["dietary_type"],
                food["serving_label"],
                food["calories"],
                food["protein_g"],
                food["carbs_g"],
                food["fat_g"],
                food["fiber_g"],
                food["notes"],
            ),
        )

    conn.commit()
    conn.close()


def add_diary_entry(
    food: Dict[str, Any],
    meal_category: str,
    serving_multiplier: float,
    entry_date: Optional[str] = None,
    notes: str = "",
) -> int:
    scaled = scale_nutrition(food, serving_multiplier)
    target_date = entry_date or date.today().isoformat()
    now = datetime.utcnow().isoformat()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO food_diary (
            food_id, food_name, meal_category, serving_multiplier,
            serving_label, calories, protein_g, carbs_g, fat_g,
            fiber_g, entry_date, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            food["id"],
            food["name"],
            meal_category,
            serving_multiplier,
            food["serving_label"],
            scaled["calories"],
            scaled["protein_g"],
            scaled["carbs_g"],
            scaled["fat_g"],
            scaled["fiber_g"],
            target_date,
            notes,
            now,
        ),
    )
    entry_id = cur.lastrowid
    conn.commit()
    conn.close()
    return int(entry_id)


def get_diary_entries(entry_date: Optional[str] = None, days: int = 1) -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    if entry_date:
        rows = cur.execute(
            "SELECT * FROM food_diary WHERE entry_date = ? ORDER BY id DESC",
            (entry_date,),
        ).fetchall()
    else:
        start_date = (date.today() - timedelta(days=days - 1)).isoformat()
        rows = cur.execute(
            "SELECT * FROM food_diary WHERE entry_date >= ? ORDER BY entry_date DESC, id DESC",
            (start_date,),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_diary_entry(entry_id: int, meal_category: str, serving_multiplier: float, food: Dict[str, Any]) -> bool:
    scaled = scale_nutrition(food, serving_multiplier)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE food_diary
        SET meal_category = ?, serving_multiplier = ?, calories = ?,
            protein_g = ?, carbs_g = ?, fat_g = ?, fiber_g = ?
        WHERE id = ?
        """,
        (
            meal_category,
            serving_multiplier,
            scaled["calories"],
            scaled["protein_g"],
            scaled["carbs_g"],
            scaled["fat_g"],
            scaled["fiber_g"],
            entry_id,
        ),
    )
    changed = cur.rowcount > 0
    conn.commit()
    conn.close()
    return changed


def delete_diary_entry(entry_id: int) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM food_diary WHERE id = ?", (entry_id,))
    changed = cur.rowcount > 0
    conn.commit()
    conn.close()
    return changed


def save_scan(image_url: str, predicted_label: str, confidence: float, mode: str, status: str) -> None:
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO scan_history (image_url, predicted_label, confidence, mode, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (image_url, predicted_label, confidence, mode, status, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()


def get_recent_scans(limit: int = 8) -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM scan_history ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_meal_plan(day_of_week: str = "Monday") -> List[Dict[str, Any]]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM meal_plans WHERE day_of_week = ? ORDER BY id ASC",
        (day_of_week,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_meal_plan(day_of_week: str, items: List[Dict[str, Any]]) -> None:
    conn = get_connection()
    now = datetime.utcnow().isoformat()
    conn.execute("DELETE FROM meal_plans WHERE day_of_week = ?", (day_of_week,))
    for item in items:
        conn.execute(
            """
            INSERT INTO meal_plans (
                day_of_week, meal_slot, food_id, food_name,
                calories, protein_g, carbs_g, fat_g, saved_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                day_of_week,
                item["meal_slot"],
                item["food_id"],
                item["food_name"],
                item["calories"],
                item["protein_g"],
                item["carbs_g"],
                item["fat_g"],
                now,
            ),
        )
    conn.commit()
    conn.close()
