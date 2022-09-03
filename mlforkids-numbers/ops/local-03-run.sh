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

PORT=8010
DEVHOST=ml-for-kids-local.net

echo "running image at http://$DEVHOST:$PORT"
docker run --rm \
    --env VERIFY_USER=$VERIFY_USER \
    --env VERIFY_PASSWORD=$VERIFY_PASSWORD \
    --env PORT=$PORT \
    -p $PORT:$PORT \
    --name taxinomitis-numbers \
    $DOCKER_ORG/$DOCKER_IMAGE:local
