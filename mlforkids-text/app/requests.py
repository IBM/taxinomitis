"""
Reading and checking request bodies

Nothing here cleans the text: the caller does that, and this only checks
the limits.
"""
# core dependencies
import base64
import json
# external dependencies
from fastapi import Request
# local dependencies
from app.errors import ApiError
from app.resources import LANGUAGES
from app.training import Training

MAX_BODY_BYTES = 10 * 1024 * 1024
MAX_TEXT_LENGTH = 2048
MAX_LABEL_LENGTH = 200
MAX_EXAMPLE_LENGTH = 1024
MAX_TRAINING_CHARACTERS = 2_000_000


async def read_json(request: Request, error_code: str) -> dict:
    """the request body, which must be a JSON object"""
    try:
        body = json.loads(await _read_body(request))
    except (ValueError, RecursionError):
        # RecursionError is from JSON nested too deeply to parse
        raise ApiError(400, error_code, "Request body isn't valid JSON") from None
    if not isinstance(body, dict):
        raise ApiError(400, error_code, "Request body isn't a JSON object")
    return body


async def _read_body(request: Request) -> bytes:
    too_large = ApiError(413, "request-too-large", f"Request body must be at most {MAX_BODY_BYTES // (1024 * 1024)} MB")
    # turn away a body that says it is too big without reading it. The
    #  count while reading covers bodies that don't say, or say wrongly.
    length = request.headers.get("Content-Length", "")
    if length.isdigit() and int(length) > MAX_BODY_BYTES:
        raise too_large
    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_BODY_BYTES:
            raise too_large
    return bytes(body)


def parse_training(body: dict) -> Training:
    """the language, labels and examples in a training request"""
    def invalid(message):
        return ApiError(400, "invalid-training", message)

    language = body.get("language")
    if language not in LANGUAGES:
        raise invalid("Language is missing or not supported")

    entries = body.get("labels")
    if not isinstance(entries, list) or len(entries) < 2:
        raise invalid("Training needs at least 2 labels")

    labels, examples = [], []
    for entry in entries:
        if not isinstance(entry, dict):
            raise invalid("Each label must be an object")
        label = entry.get("label")
        if not isinstance(label, str) or not 1 <= len(label) <= MAX_LABEL_LENGTH:
            raise invalid(f"Label names must be 1-{MAX_LABEL_LENGTH} characters")
        label_examples = entry.get("examples")
        if not isinstance(label_examples, list) or len(label_examples) < 1:
            raise invalid("Each label needs at least 1 example")
        for example in label_examples:
            if not isinstance(example, str) or not 1 <= len(example) <= MAX_EXAMPLE_LENGTH:
                raise invalid(f"Examples must be 1-{MAX_EXAMPLE_LENGTH} characters")
        labels.append(label)
        examples.append(label_examples)

    if len(set(labels)) != len(labels):
        raise invalid("Label names must be unique")

    if sum(len(example) for label_examples in examples for example in label_examples) > MAX_TRAINING_CHARACTERS:
        raise ApiError(400, "training-too-large",
                       f"Training must be at most {MAX_TRAINING_CHARACTERS} characters of examples in total")

    return Training(language=language, labels=labels, examples=examples)


def parse_text(body: dict) -> str:
    """the text in a classify request"""
    text = body.get("text")
    if not isinstance(text, str) or text == "":
        raise ApiError(400, "invalid-text", "Text to classify is missing or empty")
    if len(text) > MAX_TEXT_LENGTH:
        raise ApiError(400, "text-too-long", f"Text to classify must be at most {MAX_TEXT_LENGTH} characters")
    return text


def parse_model(body: dict) -> bytes | None:
    """the model blob in a classify request, or None if it was left out"""
    encoded = body.get("model")
    if encoded is None:
        return None
    if not isinstance(encoded, str):
        raise ApiError(400, "invalid-model", "Model isn't a string")
    try:
        return base64.b64decode(encoded, validate=True)
    except ValueError:
        raise ApiError(400, "invalid-model", "Model isn't valid base64") from None
