#!/bin/bash

set -e

echo "checking ibmcloud login"
$(dirname $0)/confirm-ibmcloud-login.sh

echo "selecting eu-de region (for use by me)"
ibmcloud target -r eu-de

echo "targetting code engine project"
ibmcloud ce project target --name mlforkids-me
