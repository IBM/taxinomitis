import logging

import pytest

from app.accesslog import ACCESS_LOGGER, ProbeRequestsAtDebug


def access_record(method, path, status=200):
    # as uvicorn logs each request
    return logging.LogRecord(ACCESS_LOGGER, logging.INFO, __file__, 0,
                             '%s - "%s %s HTTP/%s" %d', ("127.0.0.1:60474", method, path, "1.1", status), None)


@pytest.fixture
def access_logger_level():
    logger = logging.getLogger(ACCESS_LOGGER)
    original = logger.level
    yield logger.setLevel
    logger.setLevel(original)


@pytest.mark.parametrize("status", [200, 503])
def test_probe_requests_are_dropped_at_info(access_logger_level, status):
    access_logger_level(logging.INFO)
    assert ProbeRequestsAtDebug().filter(access_record("GET", "/", status)) is False


def test_probe_requests_are_logged_as_debug_at_debug(access_logger_level):
    access_logger_level(logging.DEBUG)
    record = access_record("GET", "/")
    assert ProbeRequestsAtDebug().filter(record) is True
    assert record.levelno == logging.DEBUG
    assert record.levelname == "DEBUG"


@pytest.mark.parametrize("method,path", [
    ("POST", "/models"),
    ("POST", "/models/abc/classify"),
    ("GET", "/models"),
    ("GET", "/?check=1"),
    ("POST", "/"),
])
def test_other_requests_are_left_at_info(access_logger_level, method, path):
    access_logger_level(logging.INFO)
    record = access_record(method, path)
    assert ProbeRequestsAtDebug().filter(record) is True
    assert record.levelno == logging.INFO


def test_records_without_request_arguments_are_left_alone(access_logger_level):
    access_logger_level(logging.INFO)
    record = logging.LogRecord(ACCESS_LOGGER, logging.INFO, __file__, 0, "something else", None, None)
    assert ProbeRequestsAtDebug().filter(record) is True
