#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
    cd -- "${BASH_SOURCE%/*}/" || exit
fi


echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)


function create_app_image_builder {
    echo "Creating Docker image builder"
    ibmcloud ce build create \
        --name $DOCKER_IMAGE \
        --strategy dockerfile \
        --size small \
        --build-type git \
        --source https://github.com/IBM/taxinomitis \
        --commit master \
        --context-dir $DOCKER_IMAGE \
        --dockerfile Dockerfile \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --registry-secret docker.io
}


function create_app {
    echo "Deploying version $DOCKER_VERSION of the $DOCKER_IMAGE image"
    ibmcloud ce application create \
        --name $DOCKER_IMAGE \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --registry-secret docker.io \
        --cpu $CPU --memory $MEMORY --ephemeral-storage $DISK \
        --service-account $SERVICE_ACCOUNT \
        --port 8000 \
        --env-from-secret $DOCKER_IMAGE \
        --min-scale $MIN_INSTANCES --max-scale $MAX_INSTANCES \
        --no-cluster-local
}



echo "EU-DE deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-eude.sh
echo "setting up config"
ibmcloud ce secret create --name $DOCKER_IMAGE --from-env-file prod-eu-credentials.env
echo "Creating app"
create_app

echo "US-SOUTH deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh
echo "setting up config"
ibmcloud ce secret create --name $DOCKER_IMAGE --from-env-file prod-us-credentials.env
echo "Setting up image builder in us-south only"
create_app_image_builder
echo "Creating app"
create_app

echo "AU-SYD deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ausyd.sh
echo "setting up config"
ibmcloud ce secret create --name $DOCKER_IMAGE --from-env-file prod-au-credentials.env
echo "Creating app"
create_app
