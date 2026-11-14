"""
NutriScan AI - Transfer Learning Training Script (MobileNetV2 / ResNet50)
Trains a multi-class food image classifier on Food-101 + Indian food images.

Expected dataset directory layout:
dataset/
  train/
    idli/
    masala_dosa/
    biryani/
    ...
  val/
    idli/
    masala_dosa/
    biryani/
    ...
"""
import json
import os
import tensorflow as tf
from tensorflow.keras import layers, models

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
MODELS_DIR = os.path.join(BASE_DIR, "models")
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 12


def build_model(num_classes: int, backbone: str = "mobilenetv2") -> tf.keras.Model:
    if backbone == "resnet50":
        base_model = tf.keras.applications.ResNet50(
            input_shape=(224, 224, 3),
            include_top=False,
            weights="imagenet",
        )
        preprocess_fn = tf.keras.applications.resnet50.preprocess_input
    else:
        base_model = tf.keras.applications.MobileNetV2(
            input_shape=(224, 224, 3),
            include_top=False,
            weights="imagenet",
        )
        preprocess_fn = tf.keras.applications.mobilenet_v2.preprocess_input

    base_model.trainable = False

    inputs = layers.Input(shape=(224, 224, 3))
    x = layers.RandomFlip("horizontal")(inputs)
    x = layers.RandomRotation(0.1)(x)
    x = layers.Lambda(preprocess_fn)(x)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = models.Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def main() -> None:
    train_dir = os.path.join(DATASET_DIR, "train")
    val_dir = os.path.join(DATASET_DIR, "val")

    if not os.path.exists(train_dir) or not os.path.exists(val_dir):
        raise FileNotFoundError(
            "Dataset directories dataset/train and dataset/val were not found. "
            "See README.md for instructions on preparing Food-101 + Indian food folders."
        )

    train_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir, image_size=IMG_SIZE, batch_size=BATCH_SIZE
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        val_dir, image_size=IMG_SIZE, batch_size=BATCH_SIZE
    )

    class_names = train_ds.class_names
    os.makedirs(MODELS_DIR, exist_ok=True)
    with open(os.path.join(MODELS_DIR, "class_labels.json"), "w", encoding="utf-8") as fh:
        json.dump(class_names, fh, indent=2)

    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.prefetch(buffer_size=AUTOTUNE)
    val_ds = val_ds.prefetch(buffer_size=AUTOTUNE)

    model = build_model(num_classes=len(class_names), backbone="mobilenetv2")
    model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS)

    output_path = os.path.join(MODELS_DIR, "nutriscan_mobilenetv2.keras")
    model.save(output_path)
    print(f"Saved trained model to {output_path}")


if __name__ == "__main__":
    main()
