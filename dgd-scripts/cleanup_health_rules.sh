#!/bin/bash
##################################################################################
#  StaySuite HospitalityOS — Cleanup Gateway Health Rules                       #
#  Removes unsupported UDP rules from GatewayHealthRule.                        #
#  Ensures at least 1 PING rule per gateway.                                    #
#  Updated: tbldgdgatewayrule → GatewayHealthRule                               #
##################################################################################

. /etc/staysuite/dgd/env.sh

GATEWAY_FILE=$DGD_DIR/gateway.tmp

# ── Fetch all gateway UUIDs ──
db_query "SELECT id, \"ipAddress\" FROM \"Gateway\"
           WHERE \"multiWanConfigId\" = (
             SELECT id FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1
           )
           ORDER BY \"routingTableId\";" | awk 'NF' > $GATEWAY_FILE

cat $GATEWAY_FILE | while read line
do
        gateway_uuid=`echo $line | awk -F',' '{print $1}'`
        gateway_ip=`echo $line | awk -F',' '{print $2}'`

        echo "`date` : Checking health rules for $gateway_ip" >> $LOGFILE

        # Count non-UDP rules
        no_of_condition=`db_query "SELECT count(*) FROM \"GatewayHealthRule\"
                                    WHERE \"gatewayId\" = '$gateway_uuid' AND protocol != 'UDP';" | awk '{print $1}'`

        # Remove all UDP rules (DGD doesn't support UDP health checks)
        db_exec "DELETE FROM \"GatewayHealthRule\" WHERE \"gatewayId\" = '$gateway_uuid' AND protocol = 'UDP';"

        if [ "$no_of_condition" -eq 0 ] 2>/dev/null; then
                echo "`date` : No valid health rules for $gateway_ip. Adding default PING rule." >> $LOGFILE
                # Insert default PING rule: ping the gateway IP itself
                db_exec "INSERT INTO \"GatewayHealthRule\" (\"gatewayId\", \"tenantId\", protocol, host, port, \"sortOrder\")
                         SELECT '$gateway_uuid', \"tenantId\", 'PING', '$gateway_ip', 0, 0
                         FROM \"Gateway\" WHERE id = '$gateway_uuid';"
        fi
done

echo "`date` : Health rule cleanup complete" >> $LOGFILE
