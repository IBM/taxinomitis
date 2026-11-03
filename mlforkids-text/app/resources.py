"""
Everything an instance loads before it is ready: the encoder, the
"none of these" background embeddings, and the calibration curves.
"""
# core dependencies
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
# external dependencies
import numpy as np

ENCODER_NAME = "intfloat/multilingual-e5-small"
ENCODER_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
DIMS = 384

LANGUAGES = ["en", "ar", "zh-tw", "zh-cn", "cs", "nl", "fr", "de", "it", "ja", "ko", "pt-br", "es", "xx"]

# the curve that newly trained models use
CURRENT_CALIBRATION = "q1"

ROOT = Path(__file__).resolve().parent.parent
CALIBRATION_FOLDER = ROOT / "calibration"
BACKGROUND_FILE = ROOT / "background" / "tatoeba-e5.npz"


@dataclass(frozen=True)
class Curve:
    id: str
    x: np.ndarray
    y: np.ndarray
    encoderrevision: str
    backgroundsha256: str

    def apply(self, probabilities: np.ndarray) -> np.ndarray:
        return np.interp(probabilities, self.x, self.y)


class Encoder(Protocol):
    name: str
    revision: str
    dims: int

    def embed(self, texts: list) -> np.ndarray:
        """float32 unit vectors, one row per text"""
        ...


@dataclass(frozen=True)
class Resources:
    encoder: Encoder
    background: dict[str, np.ndarray]   # language code -> float32 array, sentences x dims
    calibrations: dict[str, Curve]      # curve id -> Curve


def load_calibrations() -> dict[str, Curve]:
    curves = {}
    for path in sorted(CALIBRATION_FOLDER.glob("*.json")):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        curves[data["id"]] = Curve(id=data["id"],
                                   x=np.asarray(data["x"], dtype=np.float64),
                                   y=np.asarray(data["y"], dtype=np.float64),
                                   encoderrevision=data["encoderrevision"],
                                   backgroundsha256=data["background"]["sha256"])
    return curves


def load_background(calibrations: dict[str, Curve]) -> dict[str, np.ndarray]:
    """
    the "none of these" embeddings, kept as float32, checked against the
    Tatoeba file and encoder revision that the current curve was fitted with
    """
    curve = calibrations[CURRENT_CALIBRATION]
    with np.load(BACKGROUND_FILE, allow_pickle=False) as data:
        if str(data["tatoebasha256"]) != curve.backgroundsha256:
            raise ValueError(f"{BACKGROUND_FILE} wasn't made from the Tatoeba sentences {curve.id} was fitted with")
        if str(data["encoderrevision"]) != ENCODER_REVISION or curve.encoderrevision != ENCODER_REVISION:
            raise ValueError(f"{BACKGROUND_FILE} wasn't made with encoder revision {ENCODER_REVISION}")
        background = {}
        for language in LANGUAGES:
            embeddings = data[language]
            if embeddings.dtype != np.float32 or embeddings.ndim != 2 or embeddings.shape[0] == 0 or embeddings.shape[1] != DIMS:
                raise ValueError(f"{BACKGROUND_FILE} has invalid embeddings for {language}")
            background[language] = embeddings
    return background


def load_production_resources() -> Resources:
    from app.encoder import E5Encoder
    calibrations = load_calibrations()
    background = load_background(calibrations)
    encoder = E5Encoder()
    # so the first request isn't slowed down by one-off set-up
    encoder.embed(["warm up"])
    return Resources(encoder=encoder, background=background, calibrations=calibrations)
