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
        --size large \
        --build-type git \
        --source https://github.com/IBM/taxinomitis \
        --commit master \
        --context-dir $DOCKER_IMAGE \
        --dockerfile Dockerfile \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --registry-secret docker.io
}


function build_app_image {
    echo "Building version $DOCKER_VERSION of the $DOCKER_IMAGE image"
    ibmcloud ce buildrun submit \
        --build $DOCKER_IMAGE \
        --name $DOCKER_IMAGE-$DOCKER_VERSION \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --wait
}


function create_app {
    echo "Deploying version $DOCKER_VERSION of the $DOCKER_IMAGE image"
    # the service answers GET / with 503 until the encoder is loaded,
    #  so readiness is checked over HTTP rather than just the port
    ibmcloud ce application create \
        --name $DOCKER_IMAGE \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --registry-secret docker.io \
        --cpu $CPU --memory $MEMORY --ephemeral-storage $DISK \
        --service-account $SERVICE_ACCOUNT \
        --port 8000 \
        --probe-ready type=http --probe-ready path=/ --probe-ready port=8000 \
        --request-timeout $REQUEST_TIMEOUT \
        --env-from-secret $DOCKER_IMAGE \
        --min-scale $MIN_INSTANCES --max-scale $MAX_INSTANCES \
        --no-cluster-local
}


# the image has to exist before any app can be created from it,
#  so it is built first, in us-south, where the builder lives
echo "US-SOUTH deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh
echo "Setting up image builder in us-south only"
create_app_image_builder
build_app_image
echo "setting up config"
ibmcloud ce secret create --name $DOCKER_IMAGE --from-env-file prod-us-credentials.env
echo "Creating app"
create_app

echo "EU-DE deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-eude.sh
echo "setting up config"
ibmcloud ce secret create --name $DOCKER_IMAGE --from-env-file prod-eu-credentials.env
echo "Creating app"
create_app

echo "ME deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-me.sh
echo "setting up config"
ibmcloud ce secret create --name $DOCKER_IMAGE --from-env-file prod-me-credentials.env
echo "Creating app"
create_app

echo "AU-SYD deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ausyd.sh
echo "setting up config"
ibmcloud ce secret create --name $DOCKER_IMAGE --from-env-file prod-au-credentials.env
echo "Creating app"
create_app
