#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi

echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

echo "Building version $DOCKER_VERSION of the $DOCKER_IMAGE image"
docker build -t $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION --platform=linux/amd64 ../

echo "Updating latest tag for local development"
docker tag $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION $DOCKER_ORG/$DOCKER_IMAGE:latest
