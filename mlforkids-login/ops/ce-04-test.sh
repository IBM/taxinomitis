#!/bin/sh

set -e

echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

CODE_ENGINE_URL=`ibmcloud ce application get --name $DOCKER_IMAGE -o json | jq -r .status.url`

echo "invoking health endpoint"
healthoutput=$(curl $CODE_ENGINE_URL/health)
if [ $healthoutput = "healthy" ];
then
    echo "looks okay"
else
    echo "health check failed"
    echo $healthoutput
    exit -1
fi
