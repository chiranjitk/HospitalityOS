#!/bin/bash
##################################################################################
#  StaySuite HospitalityOS — Gateway Health Check Engine                        #
#  Updated: Gateway, GatewayHealthRule, GatewayExplicitRoute tables.            #
#  psql + UUID for DB lookups, routingTableId for ip rule commands.             #
##################################################################################

. /etc/staysuite/dgd/env.sh

FILE_COUNT=1
RULE_FILE=$GATEWAY_RULE_FILE$FILE_COUNT
any_gateway_status_changed=0

# ── Check MultiWanConfig is enabled and has >1 gateway ──
function check_registration_status()
{
        config_enabled=`db_query "SELECT enabled FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1;"`
        if [ "$config_enabled" != "t" ]; then
                echo "`date` : Multi-WAN DGD is not enabled in MultiWanConfig." >> $LOGFILE
                exit 1;
        fi

        db_query "SELECT id, \"ipAddress\", \"routingTableId\", \"interfaceName\", weight
                   FROM \"Gateway\"
                   WHERE \"multiWanConfigId\" = (
                     SELECT id FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1
                   )
                   ORDER BY \"routingTableId\";" > $MULTIGW_CSV

        no_of_gateways=`awk 'NF' $MULTIGW_CSV | wc -l`

        if [ $no_of_gateways -eq 1 ]; then
                echo "`date` : Only 1 gateway configured. DGD needs 2+." >> $LOGFILE
                exit 1;
        fi

        if [ $no_of_gateways -eq 0 ]; then
                echo "`date` : No gateways configured. Exiting." >> $LOGFILE
                exit 1;
        fi
}

# ── Parse dgd.conf into per-gateway rule files ──
function parse_rule_to_gateway_file()
{
        rm -f $GATEWAY_RULE_FILE*
        while read line
        do
                if [ "$line" = "{" ]; then
                        valid_line=1;
                fi

                if [ "$line" = "}" ]; then
                        valid_line=0;
                        FILE_COUNT=`expr $FILE_COUNT + 1`
                        RULE_FILE=$GATEWAY_RULE_FILE$FILE_COUNT
                fi

                if [ $valid_line -eq 1 -a "$line" != "{" ]; then
                        echo "$line" >> $RULE_FILE
                fi
        done < $DGD_CONF
}

# ── Parse a single gateway rule file ──
function parse_gateway_file()
{
        echo "`date` : Content of GATEWAY $FILE_COUNT" >> $LOGFILE
        GW_IP=`head -1 $GATEWAY_RULE_FILE$FILE_COUNT`
        ACTION=`tail -1 $GATEWAY_RULE_FILE$FILE_COUNT`
        echo "`date` : Gateway IP = $GW_IP" >> $LOGFILE
        echo "`date` : $ACTION" >> $LOGFILE
        echo $ACTION | sed 's/[^&|]//g' | sed 's/\(.\{1\}\)/\1 /g' | tr ' ' '\n' | sed '/^$/d' > $ACTION_FILE
        grep -ir "rule" $GATEWAY_RULE_FILE$FILE_COUNT | cut -d " " -f 2- > $FAILOVER_COND
        no_of_condition=`cat $FAILOVER_COND | wc -l`
        echo "`date` : NO OF CONDITION = $no_of_condition" >> $LOGFILE

        # Look up gateway UUID and routingTableId from multiplegw.csv
        gw_string=`grep "$GW_IP" $MULTIGW_CSV`
        gw_uuid=`echo $gw_string | awk -F',' '{print $1}'`
        gw_table=`echo $gw_string | awk -F',' '{print $3}'`
        gw_weight=`echo $gw_string | awk -F',' '{print $5}'`
        source_interface=`echo $gw_string | awk -F',' '{print $4}'`

        # Get source IP from interface (modern ip command)
        source_ip=`ip -4 addr show $source_interface | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1`
        echo "`date` : SOURCE INTERFACE = $source_interface" >> $LOGFILE
        echo "`date` : SOURCE IP = $source_ip" >> $LOGFILE
        echo "`date` : ROUTING TABLE = gw${gw_table}nof" >> $LOGFILE
}

