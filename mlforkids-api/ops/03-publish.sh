#!/bin/sh

set -e

echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

echo "Selecting code engine project"
../../ops/00-codeengine-env-select.sh

echo "Publishing Docker image"
docker push $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION

echo "setting up credentials (first publish only)"
ibmcloud ce secret create --name mlforkids-api --from-env-file prod-credentials.env

# echo "refreshing credentials"
# ibmcloud ce secret update --name $DOCKER_IMAGE --from-env-file prod-credentials.env

echo "Registering spec for version $DOCKER_VERSION of the $DOCKER_IMAGE image"
ibmcloud ce application create \
    --name $DOCKER_IMAGE \
    --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
    --cpu $CPU --memory $MEMORY --ephemeral-storage $DISK \
    --service-account $SERVICE_ACCOUNT \
    --env-from-secret $DOCKER_IMAGE \
    --env BLUEMIX_REGION="codeengine" \
    --min-scale $MIN_INSTANCES  --max-scale $MAX_INSTANCES \
    --no-cluster-local

echo "Registering a batch job to run periodic cleanup"
ibmcloud ce job create \
    --name $DOCKER_IMAGE-cleanup \
    --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
    --command "npm" \
    --argument "run" --argument "codeenginejob" \
    --env-from-secret $DOCKER_IMAGE \
    --maxexecutiontime 1800 \
    --retrylimit 1 \
    --memory 1G --cpu 0.5

echo "Scheduling batch job to run hourly"
ibmcloud ce sub cron create \
    --name $DOCKER_IMAGE-cleanup \
    --destination-type job \
    --destination $DOCKER_IMAGE-cleanup \
    --schedule "*/60 * * * *"

