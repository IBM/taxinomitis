# core dependencies
from collections.abc import Mapping


class ApiError(Exception):
    """
    an error response: { "error": code, "message": message }

    messages are for logs, and must never include student text or label names
    """
    def __init__(self, status: int, code: str, message: str, headers: Mapping[str, str] | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers
