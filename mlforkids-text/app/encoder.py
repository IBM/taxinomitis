"""
The e5 encoder, shared by every model.

Each step here is part of what calibration q1 was fitted to, so none of
them may be left to a library default.
"""
# external dependencies
import numpy as np
from sentence_transformers import SentenceTransformer
# local dependencies
from app.resources import DIMS, ENCODER_NAME, ENCODER_REVISION

PREFIX = "query: "

# includes the prefix and the encoder's start and end tokens
MAX_TOKENS = 512

# as the reference implementation was evaluated with
BATCH_SIZE = 64


class E5Encoder:
    name = ENCODER_NAME
    revision = ENCODER_REVISION
    dims = DIMS

    def __init__(self):
        self._model = SentenceTransformer(ENCODER_NAME, revision=ENCODER_REVISION, device="cpu")
        self._model.max_seq_length = MAX_TOKENS

    def embed(self, texts: list) -> np.ndarray:
        vectors = self._model.encode([PREFIX + t for t in texts],
                                     normalize_embeddings=True,
                                     batch_size=BATCH_SIZE,
                                     show_progress_bar=False)
        vectors = np.asarray(vectors, dtype=np.float32)
        # normalised again, as float32, on purpose
        # It isn't redundant with normalize_embeddings above.
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        return vectors / np.where(norms == 0, 1, norms)
