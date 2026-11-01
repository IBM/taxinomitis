"""
The model blob: a versioned binary format holding one trained model.

    bytes 0-6    ASCII "MLFKTXT"
    byte  7      format version (unsigned byte)
    bytes 8-11   header length (unsigned 32-bit, little-endian)
    header       UTF-8 JSON
    weights      float16, (labels + 1) x dims, "none of these" row last
    intercepts   float16, labels + 1

Blobs arrive in classify requests, so decoding treats them as untrusted:
plain arithmetic only (never pickle), and every length and count is
checked against the actual size of the blob before anything is read.
"""
# core dependencies
import json
import struct
from dataclasses import dataclass
# external dependencies
import numpy as np

MAGIC = b"MLFKTXT"
FORMAT_VERSION = 1
SUPPORTED_FORMATS = [FORMAT_VERSION]

_PREFIX_LENGTH = len(MAGIC) + 1 + 4
_FLOAT16 = np.dtype("<f2")


class InvalidModel(Exception):
    """the blob isn't a valid model"""


class NeedsRetraining(Exception):
    """a valid model, but made with something this service no longer supports"""


@dataclass(frozen=True)
class Model:
    modelid: str
    created: str
    language: str
    labels: list[str]
    encoder: str
    encoderrevision: str
    dims: int
    calibration: str
    weights: np.ndarray       # float16, (labels + 1) x dims
    intercepts: np.ndarray    # float16, labels + 1


def decode_model(data: bytes, *, encoder: str, encoderrevision: str, dims: int, calibrations) -> Model:
    if len(data) < _PREFIX_LENGTH or data[:len(MAGIC)] != MAGIC:
        raise InvalidModel("not a model blob")
    version = data[len(MAGIC)]
    if version not in SUPPORTED_FORMATS:
        raise NeedsRetraining("unsupported format version")
    (headerlength,) = struct.unpack_from("<I", data, len(MAGIC) + 1)
    if headerlength > len(data) - _PREFIX_LENGTH:
        raise InvalidModel("header length is longer than the blob")
    header = _parse_header(data[_PREFIX_LENGTH:_PREFIX_LENGTH + headerlength])

    # first, whether the blob is intact by its own header, so a corrupt
    #  blob is reported as invalid whichever encoder it names
    classes = len(header["labels"]) + 1
    headerdims = header["dims"]
    expected = _PREFIX_LENGTH + headerlength + (classes * headerdims + classes) * _FLOAT16.itemsize
    if len(data) != expected:
        raise InvalidModel("blob size doesn't match its header")

    offset = _PREFIX_LENGTH + headerlength
    weights = np.frombuffer(data, dtype=_FLOAT16, count=classes * headerdims, offset=offset).reshape(classes, headerdims)
    offset += classes * headerdims * _FLOAT16.itemsize
    intercepts = np.frombuffer(data, dtype=_FLOAT16, count=classes, offset=offset)
    if not (np.isfinite(weights).all() and np.isfinite(intercepts).all()):
        raise InvalidModel("weights aren't finite numbers")

    # then, whether this service can still use it. An older encoder may
    #  have had other dims, so the dims are only checked after this.
    if header["encoder"] != encoder or header["encoderrevision"] != encoderrevision:
        raise NeedsRetraining("model was made with a different encoder")
    if header["calibration"] not in calibrations:
        raise NeedsRetraining("unknown calibration")

    if headerdims != dims:
        raise InvalidModel("dims don't match the encoder")

    return Model(weights=weights, intercepts=intercepts, **header)


_HEADER_STRINGS = ["modelid", "created", "language", "encoder", "encoderrevision", "calibration"]


def _parse_header(raw: bytes) -> dict:
    try:
        header = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise InvalidModel("header isn't UTF-8 JSON") from None
    if not isinstance(header, dict) or set(header) != set(_HEADER_STRINGS) | {"labels", "dims"}:
        raise InvalidModel("header doesn't have the expected fields")
    if not all(isinstance(header[k], str) for k in _HEADER_STRINGS):
        raise InvalidModel("header field has the wrong type")
    labels = header["labels"]
    if (not isinstance(labels, list) or len(labels) < 2
            or not all(isinstance(l, str) for l in labels) or len(set(labels)) != len(labels)):
        raise InvalidModel("header labels aren't valid")
    dims = header["dims"]
    if type(dims) is not int or dims < 1:
        raise InvalidModel("header dims isn't valid")
    return header


def encode_model(header: dict, weights: np.ndarray, intercepts: np.ndarray) -> bytes:
    headerbytes = json.dumps(header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return (MAGIC + bytes([FORMAT_VERSION])
            + struct.pack("<I", len(headerbytes))
            + headerbytes
            + _to_float16(weights).tobytes()
            + _to_float16(intercepts).tobytes())


def _to_float16(values: np.ndarray) -> np.ndarray:
    # via float32, as the reference implementation rounds them
    return np.ascontiguousarray(values, dtype=np.float32).astype(_FLOAT16)
