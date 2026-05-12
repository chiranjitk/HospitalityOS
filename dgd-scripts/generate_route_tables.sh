#!/bin/bash
##################################################################################
#  StaySuite HospitalityOS — Generate Linux Routing Tables                      #
#                                                                              #
#  This script sets up iproute2 routing tables for DGD multi-WAN:              #
#  - Per-gateway tables: gw<N>nof (e.g. gw101nof, gw102nof)                   #
#  - Main DGD failover table: 221                                              #
#  - Explicit route rules (source-based routing)                               #
#  - Fwmark routing rules                                                      #
#  - Default routes per gateway                                                #
#                                                                              #
#  Table mapping:                                                               #
#    /etc/iproute2/rt_tables  →  name-to-number mapping                       #
#    100 gw101nof   (gateway with routingTableId=101)                          #
#    101 gw102nof   (gateway with routingTableId=102)                          #
#    221 dgd-main   (DGD failover table)                                       #
#    252 fwmark-1   (fwmark 0x1)                                              #
#    253 fwmark-2   (fwmark 0x2)                                              #
#                                                                              #
#  Updated: Uses Gateway, GatewayExplicitRoute, GatewayFwmark from PostgreSQL  #
##################################################################################

. /etc/staysuite/dgd/env.sh

RT_TABLES=/etc/iproute2/rt_tables
RT_TABLES_BACKUP=$DGD_DIR/rt_tables.backup
DGD_TABLE_NUM=221
FWMARK_BASE_NUM=250

echo "`date` : Generating routing tables for DGD" >> $LOGFILE

# ── Backup existing rt_tables ──
if [ -f $RT_TABLES ]; then
        cp $RT_TABLES $RT_TABLES_BACKUP
fi

# ── Remove previous StaySuite DGD entries from rt_tables ──
# Keep system tables (local, main, default) and any user-added tables
if [ -f $RT_TABLES ]; then
        grep -v -E '(gw[0-9]+nof|dgd-main|fwmark-)' $RT_TABLES > ${RT_TABLES}.tmp
        mv -f ${RT_TABLES}.tmp $RT_TABLES
fi

# ── Fetch all gateways: routingTableId, ipAddress, interfaceName, id (UUID), weight ──
db_query "SELECT \"routingTableId\", \"ipAddress\", \"interfaceName\", id, weight
           FROM \"Gateway\"
           WHERE \"multiWanConfigId\" = (
             SELECT id FROM \"MultiWanConfig\" WHERE enabled = true LIMIT 1
           )
           ORDER BY \"routingTableId\";" > $MULTIGW_CSV

no_of_gateways=`awk 'NF' $MULTIGW_CSV | wc -l`

if [ $no_of_gateways -eq 0 ]; then
        echo "`date` : No gateways configured. Nothing to generate." >> $LOGFILE
        exit 1
fi

table_counter=100

