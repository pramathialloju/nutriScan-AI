"""
NutriScan AI - Flask Backend Application
"""
import os
from datetime import date, timedelta
from flask import Flask, jsonify, render_template, request
from werkzeug.utils import secure_filename

import database
from food_classifier import predict_food_image
from nutrition import FOOD_DATASET, get_food_by_id, scale_nutrition
from recommendation import generate_recommendations

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
database.init_db()


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _render_dashboard():
    today_entries = database.get_diary_entries(entry_date=date.today().isoformat())
    summary = {
        "calories": round(sum(e["calories"] for e in today_entries)),
        "protein": round(sum(e["protein_g"] for e in today_entries), 1),
        "carbs": round(sum(e["carbs_g"] for e in today_entries), 1),
        "fat": round(sum(e["fat_g"] for e in today_entries), 1),
        "count": len(today_entries),
    }
    return render_template("dashboard.html", entries=today_entries, summary=summary)


@app.route("/")
def index():
    return _render_dashboard()


@app.route("/dashboard")
def dashboard():
    return _render_dashboard()


@app.route("/food-recognition")
def food_recognition():
    scans = database.get_recent_scans(limit=6)
    return render_template("food_recognition.html", scans=scans)


@app.route("/api/predict", methods=["POST"])
def api_predict():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided."}), 400
    file = request.files["image"]
    if not file.filename or not allowed_file(file.filename):
        return jsonify({"error": "Please upload a JPG, PNG, or WebP food image."}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(save_path)

    result = predict_food_image(save_path)
    image_url = f"/static/uploads/{filename}"
    database.save_scan(
        image_url=image_url,
        predicted_label=result["predicted_label"],
        confidence=result["confidence"],
        mode=result["mode"],
        status=result["status"],
    )
    return jsonify({"image_url": image_url, **result})


@app.route("/nutrition")
def nutrition_page():
    return render_template("nutrition.html", foods=FOOD_DATASET)


@app.route("/api/nutrition")
def api_nutrition():
    query = request.args.get("q", "").strip().lower()
    items = [
        f for f in FOOD_DATASET if not query or query in f["name"].lower()
    ]
    return jsonify({"foods": items})


@app.route("/recommendations")
def recommendations_page():
    dietary = request.args.get("dietary", "all")
    focus = request.args.get("focus", "balanced")
    meal_type = request.args.get("meal_type", "all")
    recs = generate_recommendations(FOOD_DATASET, dietary, focus, meal_type)
    return render_template(
        "recommendations.html",
        recommendations=recs,
        dietary=dietary,
        focus=focus,
        meal_type=meal_type,
    )


@app.route("/meal-planner")
def meal_planner_page():
    day = request.args.get("day", "Monday")
    items = database.get_meal_plan(day)
    return render_template(
        "meal_planner.html", day=day, items=items, foods=FOOD_DATASET
    )


@app.route("/api/meal-plan", methods=["GET", "POST"])
def api_meal_plan():
    if request.method == "GET":
        day = request.args.get("day", "Monday")
        return jsonify({"items": database.get_meal_plan(day)})

    payload = request.get_json(silent=True) or {}
    day = payload.get("day_of_week", "Monday")
    raw_items = payload.get("items", [])
    enriched = []
    for entry in raw_items:
        food = get_food_by_id(entry.get("food_id", ""))
        if not food:
            continue
        scaled = scale_nutrition(food, 1.0)
        enriched.append(
            {
                "meal_slot": entry.get("meal_slot", "Lunch"),
                "food_id": food["id"],
                "food_name": food["name"],
                **scaled,
            }
        )
    database.save_meal_plan(day, enriched)
    return jsonify({"saved": True, "items": enriched})


@app.route("/food-diary")
def food_diary_page():
    target_date = request.args.get("date", date.today().isoformat())
    entries = database.get_diary_entries(entry_date=target_date)
    return render_template(
        "food_diary.html",
        entries=entries,
        foods=FOOD_DATASET,
        target_date=target_date,
    )


@app.route("/api/diary", methods=["GET", "POST"])
def api_diary():
    if request.method == "GET":
        target_date = request.args.get("date", date.today().isoformat())
        entries = database.get_diary_entries(entry_date=target_date)
        return jsonify({"entries": entries})

    payload = request.get_json(silent=True) or {}
    food = get_food_by_id(payload.get("food_id", ""))
    if not food:
        return jsonify({"error": "Invalid food_id"}), 400
    meal_category = payload.get("meal_category", "Lunch")
    multiplier = float(payload.get("serving_multiplier", 1.0))
    entry_date = payload.get("entry_date", date.today().isoformat())
    notes = payload.get("notes", "")
    entry_id = database.add_diary_entry(food, meal_category, multiplier, entry_date, notes)
    return jsonify({"id": entry_id}), 201


@app.route("/api/diary/<int:entry_id>", methods=["PUT", "DELETE"])
def api_diary_item(entry_id: int):
    if request.method == "DELETE":
        ok = database.delete_diary_entry(entry_id)
        return jsonify({"deleted": ok}), (200 if ok else 404)

    payload = request.get_json(silent=True) or {}
    food = get_food_by_id(payload.get("food_id", ""))
    if not food:
        return jsonify({"error": "Invalid food_id"}), 400
    ok = database.update_diary_entry(
        entry_id,
        payload.get("meal_category", "Lunch"),
        float(payload.get("serving_multiplier", 1.0)),
        food,
    )
    return jsonify({"updated": ok}), (200 if ok else 404)


@app.route("/analytics")
def analytics_page():
    return render_template("analytics.html")


@app.route("/api/analytics")
def api_analytics():
    today_str = date.today().isoformat()
    today_entries = database.get_diary_entries(entry_date=today_str)
    week_entries = database.get_diary_entries(days=7)

    daily = {
        "calories": sum(e["calories"] for e in today_entries),
        "protein": round(sum(e["protein_g"] for e in today_entries), 1),
        "carbs": round(sum(e["carbs_g"] for e in today_entries), 1),
        "fat": round(sum(e["fat_g"] for e in today_entries), 1),
    }

    weekly_buckets = {}
    for offset in range(6, -1, -1):
        d = (date.today() - timedelta(days=offset)).isoformat()
        weekly_buckets[d] = 0
    for e in week_entries:
        if e["entry_date"] in weekly_buckets:
            weekly_buckets[e["entry_date"]] += e["calories"]

    return jsonify(
        {
            "has_data": len(week_entries) > 0,
            "daily": daily,
            "weekly_labels": list(weekly_buckets.keys()),
            "weekly_calories": list(weekly_buckets.values()),
        }
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
