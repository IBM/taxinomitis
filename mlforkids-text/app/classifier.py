"""
Classifying text with a decoded model
"""
# external dependencies
import numpy as np
# local dependencies
from app.blob import Model
from app.resources import Resources


def classify(resources: Resources, model: Model, text: str) -> list:
    embedding = resources.encoder.embed([text])[0].astype(np.float64)

    logits = embedding @ model.weights.astype(np.float64).T + model.intercepts.astype(np.float64)
    logits -= logits.max()
    probabilities = np.exp(logits)
    probabilities /= probabilities.sum()

    # drop "none of these" without renormalising
    label_probabilities = probabilities[:-1]
    confidences = resources.calibrations[model.calibration].apply(label_probabilities)

    classes = [{"label": label, "confidence": round(float(c), 4)} for label, c in zip(model.labels, confidences)]
    # sorted() is stable, so equal confidences keep the label order
    return sorted(classes, key=lambda c: -c["confidence"])
