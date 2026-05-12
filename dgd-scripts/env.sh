#!/bin/bash
##################################################################################
#  StaySuite HospitalityOS — DGD Environment Configuration                     #
#  Shared by all DGD scripts                                                    #
##################################################################################

# Database connection (PostgreSQL)
# Override via /etc/staysuite/dgd/db.properties or env vars
if [ -f /etc/staysuite/dgd/db.properties ]; then
    . /etc/staysuite/dgd/db.properties
else
    DB_HOST="${DGD_DB_HOST:-localhost}"
    DB_PORT="${DGD_DB_PORT:-5432}"
    DB_NAME="${DGD_DB_NAME:-staysuite}"
    DB_USER="${DGD_DB_USER:-staysuite}"
    DB_PASS="${DGD_DB_PASS:-}"
fi

# Build PSQL command
if [ -n "$DB_PASS" ]; then
    export PGPASSWORD="$DB_PASS"
fi
PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -F','"

# --- Paths ---
DGD_DIR=/etc/staysuite/dgd
DGD_CONF=$DGD_DIR/dgd.conf
LOGFILE=/var/log/staysuite/dgd.log
GW_STAT_PROP=$DGD_DIR/gatewayStatus.properties
MULTIGW_CSV=$DGD_DIR/multiplegw.csv
EXPLICIT_ROUTE=$DGD_DIR/explicit_route
EXPLICIT_DEAD_ROUTE=$DGD_DIR/explicit_dead_route
NEW_221=$DGD_DIR/221-new
FLAG_FILE=$DGD_DIR/flag_file
RET_STATUS_FILE=$DGD_DIR/return_status_file
ACTION_FILE=$DGD_DIR/action_file
FINAL_CONDITION=$DGD_DIR/final_condition
GATEWAY_RULE_FILE=$DGD_DIR/gateway_rule_
GATEWAY_WITH_ID=$DGD_DIR/gateway_with_id.txt
FAILOVER_COND=$DGD_DIR/failover_condition
GW_CONFIG=$DGD_DIR/gateway.conf_
NETMASK_TO_NET_BITS=$DGD_DIR/netmasktonetbits.sh

# --- Ensure directories exist ---
mkdir -p $DGD_DIR /var/log/staysuite

# --- Utility: query DB with psql (returns CSV rows) ---
# Usage: db_query "SELECT ..."
db_query() {
    $PSQL -c "$1"
}

# --- Utility: execute DB command (no output) ---
# Usage: db_exec "UPDATE ..."
db_exec() {
    $PSQL -c "$1" > /dev/null 2>&1
}
