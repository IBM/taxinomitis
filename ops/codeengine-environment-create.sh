#!/bin/bash

set -e

echo "checking ibmcloud login"
$(dirname $0)/confirm-ibmcloud-login.sh

echo "selecting eu-de region"
ibmcloud target -r eu-de
echo "creating code engine project (EU)"
ibmcloud ce project create --no-select --name mlforkids-eu

echo "selecting me region"
ibmcloud target -r eu-de
echo "creating code engine project (ME)"
ibmcloud ce project create --no-select --name mlforkids-me

echo "selecting au-syd region"
ibmcloud target -r au-syd
echo "creating code engine project (AU)"
ibmcloud ce project create --no-select --name mlforkids-au

echo "selecting us-south region"
ibmcloud target -r us-south
echo "creating code engine project (US)"
ibmcloud ce project create --no-select --name mlforkids-us
