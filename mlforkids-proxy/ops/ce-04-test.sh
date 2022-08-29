#!/bin/sh

set -e

# allow this script to be run from other locations, despite the
#  relative file paths used in it
if [[ $BASH_SOURCE = */* ]]; then
  cd -- "${BASH_SOURCE%/*}/" || exit
fi

echo "Applying config from env file"
export $(grep -v '^#' app.env | xargs)

CODE_ENGINE_URL=`ibmcloud ce application get --name $DOCKER_IMAGE -o json | jq -r .status.url`

echo "trying wikipedia proxy"
scratchtitle=$(curl "$CODE_ENGINE_URL/wikipedia/w/api.php?action=query&format=json&prop=extracts&explaintext=&titles=Scratch+%28programming+language%29" | jq -r '.query.pages["9236158"]'.title)
if [ "$scratchtitle" = "Scratch (programming language)" ];
then
    echo "looks okay"
else
    echo "proxy check failed"
    echo $scratchtitle
    exit -1
fi

