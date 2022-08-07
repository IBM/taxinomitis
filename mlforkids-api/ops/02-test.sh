#!/bin/sh

set -e

echo "Applying config from env files"
export $(grep -v '^#' app.env | xargs)
export $(grep -v '^#' dev-credentials.env | xargs)


echo "Starting local numbers service"
docker run --rm --detach \
    --platform=linux/amd64 \
    --env VERIFY_USER=$NUMBERS_SERVICE_USER \
    --env VERIFY_PASSWORD=$NUMBERS_SERVICE_PASS \
    --env PORT=8010 \
    -p 8010:8010 \
    --name taxinomitis-numbers \
    dalelane/mlforkids-numbers:latest

echo "Building test image"
docker build --platform=linux/amd64 ../ -f ../Dockerfile.test -t $DOCKER_ORG/$DOCKER_IMAGE-test:$DOCKER_VERSION

echo "Running tests"
docker run --rm -it \
    --platform=linux/amd64 \
    --env-file dev-credentials.env \
    -h ml-for-kids-local.net \
    -p $PORT:$PORT \
    --name taxinomitis \
    $DOCKER_ORG/$DOCKER_IMAGE-test:$DOCKER_VERSION

echo "Stopping local numbers service"
docker stop taxinomitis-numbers
