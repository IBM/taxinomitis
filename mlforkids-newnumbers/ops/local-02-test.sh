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


PORT=8000

echo "Running image"
docker run --rm --detach \
    --platform linux/amd64 \
    --env VERIFY_USER=$VERIFY_USER \
    --env VERIFY_PASSWORD=$VERIFY_PASSWORD \
    --env MODELS_CACHE_SIZE=3 \
    --env PUBLIC_API_URL=http://localhost:$PORT \
    --env PORT=$PORT \
    -p $PORT:$PORT \
    --name taxinomitis-newnumbers \
    $DOCKER_ORG/$DOCKER_IMAGE:local

echo "Waiting for start"
sleep 4

cd ../test

npm test

echo "stopping image"
docker stop taxinomitis-newnumbers

