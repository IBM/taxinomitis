"""
The entry point for uvicorn:

    uvicorn app.main:app --host 0.0.0.0 --port 8000

Needs VERIFY_USER and VERIFY_PASSWORD, and background/tatoeba-e5.npz
(scripts/make_background.py). Optional: MODELS_CACHE_SIZE,
MODELS_CACHE_TTL_SECONDS, MAX_CONCURRENT_TRAININGS.
"""
# core dependencies
import sys
from logging import basicConfig, getLogger
# local dependencies
from app.resources import load_production_resources
from app.service import create_app
from app.settings import Settings

# to stdout, never to a file: nothing is written to disk.
#  Only this service's own logs at INFO: libraries only log warnings.
basicConfig(stream=sys.stdout, level="WARNING", format="%(asctime)s %(levelname)s %(name)s : %(message)s")
getLogger("app").setLevel("INFO")

app = create_app(load_production_resources, Settings.from_environ())
