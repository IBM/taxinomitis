#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
    cd -- "${BASH_SOURCE%/*}/" || exit
fi


echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)


function test_app {
    export $(grep -v '^#' $1 | xargs)
    CODE_ENGINE_URL=`ibmcloud ce application get --name $DOCKER_IMAGE -o json | jq -r .status.url`
    echo "Checking $CODE_ENGINE_URL against the reference scores"
    python3 check-service.py $CODE_ENGINE_URL
}


echo "EU-DE deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-eude.sh
test_app prod-eu-credentials.env

echo "ME deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-me.sh
test_app prod-me-credentials.env

echo "AU-SYD deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ausyd.sh
test_app prod-au-credentials.env

echo "US-SOUTH deployment"
echo "Selecting code engine project"
../../ops/codeengine-region-ussouth.sh
test_app prod-us-credentials.env
