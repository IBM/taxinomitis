#!/bin/bash

set -e

echo "checking ibmcloud login"
$(dirname $0)/confirm-ibmcloud-login.sh

echo "selecting us-south region"
ibmcloud target -r us-south

echo "targetting code engine project"
ibmcloud ce project target --name mlforkids-us
