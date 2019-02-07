classname=$1

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
numfile="$DIR/.lastvisrec"
lastvisrec=`cat $numfile`
nextvisrec=`expr $lastvisrec + 1`
echo $nextvisrec > $numfile

sid=$nextvisrec

servicename=mlforkids-managed-vr-$sid

ibmcloud resource service-instance-create $servicename watson-vision-combined standard-rc us-south -g machinelearningforkids

visrecserviceid=`ibmcloud resource service-instance -g machinelearningforkids --location us-south --output json $servicename  | jq --raw-output .[0].id`

ibmcloud resource service-key-create mlforkidsapikey Manager --instance-id "$visrecserviceid" -g machinelearningforkids

visrecapikey=`ibmcloud resource service-keys -g machinelearningforkids  --instance-id "$visrecserviceid" --output json | jq --raw-output .[0].credentials.apikey`

uuid=`uuidgen | tr '[:upper:]' '[:lower:]'`

visrecuser=${visrecapikey:0:22}
visrecpass=${visrecapikey:22:22}

echo ""
echo ""
echo "INSERT INTO bluemixcredentials (id, classid, servicetype, credstypeid, url, username, password, notes) "
echo "VALUES "
echo "('$uuid', '$classname', 'visrec', 4, 'https://gateway.watsonplatform.net/visual-recognition/api', '$visrecuser', '$visrecpass', '$servicename')"
echo ";"

