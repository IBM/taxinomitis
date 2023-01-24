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
        --size medium \
        --build-type git \
        --source https://github.com/IBM/taxinomitis \
        --commit master \
        --context-dir $DOCKER_IMAGE \
        --dockerfile Dockerfile \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --registry-secret docker.io
}


function setup_batch_job {
    echo "Registering a batch job to run periodic cleanup"
    ibmcloud ce job create \
        --name $DOCKER_IMAGE-cleanup-job \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --command "npm" \
        --argument "run" --argument "codeenginejob" \
        --env-from-secret $DOCKER_IMAGE \
        --registry-secret docker.io \
        --env-from-secret $DOCKER_IMAGE \
        --env-from-secret $DOCKER_IMAGE-auth0 \
        --env-from-secret $DOCKER_IMAGE-cos \
        --env-from-secret $DOCKER_IMAGE-email \
        --env-from-secret $DOCKER_IMAGE-numbers \
        --env-from-secret $DOCKER_IMAGE-openwhisk \
        --env-from-secret $DOCKER_IMAGE-postgresql \
        --env-from-secret $DOCKER_IMAGE-slack \
        --env NUMBERS_SERVICE=$(ibmcloud ce application get --name mlforkids-numbers -o json | jq -r .status.url) \
        --mount-secret "/usr/src/app/pgsqlcerts"=$DOCKER_IMAGE-postgresql-cert \
        --maxexecutiontime 1800 \
        --retrylimit 1 \
        --memory 1G --cpu 0.5

    echo "Scheduling batch job to run hourly"
    ibmcloud ce sub cron create \
        --name $DOCKER_IMAGE-cleanup-job \
        --destination-type job \
        --destination $DOCKER_IMAGE-cleanup-job \
        --schedule "*/60 * * * *"
}


function create_app {
    echo "setting up credentials"
    ibmcloud ce secret create \
        --name $DOCKER_IMAGE-auth0 \
        --from-env-file auth0-credentials.env
    ibmcloud ce secret create \
        --name $DOCKER_IMAGE-cos \
        --from-env-file cos-credentials.env
    ibmcloud ce secret create \
        --name $DOCKER_IMAGE-email \
        --from-env-file email-credentials.env
    ibmcloud ce secret create \
        --name $DOCKER_IMAGE-openwhisk \
        --from-env-file openwhisk-credentials.env
    ibmcloud ce secret create \
        --name $DOCKER_IMAGE-postgresql \
        --from-env-file postgresql-credentials.env
    ibmcloud ce secret create \
        --name $DOCKER_IMAGE-postgresql-cert \
        --from-file ibmcloud-ca.cert
    ibmcloud ce secret create \
        --name $DOCKER_IMAGE \
        --from-env-file prod-credentials.env
    ibmcloud ce secret create \
        --name $DOCKER_IMAGE-slack \
        --from-env-file slack-credentials.env
    ibmcloud ce secret create \
        --name $DOCKER_IMAGE-spotify \
        --from-env-file spotify-credentials.env

    echo "Deploying version $DOCKER_VERSION of the $DOCKER_IMAGE image"
    ibmcloud ce application create \
        --name $DOCKER_IMAGE \
        --image $DOCKER_ORG/$DOCKER_IMAGE:$DOCKER_VERSION \
        --registry-secret docker.io \
        --cpu $CPU --memory $MEMORY --ephemeral-storage $DISK \
        --service-account $SERVICE_ACCOUNT \
        --env-from-secret $DOCKER_IMAGE \
        --env-from-secret $DOCKER_IMAGE-auth0 \
        --env-from-secret $DOCKER_IMAGE-cos \
        --env-from-secret $DOCKER_IMAGE-email \
        --env-from-secret $DOCKER_IMAGE-numbers \
        --env-from-secret $DOCKER_IMAGE-openwhisk \
        --env-from-secret $DOCKER_IMAGE-postgresql \
        --env-from-secret $DOCKER_IMAGE-slack \
        --env-from-secret $DOCKER_IMAGE-spotify \
        --env NUMBERS_SERVICE=$(ibmcloud ce application get --name mlforkids-numbers -o json | jq -r .status.url) \
        --mount-secret "/usr/src/app/pgsqlcerts"=$DOCKER_IMAGE-postgresql-cert \
        --min-scale $MIN_INSTANCES  --max-scale $MAX_INSTANCES \
        --no-cluster-local
}



echo "EU-DE deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-eude.sh
echo "Creating app"
ibmcloud ce secret create --name $DOCKER_IMAGE-numbers --from-env-file numbers-eu-credentials.env
create_app

echo "ME (EU-DE) deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-me.sh
echo "Creating app"
ibmcloud ce secret create --name $DOCKER_IMAGE-numbers --from-env-file numbers-me-credentials.env
create_app


echo "US-SOUTH deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh
echo "Creating app"
ibmcloud ce secret create --name $DOCKER_IMAGE-numbers --from-env-file numbers-us-credentials.env
create_app
# echo "Setting up image builder in us-south only"
# create_app_image_builder
echo "Setting up batch job in us-south only"
setup_batch_job


echo "AU-SYD deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ausyd.sh
echo "Creating app"
ibmcloud ce secret create --name $DOCKER_IMAGE-numbers --from-env-file numbers-au-credentials.env
create_app
