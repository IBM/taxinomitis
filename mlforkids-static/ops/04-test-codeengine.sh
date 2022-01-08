#!/bin/sh

set -e

echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

CODE_ENGINE_URL=`ibmcloud ce application get --name $DOCKER_IMAGE -o json | jq -r .status.url`

echo "querying index file"
curl $CODE_ENGINE_URL/index.html
