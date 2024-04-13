from datetime import datetime
from pydantic import BaseModel
from enum import Enum
from typing import Optional, List


class ModelStatus(str, Enum):
    Available = "Available"
    Failed = "Failed"
    Training = "Training"
    Unavailable = "Unavailable"

class ModelLocations(BaseModel):
    status: str
    model: str
    tree: str
    dot: str
    vocab: str

class ErrorInfo(BaseModel):
    message: str
    stack: str

# response payload for training requests
class ModelInfo(BaseModel):
    key: str
    status: ModelStatus
    urls: ModelLocations
    features: dict
    labels: List[str]
    error: Optional[ErrorInfo]
    lastupdate: datetime