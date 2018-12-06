classname=$1

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
numfile="$DIR/.lastconv"
lastconv=`cat $numfile`
nextconv=`expr $lastconv + 1`
echo $nextconv > $numfile

sid=$nextconv

servicename=mlforkids-managed-$sid

ibmcloud resource service-instance-create $servicename conversation standard us-south -g machinelearningforkids

convserviceid=`ibmcloud resource service-instance -g machinelearningforkids --location us-south --output json $servicename  | jq --raw-output .[0].id`

ibmcloud resource service-key-create mlforkidsapikey Manager --instance-id "$convserviceid" -g machinelearningforkids

convapikey=`ibmcloud resource service-keys -g machinelearningforkids  --instance-id "$convserviceid" --output json | jq --raw-output .[0].credentials.apikey`

uuid=`uuidgen | tr '[:upper:]' '[:lower:]'`

convuser=${convapikey:0:22}
convpass=${convapikey:22:22}

echo ""
echo ""
echo "INSERT INTO bluemixcredentials (id, classid, servicetype, credstypeid, url, username, password, notes) "
echo "VALUES "
echo "('$uuid', '$classname', 'conv', 2, 'https://gateway.watsonplatform.net/assistant/api', '$convuser', '$convpass', '$servicename')"
echo ";"

