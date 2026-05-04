#!/bin/bash
###########################################################################
#       Script : StaySuite User Logout (nftables + HTB cleanup)
#       OS     : Rocky Linux 10 (nftables v1.1.1, kernel 5.x+)
#       Reason : Single-user firewall + bandwidth deactivation
#
#  Can be called with minimal params (-i <ip> only).
#  State file provides all other values for precise cleanup.
#  Orphan scan catches rules left by crash/reboot.
#
#  EXIT CODES:
#    0  Success (or not logged in — idempotent)
#    1  Invalid parameters
###########################################################################

set -uo pipefail

LOGFILE="${LOGFILE:-/var/log/staysuite_login.log}"
LOGDIR="$(dirname "$LOGFILE")"
mkdir -p "$LOGDIR" 2>/dev/null || LOGFILE="/dev/null"
[[ -w "$LOGDIR" ]] || LOGFILE="/dev/null"
log_msg()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [LOGOUT] $*" >> "$LOGFILE" 2>/dev/null || true; }
log_err()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [LOGOUT][ERR] $*" >> "$LOGFILE" 2>/dev/null || true; }

STATEDIR="${SS_STATEDIR:-/var/run/staysuite/sessions}"
PERSIST_STATEDIR="${SS_PERSIST_STATEDIR:-/var/lib/staysuite/sessions}"

IP=""
SESSION_ID=""
DN_CLASSID=0
UP_CLASSID=0
POOL_ID=0
SNAT_IP=""
GATEWAY_ID=""
POLICY_ID=""
MAP_LIVE=0
FW_PREF=100
MARK=""

# ─── Parse arguments ──────────────────────────────────────────────────
while getopts "i:S:d:u:s:W:P:f:" opt; do
    case "$opt" in
        i) IP="$OPTARG" ;;
        S) SESSION_ID="$OPTARG" ;;
        d) DN_CLASSID="$OPTARG" ;;
        u) UP_CLASSID="$OPTARG" ;;
        s) SNAT_IP="$OPTARG" ;;
        W) GATEWAY_ID="$OPTARG" ;;
        P) POOL_ID="$OPTARG" ;;
        f) FW_PREF="$OPTARG" ;;
        \?) ;;
    esac
done

# ─── Load session state ─────────────────────────────────────────────
if [[ -n "$SESSION_ID" ]]; then
    for f in "${STATEDIR}/${SESSION_ID}.state" "${PERSIST_STATEDIR}/${SESSION_ID}.state"; do
        [[ -f "$f" ]] || continue
        while IFS='=' read -r key val; do
            case "$key" in
                IP)         [[ -z "$IP" ]] && IP="$val" ;;
                MARK)       [[ -z "$MARK" ]] && MARK="$val" ;;
                SNAT_IP)    [[ -z "$SNAT_IP" ]] && SNAT_IP="$val" ;;
                POOL_ID)    [[ "$POOL_ID" -eq 0 ]] && POOL_ID="$val" ;;
                DN_CLASSID) [[ "$DN_CLASSID" -eq 0 ]] && DN_CLASSID="$val" ;;
                UP_CLASSID) [[ "$UP_CLASSID" -eq 0 ]] && UP_CLASSID="$val" ;;
                GATEWAY_ID) [[ -z "$GATEWAY_ID" ]] && GATEWAY_ID="$val" ;;
                POLICY_ID)  POLICY_ID="$val" ;;
                MAP_LIVE)   MAP_LIVE="$val" ;;
                FW_PREF)    FW_PREF="$val" ;;
            esac
        done < "$f"
        log_msg "loaded state from $f"
        break
    done
fi

[[ -z "$IP" ]] && exit 0

# Compute mark if not loaded from state
if [[ -z "$MARK" ]]; then
    IFS='.' read -ra o <<< "$IP"
    MARK=$(printf "0x%02X%02X%02X%02X" "${o[0]}" "${o[1]}" "${o[2]}" "${o[3]}")
    unset IFS
fi

TAG="ss_${IP//./_}"

