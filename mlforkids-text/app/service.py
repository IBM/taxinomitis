"""
The mlforkids-text HTTP API 
"""
# core dependencies
import base64
import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import Callable
# external dependencies
from cachetools import TTLCache
from fastapi import Depends, FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException
from starlette.requests import ClientDisconnect
from starlette.concurrency import run_in_threadpool
# local dependencies
from app.auth import basic_auth_check
from app.blob import SUPPORTED_FORMATS, InvalidModel, Model, NeedsRetraining, decode_model
from app.classifier import classify
from app.errors import ApiError
from app.requests import parse_model, parse_text, parse_training, read_json
from app.resources import CURRENT_CALIBRATION, Resources
from app.settings import Settings
from app.training import train


# logs contain only model ids, counts, sizes, timings and error codes:
#  never student text or label names
log = logging.getLogger(__name__)

RETRY_AFTER_SECONDS = 30


def exit_process():
    # sys.exit would only end the loading thread
    os._exit(1)


def create_app(load_resources: Callable[[], Resources], settings: Settings,
               on_load_failure: Callable[[], None] = exit_process) -> FastAPI:
    state = {"resources": None}

    # decoded models, by model id. Only used from the event loop thread,
    #  because cachetools caches aren't thread-safe.
    cache: TTLCache[str, Model] = TTLCache(maxsize=settings.cache_size, ttl=settings.cache_ttl_seconds)

    # trainings beyond this are turned away straight away, not queued
    trainings = threading.BoundedSemaphore(settings.max_trainings)

    def load():
        try:
            log.info("Loading encoder and background embeddings")
            started = time.monotonic()
            state["resources"] = load_resources()
            log.info("Ready after %.1f s", time.monotonic() - started)
        except Exception:
            # exit, so the instance is restarted rather than never getting ready
            log.exception("Failed to load encoder or background embeddings - exiting")
            on_load_failure()

    @asynccontextmanager
    async def lifespan(_app):
        threading.Thread(target=load, daemon=True, name="load-resources").start()
        yield

    app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None, lifespan=lifespan)
    authenticated = Depends(basic_auth_check(settings.username, settings.password))

    @app.get("/")
    def healthcheck():
        resources = state["resources"]
        if resources is None:
            return JSONResponse(status_code=503, content={"status": "starting"})
        return {
            "status": "ready",
            "encoder": resources.encoder.name,
            "encoderrevision": resources.encoder.revision,
            "formats": SUPPORTED_FORMATS,
            "calibrations": sorted(resources.calibrations),
            "currentcalibration": CURRENT_CALIBRATION,
        }

    @app.exception_handler(ApiError)
    async def api_error(request: Request, error: ApiError):
        log.info("%s %s : %d %s", request.method, request.url.path, error.status, error.code)
        return error_response(error)

    @app.exception_handler(HTTPException)
    async def routing_error(request: Request, error: HTTPException):
        # unknown paths and methods, which FastAPI raises before any endpoint runs
        if error.status_code not in ROUTING_ERRORS:
            return await http_exception_handler(request, error)
        code, message = ROUTING_ERRORS[error.status_code]
        return await api_error(request, ApiError(error.status_code, code, message, headers=error.headers))

    @app.middleware("http")
    async def unexpected_error(request: Request, call_next):
        # caught here rather than with an exception handler, because Starlette
        #  re-raises after those, and uvicorn would then log the exception's
        #  message and traceback, which could include student text
        try:
            return await call_next(request)
        except ClientDisconnect:
            # the caller hung up, so this isn't a failure, and nobody will
            #  see the response: the status only shows in the access log
            log.info("%s %s : client disconnected", request.method, request.url.path)
            return Response(status_code=400)
        except Exception as e:
            log.error("%s %s : 500 internal-error (%s)", request.method, request.url.path, type(e).__name__)
            return error_response(ApiError(500, "internal-error", "Unexpected error"))

    def ready() -> Resources:
        resources = state["resources"]
        if resources is None:
            raise ApiError(503, "starting", "The service is still starting")
        return resources

    @app.post("/models", dependencies=[authenticated])
    async def create_model(request: Request):
        resources = ready()
        body = await read_json(request, "invalid-training")
        training = parse_training(body)
        if not trainings.acquire(blocking=False):
            raise ApiError(503, "busy", "Already running as many trainings as allowed",
                           headers={"Retry-After": str(RETRY_AFTER_SECONDS)})
        started = time.monotonic()
        try:
            modelid, blob = await run_in_threadpool(train, resources, training)
        finally:
            trainings.release()
        cache[modelid] = decode_for_api(resources, blob)
        log.info("%s : trained %d labels, %d examples, %d characters, %d bytes, in %.2f s",
                 modelid, len(training.labels), sum(len(e) for e in training.examples),
                 sum(len(t) for e in training.examples for t in e), len(blob), time.monotonic() - started)
        return {
            "modelid": modelid,
            "model": base64.b64encode(blob).decode("ascii"),
            "labels": training.labels,
            "calibration": CURRENT_CALIBRATION,
        }

    @app.post("/models/{modelid}/classify", dependencies=[authenticated])
    async def classify_text(modelid: str, request: Request):
        resources = ready()
        body = await read_json(request, "invalid-text")
        text = parse_text(body)
        blob = parse_model(body)
        if blob is None:
            model = cache.get(modelid)
            if model is None:
                raise ApiError(404, "model-not-cached", "Model isn't cached - retry with the model")
        else:
            model = decode_for_api(resources, blob)
            if model.modelid != modelid:
                raise ApiError(400, "invalid-model", "Model id doesn't match the model")
            cache[modelid] = model
        started = time.monotonic()
        classes = await run_in_threadpool(classify, resources, model, text)
        log.info("%s : classified %d characters (%s) in %.0f ms", modelid, len(text),
                 "cached" if blob is None else "model sent", (time.monotonic() - started) * 1000)
        return {"modelid": modelid, "classes": classes}

    return app


ROUTING_ERRORS = {
    404: ("not-found", "No such endpoint"),
    405: ("method-not-allowed", "Method not allowed for this endpoint"),
}


def error_response(error: ApiError) -> JSONResponse:
    return JSONResponse(status_code=error.status, headers=error.headers,
                        content={"error": error.code, "message": error.message})


def decode_for_api(resources: Resources, blob: bytes) -> Model:
    try:
        return decode_model(blob,
                            encoder=resources.encoder.name,
                            encoderrevision=resources.encoder.revision,
                            dims=resources.encoder.dims,
                            calibrations=resources.calibrations)
    except InvalidModel as e:
        raise ApiError(400, "invalid-model", f"Model isn't valid: {e}") from None
    except NeedsRetraining as e:
        raise ApiError(409, "needs-retraining", f"Model needs retraining: {e}") from None
