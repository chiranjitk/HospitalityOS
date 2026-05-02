#!/bin/bash
###########################################################################
#       Script : StaySuite User Login (nftables + HTB)
#       OS     : Rocky Linux 10 (nftables v1.1.1, kernel 5.x+)
#       Reason : Single-user firewall + bandwidth activation
#
#  Flow:
#    1. Validate parameters
#    2. Check duplicate login (IP already in loggedinusers set)
#    3. Add IP to nft "loggedinusers" set  → unblocks prerouting
#    4. Insert NAT POSTROUTING rule         → accept / SNAT / masquerade
#    5. Create HTB leaf class on ifb0/ifb1  → download/upload shaping
#    6. Attach u32 filter to classify traffic by IP
#    7. (Optional) Multi-gateway fwmark + ipset
#
#  Called by: Next.js credential-engine / provisioning-service
#  One invocation per user session.
#
#  EXIT CODES:
#    0  Success
#    1  Invalid parameters / usage error
#    2  User already logged in
#    3  nft rule failed
#    4  tc (HTB / filter) failed
#    5  Partial failure (some rules applied, rollback attempted)
###########################################################################

set -euo pipefail

# ─── Logging ──────────────────────────────────────────────────────────
LOGFILE="${LOGFILE:-/var/log/staysuite_login.log}"
log_msg()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [LOGIN] $*" >> "$LOGFILE" 2>/dev/null; }
log_err()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [LOGIN][ERR] $*" >> "$LOGFILE" 2>/dev/null; }

# ─── State directory (runtime session state) ──────────────────────────
STATEDIR="/var/run/staysuite/sessions"
mkdir -p "$STATEDIR" 2>/dev/null

# ─── Defaults ─────────────────────────────────────────────────────────
IP=""
ACTION="masq"            # accept | snat | masq
SNAT_IP=""
DOWN_CLASSID=0
UP_CLASSID=0
DOWN_KBPS=0
UP_KBPS=0
DOWN_GUARANTEED=0
UP_GUARANTEED=0
REST_TYPE=0
GATEWAY_ID=""
SESSION_ID=""
MAC_ADDR=""
USER_ID=""
POLICY_ID=""
MAP_LIVE=0
PRIORITY=1

NFT_FAILED=0
TC_FAILED=0
ROLLBACK=false

# ─── Usage ────────────────────────────────────────────────────────────
usage() {
    cat <<'EOF'
Usage: staysuite_login.sh -i <ip> [OPTIONS]

REQUIRED:
  -i <ip>              Client IPv4 address

NAT:
  -a <action>          NAT action: accept | snat | masq  (default: masq)
  -s <snat_ip>         SNAT target IP  (required when -a snat)
  -L <0|1>             Map-with-live / DNAT hairpin  (default: 0, only with -a snat)

BANDWIDTH (TC/HTB on ifb0 download, ifb1 upload):
  -d <classid>         Download HTB class minor ID  (e.g. 1001)
  -u <classid>         Upload HTB class minor ID    (e.g. 2001)
  -D <kbps>            Download rate in kbps
  -U <kbps>            Upload rate in kbps
  -g <kbps>            Guaranteed (min) download in kbps
  -G <kbps>            Guaranteed (min) upload in kbps

GATEWAY:
  -W <id>              Multi-gateway ID (adds to gw<N>_ipset + fwmark)

SESSION:
  -S <id>              Session ID  (for logging / state file name)
  -m <mac>             Client MAC address  (AA:BB:CC:DD:EE:FF)
  -X <user_id>         StaySuite user ID

SECURITY:
  -o <policy_id>       Firewall policy chain  (inserts into filter input)

PRIORITY:
  -p <prio>            TC filter priority  (default: 1)

EXIT CODES:
  0  Success
  1  Invalid parameters
  2  Already logged in
  3  nft command failed
  4  tc command failed
  5  Partial failure (rollback attempted)
EOF
    exit 1
}

