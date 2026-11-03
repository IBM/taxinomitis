"""
Logs the readiness probe's requests at DEBUG

Code Engine checks GET / every few seconds, and uvicorn logs every request
at INFO, so without this the probe's requests fill the log.
"""
# core dependencies
import logging

ACCESS_LOGGER = "uvicorn.access"


class ProbeRequestsAtDebug(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # uvicorn's access log arguments:
        #  client address, method, path with query string, HTTP version, status code
        args = record.args
        if not (isinstance(args, tuple) and len(args) >= 3 and args[1] == "GET" and args[2] == "/"):
            return True
        if not logging.getLogger(ACCESS_LOGGER).isEnabledFor(logging.DEBUG):
            return False
        record.levelno = logging.DEBUG
        record.levelname = logging.getLevelName(logging.DEBUG)
        return True


def log_probe_requests_at_debug():
    logging.getLogger(ACCESS_LOGGER).addFilter(ProbeRequestsAtDebug())
