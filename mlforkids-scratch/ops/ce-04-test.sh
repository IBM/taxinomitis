#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi



echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

CODE_ENGINE_URL=`ibmcloud ce application get --name $DOCKER_IMAGE -o json | jq -r .status.url`

echo "querying healthcheck endpoint"
curl $CODE_ENGINE_URL/health
