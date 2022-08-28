#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi

source app.env

PORT=9100
DEVHOST=ml-for-kids-local.net

echo "running image"
docker run --rm --detach \
    -p $PORT:80 \
    --name taxinomitis-scratch \
    --hostname $DEVHOST \
    $DOCKER_ORG/$DOCKER_IMAGE:local

echo "wait for startup"
sleep 1

echo "invoking health endpoint"
curl $DEVHOST:$PORT/health

echo "stopping"
docker stop taxinomitis-scratch
