#!/bin/sh

set -e

function update_app {
    echo "Refreshing credentials"
    ibmcloud ce secret update --name $DOCKER_IMAGE --from-env-file prod-credentials.env

    echo "Deploying version $DOCKER_VERSION of the $DOCKER_IMAGE image"
    ibmcloud ce application update \
        --name $DOCKER_IMAGE \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION
}

echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

echo "Publishing Docker image"
docker push $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION



echo "EU-DE deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-eude.sh
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

echo "Updating batch job to run periodic cleanup"
ibmcloud ce job update \
    --name $DOCKER_IMAGE-cleanup \
    --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION


