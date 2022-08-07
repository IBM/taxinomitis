#!/bin/sh

set -e

echo "Applying config from env files"
export $(grep -v '^#' app.env | xargs)

echo "Building version $DOCKER_VERSION of the $DOCKER_IMAGE image"
docker build--platform=linux/amd64 ../ -t $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION

echo "Updating latest tag for local development"
docker tag $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION $DOCKER_ORG/$DOCKER_IMAGE:latest