# ─── Parse arguments ──────────────────────────────────────────────────
while getopts "i:a:s:L:d:u:D:U:g:G:W:S:m:X:o:p:t:" opt; do
    case "$opt" in
        i) IP="$OPTARG" ;;
        a) ACTION="$OPTARG" ;;
        s) SNAT_IP="$OPTARG" ;;
        L) MAP_LIVE="$OPTARG" ;;
        d) DOWN_CLASSID="$OPTARG" ;;
        u) UP_CLASSID="$OPTARG" ;;
        D) DOWN_KBPS="$OPTARG" ;;
        U) UP_KBPS="$OPTARG" ;;
        g) DOWN_GUARANTEED="$OPTARG" ;;
        G) UP_GUARANTEED="$OPTARG" ;;
        W) GATEWAY_ID="$OPTARG" ;;
        S) SESSION_ID="$OPTARG" ;;
        m) MAC_ADDR="$OPTARG" ;;
        X) USER_ID="$OPTARG" ;;
        o) POLICY_ID="$OPTARG" ;;
        p) PRIORITY="$OPTARG" ;;
        t) REST_TYPE="$OPTARG" ;;
        \?) usage ;;
        *) usage ;;
    esac
done

# ─── Validate required ───────────────────────────────────────────────
if [[ -z "$IP" ]]; then
    log_err "Missing required parameter: -i <ip>"
    exit 1
fi

# Validate IP format (basic IPv4 check)
if ! [[ "$IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    log_err "Invalid IP address format: $IP"
    exit 1
fi

# Validate NAT action
if [[ "$ACTION" != "accept" && "$ACTION" != "snat" && "$ACTION" != "masq" ]]; then
    log_err "Invalid NAT action: $ACTION (must be accept|snat|masq)"
    exit 1
fi

# SNAT requires -s
if [[ "$ACTION" == "snat" && -z "$SNAT_IP" ]]; then
    log_err "SNAT action requires -s <snat_ip>"
    exit 1
fi

# Bandwidth class IDs must be non-zero if bandwidth is specified
if [[ "$DOWN_KBPS" -gt 0 && "$DOWN_CLASSID" -eq 0 ]]; then
    log_err "Download bandwidth specified but no class ID (-d)"
    exit 1
fi
if [[ "$UP_KBPS" -gt 0 && "$UP_CLASSID" -eq 0 ]]; then
    log_err "Upload bandwidth specified but no class ID (-u)"
    exit 1
fi

# ─── File locking (prevent concurrent login for same IP) ─────────────
ME="staysuite_login"
LCK="/tmp/${ME}_${IP}.LCK"
exec 8>"$LCK"
flock -n 8 2>/dev/null || {
    log_err "Lock contention for IP $IP — another login in progress, waiting..."
    flock -w 10 8 2>/dev/null || {
        log_err "Lock timeout for IP $IP — aborting"
        exit 1
    }
}

# ─── Helper: IPv4 validation (each octet ≤ 255) ─────────────────────
valid_ip() {
    local IFS='.'
    read -ra octets <<< "$1"
    for o in "${octets[@]}"; do
        [[ "$o" -le 255 ]] || return 1
    done
    return 0
}
valid_ip "$IP" || { log_err "Invalid IP octets: $IP"; exit 1; }

# ─── Tag for nft rule comments (enables precise removal on logout) ───
COMMENT_TAG="ss_${IP//./_}"

# ─── Step 1: Check duplicate login ───────────────────────────────────
if nft get element inet mangle loggedinusers "{ ${IP} }" >/dev/null 2>&1; then
    log_msg "DUPLICATE: IP $IP already in loggedinusers set (session: $SESSION_ID, user: $USER_ID)"
    # Still exit success — idempotent is better than failing
    exit 0
fi

log_msg "LOGIN START: ip=$IP action=$ACTION down=${DOWN_KBPS}kbps up=${UP_KBPS}kbps session=$SESSION_ID mac=$MAC_ADDR user=$USER_ID gateway=$GATEWAY_ID"

# ─── Step 2: Add IP to loggedinusers nft set ─────────────────────────
# This is the master key — once in this set, the prerouting rules in
# defaultchains_cryptsk.sh allow traffic to flow through the accounting
# and firewall chains.
if ! nft add element inet mangle loggedinusers "{ ${IP} }" 2>/dev/null; then
    log_err "nft: failed to add $IP to loggedinusers set"
    exit 3
fi
log_msg "nft: added $IP → loggedinusers"

# ─── Step 3: NAT POSTROUTING rule ────────────────────────────────────
# Uses comment tag so staysuite_logout.sh can find and delete it precisely.
case "$ACTION" in
    accept)
        if ! nft add rule inet nat postrouting ip saddr "${IP}" counter accept comment "\"${COMMENT_TAG}\"" 2>/dev/null; then
            NFT_FAILED=1
            log_err "nft: failed to add POSTROUTING accept for $IP"
        else
            log_msg "nft: POSTROUTING accept for $IP"
        fi
        ;;
    snat)
        # Also add SNAT IP to loggedinuserssnatip set (used by prerouting for reply traffic)
        nft add element inet mangle loggedinuserssnatip "{ ${SNAT_IP} }" 2>/dev/null \
            && log_msg "nft: added $SNAT_IP → loggedinuserssnatip"

        if ! nft add rule inet nat postrouting ip saddr "${IP}" counter snat to "${SNAT_IP}" comment "\"${COMMENT_TAG}\"" 2>/dev/null; then
            NFT_FAILED=1
            log_err "nft: failed to add POSTROUTING snat $SNAT_IP for $IP"
        else
            log_msg "nft: POSTROUTING snat to $SNAT_IP for $IP"
        fi

        # DNAT hairpin (map-with-live): traffic from LAN destined for SNAT IP → forward to user IP
        if [[ "$MAP_LIVE" == "1" ]]; then
            if ! nft add rule inet nat prerouting ip daddr "${SNAT_IP}" counter dnat to "${IP}" comment "\"${COMMENT_TAG}_hairpin\"" 2>/dev/null; then
                log_err "nft: failed to add DNAT hairpin (non-critical)"
            else
                log_msg "nft: PREROUTING dnat hairpin $SNAT_IP → $IP"
            fi
        fi
        ;;
    masq)
        if ! nft add rule inet nat postrouting ip saddr "${IP}" counter masquerade comment "\"${COMMENT_TAG}\"" 2>/dev/null; then
            NFT_FAILED=1
            log_err "nft: failed to add POSTROUTING masq for $IP"
        else
            log_msg "nft: POSTROUTING masquerade for $IP"
        fi
        ;;