# ── Perform health checks (PING/TCP) for a gateway ──
function check_gateway_status()
{
        previousstatus=`grep $GW_IP $GW_STAT_PROP | awk -F',' '{print $2}'`
        if [ -z "$previousstatus" ]; then
                echo "`date` : Previous Cycle Same Gateway Status : Not Found, assuming DEAD(1)" >> $LOGFILE
                previousstatus=1
        else
                echo "`date` : Previous Cycle Same Gateway Status : $previousstatus" >> $LOGFILE
        fi
        echo -n > $RET_STATUS_FILE

        while read line
        do
                failure_proto=`echo $line | awk '{print $1}'`
                connect_ip=`echo $line | awk '{print $2}'`
                connect_port=`echo $line | awk '{print $3}'`
                echo "`date` : Testing Connection $failure_proto $connect_ip $connect_port" >> $LOGFILE

                if [ "$failure_proto" = "ping" ]; then
                        # Temp route trick: if gateway was DEAD, add temporary route to reach health check target
                        if [ $previousstatus -eq 1 ]; then
                                echo "`date` : Inserting Temp Route For $connect_ip via $GW_IP" >> $LOGFILE
                                ip route add $connect_ip via $GW_IP 2>/dev/null
                        fi

                        # Read ping count/timeout from MultiWanConfig
                        ping_count=`db_query "SELECT \"pingCount\" FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1;" | awk '{print $1}'`
                        ping_count=${ping_count:-3}
                        ping_timeout=`db_query "SELECT \"pingTimeout\" FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1;" | awk '{print $1}'`
                        ping_timeout=${ping_timeout:-2}

                        ping -n -c $ping_count -W $ping_timeout -I $source_interface $connect_ip > /dev/null 2>&1
                        return_status=$?

                        if [ $previousstatus -eq 1 ]; then
                                echo "`date` : Deleting Temp Route For $connect_ip" >> $LOGFILE
                                ip route del $connect_ip via $GW_IP 2>/dev/null
                        fi

                elif [ "$failure_proto" = "tcp" ]; then
                        if [ $previousstatus -eq 1 ]; then
                                echo "`date` : Inserting Temp Route For $connect_ip via $GW_IP" >> $LOGFILE
                                ip route add $connect_ip via $GW_IP 2>/dev/null
                        fi

                        tcp_timeout=`db_query "SELECT \"tcpTimeout\" FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1;" | awk '{print $1}'`
                        tcp_timeout=${tcp_timeout:-5}

                        nc -s $source_ip -z -w$tcp_timeout -n $connect_ip $connect_port > /dev/null 2>&1
                        return_status=$?

                        if [ $previousstatus -eq 1 ]; then
                                echo "`date` : Deleting Temp Route For $connect_ip" >> $LOGFILE
                                ip route del $connect_ip via $GW_IP 2>/dev/null
                        fi

                elif [ "$failure_proto" = "udp" ]; then
                        # UDP checks not supported, always pass
                        return_status=0
                else
                        echo "`date` : DGD does not support $failure_proto" >> $LOGFILE
                        return_status=1
                fi
                echo "`date` : $failure_proto status : $return_status" >> $LOGFILE
                echo "$return_status" >> $RET_STATUS_FILE
        done < $FAILOVER_COND
}

# ── Build final condition script from individual check results ──
function prepare_final_condition_script()
{
        iterator=1

        echo "#!/bin/bash" > $FINAL_CONDITION
        echo -n "if [ " >> $FINAL_CONDITION
        while [ $iterator -le $no_of_condition ]
        do
                ret_stat=`sed -n ${iterator}p $RET_STATUS_FILE`
                echo -n "$ret_stat -ne 0 " >> $FINAL_CONDITION
                if [ $iterator -eq $no_of_condition ]; then
                        break;
                fi
                if [ "`sed -n ${iterator}p $ACTION_FILE`" = '&' ]; then
                        echo -n "-a " >> $FINAL_CONDITION
                else
                        echo -n "-o " >> $FINAL_CONDITION
                fi
                iterator=`expr $iterator + 1`
        done
        echo " ]; then" >> $FINAL_CONDITION
        echo -e "\texit 1;\nelse\n\texit 0\nfi" >> $FINAL_CONDITION

        chmod 755 $FINAL_CONDITION
}

