#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
    cd -- "${BASH_SOURCE%/*}/" || exit
fi


echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)


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


function setup_secrets {
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
}

echo "US-SOUTH deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh
echo "Setting up batch job in us-south only"
ibmcloud ce secret create --name $DOCKER_IMAGE-numbers --from-env-file numbers-us-credentials.env
setup_secrets
setup_batch_job
