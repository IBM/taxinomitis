#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi

source app.env

PORT=9001
DEVHOST=ml-for-kids-local.net

echo "running image at http://$DEVHOST:$PORT"
docker run --rm \
    --env TWITTER_BEARER_TOKEN=notabearertoken \
    --env HOSTNAME=$DEVHOST \
    --env PORT=$PORT \
    -p $PORT:$PORT \
    --name taxinomitis-proxy \
    --hostname $DEVHOST \
    $DOCKER_ORG/$DOCKER_IMAGE:local
