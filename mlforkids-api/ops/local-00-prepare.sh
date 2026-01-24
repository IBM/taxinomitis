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

# confirm Node 22
NODE_VERSION=$(node --version)
if [ "${NODE_VERSION:0:3}" != "v22" ]; then
    echo "Node v22 is required"
    exit 9
fi

# run build
npm run buildprod

echo "build complete"
