#!/bin/sh

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi

cd ..

source ./venv/bin/activate

MODE=development \
    MPLBACKEND=svg \
    MODELS_CACHE_SIZE=3 \
    PUBLIC_API_URL=http://127.0.0.1:8000 \
    VERIFY_USER=testuser \
    VERIFY_PASSWORD=testpass \
    uvicorn app.main:app --reload --port 8000
