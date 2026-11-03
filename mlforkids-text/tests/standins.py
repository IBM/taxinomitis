"""
A stand-in for the e5 encoder, so API tests that aren't about the q1
pipeline don't need to load the real model.

Each text gets a fixed pseudo-random unit vector, so the same text always
has the same embedding. Training on those vectors gives a model that
recognises its own training examples.
"""
import hashlib
import threading

import numpy as np

from app.resources import Resources, load_calibrations, ENCODER_NAME, ENCODER_REVISION, DIMS, LANGUAGES


class StandInEncoder:
    name = ENCODER_NAME
    revision = ENCODER_REVISION
    dims = DIMS

    def __init__(self):
        # texts listed here make embed() wait until their event is set
        self.held_texts = {}
        self.calls = []

    def embed(self, texts):
        self.calls.append(list(texts))
        for text in texts:
            if text in self.held_texts:
                self.held_texts[text].wait(timeout=30)
        return np.vstack([vector(t) for t in texts]).astype(np.float32)


def vector(text):
    seed = int.from_bytes(hashlib.sha256(text.encode("utf-8")).digest()[:8], "little")
    v = np.random.default_rng(seed).standard_normal(DIMS)
    return v / np.linalg.norm(v)


def standin_resources(encoder=None):
    background = {lang: np.vstack([vector(f"{lang} background {i}") for i in range(50)]).astype(np.float32)
                  for lang in LANGUAGES}
    return Resources(encoder=encoder or StandInEncoder(), background=background, calibrations=load_calibrations())


class HeldLoader:
    """a loader that holds on to the resources until the event is set, to test readiness"""
    def __init__(self, resources):
        self.resources = resources
        self.event = threading.Event()

    def __call__(self):
        self.event.wait(timeout=30)
        return self.resources
