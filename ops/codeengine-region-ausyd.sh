#!/bin/bash

set -e

echo "checking ibmcloud login"
$(dirname $0)/confirm-ibmcloud-login.sh

echo "selecting au-syd region"
ibmcloud target -r au-syd

echo "targetting code engine project"
ibmcloud ce project target --name mlforkids-au
