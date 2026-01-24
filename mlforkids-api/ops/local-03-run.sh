#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi

echo "Applying config from env files"
export $(grep -v '^#' app.env | xargs)
export $(grep -v '^#' dev-credentials.env | xargs)


docker run --rm -it \
    --platform=linux/amd64 \
    --env-file dev-credentials.env \
    -h ml-for-kids-local.net \
    -p $PORT:$PORT \
    --name taxinomitis \
    $DOCKER_ORG/$DOCKER_IMAGE:local
