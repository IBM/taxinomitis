"""
Checks a running mlforkids-text service, at a URL, against the reference
scores in reference/reference-scores.json: the scores that calibration q1
was fitted to

It waits for the service to be ready, then trains every reference project
and classifies every reference input through the API. It needs only the
Python standard library.

Run with:   ../venv/bin/python check-service.py <url>   (or any Python 3)
Credentials come from the VERIFY_USER and VERIFY_PASSWORD environment variables.
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REFERENCE = Path(__file__).resolve().parent.parent / "reference" / "reference-scores.json"
READY_TIMEOUT_SECONDS = 300


def request(url, body=None, auth=None, timeout=600):
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = "Basic " + base64.b64encode(auth.encode("utf-8")).decode("ascii")
    data = json.dumps(body).encode("utf-8") if body is not None else None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data, headers), timeout=timeout) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def wait_until_ready(url):
    deadline = time.monotonic() + READY_TIMEOUT_SECONDS
    while True:
        try:
            status, body = request(url + "/", timeout=10)
            if status == 200:
                return body
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            pass
        if time.monotonic() > deadline:
            sys.exit(f"FAILED: {url} wasn't ready after {READY_TIMEOUT_SECONDS} s")
        time.sleep(2)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    url = sys.argv[1].rstrip("/")
    auth = f"{os.environ['VERIFY_USER']}:{os.environ['VERIFY_PASSWORD']}"
    with open(REFERENCE, encoding="utf-8") as f:
        reference = json.load(f)
    tolerance = reference["tolerance"]["confidence"]
    failures = []

    print(f"waiting for {url} to be ready")
    health = wait_until_ready(url)
    for key in ("encoder", "encoderrevision"):
        if health[key] != reference[key]:
            failures.append(f"health check: {key} is {health[key]}, reference is {reference[key]}")
    if health["currentcalibration"] != reference["calibration"]:
        failures.append(f"health check: current calibration is {health['currentcalibration']}")

    status, body = request(url + "/models", reference["projects"][0]["request"])
    if status != 401:
        failures.append(f"training without credentials returned {status}, not 401")

    for project in reference["projects"]:
        started = time.monotonic()
        status, trained = request(url + "/models", project["request"], auth)
        if status != 200:
            failures.append(f"{project['name']}: training returned {status} {trained}")
            continue
        print(f"{project['name']}: trained in {time.monotonic() - started:.1f} s")

        for test in project["tests"]:
            status, result = request(f"{url}/models/{trained['modelid']}/classify",
                                     {"text": test["text"], "model": trained["model"]}, auth)
            name = f"{project['name']}: {test['text'][:20]!r}"
            if "expectederror" in test:
                if status != 400 or result.get("error") != test["expectederror"]:
                    failures.append(f"{name}: expected {test['expectederror']}, got {status} {result}")
                continue
            if status != 200:
                failures.append(f"{name}: classify returned {status} {result}")
                continue
            confidences = {c["label"]: c["confidence"] for c in result["classes"]}
            for expected in test["expected"]:
                actual = confidences.get(expected["label"])
                if actual is None or abs(actual - expected["confidence"]) > tolerance:
                    failures.append(f"{name}: {expected['label']} is {actual}, reference is {expected['confidence']}")

    if failures:
        print("FAILED:")
        for failure in failures:
            print("  " + failure)
        sys.exit(1)
    print("all reference checks passed")


if __name__ == "__main__":
    main()
