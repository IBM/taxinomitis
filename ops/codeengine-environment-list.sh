#!/bin/bash

set -e

ibmcloud target -r eu-de --quiet > /tmp/ignore
ibmcloud ce project select --name mlforkids-eu --quiet  > /tmp/ignore
ibmcloud ce application list
ibmcloud ce secret list

ibmcloud ce project select --name mlforkids-me --quiet  > /tmp/ignore
ibmcloud ce application list
ibmcloud ce secret list

ibmcloud target -r au-syd --quiet > /tmp/ignore
ibmcloud ce project select --name mlforkids-au --quiet > /tmp/ignore
ibmcloud ce application list
ibmcloud ce secret list

ibmcloud target -r us-south --quiet > /tmp/ignore
ibmcloud ce project select --name mlforkids-us --quiet > /tmp/ignore
ibmcloud ce application list
ibmcloud ce secret list
