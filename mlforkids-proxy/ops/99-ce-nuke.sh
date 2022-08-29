#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
    cd -- "${BASH_SOURCE%/*}/" || exit
fi


echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)


echo "US-SOUTH deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh
ibmcloud ce build       delete --name $DOCKER_IMAGE --ignore-not-found
ibmcloud ce application delete --name $DOCKER_IMAGE --ignore-not-found
ibmcloud ce secret      delete --name $DOCKER_IMAGE --ignore-not-found


echo "EU-DE deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-eude.sh
ibmcloud ce application delete --name $DOCKER_IMAGE --ignore-not-found
ibmcloud ce secret      delete --name $DOCKER_IMAGE --ignore-not-found


echo "AU-SYD deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ausyd.sh
ibmcloud ce application delete --name $DOCKER_IMAGE --ignore-not-found
ibmcloud ce secret      delete --name $DOCKER_IMAGE --ignore-not-found