# ── Generate per-gateway routing tables ──
while read line
do
        gw_line=`echo $line | awk '{print $1}'`
        gw_table_id=`echo $gw_line | awk -F',' '{print $1}'`
        gw_ip=`echo $gw_line | awk -F',' '{print $2}'`
        gw_iface=`echo $gw_line | awk -F',' '{print $3}'`
        gw_uuid=`echo $gw_line | awk -F',' '{print $4}'`
        gw_weight=`echo $gw_line | awk -F',' '{print $5}'`

        # Use routingTableId if set, otherwise auto-assign from 101+
        if [ -n "$gw_table_id" ] && [ "$gw_table_id" != "0" ]; then
                rt_num=$gw_table_id
                rt_name="gw${gw_table_id}nof"
        else
                rt_num=$(expr 100 + $table_counter)
                rt_name="gw${rt_num}nof"
                table_counter=$(expr $table_counter + 1)
        fi

        echo "`date` : Gateway $gw_ip ($gw_iface) → table $rt_num ($rt_name)" >> $LOGFILE

        # Add to rt_tables
        echo "$rt_num    $rt_name" >> $RT_TABLES

        # ── Flush and recreate per-gateway routing table ──
        # Remove all existing routes in this table
        ip route flush table $rt_name 2>/dev/null

        # Add default route via this gateway
        if [ "$gw_weight" -ne 0 ] 2>/dev/null; then
                ip route add default via $gw_ip dev $gw_iface table $rt_name 2>/dev/null
                if [ $? -eq 0 ]; then
                        echo "`date` :   Added default via $gw_ip dev $gw_iface table $rt_name" >> $LOGFILE
                else
                        echo "`date` :   WARNING: Could not add default route to table $rt_name" >> $LOGFILE
                fi
        fi

        # ── Setup explicit routes (source-based routing) ──
        db_query "SELECT network FROM \"GatewayExplicitRoute\" WHERE \"gatewayId\" = '$gw_uuid';" | while read net_line
        do
                cidr=`echo $net_line | awk '{print $1}'`
                if [ -n "$cidr" ]; then
                        ip=`echo $cidr | awk -F'/' '{print $1}'`
                        prefix=`echo $cidr | awk -F'/' '{print $2}'`

                        # Remove any existing rules for this CIDR at preference 200
                        while :; do
                                ip rule del from ${ip}/${prefix} table $rt_name pref 200 2>/dev/null
                                if [ $? -ne 0 ]; then break; fi
                        done;

                        # Add explicit route rule
                        ip rule add from ${ip}/${prefix} table $rt_name pref 200
                        echo "`date` :   Explicit route: from ${ip}/${prefix} → table $rt_name" >> $LOGFILE
                fi
        done

        # ── Setup fwmark routing rules ──
        db_query "SELECT \"fwmarkValue\" FROM \"GatewayFwmark\" WHERE \"gatewayId\" = '$gw_uuid';" | while read fw_line
        do
                fwmark=`echo $fw_line | awk '{print $1}'`
                if [ -n "$fwmark" ]; then
                        # Remove existing fwmark rule
                        ip rule del fwmark $fwmark table $rt_name 2>/dev/null

                        # Add fwmark rule
                        ip rule add fwmark $fwmark table $rt_name
                        echo "`date` :   Fwmark route: fwmark $fwmark → table $rt_name" >> $LOGFILE

                        # Register fwmark table in rt_tables
                        fwmark_num=$(expr $FWMARK_BASE_NUM + $(echo $fwmark | sed 's/0x//'))
                        fwmark_name="fwmark-$(echo $fwmark | sed 's/0x//')"
                        grep -q "$fwmark_name" $RT_TABLES || echo "$fwmark_num    $fwmark_name" >> $RT_TABLES
                fi
        done

done < <(awk 'NF' $MULTIGW_CSV)

# ── Setup main DGD failover table (221) ──
grep -q "dgd-main" $RT_TABLES || echo "$DGD_TABLE_NUM    dgd-main" >> $RT_TABLES
ip route flush table dgd-main 2>/dev/null

# Build initial 221-new script with default route entries for all active gateways
echo "#!/bin/bash" > $NEW_221
echo "# DGD Table 221 — Auto-generated" >> $NEW_221
echo "# This script is dynamically updated by gateway_check.sh" >> $NEW_221
echo "# Initial routes for all active gateways:" >> $NEW_221
echo "" >> $NEW_221

while read line
do
        gw_line=`echo $line | awk '{print $1}'`
        gw_ip=`echo $gw_line | awk -F',' '{print $2}'`
        gw_weight=`echo $gw_line | awk -F',' '{print $5}'`

        if [ "$gw_weight" -ne 0 ] 2>/dev/null; then
                echo "ip route replace default via $gw_ip table $DGD_TABLE_NUM" >> $NEW_221
                echo "`date` : Table 221: default via $gw_ip" >> $LOGFILE
        fi
done < <(awk 'NF' $MULTIGW_CSV)

echo "" >> $NEW_221
chmod 755 $NEW_221

# ── Apply initial table 221 routes ──
sh $NEW_221
ip route flush cache

# ── Add ip rule for table 221 (main DGD failover routing) ──
# Priority 220: if no explicit route or fwmark matches, use DGD table 221
while :; do
        ip rule del pref 220 table $DGD_TABLE_NUM 2>/dev/null
        if [ $? -ne 0 ]; then break; fi
done;
ip rule add pref 220 table $DGD_TABLE_NUM

echo "`date` : Table 221 (DGD failover) activated at preference 220" >> $LOGFILE

# ── Summary ──
echo ""
echo "=== DGD Route Table Summary ==="
echo "Gateways configured: $no_of_gateways"
echo ""
echo "Routing Tables:"
awk 'NF' $MULTIGW_CSV | while read line
do
        gw_ip=`echo $line | awk -F',' '{print $2}'`
        gw_iface=`echo $line | awk -F',' '{print $3}'`
        gw_table_id=`echo $line | awk -F',' '{print $1}'`
        echo "  gw${gw_table_id}nof  →  $gw_ip via $gw_iface"
done
echo ""
echo "DGD Failover Table: 221 (preference 220)"
echo ""
echo "Current ip rule list:"
ip rule show
echo ""
echo "Route tables written to: $RT_TABLES"
echo "Full log: $LOGFILE"