esac

# ─── Step 4: Multi-gateway support ───────────────────────────────────
if [[ -n "$GATEWAY_ID" && "$GATEWAY_ID" != "-1" ]]; then
    # Add IP to gateway's ipset so the prerouting fwmark rule applies
    nft add element inet nat "gw${GATEWAY_ID}_ipset" "{ ${IP} }" 2>/dev/null \
        && log_msg "nft: added $IP → gw${GATEWAY_ID}_ipset"
fi

# ─── Step 5: Security policy (filter input chain) ───────────────────
if [[ -n "$POLICY_ID" && "$POLICY_ID" != "0" ]]; then
    if ! nft add rule inet filter input ip saddr "${IP}" counter jump "${POLICY_ID}" comment "\"${COMMENT_TAG}_policy\"" 2>/dev/null; then
        log_err "nft: failed to add filter policy $POLICY_ID for $IP (non-critical)"
    else
        log_msg "nft: filter input policy $POLICY_ID for $IP"
    fi
fi

# ─── Step 6: HTB bandwidth classes + filters ─────────────────────────
# initialization.sh creates the base HTB root on ifb0/ifb1:
#   tc qdisc add dev ifb0 root handle 1: htb default 1
#   tc class add dev ifb0 parent 1:0 classid 1:1 htb rate 10gbit ceil 10gbit
#
# Login adds leaf classes under 1:1 and u32 filters to classify by IP.

if [[ "$DOWN_KBPS" -gt 0 && "$DOWN_CLASSID" -gt 0 ]]; then
    # ── Download class on ifb0 (LAN egress → client) ──
    # Match by destination IP (traffic heading to the client)
    DOWN_CEIL="${DOWN_KBPS}kbit"
    DOWN_GUAR="${DOWN_KBPS}kbit"
    [[ "$DOWN_GUARANTEED" -gt 0 ]] && { DOWN_CEIL="${DOWN_GUARANTEED}kbit"; DOWN_GUAR="${DOWN_GUARANTEED}kbit"; }

    if ! tc class add dev ifb0 parent 1:1 classid "1:${DOWN_CLASSID}" htb \
        rate "$DOWN_GUAR" ceil "$DOWN_CEIL" quantum 1500 2>/dev/null; then
        TC_FAILED=1
        log_err "tc: failed to add download class 1:${DOWN_CLASSID} on ifb0"
    else
        log_msg "tc: download class 1:${DOWN_CLASSID} on ifb0 (rate=$DOWN_GUAR ceil=$DOWN_CEIL)"

        # u32 filter: match dst IP on ifb0 → assign to download class
        if ! tc filter add dev ifb0 parent 1: protocol ip prio "${PRIORITY:-1}" u32 \
            match ip dst "${IP}/32" flowid "1:${DOWN_CLASSID}" 2>/dev/null; then
            TC_FAILED=1
            log_err "tc: failed to add download filter for $IP on ifb0"
        else
            log_msg "tc: download filter dst=$IP → 1:${DOWN_CLASSID} on ifb0"
        fi
    fi
