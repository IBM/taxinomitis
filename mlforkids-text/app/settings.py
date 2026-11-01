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

    @staticmethod
    def from_environ():
        return Settings(username=environ["VERIFY_USER"],
                        password=environ["VERIFY_PASSWORD"],
                        cache_size=int(environ.get("MODELS_CACHE_SIZE", "10000")),
                        cache_ttl_seconds=int(environ.get("MODELS_CACHE_TTL_SECONDS", "86400")),
                        max_trainings=int(environ.get("MAX_CONCURRENT_TRAININGS", "1")))
