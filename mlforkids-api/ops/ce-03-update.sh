#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi



function update_app {
    echo "Deploying version $DOCKER_VERSION of the $DOCKER_IMAGE image"
    ibmcloud ce application update \
        --name $DOCKER_IMAGE \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION
}

function update_cleanup_job {
    echo "Updating batch job to run periodic cleanup"
    ibmcloud ce job update \
        --name $DOCKER_IMAGE-cleanup-job \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION
}


echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

echo "EU-DE deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-eude.sh
echo "Updating app"
update_app

echo "ME (EU-DE) deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-me.sh
echo "Updating app"
update_app

echo "AU-SYD deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ausyd.sh
echo "Updating app"
update_app

echo "US-SOUTH deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh
echo "Updating app"
update_app
update_cleanup_job