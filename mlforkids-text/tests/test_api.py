"""
The HTTP API, with a stand-in encoder (tests/standins.py), for everything
that isn't about reproducing the q1 pipeline's scores.
"""
import base64
import json
import logging
import threading
import time

import pytest
from fastapi.testclient import TestClient

from app.resources import Resources
from app.service import create_app
from tests.conftest import AUTH, settings, wait_until_ready
from tests.standins import HeldLoader
from tests.test_blob import build, header


def test_reports_ready_once_loaded(client):
    response = client.get("/", auth=None)
    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "encoder": "intfloat/multilingual-e5-small",
        "encoderrevision": "614241f622f53c4eeff9890bdc4f31cfecc418b3",
        "formats": [1],
        "calibrations": ["q1"],
        "currentcalibration": "q1",
    }


def test_reports_starting_until_loaded(resources):
    loader = HeldLoader(resources)
    with TestClient(create_app(loader, settings())) as client:
        response = client.get("/")
        assert response.status_code == 503
        assert response.json() == {"status": "starting"}

        loader.event.set()
        wait_until_ready(client)


FEELINGS = {
    "language": "en",
    "labels": [
        {"label": "happy", "examples": ["I love this", "what a great day", "brilliant news"]},
        {"label": "sad", "examples": ["I feel awful", "this is the worst", "terrible news"]},
    ],
}


def train(client, request=FEELINGS):
    response = client.post("/models", json=request)
    assert response.status_code == 200, response.text
    return response.json()


def classify(client, trained, text, include_model=True):
    body = {"text": text}
    if include_model:
        body["model"] = trained["model"]
    return client.post(f"/models/{trained['modelid']}/classify", json=body)


def test_trains_a_model_that_recognises_its_own_examples(client):
    trained = train(client)
    assert set(trained) == {"modelid", "model", "labels", "calibration"}
    assert trained["labels"] == ["happy", "sad"]
    assert trained["calibration"] == "q1"

    response = classify(client, trained, "terrible news")
    assert response.status_code == 200
    result = response.json()
    assert result["modelid"] == trained["modelid"]
    assert [c["label"] for c in result["classes"]] == ["sad", "happy"]
    assert result["classes"][0]["confidence"] > result["classes"][1]["confidence"]


def assert_error(response, status, code):
    assert response.status_code == status, response.text
    body = response.json()
    assert set(body) == {"error", "message"}
    assert body["error"] == code


@pytest.mark.parametrize("body", [
    pytest.param({}, id="missing"),
    pytest.param({"text": ""}, id="empty"),
    pytest.param({"text": None}, id="null"),
    pytest.param({"text": 42}, id="not a string"),
])
def test_rejects_missing_or_empty_text(client, body):
    trained = train(client)
    response = client.post(f"/models/{trained['modelid']}/classify", json={**body, "model": trained["model"]})
    assert_error(response, 400, "invalid-text")


def test_rejects_text_over_2048_characters(client):
    trained = train(client)
    assert_error(classify(client, trained, "é" * 2049), 400, "text-too-long")


def test_accepts_text_of_2048_characters(client):
    # characters are code points: this is 2048 characters but more bytes
    trained = train(client)
    assert classify(client, trained, "é" * 2048).status_code == 200


@pytest.mark.parametrize("raw", [b"not json", b"[1, 2]", b"\xff\xfe"])
def test_rejects_a_classify_body_that_isnt_a_json_object(client, raw):
    trained = train(client)
    response = client.post(f"/models/{trained['modelid']}/classify", content=raw,
                           headers={"Content-Type": "application/json"})
    assert_error(response, 400, "invalid-text")


def test_classifies_straight_after_training_without_the_model(client):
    trained = train(client)
    response = classify(client, trained, "terrible news", include_model=False)
    assert response.status_code == 200
    assert response.json()["classes"][0]["label"] == "sad"


def test_says_when_a_model_left_out_isnt_cached(client):
    response = client.post("/models/3f6c2a0e-7d1b-4f0a-9a52-8f1f2a9c4b10/classify", json={"text": "hello"})
    assert_error(response, 404, "model-not-cached")


