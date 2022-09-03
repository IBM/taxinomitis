#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
    cd -- "${BASH_SOURCE%/*}/" || exit
fi

echo "Applying config from env files"
export $(grep -v '^#' app.env | xargs)
export $(grep -v '^#' prod-credentials.env | xargs)

cd ..

# confirm Node 16
NODE_VERSION=$(node --version)
if [ "${NODE_VERSION:0:3}" != "v16" ]; then
    echo "Node v16 is required"
    exit 9
fi

# run build
./node_modules/.bin/gulp buildprod

echo "build complete"
