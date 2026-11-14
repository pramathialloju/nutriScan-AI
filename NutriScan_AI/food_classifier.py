"""
NutriScan AI - CNN / Transfer Learning Food Image Classifier
Supports trained MobileNetV2 / ResNet50 Keras models saved in models/.
When no trained model weights exist, enters a clearly labeled Demonstration Mode.
"""
import json
import os
from typing import Any, Dict, List, Optional

import numpy as np
from PIL import Image

from nutrition import match_label_to_food

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "nutriscan_mobilenetv2.keras")
LABELS_PATH = os.path.join(MODELS_DIR, "class_labels.json")
CONFIDENCE_THRESHOLD = 0.55

_loaded_model = None
_loaded_labels: Optional[List[str]] = None


def load_trained_model() -> bool:
    """Attempt to load trained Keras model and class labels from models/."""
    global _loaded_model, _loaded_labels

    if _loaded_model is not None and _loaded_labels is not None:
        return True

    if not os.path.exists(MODEL_PATH) or not os.path.exists(LABELS_PATH):
        return False

    try:
        import tensorflow as tf

        _loaded_model = tf.keras.models.load_model(MODEL_PATH)
        with open(LABELS_PATH, "r", encoding="utf-8") as fh:
            _loaded_labels = json.load(fh)
        return True
    except Exception as exc:
        print(f"[NutriScan AI] Failed to load trained model: {exc}")
        _loaded_model = None
        _loaded_labels = None
        return False


def preprocess_image(image_path: str, target_size=(224, 224)) -> np.ndarray:
    """Resize and normalize image for MobileNetV2 / ResNet50 inference."""
    img = Image.open(image_path).convert("RGB")
    img = img.resize(target_size, Image.Resampling.BILINEAR)
    arr = np.asarray(img, dtype=np.float32)
    # MobileNetV2 normalization to [-1, 1]
    arr = (arr / 127.5) - 1.0
    return np.expand_dims(arr, axis=0)


def predict_food_image(image_path: str) -> Dict[str, Any]:
    """
    Run food recognition on an uploaded image.
    Never guesses from filenames; reports Demonstration Mode honestly if model weights are missing.
    """
    model_ready = load_trained_model()
    if not model_ready or _loaded_model is None or _loaded_labels is None:
        return {
            "status": "demonstration_unavailable",
            "mode": "demonstration",
            "predicted_label": "Trained Model Not Found",
            "confidence": 0.0,
            "matched_food": None,
            "message": (
                "Demonstration Mode: Trained MobileNetV2 weights were not found at "
                "models/nutriscan_mobilenetv2.keras. Follow train_model.py instructions "
                "to train on Food-101 + Indian food images and enable live CNN inference."
            ),
        }

    batch = preprocess_image(image_path)
    probs = _loaded_model.predict(batch, verbose=0)[0]
    top_idx = int(np.argmax(probs))
    confidence = float(probs[top_idx])
    predicted_label = _loaded_labels[top_idx]

    if confidence < CONFIDENCE_THRESHOLD:
        return {
            "status": "low_confidence",
            "mode": "cnn-mobilenetv2",
            "predicted_label": predicted_label,
            "confidence": round(confidence, 4),
            "matched_food": None,
            "message": (
                "Prediction confidence was too low to identify this food reliably. "
                "Please upload a clearer, well-lit image of a supported dish."
            ),
        }

    matched_food = match_label_to_food(predicted_label)
    if matched_food is None:
        return {
            "status": "unsupported",
            "mode": "cnn-mobilenetv2",
            "predicted_label": predicted_label,
            "confidence": round(confidence, 4),
            "matched_food": None,
            "message": (
                f"Detected '{predicted_label}', which is not currently mapped in nutrition.py."
            ),
        }

    return {
        "status": "matched",
        "mode": "cnn-mobilenetv2",
        "predicted_label": matched_food["name"],
        "confidence": round(confidence, 4),
        "matched_food": matched_food,
        "message": f"Identified {matched_food['name']} with {round(confidence * 100)}% confidence.",
    }
