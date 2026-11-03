"""
The model blob decoder, at its own seam: blobs arrive in classify requests,
so they are untrusted input. Blobs here are built by hand from the format, 
not by the service's encoder.
"""
import json
import struct

import numpy as np
import pytest

from app.blob import InvalidModel, NeedsRetraining, decode_model

ENCODER = "intfloat/multilingual-e5-small"
REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
MODELID = "3f6c2a0e-7d1b-4f0a-9a52-8f1f2a9c4b10"


def header(**overrides):
    h = {
        "modelid": MODELID,
        "created": "2026-11-01T14:03:22Z",
        "language": "ko",
        "labels": ["happy", "sad"],
        "encoder": ENCODER,
        "encoderrevision": REVISION,
        "dims": 4,
        "calibration": "q1",
    }
    h.update(overrides)
    return h


def build(h=None, weights=None, intercepts=None, version=1, magic=b"MLFKTXT", headerlength=None):
    h = header() if h is None else h
    headerbytes = json.dumps(h).encode("utf-8") if isinstance(h, dict) else h
    if weights is None:
        weights = [[0.5, -1.0, 2.0, 0.25], [1.5, 0.0, -0.5, 3.0], [-2.0, 1.0, 0.125, -0.75]]
    if intercepts is None:
        intercepts = [0.5, -0.25, 1.0]
    return (magic + bytes([version])
            + struct.pack("<I", len(headerbytes) if headerlength is None else headerlength)
            + headerbytes
            + np.asarray(weights, dtype="<f2").tobytes()
            + np.asarray(intercepts, dtype="<f2").tobytes())


def decode(data):
    return decode_model(data, encoder=ENCODER, encoderrevision=REVISION, calibrations={"q1"}, dims=4)


def test_decodes_a_valid_blob():
    model = decode(build())
    assert model.modelid == MODELID
    assert model.language == "ko"
    assert model.labels == ["happy", "sad"]
    assert model.calibration == "q1"
    assert model.weights.tolist() == [[0.5, -1.0, 2.0, 0.25], [1.5, 0.0, -0.5, 3.0], [-2.0, 1.0, 0.125, -0.75]]
    assert model.intercepts.tolist() == [0.5, -0.25, 1.0]


def test_rejects_dims_that_dont_match_the_encoder():
    with pytest.raises(InvalidModel):
        decode_model(build(), encoder=ENCODER, encoderrevision=REVISION, calibrations={"q1"}, dims=384)


@pytest.mark.parametrize("data", [
    pytest.param(b"", id="empty"),
    pytest.param(b"MLFKTX", id="shorter than the magic"),
    pytest.param(b"MLFKTXT\x01\x00\x00", id="cut inside the header length"),
    pytest.param(build(magic=b"NOTMLFK"), id="wrong magic"),
    pytest.param(build(headerlength=100000), id="header length past the end"),
    pytest.param(build(headerlength=2 ** 32 - 1), id="huge header length"),
    pytest.param(build()[:-1], id="truncated by one byte"),
    pytest.param(build()[:-2], id="missing an intercept"),
    pytest.param(build() + b"\x00\x00", id="extra bytes at the end"),
    pytest.param(build(h=b"\xff\xfe not utf-8"), id="header not UTF-8"),
    pytest.param(build(h=b"{not json"), id="header not JSON"),
    pytest.param(build(h=b"[1, 2]"), id="header not an object"),
    pytest.param(build(h={k: v for k, v in header().items() if k != "language"}), id="header missing a field"),
    pytest.param(build(h=header(extra="x")), id="header with an extra field"),
    pytest.param(build(h=header(modelid=7)), id="modelid not a string"),
    pytest.param(build(h=header(labels="happy")), id="labels not a list"),
    pytest.param(build(h=header(labels=["happy", 3])), id="label not a string"),
    pytest.param(build(h=header(labels=["happy", "happy"])), id="duplicate labels"),
    pytest.param(build(h=header(labels=["happy"]), weights=[[0, 0, 0, 0]] * 2, intercepts=[0, 0]), id="one label"),
    pytest.param(build(h=header(dims="4")), id="dims not an integer"),
    pytest.param(build(h=header(dims=True)), id="dims a boolean"),
    pytest.param(build(h=header(labels=["a", "b", "c"])), id="more labels than weight rows"),
    pytest.param(build(intercepts=[float("nan"), 0, 0]), id="NaN intercept"),
    pytest.param(build(weights=[[float("inf"), 0, 0, 0], [0] * 4, [0] * 4]), id="infinite weight"),
])
def test_rejects_malformed_blobs(data):
    with pytest.raises(InvalidModel):
        decode(data)


@pytest.mark.parametrize("data", [
    pytest.param(build(version=2), id="newer format version"),
    pytest.param(build(version=0), id="older format version"),
    pytest.param(build(h=header(encoder="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")), id="other encoder"),
    pytest.param(build(h=header(encoderrevision="0" * 40)), id="other encoder revision"),
    pytest.param(build(h=header(calibration="q0")), id="unknown calibration"),
])
def test_asks_for_retraining_for_models_it_no_longer_supports(data):
    with pytest.raises(NeedsRetraining):
        decode(data)


def test_a_model_survives_encoding_and_decoding():
    from app.blob import encode_model
    weights = np.array([[0.1, 0.2, 0.3, 0.4], [-1, -2, -3, -4], [5, 6, 7, 8]], dtype=np.float64)
    data = encode_model(header(labels=["사과", "바나나"]), weights, np.array([0.1, 0.2, 0.3]))
    assert data[:8] == b"MLFKTXT\x01"
    model = decode(data)
    assert model.labels == ["사과", "바나나"]
    assert model.weights.dtype == np.float16
    assert model.weights.tolist() == weights.astype(np.float16).tolist()
    assert model.intercepts.tolist() == np.array([0.1, 0.2, 0.3]).astype(np.float16).tolist()


def test_a_corrupt_blob_from_another_encoder_is_invalid_not_needing_retraining():
    with pytest.raises(InvalidModel):
        decode(build(h=header(encoderrevision="0" * 40))[:-1])


def test_a_blob_from_an_encoder_with_other_dims_needs_retraining():
    eight = [[0.0] * 8] * 3
    with pytest.raises(NeedsRetraining):
        decode(build(h=header(encoderrevision="0" * 40, dims=8), weights=eight))
