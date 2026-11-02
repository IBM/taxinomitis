"""
Configuration, from environment variables.
"""
# core dependencies
from dataclasses import dataclass
from os import environ


@dataclass(frozen=True)
class Settings:
    username: str
    password: str
    cache_size: int
    cache_ttl_seconds: int
    max_trainings: int
    max_waiting_trainings: int
    max_training_wait_seconds: float

    @staticmethod
    def from_environ():
        return Settings(username=environ["VERIFY_USER"],
                        password=environ["VERIFY_PASSWORD"],
                        cache_size=int(environ.get("MODELS_CACHE_SIZE", "10000")),
                        cache_ttl_seconds=int(environ.get("MODELS_CACHE_TTL_SECONDS", "86400")),
                        max_trainings=int(environ.get("MAX_CONCURRENT_TRAININGS", "1")),
                        max_waiting_trainings=int(environ.get("MAX_WAITING_TRAININGS", "200")),
                        # below mlforkids-api's 90 s timeout, so a training that
                        #  can't start in time gets busy while its caller is listening
                        max_training_wait_seconds=float(environ.get("MAX_TRAINING_WAIT_SECONDS", "60")))