def test_caches_a_model_sent_with_a_classify_request(resources):
    with TestClient(create_app(lambda: resources, settings())) as first, \
         TestClient(create_app(lambda: resources, settings())) as second:
        for c in (first, second):
            c.auth = AUTH
            wait_until_ready(c)
        trained = train(first)

        # a different instance, which didn't train it
        assert_error(classify(second, trained, "terrible news", include_model=False), 404, "model-not-cached")
        assert classify(second, trained, "terrible news").status_code == 200
        assert classify(second, trained, "terrible news", include_model=False).status_code == 200


def test_cache_drops_the_least_recently_used_model(resources):
    with TestClient(create_app(lambda: resources, settings(cache_size=2))) as client:
        client.auth = AUTH
        wait_until_ready(client)
        first, second = train(client), train(client)
        assert classify(client, first, "terrible news", include_model=False).status_code == 200
        third = train(client)

        assert classify(client, first, "terrible news", include_model=False).status_code == 200
        assert classify(client, third, "terrible news", include_model=False).status_code == 200
        assert_error(classify(client, second, "terrible news", include_model=False), 404, "model-not-cached")


def test_cache_entries_expire(resources):
    with TestClient(create_app(lambda: resources, settings(cache_ttl_seconds=1))) as client:
        client.auth = AUTH
        wait_until_ready(client)
        trained = train(client)
        time.sleep(1.2)
        assert_error(classify(client, trained, "terrible news", include_model=False), 404, "model-not-cached")


@pytest.mark.parametrize("model", [
    pytest.param("not base64!", id="not base64"),
    pytest.param("TUxGS1RYVAE", id="unpadded"),
    pytest.param("TUxGS1RYVAEAAAAA", id="truncated blob"),
    pytest.param(12345, id="not a string"),
    pytest.param(["TUxGS1RYVAE="], id="a list"),
])
def test_rejects_an_invalid_model(client, model):
    trained = train(client)
    response = client.post(f"/models/{trained['modelid']}/classify", json={"text": "hello", "model": model})
    assert_error(response, 400, "invalid-model")


def test_rejects_a_model_sent_for_a_different_model_id(client):
    trained = train(client)
    response = client.post("/models/00000000-0000-0000-0000-000000000000/classify",
                           json={"text": "hello", "model": trained["model"]})
    assert_error(response, 400, "invalid-model")


def blob_for(**header_overrides):
    h = header(dims=384, **header_overrides)
    return base64.b64encode(build(h=h, weights=[[0.0] * 384] * 3, intercepts=[0.0] * 3)).decode("ascii")


@pytest.mark.parametrize("labels", [["happy", "sad"], ["sad", "happy"]])
def test_equal_confidences_keep_the_model_label_order(client, labels):
    # all-zero weights give every class the same probability.
    #  The blob was made outside this instance, which is enough on its own.
    response = client.post("/models/3f6c2a0e-7d1b-4f0a-9a52-8f1f2a9c4b10/classify",
                           json={"text": "hello", "model": blob_for(labels=labels)})
    assert response.status_code == 200
    classes = response.json()["classes"]
    assert [c["label"] for c in classes] == labels
    assert classes[0]["confidence"] == classes[1]["confidence"]


@pytest.mark.parametrize("overrides", [
    pytest.param({"encoderrevision": "0" * 40}, id="other encoder revision"),
    pytest.param({"calibration": "q0"}, id="unknown calibration"),
])
def test_asks_for_retraining(client, overrides):
    response = client.post("/models/3f6c2a0e-7d1b-4f0a-9a52-8f1f2a9c4b10/classify",
                           json={"text": "hello", "model": blob_for(**overrides)})
    assert_error(response, 409, "needs-retraining")


def with_labels(*labels, language="en"):
    return {"language": language, "labels": list(labels)}


HAPPY = {"label": "happy", "examples": ["I love this"]}
SAD = {"label": "sad", "examples": ["I feel awful"]}


