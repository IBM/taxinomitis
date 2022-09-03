#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
    cd -- "${BASH_SOURCE%/*}/" || exit
fi


echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)


function delete_cleanup_job {
    echo "deleting cleanup job"
    ibmcloud ce sub cron delete --name $DOCKER_IMAGE-cleanup-job --ignore-not-found
    ibmcloud ce job      delete --name $DOCKER_IMAGE-cleanup-job --ignore-not-found
}


function delete_secrets {
    echo "deleting secrets"
    ibmcloud ce secret delete --name $DOCKER_IMAGE            --ignore-not-found
    ibmcloud ce secret delete --name $DOCKER_IMAGE-auth0      --ignore-not-found
    ibmcloud ce secret delete --name $DOCKER_IMAGE-cos        --ignore-not-found
    ibmcloud ce secret delete --name $DOCKER_IMAGE-email      --ignore-not-found
    ibmcloud ce secret delete --name $DOCKER_IMAGE-numbers    --ignore-not-found
    ibmcloud ce secret delete --name $DOCKER_IMAGE-openwhisk  --ignore-not-found
    ibmcloud ce secret delete --name $DOCKER_IMAGE-postgresql --ignore-not-found
    ibmcloud ce secret delete --name $DOCKER_IMAGE-postgresql-cert --ignore-not-found
    ibmcloud ce secret delete --name $DOCKER_IMAGE-slack      --ignore-not-found
}


echo "US-SOUTH deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh
ibmcloud ce build       delete --name $DOCKER_IMAGE --ignore-not-found
ibmcloud ce application delete --name $DOCKER_IMAGE --ignore-not-found
delete_cleanup_job
delete_secrets


echo "EU-DE deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-eude.sh
ibmcloud ce application delete --name $DOCKER_IMAGE --ignore-not-found
delete_secrets


echo "AU-SYD deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ausyd.sh
ibmcloud ce application delete --name $DOCKER_IMAGE --ignore-not-found
delete_secrets