fi

if [[ "$UP_KBPS" -gt 0 && "$UP_CLASSID" -gt 0 ]]; then
    # ── Upload class on ifb1 (WAN egress → internet) ──
    # Match by source IP (traffic coming from the client)
    UP_RATE="${UP_KBPS}kbit"
    UP_CEIL="${UP_KBPS}kbit"
    UP_GUAR="${UP_GUARANTEED}kbit"
    [[ "$UP_GUARANTEED" -gt 0 ]] || UP_GUAR="${UP_KBPS}kbit"

    if ! tc class add dev ifb1 parent 1:1 classid "1:${UP_CLASSID}" htb \
        rate "$UP_GUAR" ceil "$UP_CEIL" quantum 1500 2>/dev/null; then
        TC_FAILED=1
        log_err "tc: failed to add upload class 1:${UP_CLASSID} on ifb1"
    else
        log_msg "tc: upload class 1:${UP_CLASSID} on ifb1 (rate=$UP_GUAR ceil=$UP_CEIL)"

        # u32 filter: match src IP on ifb1 → assign to upload class
        if ! tc filter add dev ifb1 parent 1: protocol ip prio "${PRIORITY:-1}" u32 \
            match ip src "${IP}/32" flowid "1:${UP_CLASSID}" 2>/dev/null; then
            TC_FAILED=1
            log_err "tc: failed to add upload filter for $IP on ifb1"
        else
            log_msg "tc: upload filter src=$IP → 1:${UP_CLASSID} on ifb1"
        fi
    fi
fi

# ─── Step 7: Idle timeout / heartbeat rule ──────────────────────────
# Allow heartbeat UDP on port 6060 through the intranetuploadaccounting chain
# (same as old 24online script for CYBEROAM/HTTPCLIENT client types)
if ! nft add rule inet filter intranetuploadaccounting ip saddr "${IP}" udp dport 6060 counter accept \
    comment "\"${COMMENT_TAG}_heartbeat\"" 2>/dev/null; then
    log_err "nft: failed to add heartbeat rule (non-critical)"
else
    log_msg "nft: heartbeat rule for $IP on port 6060"
fi

# ─── Step 8: Save session state ─────────────────────────────────────
# Writes a state file so logout can clean up even without all parameters
if [[ -n "$SESSION_ID" ]]; then
    cat > "${STATEDIR}/${SESSION_ID}.state" <<STATE
IP=${IP}
ACTION=${ACTION}
SNAT_IP=${SNAT_IP}
DOWN_CLASSID=${DOWN_CLASSID}
UP_CLASSID=${UP_CLASSID}
DOWN_KBPS=${DOWN_KBPS}
UP_KBPS=${UP_KBPS}
GATEWAY_ID=${GATEWAY_ID}
POLICY_ID=${POLICY_ID}
MAC_ADDR=${MAC_ADDR}
USER_ID=${USER_ID}
MAP_LIVE=${MAP_LIVE}
PRIORITY=${PRIORITY}
TIMESTAMP=$(date +%s)
STATE
    log_msg "state saved: ${STATEDIR}/${SESSION_ID}.state"
fi

# ─── Final result ────────────────────────────────────────────────────
if [[ "$NFT_FAILED" -eq 1 && "$TC_FAILED" -eq 1 ]]; then
    log_err "LOGIN PARTIAL FAILURE for $IP: nft and tc both failed — cleanup needed"
    # Remove from loggedinusers since we can't fully activate
    nft delete element inet mangle loggedinusers "{ ${IP} }" 2>/dev/null
    exit 5
elif [[ "$NFT_FAILED" -eq 1 ]]; then
    log_err "LOGIN PARTIAL FAILURE for $IP: nft failed but tc OK"
    exit 3
elif [[ "$TC_FAILED" -eq 1 ]]; then
    log_err "LOGIN PARTIAL FAILURE for $IP: tc failed but nft OK"
    exit 4
fi

log_msg "LOGIN SUCCESS: ip=$IP session=$SESSION_ID"
exit 0
