# NutriScan AI — Python Flask & Transfer Learning Guide

**Tagline:** Scan Your Food. Understand Your Nutrition.

## 1. Downloading & Preparing Datasets

1. **Food-101 Dataset**:
   - Download from ETH Zurich / Kaggle (`food-101.tar.gz`) or TensorFlow Datasets (`tfds.load("food101")`).
   - Extract `images/` and split into `dataset/train/<class_name>/` (80%) and `dataset/val/<class_name>/` (20%).
2. **Indian Food Image Dataset**:
   - Download Indian Food Images Dataset from Kaggle (covering `idli`, `dosa`, `masala_dosa`, `chapati`, `biryani`, `paneer_curry`, `dal`, `sambar`, `upma`, `poha`, `curd_rice`).
   - Merge class folders into the same `dataset/train/` and `dataset/val/` layout so MobileNetV2 learns both Indian and Food-101 classes together.

## 2. Training & Loading the Model

```bash
cd NutriScan_AI
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Train MobileNetV2 / ResNet50 transfer learning model
python train_model.py
```

This exports `models/nutriscan_mobilenetv2.keras` and `models/class_labels.json`. `food_classifier.py` automatically loads these files on startup when present.

## 3. Running the Flask Application

```bash
cd NutriScan_AI
python app.py
```

Open `http://localhost:5000` in your browser. SQLite persists automatically in `instance/nutriscan.db`.
