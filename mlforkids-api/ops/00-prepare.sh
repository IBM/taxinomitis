#!/bin/sh

set -e

echo "Applying config from env files"
export $(grep -v '^#' app.env | xargs)
export $(grep -v '^#' prod-credentials.env | xargs)

cd ..

# get dependencies
npm install

# run build
./node_modules/.bin/gulp buildprod

# replacing dependency with version (from git but not published to npm) that includes additional fixes
cp -v ../../webcam-directive/app/scripts/webcam.js web/static/bower_components/webcam/app/scripts/webcam.js
cp -v ../../webcam-directive/dist/webcam.min.js web/static/bower_components/webcam/dist/webcam.min.js

# saving a copy of what we will deploy
cp -rfv web/static/*-16* ./ops/previous-prod/.

# merging previous deploy with new
cp -rfv ./ops/previous-prod/* web/static/.

cd ops

echo "build complete"
