#!/bin/sh

set -e

source app.env

PORT=9000
DEVHOST=ml-for-kids-local.net

echo "running image"
docker run --rm --detach \
    --env CNAME_API_KEY=apikey \
    --env PROXY_PASS_HOST=devtenant.edge.tenants.auth0.com \
    --env HOSTNAME=$DEVHOST \
    --env PORT=$PORT \
    -p $PORT:$PORT \
    --name taxinomitis-login \
    --hostname $DEVHOST \
    $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION

echo "wait for templating and startup"
sleep 3

echo "invoking health endpoint"
healthoutput=$(curl $DEVHOST:$PORT/health)
if [ $healthoutput != "healthy" ];
then
    echo "health check failed"
    echo $healthoutput
    exit -1
fi

echo "stopping"
docker stop taxinomitis-login
