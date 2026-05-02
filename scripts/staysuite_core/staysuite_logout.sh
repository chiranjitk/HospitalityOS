#!/bin/bash
###########################################################################
#       Script : StaySuite User Logout (nftables + HTB cleanup)
#       OS     : Rocky Linux 10 (nftables v1.1.1, kernel 5.x+)
#       Reason : Single-user firewall + bandwidth deactivation
#
#  Flow:
#    1. Validate parameters (or read from session state file)
#    2. Remove IP from nft "loggedinusers" set
#    3. Delete NAT POSTROUTING rule by comment tag
#    4. Delete DNAT hairpin rule (if any)
#    5. Remove from loggedinuserssnatip set (SNAT cleanup)
#    6. Remove from gateway ipset (if applicable)
#    7. Remove security policy rule from filter input
#    8. Remove heartbeat rule from intranetuploadaccounting
#    9. Delete HTB class + filter on ifb0/ifb1
#   10. Remove session state file
#
#  Can be called with minimal params (-i <ip> only) — will look up
#  all other values from the state file saved by staysuite_login.sh,
#  or scan nft rules by comment tag.
#
#  EXIT CODES:
#    0  Success (or user was not logged in — idempotent)
#    1  Invalid parameters / usage error
#    2  IP not found in loggedinusers (soft fail)
#    3  nft cleanup failed
#    4  tc cleanup failed
###########################################################################

set -uo pipefail

# ─── Logging ──────────────────────────────────────────────────────────
LOGFILE="${LOGFILE:-/var/log/staysuite_login.log}"
log_msg()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [LOGOUT] $*" >> "$LOGFILE" 2>/dev/null; }
log_err()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [LOGOUT][ERR] $*" >> "$LOGFILE" 2>/dev/null; }

# ─── State directory ──────────────────────────────────────────────────
STATEDIR="/var/run/staysuite/sessions"

# ─── Defaults ─────────────────────────────────────────────────────────
IP=""
SESSION_ID=""
DOWN_CLASSID=0
UP_CLASSID=0
ACTION=""
SNAT_IP=""
GATEWAY_ID=""
POLICY_ID=""
MAC_ADDR=""
MAP_LIVE=0
PRIORITY=1

NFT_FAILED=0
TC_FAILED=0

# ─── Usage ────────────────────────────────────────────────────────────
usage() {
    cat <<'EOF'
Usage: staysuite_logout.sh -i <ip> [OPTIONS]
       staysuite_logout.sh -S <session_id>   (auto-loads state from file)

REQUIRED (one of):
  -i <ip>              Client IPv4 address
  -S <session_id>      Load all params from session state file

OPTIONAL (override state file):
  -d <classid>         Download HTB class minor ID
  -u <classid>         Upload HTB class minor ID
  -s <snat_ip>         SNAT IP (for loggedinuserssnatip cleanup)
  -W <id>              Gateway ID (for gateway ipset cleanup)

EXIT CODES:
  0  Success (or not logged in — idempotent)
  1  Invalid parameters
  2  IP not in loggedinusers
  3  nft cleanup failed
  4  tc cleanup failed
EOF
    exit 1
}

# ─── Parse arguments ──────────────────────────────────────────────────
while getopts "i:S:d:u:s:W:" opt; do
    case "$opt" in
        i) IP="$OPTARG" ;;
        S) SESSION_ID="$OPTARG" ;;
        d) DOWN_CLASSID="$OPTARG" ;;
        u) UP_CLASSID="$OPTARG" ;;
        s) SNAT_IP="$OPTARG" ;;
        W) GATEWAY_ID="$OPTARG" ;;
        \?) usage ;;
        *) usage ;;
    esac
done

# ─── Load session state file if session_id given ─────────────────────
if [[ -n "$SESSION_ID" && -f "${STATEDIR}/${SESSION_ID}.state" ]]; then
    log_msg "Loading state from ${STATEDIR}/${SESSION_ID}.state"
    while IFS='=' read -r key val; do
        case "$key" in
            IP) [[ -z "$IP" ]] && IP="$val" ;;
            ACTION) ACTION="$val" ;;
            SNAT_IP) [[ -z "$SNAT_IP" ]] && SNAT_IP="$val" ;;
            DOWN_CLASSID) [[ "$DOWN_CLASSID" -eq 0 ]] && DOWN_CLASSID="$val" ;;
            UP_CLASSID) [[ "$UP_CLASSID" -eq 0 ]] && UP_CLASSID="$val" ;;
            GATEWAY_ID) [[ -z "$GATEWAY_ID" ]] && GATEWAY_ID="$val" ;;
            POLICY_ID) POLICY_ID="$val" ;;
            MAP_LIVE) MAP_LIVE="$val" ;;
            PRIORITY) PRIORITY="$val" ;;
        esac
    done < "${STATEDIR}/${SESSION_ID}.state"
fi

# ─── Validate required ───────────────────────────────────────────────
if [[ -z "$IP" ]]; then
    log_err "Missing required parameter: -i <ip> or -S <session_id>"
    exit 1