# ── Manage gateway: check health, update status, manage explicit routes + table 221 ──
function manage_gateway()
{
        parse_gateway_file
        check_gateway_status
        prepare_final_condition_script

        /bin/sh $FINAL_CONDITION
        gateway_final_status=$?

        echo "`date` : Weight $gw_weight" >> $LOGFILE

        # Weight 0 = gateway disabled/offline
        if [ $gw_weight -eq 0 ]; then
                gateway_final_status=1;
        fi

        # 0 = LIVE, 1 = DEAD
        if [ $gateway_final_status -eq 0 ]; then
                echo "`date` : Gateway $GW_IP (table gw${gw_table}nof) status : LIVE" >> $LOGFILE
                echo ${GW_IP},0 >> $GW_STAT_PROP.tmp
        else
                echo "`date` : Gateway $GW_IP (table gw${gw_table}nof) status : DEAD" >> $LOGFILE
                echo ${GW_IP},1 >> $GW_STAT_PROP.tmp
        fi

        # ── If gateway is DEAD: remove all its explicit route rules ──
        if [ $gateway_final_status -ne 0 ]; then
                db_query "SELECT network FROM \"GatewayExplicitRoute\" WHERE \"gatewayId\" = '$gw_uuid';" > $EXPLICIT_DEAD_ROUTE

                while read line; do
                        cidr=`echo $line | awk '{print $1}'`
                        ip=`echo $cidr | awk -F'/' '{print $1}'`
                        prefix=`echo $cidr | awk -F'/' '{print $2}'`

                        if [ -z "$prefix" ] || [ "$prefix" -lt 0 ] 2>/dev/null || [ "$prefix" -gt 32 ] 2>/dev/null; then
                                continue;
                        fi

                        while :; do
                                ip rule del from ${ip}/${prefix} table gw${gw_table}nof pref 200 2>/dev/null
                                if [ $? -ne 0 ]; then break; fi
                        done;
                done < <(awk 'NF' $EXPLICIT_DEAD_ROUTE)
        fi

        # ── If gateway status CHANGED: add/remove explicit route rules ──
        if [ $previousstatus -ne $gateway_final_status ]; then
                db_query "SELECT network FROM \"GatewayExplicitRoute\" WHERE \"gatewayId\" = '$gw_uuid';" > $EXPLICIT_DEAD_ROUTE

                while read line; do
                        cidr=`echo $line | awk '{print $1}'`
                        ip=`echo $cidr | awk -F'/' '{print $1}'`
                        prefix=`echo $cidr | awk -F'/' '{print $2}'`

                        if [ -z "$prefix" ] || [ "$prefix" -lt 0 ] 2>/dev/null || [ "$prefix" -gt 32 ] 2>/dev/null; then
                                continue;
                        fi

                        # Remove all existing rules first
                        while :; do
                                ip rule del from ${ip}/${prefix} table gw${gw_table}nof pref 200 2>/dev/null
                                if [ $? -ne 0 ]; then break; fi
                        done;

                        if [ $gateway_final_status -ne 0 ]; then
                                # Gateway went DEAD — explicit route removed (rule deleted above)
                                echo "`date` : Gateway DEAD — Removing Explicit Route ${ip}/${prefix}" >> $LOGFILE
                        else
                                # Gateway went LIVE — add explicit route rule back
                                echo "`date` : Gateway LIVE — Adding Explicit Route ${ip}/${prefix}" >> $LOGFILE
                                ip rule add from ${ip}/${prefix} table gw${gw_table}nof pref 200
                        fi
                        ip route flush cache
                done < <(awk 'NF' $EXPLICIT_DEAD_ROUTE)

                any_gateway_status_changed=1;
        fi
        echo >> $LOGFILE
}

# ── MAIN ──
function main()
{
        check_registration_status
        rm -f $FLAG_FILE

        parse_rule_to_gateway_file

        FILE_COUNT=1
        sed -n 1p $NEW_221 | sed 's/add/change/' > $NEW_221.tmp
        while true
        do
                if [ ! -e $GATEWAY_RULE_FILE$FILE_COUNT ]; then
                        break;
                fi

                manage_gateway
                FILE_COUNT=`expr $FILE_COUNT + 1`
                # Collect LIVE gateway routes into 221-new.tmp
                if [ $gateway_final_status -eq 0 ]; then
                        grep "$GW_IP" $NEW_221 >> $NEW_221.tmp
                fi
        done

        echo >> $NEW_221.tmp

        # ── Apply routing changes if any gateway status changed ──
        if [ $any_gateway_status_changed -eq 1 ]; then
                no_of_line=`awk 'NF' $NEW_221.tmp | wc -l`
                if [ $no_of_line -lt 2 ]; then
                        echo "`date` : All gateways are DOWN. Keeping previous routes." >> $LOGFILE
                else
                        echo "`date` : Gateway State Changed. Replacing routing table 221." >> $LOGFILE
                        chmod 755 $NEW_221.tmp
                        sh $NEW_221.tmp
                        ip route flush cache
                fi
        fi

        mv -f $GW_STAT_PROP.tmp $GW_STAT_PROP
        touch $FLAG_FILE
}

main
