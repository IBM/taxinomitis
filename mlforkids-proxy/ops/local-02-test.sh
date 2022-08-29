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

echo "running image"
docker run --rm --detach \
    --env TWITTER_BEARER_TOKEN=notabearertoken \
    --env HOSTNAME=$DEVHOST \
    --env PORT=$PORT \
    -p $PORT:$PORT \
    --name taxinomitis-proxy \
    --hostname $DEVHOST \
    $DOCKER_ORG/$DOCKER_IMAGE:local

echo "wait for templating and startup"
sleep 3

echo "trying wikipedia proxy"
scratchtitle=$(curl "$DEVHOST:$PORT/wikipedia/w/api.php?action=query&format=json&prop=extracts&explaintext=&titles=Scratch+%28programming+language%29" | jq -r '.query.pages["9236158"]'.title)
if [ "$scratchtitle" = "Scratch (programming language)" ];
then
    echo "looks okay"
else
    echo "proxy check failed"
    echo $scratchtitle
    exit -1
fi

echo "stopping"
docker stop taxinomitis-proxy
