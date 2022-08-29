#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi

echo "Applying config from env files"
export $(grep -v '^#' app.env | xargs)

echo "Building 'local' version of the $DOCKER_IMAGE image for local development and testing"
docker build \
    ../ \
    -t $DOCKER_ORG/$DOCKER_IMAGE:local
