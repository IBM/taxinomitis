#!/bin/sh

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi

export $(grep -v '^#' devtest-credentials.env | xargs)

cd ..

source ./venv/bin/activate

# the e5 embeddings for the "none of these" background aren't in git,
#  so they need making once (this downloads e5 from Hugging Face)
if [ ! -f background/tatoeba-e5.npz ]; then
    echo "tatoeba missing - run `python -m scripts.make_background`"
    exit
fi

MODELS_CACHE_SIZE=3 \
    uvicorn app.main:app --reload --reload-dir app --port 8020
