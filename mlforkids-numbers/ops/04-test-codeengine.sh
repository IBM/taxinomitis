#!/bin/sh

set -e

echo "Applying config from env files"
export $(grep -v '^#' app.env | xargs)
export $(grep -v '^#' prod-credentials.env | xargs)

CODE_ENGINE_URL=`ibmcloud ce application get --name $DOCKER_IMAGE -o json | jq -r .status.url`

curl -H "Content-Type: application/json" \
    -d @./data/trainingdata.json \
    --user $VERIFY_USER:$VERIFY_PASSWORD \
    $CODE_ENGINE_URL/api/models

sleep 2

echo ""

curl -H "Content-Type: application/json" \
    -d @./data/testdata-died.json \
    --user $VERIFY_USER:$VERIFY_PASSWORD \
    $CODE_ENGINE_URL/api/classify

echo ""

curl -H "Content-Type: application/json" \
    -d @./data/testdata-survived.json \
    --user $VERIFY_USER:$VERIFY_PASSWORD \
    $CODE_ENGINE_URL/api/classify

echo ""

curl -H "Content-Type: application/json" \
    --user $VERIFY_USER:$VERIFY_PASSWORD \
    --output /tmp/taxinomitis-visualisations.json \
    "$CODE_ENGINE_URL/api/models?tenantid=daletenant&studentid=MYUSERID&projectid=testproject"
echo "differences:"
diff --ignore-blank-lines /tmp/taxinomitis-visualisations.json ./data/testdata-viz.json | wc -l
