"""
Training a per-project model
"""
# core dependencies
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
# external dependencies
import numpy as np
from sklearn.linear_model import LogisticRegression
# local dependencies
from app.blob import encode_model
from app.resources import CURRENT_CALIBRATION, Resources


@dataclass(frozen=True)
class Training:
    language: str
    labels: list[str]           # the student's labels, in the order the model should hold them
    examples: list[list[str]]   # one list of example texts for each label


def train(resources: Resources, training: Training) -> tuple:
    """returns the new model's id and its blob"""
    encoder = resources.encoder
    language, labels, examples = training.language, training.labels, training.examples
    background = resources.background[language]

    texts = [text for label_examples in examples for text in label_examples]
    X = np.vstack([encoder.embed(texts), background])

    # classes are numbered in label order, with "none of these" last,
    #  so the fitted rows are already in the order the blob stores them
    none_of_these = len(labels)
    y = np.concatenate([
        np.repeat(np.arange(len(labels)), [len(e) for e in examples]),
        np.full(len(background), none_of_these),
    ])

    # the "none of these" class counts as much as an average label
    per_label = len(texts) / len(labels)
    weights = np.concatenate([np.ones(len(texts)), np.full(len(background), per_label / len(background))])

    model = LogisticRegression(C=10, max_iter=2000).fit(X, y, sample_weight=weights)

    modelid = str(uuid.uuid4())
    header = {
        "modelid": modelid,
        "created": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "language": language,
        "labels": labels,
        "encoder": encoder.name,
        "encoderrevision": encoder.revision,
        "dims": encoder.dims,
        "calibration": CURRENT_CALIBRATION,
    }
    return modelid, encode_model(header, model.coef_, model.intercept_)
