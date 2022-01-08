#!/bin/sh

export KUBECONFIG=$(ibmcloud ce project current -o json | jq -r .kube_config_file)
