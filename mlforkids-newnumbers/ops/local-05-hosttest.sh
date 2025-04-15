#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
    cd -- "${BASH_SOURCE%/*}/" || exit
fi

echo "Applying config from env files"
export $(grep -v '^#' app.env | xargs)
export $(grep -v '^#' devtest-credentials.env | xargs)

cd ..

PORT=8000
DEVHOST=ml-for-kids-local.net

echo "Running server"
source ./venv/bin/activate

MODE=development \
    MPLBACKEND=svg \
    MODELS_CACHE_SIZE=3 \
    PUBLIC_API_URL=http://127.0.0.1:8000 \
    VERIFY_USER=testuser \
    VERIFY_PASSWORD=testpass \
    uvicorn app.main:app --port 8000 &

echo "Waiting for start"
sleep 10

cd ./test

echo "running tests"
npm test

echo "Stopping server"
pkill -P $$
