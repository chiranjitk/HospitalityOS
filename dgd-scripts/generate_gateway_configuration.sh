#!/bin/bash
##################################################################################
#  StaySuite HospitalityOS — Generate Per-Gateway Configuration Files            #
#  Generates gateway.conf_<routingTableId> from Gateway + GatewayHealthRule +    #
#  GatewayExplicitRoute + GatewayFwmark tables (PostgreSQL)                     #
#  Updated: tblgateway → Gateway, tbldgdgatewayrule → GatewayHealthRule,        #
#  tblgatewaynetworkrel → GatewayExplicitRoute, tblfwmark → GatewayFwmark       #
##################################################################################

. /etc/staysuite/dgd/env.sh

rm -f $GW_CONFIG*

MAIN_CONFIG=$DGD_DIR/multiple_gateway.conf

# ── Count gateways and get config interval ──
NO_OF_GATEWAYS=`db_query "SELECT count(*) FROM \"Gateway\"
                           WHERE \"multiWanConfigId\" = (
                             SELECT id FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1
                           );" | awk '{print $1}'`

check_interval=`db_query "SELECT \"checkInterval\" FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1;" | awk '{print $1}'`
check_interval=${check_interval:-20}

echo "NO_OF_GATEWAYS=$NO_OF_GATEWAYS" > $MAIN_CONFIG
echo "TIMEOUT=$check_interval" >> $MAIN_CONFIG

. $MAIN_CONFIG

echo "`date` : Generating config for $NO_OF_GATEWAYS gateways, interval=${check_interval}s" >> $LOGFILE

# ── Iterate each gateway ──
db_query "SELECT id, name, \"ipAddress\", \"interfaceName\", \"routingTableId\",
                  weight, \"isBackup\", \"backupGatewayId\"
           FROM \"Gateway\"
           WHERE \"multiWanConfigId\" = (
             SELECT id FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1
           )
           ORDER BY \"routingTableId\";" | while read gw_line
do
        gw_uuid=`echo $gw_line | awk -F',' '{print $1}'`
        gw_name=`echo $gw_line | awk -F',' '{print $2}'`
        gw_ip=`echo $gw_line | awk -F',' '{print $3}'`
        gw_iface=`echo $gw_line | awk -F',' '{print $4}'`
        gw_table=`echo $gw_line | awk -F',' '{print $5}'`
        gw_weight=`echo $gw_line | awk -F',' '{print $6}'`
        gw_isbackup=`echo $gw_line | awk -F',' '{print $7}'`
        gw_backupgw=`echo $gw_line | awk -F',' '{print $8}'`

        CONFIG_FILE=${GW_CONFIG}${gw_table}
        cat /dev/null > $CONFIG_FILE

        echo "gateway_uuid=$gw_uuid" >> $CONFIG_FILE
        echo "routingtableid=$gw_table" >> $CONFIG_FILE
        echo "gatewayname='$gw_name'" >> $CONFIG_FILE
        echo "ipaddress=$gw_ip" >> $CONFIG_FILE
        echo "interface=$gw_iface" >> $CONFIG_FILE
        echo "weight=$gw_weight" >> $CONFIG_FILE
        echo "isbackup=$gw_isbackup" >> $CONFIG_FILE
        echo "backupgatewayid=$gw_backupgw" >> $CONFIG_FILE

        # Get source IP from interface
        source_ip=`ip -4 addr show $gw_iface | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1`
        echo "source_ip=$source_ip" >> $CONFIG_FILE

        # ── Health Rules (GatewayHealthRule) ──
        RULE_ITERATOR=1
        db_query "SELECT protocol, host, port FROM \"GatewayHealthRule\"
                   WHERE \"gatewayId\" = '$gw_uuid'
                   ORDER BY \"sortOrder\";" | while read ruleline
        do
                protocol=`echo $ruleline | awk -F',' '{print $1}'`
                host=`echo $ruleline | awk -F',' '{print $2}'`
                port=`echo $ruleline | awk -F',' '{print $3}'`
                echo "protocol${RULE_ITERATOR}=$protocol" >> $CONFIG_FILE
                echo "host${RULE_ITERATOR}=$host" >> $CONFIG_FILE
                echo "port${RULE_ITERATOR}=${port:-0}" >> $CONFIG_FILE
                RULE_ITERATOR=`expr $RULE_ITERATOR + 1`
        done

        # ── Explicit Routes (GatewayExplicitRoute) ──
        EXPLICIT_RULE_ITERATOR=1
        db_query "SELECT network FROM \"GatewayExplicitRoute\" WHERE \"gatewayId\" = '$gw_uuid';" | while read rules
        do
                network=`echo $rules | awk '{print $1}'`
                if [ -n "$network" ]; then
                        echo "EXPLICIT_RULE${EXPLICIT_RULE_ITERATOR}='$network'" >> $CONFIG_FILE
                        EXPLICIT_RULE_ITERATOR=`expr $EXPLICIT_RULE_ITERATOR + 1`
                fi
        done

        # ── Fwmark Rules (GatewayFwmark) ──
        fwmark=`db_query "SELECT \"fwmarkValue\" FROM \"GatewayFwmark\" WHERE \"gatewayId\" = '$gw_uuid';" | tr '\n' ' '`
        echo "fwmark=$fwmark" >> $CONFIG_FILE

        echo "`date` : Generated $CONFIG_FILE for $gw_name ($gw_ip)" >> $LOGFILE
done

echo "`date` : Per-gateway configuration files generated" >> $LOGFILE
echo "Generated $NO_OF_GATEWAYS gateway config files in $DGD_DIR/"
