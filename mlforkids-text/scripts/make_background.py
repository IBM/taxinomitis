"""
TEMPORARY - writes background/tatoeba-e5.npz, the "none of these"
embeddings that the service loads at start-up.

How this file is made in the long term is still to be decided.

Run with:   venv/bin/python -m scripts.make_background
"""
# core dependencies
import hashlib
import json
# external dependencies
import numpy as np
# local dependencies
from app.encoder import E5Encoder
from app.resources import BACKGROUND_FILE, CURRENT_CALIBRATION, ENCODER_REVISION, LANGUAGES, ROOT, load_calibrations

TATOEBA = ROOT / "data" / "tatoeba-background.json"


def main():
    with open(TATOEBA, "rb") as f:
        raw = f.read()
    sha256 = hashlib.sha256(raw).hexdigest()
    curve = load_calibrations()[CURRENT_CALIBRATION]
    if sha256 != curve.backgroundsha256:
        raise SystemExit(f"{TATOEBA} isn't the file {curve.id} was fitted with")
    sentences = json.loads(raw.decode("utf-8"))

    encoder = E5Encoder()
    embeddings = {language: encoder.embed(sentences[language]) for language in LANGUAGES}

    BACKGROUND_FILE.parent.mkdir(exist_ok=True)
    np.savez(BACKGROUND_FILE, tatoebasha256=np.array(sha256), encoderrevision=np.array(ENCODER_REVISION), **embeddings)
    print(f"wrote {BACKGROUND_FILE}")


if __name__ == "__main__":
    main()
