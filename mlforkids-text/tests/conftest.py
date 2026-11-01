import time

import pytest
from fastapi.testclient import TestClient

from app.service import create_app
from app.settings import Settings
from tests.standins import standin_resources

AUTH = ("testuser", "testpassword")


def settings(**overrides):
    values = dict(username=AUTH[0], password=AUTH[1], cache_size=100, cache_ttl_seconds=3600, max_trainings=1)
    values.update(overrides)
    return Settings(**values)


def wait_until_ready(client):
    deadline = time.monotonic() + 300
    while client.get("/").status_code != 200:
        assert time.monotonic() < deadline, "service never became ready"
        time.sleep(0.01)


@pytest.fixture
def resources():
    return standin_resources()


@pytest.fixture
def client(resources):
    app = create_app(lambda: resources, settings())
    with TestClient(app, raise_server_exceptions=False) as c:
        c.auth = AUTH
        wait_until_ready(c)
        yield c
