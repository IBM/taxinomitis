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

PORT=8020
DEVHOST=localhost

echo "running image at http://$DEVHOST:$PORT"
docker run --rm -it \
    --platform linux/amd64 \
    --env VERIFY_USER=$VERIFY_USER \
    --env VERIFY_PASSWORD=$VERIFY_PASSWORD \
    -p $PORT:8000 \
    --name taxinomitis-text \
    $DOCKER_ORG/$DOCKER_IMAGE:local