@pytest.mark.parametrize("request_body", [
    pytest.param({"labels": [HAPPY, SAD]}, id="no language"),
    pytest.param(with_labels(HAPPY, SAD, language="klingon"), id="unknown language"),
    pytest.param(with_labels(HAPPY, SAD, language="EN"), id="language in capitals"),
    pytest.param(with_labels(HAPPY, SAD, language=None), id="language null"),
    pytest.param({"language": "en"}, id="no labels"),
    pytest.param({"language": "en", "labels": {"happy": ["I love this"]}}, id="labels not a list"),
    pytest.param(with_labels(HAPPY), id="one label"),
    pytest.param(with_labels(), id="no labels in the list"),
    pytest.param(with_labels(HAPPY, "sad"), id="label entry not an object"),
    pytest.param(with_labels(HAPPY, {"examples": ["I feel awful"]}), id="label name missing"),
    pytest.param(with_labels(HAPPY, {"label": "", "examples": ["I feel awful"]}), id="label name empty"),
    pytest.param(with_labels(HAPPY, {"label": "s" * 201, "examples": ["I feel awful"]}), id="label name 201 characters"),
    pytest.param(with_labels(HAPPY, {"label": 7, "examples": ["I feel awful"]}), id="label name not a string"),
    pytest.param(with_labels(HAPPY, {"label": "happy", "examples": ["I feel awful"]}), id="duplicate label"),
    pytest.param(with_labels(HAPPY, {"label": "sad"}), id="examples missing"),
    pytest.param(with_labels(HAPPY, {"label": "sad", "examples": []}), id="no examples"),
    pytest.param(with_labels(HAPPY, {"label": "sad", "examples": "I feel awful"}), id="examples not a list"),
    pytest.param(with_labels(HAPPY, {"label": "sad", "examples": [""]}), id="empty example"),
    pytest.param(with_labels(HAPPY, {"label": "sad", "examples": ["x" * 1025]}), id="example 1025 characters"),
    pytest.param(with_labels(HAPPY, {"label": "sad", "examples": [None]}), id="example not a string"),
])
def test_rejects_invalid_training(client, request_body):
    assert_error(client.post("/models", json=request_body), 400, "invalid-training")


@pytest.mark.parametrize("raw", [b"not json", b"[]", b"\xff"])
def test_rejects_a_training_body_that_isnt_a_json_object(client, raw):
    response = client.post("/models", content=raw, headers={"Content-Type": "application/json"})
    assert_error(response, 400, "invalid-training")


def test_accepts_the_longest_label_names_and_examples(client):
    # characters are code points
    trained = train(client, with_labels({"label": "한" * 200, "examples": ["글" * 1024]}, SAD))
    assert trained["labels"] == ["한" * 200, "sad"]


def test_returns_labels_exactly_as_given_and_in_order(client):
    labels = ["  Zebra ", "apple", "ÄPFEL", "🙂"]
    trained = train(client, with_labels(*[{"label": l, "examples": [f"example for {i}"]} for i, l in enumerate(labels)]))
    assert trained["labels"] == labels
    result = classify(client, trained, "example for 2").json()
    assert sorted(c["label"] for c in result["classes"]) == sorted(labels)
    assert result["classes"][0]["label"] == "ÄPFEL"


@pytest.mark.parametrize("language", ["en", "ar", "zh-tw", "zh-cn", "cs", "nl", "fr", "de", "it", "ja", "ko", "pt-br", "es", "xx"])
def test_accepts_every_language(client, language):
    train(client, with_labels(HAPPY, SAD, language=language))