# ─── Log all received parameters (copy-paste for manual debugging) ───
PARAM_LOG="LOGOUT PARMS: -i $IP"
[[ -n "$SESSION_ID" ]] && PARAM_LOG="$PARAM_LOG -S $SESSION_ID"
[[ "$DN_CLASSID" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -d $DN_CLASSID"
[[ "$UP_CLASSID" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -u $UP_CLASSID"
[[ -n "$SNAT_IP" ]] && PARAM_LOG="$PARAM_LOG -s $SNAT_IP"
[[ -n "$GATEWAY_ID" && "$GATEWAY_ID" != "-1" ]] && PARAM_LOG="$PARAM_LOG -W $GATEWAY_ID"
[[ "$POOL_ID" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -P $POOL_ID"
[[ "$FW_PREF" -ne 100 ]] && PARAM_LOG="$PARAM_LOG -f $FW_PREF"
log_msg "$PARAM_LOG"
echo "$PARAM_LOG" >&2

# Locking
LCK="/tmp/staysuite_logout_${IP}.LCK"
exec 8>"$LCK"
flock -w 10 8 2>/dev/null || true

log_msg "START: ip=$IP mark=$MARK session=$SESSION_ID dn_cls=$DN_CLASSID up_cls=$UP_CLASSID pool=$POOL_ID"

# ─── Helper: delete nft rules by comment tag in a specific chain ─────
delete_rules_by_tag() {
    local tag="$1" chain="$2"
    local handles
    handles=$(nft -a list chain $chain 2>/dev/null | grep "\"${tag}" | grep -oP 'handle \K[0-9]+' | sort -rn)
    for h in $handles; do
        nft delete rule $chain handle "$h" 2>/dev/null && log_msg "nft: del handle $h from $chain ($tag)"
    done
}

# ─── Step 1: Remove IP from ALL nft sets ─────────────────────────
nft delete element inet mangle loggedinusers "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: -loggedinusers $IP"
nft delete element inet mangle usersset "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: -usersset $IP"
nft delete element inet mangle usersdstset "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: -usersdstset $IP"
nft delete element inet mangle llusersset "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: -llusersset $IP"
nft delete element inet mangle loggedinusersdstip "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: -loggedinusersdstip $IP"
nft delete element inet mangle loggedinusersnetwork "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: -loggedinusersnetwork $IP"

# ─── Step 2: Delete nft mark rules (prerouting) by comment tag ─────
# These are the rules that set meta mark = IP hex
delete_rules_by_tag "${TAG}_mark" "inet mangle prerouting"
delete_rules_by_tag "${TAG}_mark_dn" "inet mangle prerouting"

# ─── Step 3: Delete NAT rules ──────────────────────────────────────
delete_rules_by_tag "${TAG}_nat" "inet nat postrouting"
delete_rules_by_tag "${TAG}_hairpin" "inet nat prerouting"

# ─── Step 4: Remove SNAT IP from loggedinuserssnatip set ────────────
if [[ -n "$SNAT_IP" ]]; then
    nft delete element inet mangle loggedinuserssnatip "{ ${SNAT_IP} }" 2>/dev/null \
        && log_msg "nft: -loggedinuserssnatip $SNAT_IP"
fi

# ─── Step 5: Remove from gateway ipset ──────────────────────────────
if [[ -n "$GATEWAY_ID" && "$GATEWAY_ID" != "-1" ]]; then
    nft delete element inet nat "gw${GATEWAY_ID}_ipset" "{ ${IP} }" 2>/dev/null \
        && log_msg "nft: -gw${GATEWAY_ID}_ipset $IP"
fi

# ─── Step 6: Remove security / heartbeat rules ──────────────────────
delete_rules_by_tag "${TAG}_policy" "inet filter input"
delete_rules_by_tag "${TAG}_heartbeat" "inet filter intranetuploadaccounting"

# ─── Step 7: Catch-all — scan ALL chains for orphaned tagged rules ─
for table in inet/mangle inet/nat inet/filter inet/security; do
    chains=$(nft list table ${table//\// } 2>/dev/null | grep -oP 'chain \K\S+' | sort -u) || continue
    for chain in $chains; do
        handles=$(nft -a list chain ${table//\// } "$chain" 2>/dev/null \
            | grep "\"ss_${IP//./_}" | grep -oP 'handle \K[0-9]+' | sort -rn) || continue
        for h in $handles; do
            nft delete rule ${table//\// } "$chain" handle "$h" 2>/dev/null \
                && log_msg "nft: cleanup orphaned $h in ${table//\// }/$chain"
        done
    done
done

# ─── Step 7b: Cleanup orphaned set elements ─────────────────────────
for set_info in $(nft list sets 2>/dev/null | grep -oP 'set \K\S+'); do
    set_table="${set_info%%/*}"
    set_name="${set_info#*/}"
    set_type=$(nft list set "${set_table} ${set_name}" 2>/dev/null | grep -oP 'type \K\S+') || continue
    [[ "$set_type" != "ipv4_addr" ]] && continue
    if nft get element "${set_table} ${set_name}" "{ ${IP} }" >/dev/null 2>&1; then
        nft delete element "${set_table} ${set_name}" "{ ${IP} }" 2>/dev/null \
            && log_msg "nft: cleanup set ${set_table}/${set_name} - $IP"
    fi
done

# ═══════════════════════════════════════════════════════════════════
#  TC / HTB CLEANUP
# ═══════════════════════════════════════════════════════════════════

# ─── Step 8: Delete fw filter + user class on ifb0 (download) ───────
if [[ "$DN_CLASSID" -gt 0 ]]; then
    # Delete fw filter matching this IP's mark
    tc filter del dev ifb0 parent 1: protocol ip pref "$FW_PREF" fw \
        handle "${MARK}" 2>/dev/null && log_msg "tc: del fw filter ifb0 $MARK"

    # Fallback: delete by scanning handles
    tc filter show dev ifb0 parent 1: 2>/dev/null | grep "handle ${MARK}" >/dev/null 2>&1 && {
        fh=$(tc filter show dev ifb0 parent 1: 2>/dev/null \
            | grep -B2 "handle ${MARK}" | grep -oP 'pref \K[0-9]+' | head -1) || true
        [[ -n "$fh" ]] && tc filter del dev ifb0 parent 1: protocol ip pref "$fh" 2>/dev/null \
            && log_msg "tc: del fw filter ifb0 by pref $fh"
    }

    tc class del dev ifb0 classid "1:${DN_CLASSID}" 2>/dev/null \
        && log_msg "tc: del download class 1:${DN_CLASSID} ifb0"
fi

# ─── Step 9: Delete fw filter + user class on ifb1 (upload) ────────
if [[ "$UP_CLASSID" -gt 0 ]]; then
    tc filter del dev ifb1 parent 1: protocol ip pref "$FW_PREF" fw \
        handle "${MARK}" 2>/dev/null && log_msg "tc: del fw filter ifb1 $MARK"

    tc filter show dev ifb1 parent 1: 2>/dev/null | grep "handle ${MARK}" >/dev/null 2>&1 && {
        fh=$(tc filter show dev ifb1 parent 1: 2>/dev/null \
            | grep -B2 "handle ${MARK}" | grep -oP 'pref \K[0-9]+' | head -1) || true
        [[ -n "$fh" ]] && tc filter del dev ifb1 parent 1: protocol ip pref "$fh" 2>/dev/null \
            && log_msg "tc: del fw filter ifb1 by pref $fh"
    }

    tc class del dev ifb1 classid "1:${UP_CLASSID}" 2>/dev/null \
        && log_msg "tc: del upload class 1:${UP_CLASSID} ifb1"
fi

# ─── Step 10: Remove session state files ────────────────────────────
[[ -n "$SESSION_ID" ]] && {
    rm -f "${STATEDIR}/${SESSION_ID}.state" "${PERSIST_STATEDIR}/${SESSION_ID}.state" 2>/dev/null
    log_msg "state removed: $SESSION_ID"
}
rm -f "$LCK" 2>/dev/null

# ─── Step 11: Backup nft elements ───────────────────────────────────
nft list elements inet mangle loggedinusers 2>/dev/null > /var/lib/staysuite/nft_loggedinusers.set 2>/dev/null || true
nft list elements inet mangle loggedinuserssnatip 2>/dev/null > /var/lib/staysuite/nft_loggedinuserssnatip.set 2>/dev/null || true

log_msg "DONE: ip=$IP"
exit 0