fi

# Validate IP format
if ! [[ "$IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    log_err "Invalid IP address format: $IP"
    exit 1
fi

# ─── File locking ────────────────────────────────────────────────────
ME="staysuite_logout"
LCK="/tmp/${ME}_${IP}.LCK"
exec 8>"$LCK"
flock -n 8 2>/dev/null || {
    log_err "Lock contention for IP $IP — waiting..."
    flock -w 10 8 2>/dev/null || {
        log_err "Lock timeout for IP $IP"
        exit 1
    }
}

# ─── Comment tag (must match login script) ───────────────────────────
COMMENT_TAG="ss_${IP//./_}"

# ─── Helper: find and delete nft rules by comment tag ────────────────
# Scans a chain for rules containing the comment tag, extracts the handle,
# and deletes the rule. Works across all tables.
delete_rules_by_comment() {
    local tag="$1"
    local table_chain="$2"  # e.g. "inet nat postrouting"

    local handles
    handles=$(nft -a list chain $table_chain 2>/dev/null \
        | grep "\"${tag}" \
        | grep -oP 'handle \K[0-9]+' \
        | sort -rn)  # Delete in reverse order to avoid handle shift

    if [[ -n "$handles" ]]; then
        while IFS= read -r handle; do
            if nft delete rule $table_chain handle "$handle" 2>/dev/null; then
                log_msg "nft: deleted handle $handle from $table_chain (tag: $tag)"
            else
                log_err "nft: failed to delete handle $handle from $table_chain"
                NFT_FAILED=1
            fi
        done <<< "$handles"
        return 0
    fi
    return 1  # No rules found
}

# ─── Step 0: Check if user is logged in ──────────────────────────────
if ! nft get element inet mangle loggedinusers "{ ${IP} }" >/dev/null 2>&1; then
    log_msg "NOT LOGGED IN: IP $IP not in loggedinusers set (session: $SESSION_ID)"
    # Still attempt full cleanup — may be orphaned rules from a crash
    # Fall through to cleanup steps
fi

log_msg "LOGOUT START: ip=$IP session=$SESSION_ID action=$ACTION down_cls=$DOWN_CLASSID up_cls=$UP_CLASSID gateway=$GATEWAY_ID"

# ─── Step 1: Remove IP from loggedinusers nft set ────────────────────
if nft delete element inet mangle loggedinusers "{ ${IP} }" 2>/dev/null; then
    log_msg "nft: removed $IP from loggedinusers"
else
    log_msg "nft: $IP not in loggedinusers (already removed or never added)"
fi

# ─── Step 2: Delete NAT POSTROUTING rule by comment tag ─────────────
# Scans all relevant chains across tables
delete_rules_by_comment "${COMMENT_TAG}" "inet nat postrouting" || true

# ─── Step 3: Delete DNAT hairpin rule (PREROUTING) ──────────────────
if [[ "$MAP_LIVE" == "1" || "$ACTION" == "snat" ]]; then
    delete_rules_by_comment "${COMMENT_TAG}_hairpin" "inet nat prerouting" || true
fi

# ─── Step 4: Remove SNAT IP from loggedinuserssnatip set ─────────────
if [[ -n "$SNAT_IP" ]]; then
    if nft delete element inet mangle loggedinuserssnatip "{ ${SNAT_IP} }" 2>/dev/null; then
        log_msg "nft: removed $SNAT_IP from loggedinuserssnatip"
    fi
fi

# ─── Step 5: Remove from gateway ipset ──────────────────────────────
if [[ -n "$GATEWAY_ID" && "$GATEWAY_ID" != "-1" ]]; then
    if nft delete element inet nat "gw${GATEWAY_ID}_ipset" "{ ${IP} }" 2>/dev/null; then
        log_msg "nft: removed $IP from gw${GATEWAY_ID}_ipset"
    fi
fi

# ─── Step 6: Remove security policy rule from filter input ──────────
delete_rules_by_comment "${COMMENT_TAG}_policy" "inet filter input" || true

# ─── Step 7: Remove heartbeat rule from intranetuploadaccounting ────
delete_rules_by_comment "${COMMENT_TAG}_heartbeat" "inet filter intranetuploadaccounting" || true

# ─── Step 8: Also try to delete any remaining tagged rules across
#   all chains in all tables (catch-all for orphaned rules) ──────────
for table in inet/mangle inet/nat inet/filter inet/security; do
    table_slash="${table//\// }"
    # List all chains in this table
    chains=$(nft list table $table_slash 2>/dev/null \
        | grep -oP 'chain \K\S+' | sort -u) || continue

    for chain in $chains; do
        handles=$(nft -a list chain $table_slash "$chain" 2>/dev/null \
            | grep "\"ss_${IP//./_}" \
            | grep -oP 'handle \K[0-9]+' \
            | sort -rn) || continue

        for handle in $handles; do
            nft delete rule $table_slash "$chain" handle "$handle" 2>/dev/null \
                && log_msg "nft: cleanup orphaned handle $handle in $table_slash $chain"
        done
    done
done

# ─── Step 8b: Cleanup orphaned set elements ─────────────────────────
# Scans all known sets for this IP and removes it (handles crash recovery
# when the session state file is lost and SNAT_IP/GATEWAY_ID unknown).
# Sets that login adds to: loggedinuserssnatip, gw*_ipset
for set_info in $(nft list sets 2>/dev/null | grep -oP 'set \K\S+'); do
    # Extract table family and set name
    set_table="${set_info%%/*}"
    set_name="${set_info#*/}"
    # Skip non-ipv4 sets (ether_addr, etc.)
    set_type=$(nft list set "${set_table} ${set_name}" 2>/dev/null | grep -oP 'type \K\S+') || continue
    [[ "$set_type" != "ipv4_addr" ]] && continue
    # Check if IP exists in this set
    if nft get element "${set_table} ${set_name}" "{ ${IP} }" >/dev/null 2>&1; then
        nft delete element "${set_table} ${set_name}" "{ ${IP} }" 2>/dev/null \
            && log_msg "nft: cleanup orphaned $IP from ${set_table}/${set_name}"
    fi
done

# ─── Step 9: Delete HTB class + filter on ifb0 (download) ──────────
if [[ "$DOWN_CLASSID" -gt 0 ]]; then
    # Delete filter first (by dst IP), then class
    if tc filter del dev ifb0 parent 1: protocol ip prio "${PRIORITY}" u32 \
        match ip dst "${IP}/32" flowid "1:${DOWN_CLASSID}" 2>/dev/null; then
        log_msg "tc: deleted download filter for $IP on ifb0"
    fi

    # Also try deleting by handle if IP match fails (fallback)
    tc filter show dev ifb0 parent 1: 2>/dev/null \
        | grep "flowid 1:${DOWN_CLASSID}" >/dev/null 2>&1 && {
        # Filter still exists but IP match delete failed — use handle
        filter_handle=$(tc filter show dev ifb0 parent 1: 2>/dev/null \
            | grep -B5 "flowid 1:${DOWN_CLASSID}" \
            | grep -oP 'filter parent 1: .* pref \K[0-9]+' | tail -1) || true
        if [[ -n "$filter_handle" ]]; then
            tc filter del dev ifb0 parent 1: protocol ip prio "$filter_handle" 2>/dev/null \
                && log_msg "tc: deleted download filter by prio $filter_handle on ifb0"
        fi
    }

    if tc class del dev ifb0 classid "1:${DOWN_CLASSID}" 2>/dev/null; then
        log_msg "tc: deleted download class 1:${DOWN_CLASSID} on ifb0"
    else
        # Class might already be gone — non-fatal
        log_msg "tc: download class 1:${DOWN_CLASSID} not found on ifb0 (OK)"
    fi
fi

# ─── Step 10: Delete HTB class + filter on ifb1 (upload) ───────────
if [[ "$UP_CLASSID" -gt 0 ]]; then
    # Delete filter first (by src IP), then class
    if tc filter del dev ifb1 parent 1: protocol ip prio "${PRIORITY}" u32 \
        match ip src "${IP}/32" flowid "1:${UP_CLASSID}" 2>/dev/null; then
        log_msg "tc: deleted upload filter for $IP on ifb1"
    fi

    # Fallback: delete by handle
    tc filter show dev ifb1 parent 1: 2>/dev/null \
        | grep "flowid 1:${UP_CLASSID}" >/dev/null 2>&1 && {
        filter_handle=$(tc filter show dev ifb1 parent 1: 2>/dev/null \
            | grep -B5 "flowid 1:${UP_CLASSID}" \
            | grep -oP 'filter parent 1: .* pref \K[0-9]+' | tail -1) || true
        if [[ -n "$filter_handle" ]]; then
            tc filter del dev ifb1 parent 1: protocol ip prio "$filter_handle" 2>/dev/null \
                && log_msg "tc: deleted upload filter by prio $filter_handle on ifb1"
        fi
    }

    if tc class del dev ifb1 classid "1:${UP_CLASSID}" 2>/dev/null; then
        log_msg "tc: deleted upload class 1:${UP_CLASSID} on ifb1"
    else
        log_msg "tc: upload class 1:${UP_CLASSID} not found on ifb1 (OK)"
    fi
fi

# ─── Step 11: Remove session state file ──────────────────────────────
if [[ -n "$SESSION_ID" && -f "${STATEDIR}/${SESSION_ID}.state" ]]; then
    rm -f "${STATEDIR}/${SESSION_ID}.state"
    log_msg "state removed: ${STATEDIR}/${SESSION_ID}.state"
fi

# Also remove lock file
rm -f "$LCK" 2>/dev/null

# ─── Final result ────────────────────────────────────────────────────
log_msg "LOGOUT DONE: ip=$IP session=$SESSION_ID"
exit 0
