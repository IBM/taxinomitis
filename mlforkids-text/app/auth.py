"""
HTTP basic auth, needed on every endpoint except GET /.
"""
# core dependencies
import base64
import secrets
from typing import Callable
# external dependencies
from fastapi import Request
# local dependencies
from app.errors import ApiError


def basic_auth_check(username: str, password: str) -> Callable[[Request], None]:
    """a FastAPI dependency that refuses requests without these credentials"""
    expected = f"{username}:{password}".encode("utf-8")

    def check(request: Request):
        scheme, _, encoded = request.headers.get("Authorization", "").partition(" ")
        try:
            credentials = base64.b64decode(encoded, validate=True)
        except ValueError:
            credentials = b""
        if scheme.lower() != "basic" or not secrets.compare_digest(credentials, expected):
            raise ApiError(401, "unauthorized", "Missing or incorrect credentials",
                           headers={"WWW-Authenticate": "Basic"})

    return check
