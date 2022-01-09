#!/bin/sh

set -e

function create_app {
    echo "Setting up credentials"
    ibmcloud ce secret create --name $DOCKER_IMAGE --from-env-file prod-credentials.env

    echo "Deploying version $DOCKER_VERSION of the $DOCKER_IMAGE image"
    ibmcloud ce application create \
        --name $DOCKER_IMAGE \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --cpu $CPU --memory $MEMORY --ephemeral-storage $DISK \
        --service-account $SERVICE_ACCOUNT \
        --env-from-secret $DOCKER_IMAGE \
        --env NUMBERS_SERVICE=$(ibmcloud ce application get --name mlforkids-numbers -o json | jq -r .status.url) \
        --min-scale $MIN_INSTANCES  --max-scale $MAX_INSTANCES \
        --cluster-local
        # --no-cluster-local
        # --env BLUEMIX_REGION="codeengine" \
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

echo "Registering a batch job to run periodic cleanup"
ibmcloud ce job create \
    --name $DOCKER_IMAGE-cleanup \
    --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
    --command "npm" \
    --argument "run" --argument "codeenginejob" \
    --env-from-secret $DOCKER_IMAGE \
    --env NUMBERS_SERVICE=$(ibmcloud ce application get --name mlforkids-numbers -o json | jq -r .status.url) \
    --env BLUEMIX_REGION="codeengine" \
    --maxexecutiontime 1800 \
    --retrylimit 1 \
    --memory 1G --cpu 0.5

echo "Scheduling batch job to run hourly"
ibmcloud ce sub cron create \
    --name $DOCKER_IMAGE-cleanup \
    --destination-type job \
    --destination $DOCKER_IMAGE-cleanup \
    --schedule "*/60 * * * *"
