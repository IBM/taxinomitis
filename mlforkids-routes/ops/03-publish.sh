#!/bin/sh

set -e

function create_app {
    echo "Deploying version $DOCKER_VERSION of the $DOCKER_IMAGE image"
    ibmcloud ce application create \
        --name $DOCKER_IMAGE \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --cpu $CPU --memory $MEMORY --ephemeral-storage $DISK \
        --service-account $SERVICE_ACCOUNT \
        --min-scale $MIN_INSTANCES  --max-scale $MAX_INSTANCES \
        --no-cluster-local \
        --env URL_SCRATCH3=$(ibmcloud ce application get --name mlforkids-static -o json | jq -r .status.url)/scratch3/ \
        --env URL_SCRATCHX=$(ibmcloud ce application get --name mlforkids-static -o json | jq -r .status.url)/scratchx/ \
        --env URL_PROXIES=$(ibmcloud ce application get --name mlforkids-proxy -o json | jq -r .status.url)/ \
        --env URL_DEFAULT=$(ibmcloud ce application get --name mlforkids-api -o json | jq -r .status.url)/
}

echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

echo "Publishing Docker image"
docker push $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION



echo "EU-DE deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-eude.sh
echo "Creating app"
create_app

echo "AU-SYD deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ausyd.sh
echo "Creating app"
create_app

echo "US-SOUTH deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh
echo "Creating app"
create_app
