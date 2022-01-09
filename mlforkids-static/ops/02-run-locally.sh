#!/bin/sh

set -e

source app.env

PORT=9100
DEVHOST=ml-for-kids-local.net

echo "running image at http://$DEVHOST:$PORT"
docker run --rm -it \
    -p $PORT:80 \
    --name taxinomitis-static \
    --hostname $DEVHOST \
    $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION
