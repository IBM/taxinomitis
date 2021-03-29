classname=$1

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
numfile="$DIR/.lastconv"
lastconv=`cat $numfile`
nextconv=`expr $lastconv + 1`
echo $nextconv > $numfile

sid=$nextconv

region=us-south
# region=eu-gb

servicename=mlforkids-managed-$sid

ibmcloud resource service-instance-create $servicename conversation standard $region >> $DIR/../logs/create-conv.log

convserviceid=`ibmcloud resource service-instance --location $region --output json $servicename  | jq --raw-output .[0].id`

ibmcloud resource service-key-create mlforkidsapikey Manager --instance-id "$convserviceid" >> $DIR/../logs/create-conv.log

convapikey=`ibmcloud resource service-keys --instance-id "$convserviceid" --output json | jq --raw-output .[0].credentials.apikey`

uuid=`uuidgen | tr '[:upper:]' '[:lower:]'`

convuser=${convapikey:0:22}
convpass=${convapikey:22:22}

echo "INSERT INTO bluemixcredentials (id, classid, servicetype, credstypeid, url, username, password, notes) "
echo "VALUES "
echo "('$uuid', '$classname', 'conv', 2, 'https://gateway.watsonplatform.net/assistant/api', '$convuser', '$convpass', '$servicename')"
echo ";"
