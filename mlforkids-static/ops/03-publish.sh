#!/bin/sh

set -e

echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

echo "Selecting code engine project"
../../ops/00-codeengine-env-select.sh

echo "Publishing Docker image"
docker push $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION

echo "Registering spec for version $DOCKER_VERSION of the $DOCKER_IMAGE image"
ibmcloud ce application create \
    --name $DOCKER_IMAGE \
    --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
    --cpu $CPU --memory $MEMORY --ephemeral-storage $DISK \
    --service-account $SERVICE_ACCOUNT \
    --min-scale $MIN_INSTANCES  --max-scale $MAX_INSTANCES \
    --port 80 \
    --no-cluster-local
