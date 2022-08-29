#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi

source app.env

PORT=9000
DEVHOST=ml-for-kids-local.net

echo "running image at http://$DEVHOST:$PORT"
docker run --rm \
    --env CNAME_API_KEY=apikey \
    --env PROXY_PASS_HOST=auth0.com \
    --env HOSTNAME=$DEVHOST \
    --env PORT=$PORT \
    -p $PORT:$PORT \
    --name taxinomitis-login \
    --hostname $DEVHOST \
    $DOCKER_ORG/$DOCKER_IMAGE:local
