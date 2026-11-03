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
        prefixed = [PREFIX + t for t in texts]
        vectors = np.empty((len(prefixed), self.dims), dtype=np.float32)
        for batch in self._batches_of_similar_length(prefixed):
            vectors[batch] = self._model.encode([prefixed[i] for i in batch],
                                                normalize_embeddings=True,
                                                batch_size=len(batch),
                                                show_progress_bar=False)
        # normalised again, as float32, on purpose
        # It isn't redundant with normalize_embeddings above.
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        return vectors / np.where(norms == 0, 1, norms)

    def _batches_of_similar_length(self, texts: list) -> list:
        """
        indexes of the texts, grouped so that no text in a group is more
        than twice as long (in tokens) as the shortest, and no group is
        bigger than BATCH_SIZE

        Every text in a batch is padded to the batch's longest, so one long
        example in a batch of short ones would otherwise make the encoder
        process every example in the batch at that length.
        """
        lengths = [len(ids) for ids in self._model.tokenizer(texts, truncation=True, max_length=MAX_TOKENS)["input_ids"]]
        batches = []
        for i in sorted(range(len(texts)), key=lambda i: lengths[i]):
            if batches and len(batches[-1]) < BATCH_SIZE and lengths[i] <= 2 * lengths[batches[-1][0]]:
                batches[-1].append(i)
            else:
                batches.append([i])
        return batches
