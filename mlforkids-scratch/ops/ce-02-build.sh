#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
    cd -- "${BASH_SOURCE%/*}/" || exit
fi


echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

echo "Switching to US-SOUTH"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh

echo "Starting Docker image build for version $DOCKER_VERSION of $DOCKER_IMAGE"
ibmcloud ce buildrun submit \
    --build $DOCKER_IMAGE \
    --name $DOCKER_IMAGE-$DOCKER_VERSION \
    --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
    --wait
