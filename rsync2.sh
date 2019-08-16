#!/bin/sh




params=$1

echo "$params"


if [ $params == 'pro' ]
then
    echo "rsync no plan"
else
   rsync -zvrtopgl --progress --exclude=node_modules --exclude=logs * hardrole@192.168.3.14:/home/hardrole/tokensky/tokensky_otc_server
   echo "rsync dev successful"
fi






