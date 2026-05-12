#!/bin/bash
##################################################################################
#  StaySuite HospitalityOS — DGD Main Daemon                                    #
#  Updated: Table names → Gateway, GatewayHealthRule, GatewayExplicitRoute,     #
#           GatewayFwmark. Uses psql instead of dbi. UUID id for DB FK,         #
#           routingTableId for Linux ip rule operations.                         #
##################################################################################

. /etc/staysuite/dgd/env.sh

GW_CHECK_SH=$DGD_DIR/gateway_check.sh

rm -f $GW_STAT_PROP*

echo "`date` : DGD daemon starting" >> $LOGFILE

# ── Fetch all gateways: UUID, ipAddress, routingTableId, interfaceName, weight ──
# CSV output: uuid,ipAddress,routingTableId,interfaceName,weight
db_query "SELECT id, \"ipAddress\", \"routingTableId\", \"interfaceName\", weight
           FROM \"Gateway\"
           WHERE \"multiWanConfigId\" = (
             SELECT id FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1
           )
           ORDER BY \"routingTableId\";" > $MULTIGW_CSV

no_of_gateways=`awk 'NF' $MULTIGW_CSV | wc -l`

if [ $no_of_gateways -lt 2 ]; then
    echo "`date` : Less than 2 gateways configured. DGD requires multi-WAN. Exiting." >> $LOGFILE
    exit 1
fi

iterator=1
while [ $iterator -le $no_of_gateways ]
do
        gw_string=`sed -n ${iterator}p $MULTIGW_CSV`
        gw_uuid=`echo $gw_string | awk -F',' '{print $1}'`
        gw_ip=`echo $gw_string | awk -F',' '{print $2}'`
        gw_table=`echo $gw_string | awk -F',' '{print $3}'`

        echo "`date` : Initializing gateway $gw_table ($gw_ip)" >> $LOGFILE

        # Mark all gateways as DEAD (status=1) at startup
        echo ${gw_ip},1 >> $GW_STAT_PROP.tmp

        # ── Setup explicit routes for this gateway ──
        # query uses UUID as FK
        db_query "SELECT network FROM \"GatewayExplicitRoute\" WHERE \"gatewayId\" = '$gw_uuid';" > $EXPLICIT_ROUTE

        while read line; do
                # network is already in CIDR format (e.g. 192.168.1.0/24)
                cidr=`echo $line | awk '{print $1}'`
                ip=`echo $cidr | awk -F'/' '{print $1}'`
                prefix=`echo $cidr | awk -F'/' '{print $2}'`

                if [ -z "$prefix" ] || [ "$prefix" -lt 0 ] 2>/dev/null || [ "$prefix" -gt 32 ] 2>/dev/null; then
                        continue;
                fi

                # Remove any existing rules for this CIDR + table
                while :; do
                        ip rule del from ${ip}/${prefix} table gw${gw_table}nof pref 200 2>/dev/null
                        if [ $? -ne 0 ]; then break; fi
                done;

                # Add explicit route rule (will be activated when gateway goes LIVE)
                ip rule add from ${ip}/${prefix} table gw${gw_table}nof pref 200
                echo "`date` : Explicit route ${ip}/${prefix} → table gw${gw_table}nof" >> $LOGFILE

        done < <(awk 'NF' $EXPLICIT_ROUTE)

        iterator=`expr $iterator + 1`
done

mv -f $GW_STAT_PROP.tmp $GW_STAT_PROP

# ── Main DGD loop: check gateway health at regular intervals ──
while true
do
        /bin/sh $GW_CHECK_SH
        sleep_interval=`db_query "SELECT \"checkInterval\" FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1;" | awk '{print $1}'`
        sleep_interval=${sleep_interval:-20}
        echo "`date` : Sleeping for $sleep_interval Seconds" >> $LOGFILE
        sleep $sleep_interval
done
