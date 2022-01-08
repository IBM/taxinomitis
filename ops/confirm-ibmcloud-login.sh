#!/bin/bash

if [ $(ibmcloud target --output json | jq -r '.resource_group.name') != "machinelearningforkids" ]; then
    echo "wrong resource group"
    ibmcloud target
    exit 99
fi

if [ $(ibmcloud target --output json | jq -r '.api_endpoint') != "https://cloud.ibm.com" ]; then
    echo "wrong API endpoint"
    ibmcloud target
    exit 99
fi

echo "ibmcloud setup looks okay"