def examples_totalling(characters):
    examples = ["x" * 1024] * (characters // 1024)
    if characters % 1024:
        examples.append("y" * (characters % 1024))
    return examples


def test_accepts_2000000_characters(client):
    train(client, with_labels(HAPPY, {"label": "big", "examples": examples_totalling(2_000_000 - len("I love this"))}))


def test_rejects_more_than_2000000_characters(client):
    request_body = with_labels(HAPPY, {"label": "big", "examples": examples_totalling(2_000_001 - len("I love this"))})
    assert_error(client.post("/models", json=request_body), 400, "training-too-large")


CLASSIFY_PATH = "/models/3f6c2a0e-7d1b-4f0a-9a52-8f1f2a9c4b10/classify"


@pytest.mark.parametrize("path,body", [("/models", FEELINGS), (CLASSIFY_PATH, {"text": "hello"})])
@pytest.mark.parametrize("auth", [
    pytest.param(None, id="no credentials"),
    pytest.param((AUTH[0], "wrong"), id="wrong password"),
    pytest.param(("wrong", AUTH[1]), id="wrong username"),
])
def test_needs_credentials(client, path, body, auth):
    response = client.post(path, json=body, auth=auth)
    assert_error(response, 401, "unauthorized")
    assert response.headers["WWW-Authenticate"] == "Basic"


@pytest.mark.parametrize("header", ["Basic !!!not-base64", "Basic bm9jb2xvbg==", "Bearer abc"])
def test_rejects_malformed_credentials(client, header):
    response = client.post("/models", json=FEELINGS, auth=None, headers={"Authorization": header})
    assert_error(response, 401, "unauthorized")


@pytest.mark.parametrize("path,body", [("/models", FEELINGS), (CLASSIFY_PATH, {"text": "hello"})])
def test_says_when_still_starting(resources, path, body):
    loader = HeldLoader(resources)
    with TestClient(create_app(loader, settings())) as client:
        response = client.post(path, json=body, auth=AUTH)
        assert_error(response, 503, "starting")
        loader.event.set()


def start_held_training(client, resources, held_text):
    """starts a training in another thread that waits inside the encoder until released"""
    release = threading.Event()
    resources.encoder.held_texts[held_text] = release
    result = {}
    thread = threading.Thread(target=lambda: result.update(response=client.post(
        "/models", json=with_labels(HAPPY, {"label": "slow", "examples": [held_text]}))))
    thread.start()
    deadline = time.monotonic() + 10
    while not any(held_text in call for call in resources.encoder.calls):
        assert time.monotonic() < deadline, "training never started"
        time.sleep(0.01)
    return release, thread, result


def test_says_busy_when_already_training(client, resources):
    trained = train(client)
    release, thread, result = start_held_training(client, resources, "a slow example")
    try:
        response = client.post("/models", json=FEELINGS)
        assert_error(response, 503, "busy")
        assert response.headers["Retry-After"] == "30"

        # classify requests are still served
        assert classify(client, trained, "terrible news").status_code == 200
    finally:
        release.set()
        thread.join(timeout=30)

    assert result["response"].status_code == 200
    train(client)


def test_allows_the_configured_number_of_trainings_at_once(resources):
    with TestClient(create_app(lambda: resources, settings(max_trainings=2))) as client:
        client.auth = AUTH
        wait_until_ready(client)
        first = start_held_training(client, resources, "first slow example")
        second = start_held_training(client, resources, "second slow example")
        try:
            assert_error(client.post("/models", json=FEELINGS), 503, "busy")
        finally:
            for release, thread, _ in (first, second):
                release.set()
                thread.join(timeout=30)
        assert first[2]["response"].status_code == 200
        assert second[2]["response"].status_code == 200


class BrokenOnce:
    """an encoder that fails the first time, with student text in its error"""
    def __init__(self, encoder):
        self.encoder, self.broken = encoder, True
        self.name, self.revision, self.dims = encoder.name, encoder.revision, encoder.dims

    def embed(self, texts):
        if self.broken:
            self.broken = False
            raise RuntimeError(f"encoder failed on {texts}")
        return self.encoder.embed(texts)


def test_frees_its_place_when_a_training_fails(resources, caplog):
    broken = Resources(encoder=BrokenOnce(resources.encoder), background=resources.background,
                       calibrations=resources.calibrations)
    with TestClient(create_app(lambda: broken, settings()), raise_server_exceptions=False) as client:
        client.auth = AUTH
        wait_until_ready(client)
        with caplog.at_level(logging.DEBUG):
            response = client.post("/models", json=with_labels(
                HAPPY, {"label": "label-PRIVATE-1", "examples": ["example-PRIVATE-2"]}))
        assert_error(response, 500, "internal-error")
        assert "PRIVATE" not in response.text
        assert "PRIVATE" not in caplog.text
        assert "RuntimeError" in caplog.text
        train(client)


def test_unknown_paths_have_the_error_body(client):
    assert_error(client.get("/nothing-here"), 404, "not-found")


def test_wrong_methods_have_the_error_body(client):
    assert_error(client.get("/models"), 405, "method-not-allowed")


TEN_MB = 10 * 1024 * 1024


def padded(body, size):
    raw = json.dumps(body).encode("utf-8")
    return raw + b" " * (size - len(raw))


@pytest.mark.parametrize("path,body", [("/models", FEELINGS), (CLASSIFY_PATH, {"text": "hello"})])
def test_rejects_a_body_over_10mb(client, path, body):
    response = client.post(path, content=padded(body, TEN_MB + 1), headers={"Content-Type": "application/json"})
    assert_error(response, 413, "request-too-large")


def test_rejects_a_streamed_body_over_10mb(client):
    def chunks():
        yield b'{"text": "hello"'
        for _ in range(11):
            yield b" " * (1024 * 1024)
        yield b"}"
    response = client.post(CLASSIFY_PATH, content=chunks(), headers={"Content-Type": "application/json"})
    assert "Content-Length" not in response.request.headers
    assert_error(response, 413, "request-too-large")


def test_accepts_a_body_of_10mb(client):
    trained = train(client)
    response = client.post(f"/models/{trained['modelid']}/classify",
                           content=padded({"text": "hello", "model": trained["model"]}, TEN_MB),
                           headers={"Content-Type": "application/json"})
    assert response.status_code == 200


def test_logs_never_contain_student_text_or_labels(client, caplog):
    secret_label, secret_example, secret_text = "label-PRIVATE-1", "example-PRIVATE-2", "text-PRIVATE-3"
    request_body = with_labels(HAPPY, {"label": secret_label, "examples": [secret_example]})
    with caplog.at_level(logging.DEBUG):
        trained = train(client, request_body)
        assert classify(client, trained, secret_text).status_code == 200
        # and in errors
        assert client.post("/models", json=with_labels({"label": secret_label, "examples": [secret_example]})).status_code == 400
        assert classify(client, trained, secret_text * 300).status_code == 400
        assert client.post(f"/models/{trained['modelid']}/classify",
                           json={"text": secret_text, "model": secret_label}).status_code == 400

    service_logs = "\n".join(r.getMessage() for r in caplog.records if r.name.startswith("app"))
    assert trained["modelid"] in service_logs
    assert "PRIVATE" not in caplog.text


def test_gives_up_when_loading_fails():
    failed = threading.Event()

    def broken_loader():
        raise FileNotFoundError("background/tatoeba-e5.npz")

    with TestClient(create_app(broken_loader, settings(), on_load_failure=failed.set)) as client:
        assert failed.wait(timeout=10)
        assert client.get("/").status_code == 503


@pytest.mark.parametrize("path,code", [("/models", "invalid-training"), (CLASSIFY_PATH, "invalid-text")])
def test_rejects_deeply_nested_json(client, path, code):
    response = client.post(path, content=b"[" * 100_000, headers={"Content-Type": "application/json"})
    assert_error(response, 400, code)


@pytest.mark.parametrize("path", ["/models", CLASSIFY_PATH])
def test_a_caller_disconnecting_mid_request_isnt_logged_as_an_error(resources, caplog, path):
    # driven through ASGI, because an HTTP client can't hang up partway through its own request
    app = create_app(lambda: resources, settings())
    credentials = base64.b64encode(f"{AUTH[0]}:{AUTH[1]}".encode()).decode()
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST",
        "scheme": "http", "path": path, "raw_path": path.encode(), "root_path": "", "query_string": b"",
        "headers": [(b"content-type", b"application/json"), (b"authorization", f"Basic {credentials}".encode())],
        "client": ("127.0.0.1", 1234), "server": ("testserver", 80),
    }
    messages = iter([{"type": "http.request", "body": b'{"text": "hel', "more_body": True},
                     {"type": "http.disconnect"}])
    sent = []

    async def receive():
        return next(messages)

    async def send(message):
        sent.append(message)

    with TestClient(app) as client:
        wait_until_ready(client)
        with caplog.at_level(logging.INFO):
            client.portal.call(app, scope, receive, send)

    assert not [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert "client disconnected" in caplog.text
