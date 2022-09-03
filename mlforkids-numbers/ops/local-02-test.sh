#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
    cd -- "${BASH_SOURCE%/*}/" || exit
fi

echo "Applying config from env files"
export $(grep -v '^#' app.env | xargs)
export $(grep -v '^#' devtest-credentials.env | xargs)


PORT=8000

echo "Running image"
docker run --rm --detach \
    --env VERIFY_USER=$VERIFY_USER \
    --env VERIFY_PASSWORD=$VERIFY_PASSWORD \
    --env PORT=$PORT \
    -p $PORT:$PORT \
    --name taxinomitis-numbers \
    $DOCKER_ORG/$DOCKER_IMAGE:local

echo "Waiting for start"
sleep 4

echo "Training model"
curl -H "Content-Type: application/json" \
    -d @data/trainingdata.json \
    --user $VERIFY_USER:$VERIFY_PASSWORD \
    http://localhost:$PORT/api/models

echo "\n\nTrying test data (died)"
curl -H "Content-Type: application/json" \
    -d @data/testdata-died.json \
    --user $VERIFY_USER:$VERIFY_PASSWORD \
    http://localhost:$PORT/api/classify

echo "\n\nTrying test data (survived)"
curl -H "Content-Type: application/json" \
    -d @data/testdata-survived.json \
    --user $VERIFY_USER:$VERIFY_PASSWORD \
    http://localhost:$PORT/api/classify

echo "\n\nGenerating visualisations"
curl -H "Content-Type: application/json" \
    --user $VERIFY_USER:$VERIFY_PASSWORD \
    --output /tmp/taxinomitis-visualisations.json \
    'http://localhost:8000/api/models?tenantid=daletenant&studentid=MYUSERID&projectid=testproject'
echo "differences against previous viz generation (should be '0')"
diff --ignore-blank-lines /tmp/taxinomitis-visualisations.json ./data/testdata-viz.json | wc -l

echo "stopping image"
docker stop taxinomitis-numbers
