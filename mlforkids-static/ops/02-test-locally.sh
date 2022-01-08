#!/bin/sh

set -e

source app.env

PORT=9100
DEVHOST=ml-for-kids-local.net

echo "running image"
docker run --rm --detach \
    -p $PORT:80 \
    --name taxinomitis-static \
    --hostname $DEVHOST \
    $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION

echo "wait for startup"
sleep 1

echo "invoking health endpoint"
curl $DEVHOST:$PORT/index.html

echo "stopping"
docker stop taxinomitis-static
