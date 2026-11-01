"""
The HTTP API with the real encoder and background embeddings, checked
against reference/reference-scores.json: the scores the evaluated pipeline
gives, which calibration q1 was fitted to.

Slow: it loads e5. It needs background/tatoeba-e5.npz (scripts/make_background.py).
"""
import json

import pytest
from fastapi.testclient import TestClient

from app.resources import ROOT, load_production_resources
from app.service import create_app
from tests.conftest import AUTH, settings, wait_until_ready

with open(ROOT / "reference" / "reference-scores.json", encoding="utf-8") as f:
    REFERENCE = json.load(f)
TOLERANCE = REFERENCE["tolerance"]


@pytest.fixture(scope="module")
def loaded():
    resources = load_production_resources()
    with TestClient(create_app(lambda: resources, settings()), raise_server_exceptions=False) as client:
        client.auth = AUTH
        wait_until_ready(client)
        yield client, resources


@pytest.fixture(scope="module")
def trained(loaded):
    client, _ = loaded
    models = {}
    for project in REFERENCE["projects"]:
        response = client.post("/models", json=project["request"])
        assert response.status_code == 200, response.text
        models[project["name"]] = response.json()
    return models


def test_reference_is_for_this_service(loaded):
    client, _ = loaded
    health = client.get("/").json()
    assert health["encoder"] == REFERENCE["encoder"]
    assert health["encoderrevision"] == REFERENCE["encoderrevision"]
    assert health["currentcalibration"] == REFERENCE["calibration"]


@pytest.mark.parametrize("reference", REFERENCE["embeddings"], ids=lambda e: e["text"][:20])
def test_encoder_matches_the_reference(loaded, reference):
    # checked so that an encoder mismatch can be told apart from a model mismatch
    _, resources = loaded
    embedding = resources.encoder.embed([reference["text"]])[0]
    assert embedding[:8].tolist() == pytest.approx(reference["first8"], abs=TOLERANCE["embedding"])


CASES = [(project["name"], test) for project in REFERENCE["projects"] for test in project["tests"]]


@pytest.mark.parametrize("name,reference", CASES, ids=[f"{n}: {t['text'][:20]}" for n, t in CASES])
def test_classify_matches_the_reference(loaded, trained, name, reference):
    client, _ = loaded
    model = trained[name]
    response = client.post(f"/models/{model['modelid']}/classify", json={"text": reference["text"], "model": model["model"]})

    if "expectederror" in reference:
        assert response.status_code == 400
        assert response.json()["error"] == reference["expectederror"]
        return

    assert response.status_code == 200, response.text
    classes = response.json()["classes"]
    confidences = {c["label"]: c["confidence"] for c in classes}
    expected = {c["label"]: c["confidence"] for c in reference["expected"]}
    assert confidences == pytest.approx(expected, abs=TOLERANCE["confidence"])

    # labels whose expected confidences are within the tolerance of each
    #  other could fairly come out in either order
    order = [c["label"] for c in classes]
    ranked = reference["expected"]
    for i, higher in enumerate(ranked):
        for lower in ranked[i + 1:]:
            if higher["confidence"] - lower["confidence"] > TOLERANCE["confidence"]:
                assert order.index(higher["label"]) < order.index(lower["label"])
