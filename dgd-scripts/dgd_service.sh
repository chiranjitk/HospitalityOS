#!/bin/bash
##################################################################################
#  StaySuite HospitalityOS — DGD Service Wrapper                                #
#  start|stop|restart|status                                                    #
#  Updated: tblregistration → MultiWanConfig, tblgateway → Gateway              #
##################################################################################

. /etc/staysuite/dgd/env.sh

GW_CHECK_SH=$DGD_DIR/gateway_check.sh
GW_STAT_PROP=$DGD_DIR/gatewayStatus.properties
MULTIGW_CSV=$DGD_DIR/multiplegw.csv
FLAG_FILE=$DGD_DIR/flag_file
GATEWAY_WITH_ID=$DGD_DIR/gateway_with_id.txt
NETMASK_TO_NET_BITS=$DGD_DIR/netmasktonetbits.sh

is_dgd_script_running()
{
        ps -efww | grep 'dgd.sh' | grep -v grep > /dev/null 2>&1
        is_dgd_running=$?
}

function start_dgd()
{
        echo "DGD Service Start Signal Received"
        echo -e "\n`date` : DGD Service Start Signal Received" >> $LOGFILE

        # Check MultiWanConfig is enabled (replaces tblregistration check)
        config_enabled=`db_query "SELECT enabled FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1;"`
        if [ "$config_enabled" != "t" ]; then
                echo "Multi-WAN DGD is NOT ENABLED in MultiWanConfig"
                echo -e "\n`date` : Multi-WAN DGD NOT ENABLED" >> $LOGFILE
                exit 0;
        fi

        # Check >1 gateway (replaces count(*) from tblgateway)
        no_of_gw=`db_query "SELECT count(*) FROM \"Gateway\"
                             WHERE \"multiWanConfigId\" = (
                               SELECT id FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1
                             );" | awk '{print $1}'`

        if [ "$no_of_gw" -gt 1 ] 2>/dev/null; then
                echo -e "\n`date` : Multi-WAN ENABLED and $no_of_gw gateways configured" >> $LOGFILE
        else
                echo "Number of Gateways need to be MORE THAN ONE to use DGD"
                echo -e "\n`date` : Only $no_of_gw gateway(s) configured. Need 2+." >> $LOGFILE
                exit 0;
        fi

        # Generate dgd.conf before starting
        if [ -x $DGD_DIR/generate_dgd_conf.sh ]; then
                $DGD_DIR/generate_dgd_conf.sh
        fi

        # Generate route tables before starting
        if [ -x $DGD_DIR/generate_route_tables.sh ]; then
                $DGD_DIR/generate_route_tables.sh
        fi

        is_dgd_script_running;

        if [ $is_dgd_running -eq 0 ]; then
                echo "DGD Service is Already Running"
                echo "`date` : DGD Service is Already Running" >> $LOGFILE
                return 1;
        else
                echo -n "Starting DGD Service : "
                sh $DGD_DIR/dgd.sh >/dev/null 2>&1 &
                sleep 2
                echo "[ OK ]"
                echo -e "\n`date` : Service DGD Started Successfully\n" >> $LOGFILE
        fi
}

function stop_dgd()
{
        echo "DGD Service Stop Signal Received"
        echo -e "\n`date` : DGD Service Stop Signal Received\n" >> $LOGFILE

        is_dgd_script_running;

        if [ $is_dgd_running -eq 0 ]; then
                echo -n "Stopping DGD Service : "

                # Wait for current check cycle to finish
                flag=1
                while [ $flag -le 12 ]
                do
                        if [ -e $FLAG_FILE ]; then
                                break;
                        else
                                flag=`expr $flag + 1`
                                sleep 1
                        fi
                done

                kill -9 `ps -efww | grep 'dgd.sh' | grep -v grep | awk '{print $2}'`
                sleep 2
                echo "[ OK ]"
                echo -e "`date` : Service DGD Stopped Successfully\n" >> $LOGFILE
        else
                echo "DGD Service is Already Stopped"
                echo "`date` : DGD Service is Already Stopped" >> $LOGFILE
                return 1;
        fi
}

status_dgd()
{
        is_dgd_script_running;

        if [ $is_dgd_running -eq 0 ]; then
                echo
                echo "DGD Status : [ Running ]"
                echo
                echo "    Gateway Status"
                echo "----------------------"
                echo -e "     IP\t\tTABLE\t\tSTATUS"
                echo -e "-----------\t------\t\t------"

                if [ -f $GW_STAT_PROP ]; then
                        while read line
                        do
                                IP=`echo "$line" | awk -F',' '{print $1}'`
                                STATUS=`echo "$line" | awk -F',' '{print $2}'`
                                if [ "$STATUS" = "0" ]; then
                                        STATUS=LIVE
                                else
                                        STATUS=DEAD
                                fi
                                # Look up table ID
                                gw_table=`grep "$IP" $MULTIGW_CSV 2>/dev/null | awk -F',' '{print $3}'`
                                echo -e "$IP\tgw${gw_table}nof\t$STATUS"
                        done < $GW_STAT_PROP
                fi

                echo ""
                echo -e "EXPLICIT_ROUTE          GATEWAY_IP\tTABLE\t\tSTATUS"
                echo -e "--------------          ----------\t------\t\t------"

                # Fetch gateways: routingTableId, ipAddress, id (UUID)
                db_query "SELECT \"routingTableId\", \"ipAddress\", id FROM \"Gateway\"
                           WHERE \"multiWanConfigId\" = (
                             SELECT id FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1
                           )
                           ORDER BY \"routingTableId\";" | awk 'NF' > $GATEWAY_WITH_ID

                cat $GATEWAY_WITH_ID | while read line
                do
                        gw_table=`echo $line | awk -F',' '{print $1}'`
                        gateway_ip=`echo $line | awk -F',' '{print $2}'`
                        gateway_uuid=`echo $line | awk -F',' '{print $3}'`

                        # Query explicit routes using UUID FK
                        db_query "SELECT network FROM \"GatewayExplicitRoute\" WHERE \"gatewayId\" = '$gateway_uuid';" | awk 'NF' | while read network
                        do
                                cidr=`echo $network | awk '{print $1}'`
                                ip=`echo $cidr | awk -F'/' '{print $1}'`
                                prefix=`echo $cidr | awk -F'/' '{print $2}'`

                                if [ "$prefix" = "32" ] 2>/dev/null; then
                                        ip rule show | grep 200: | grep "$ip lookup" > /dev/null 2>&1
                                        ret_state=$?
                                else
                                        ip rule show | grep 200: | grep "$ip/$prefix" > /dev/null 2>&1
                                        ret_state=$?
                                fi

                                if [ $ret_state -eq 0 ]; then
                                        status="LIVE"
                                else
                                        status="DEAD"
                                fi

                                echo -e "$network   $gateway_ip\tgw${gw_table}nof\t$status"
                        done
                done
                echo ""

        else
                echo "DGD Status : [ Stopped ]"
        fi
}

case "$1" in
        start)
                start_dgd
                ;;
        stop)
                stop_dgd
                ;;
        restart)
                $0 stop
                sleep 5
                $0 start
                ;;
        status)
                status_dgd
                ;;
        *)
                echo "Usage: $0 {start|stop|restart|status}"
                exit 1;
                ;;
esac
