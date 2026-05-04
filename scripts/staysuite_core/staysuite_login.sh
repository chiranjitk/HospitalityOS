#!/bin/bash
###########################################################################
#       Script : StaySuite User Login (nftables + HTB + fw filter)
#       OS     : Rocky Linux 10 (nftables v1.1.1, kernel 5.x+)
#       Reason : Single-user firewall + bandwidth activation
#
#  ARCHITECTURE:
#    ┌──────────────────────────────────────────────────────────────┐
#    │  nft mangle prerouting                                       │
#    │    ip saddr $IP → meta mark set 0xIP_HEX                   │
#    │    ip daddr $IP → meta mark set 0xIP_HEX                   │
#    │    (mark persists through routing → available to TC)        │
#    └──────────────┬───────────────────────────────────────────────┘
#                   │
#    ┌──────────────▼───────────────────────────────────────────────┐
#    │  TC HTB on ifb0 (download) / ifb1 (upload)                  │
#    │                                                              │
#    │  1:1  (root, 10gbit — from initialization.sh)                │
#    │  ├── 1:<pool_id>  (pool root: rate/ceil from BandwidthPool) │
#    │  │   ├── 1:<dn_classid>  (user leaf, rate=plan down)        │
#    │  │   └── ...                                                 │
#    │  └── ... (other pools)                                       │
#    │                                                              │
#    │  filter parent 1: pref 100 fw handle 0xIP_HEX → classid    │
#    │    (TC reads the nft mark set by prerouting)                 │
#    └──────────────────────────────────────────────────────────────┘
#
#  FLOW:
#    1. Validate parameters
#    2. Check duplicate (IP in loggedinusers set)
#    3. Add IP → loggedinusers nft set (unblocks traffic flow)
#    4. Insert nft mark rules (IP → 0xIP_HEX in prerouting)
#    5. Insert NAT POSTROUTING rule (masq/snat/accept)
#    6. Ensure pool root class exists on ifb0/ifb1
#    7. Create user leaf HTB class under pool root
#    8. Add TC fw filter: mark 0xIP_HEX → user classid
#    9. (Optional) Gateway ipset, security policy, heartbeat
#   10. Save session state + backup nft elements
#
#  Called by: Next.js credential-engine / provisioning-service
#  One invocation per user session.
#
#  EXIT CODES:
#    0  Success (or already logged in — idempotent)
#    1  Invalid parameters / usage error
#    3  nft rule failed
#    4  tc (HTB/filter) failed
#    5  Partial failure (rollback attempted)
###########################################################################

set -euo pipefail

# ─── Logging ──────────────────────────────────────────────────────────
LOGFILE="${LOGFILE:-/var/log/staysuite_login.log}"
# Ensure log directory is writable (dev/sandbox: may not have /var/log access)
LOGDIR="$(dirname "$LOGFILE")"
mkdir -p "$LOGDIR" 2>/dev/null || LOGFILE="/dev/null"
[[ -w "$LOGDIR" ]] || LOGFILE="/dev/null"
log_msg()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [LOGIN] $*" >> "$LOGFILE" 2>/dev/null || true; }
log_err()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [LOGIN][ERR] $*" >> "$LOGFILE" 2>/dev/null || true; }

# ─── State directories (overridable via env for sandbox/testing) ─────
STATEDIR="${SS_STATEDIR:-/var/run/staysuite/sessions}"          # tmpfs — fast logout lookup
PERSIST_STATEDIR="${SS_PERSIST_STATEDIR:-/var/lib/staysuite/sessions}"  # persistent — survives reboot
mkdir -p "$STATEDIR" "$PERSIST_STATEDIR" 2>/dev/null || true

# ─── Defaults ─────────────────────────────────────────────────────────
IP=""
ACTION="masq"
SNAT_IP=""
POOL_ID=0
POOL_RATE_DN=0
POOL_CEIL_DN=0
POOL_RATE_UP=0
POOL_CEIL_UP=0
DN_CLASSID=0
UP_CLASSID=0
DN_KBPS=0
UP_KBPS=0
DN_GUAR=0
UP_GUAR=0
GATEWAY_ID=""
SESSION_ID=""
MAC_ADDR=""
USER_ID=""
POLICY_ID=""
MAP_LIVE=0
FW_PREF=100

NFT_FAILED=0
TC_FAILED=0

# ─── Usage ────────────────────────────────────────────────────────────
usage() {
    cat <<'EOF'
Usage: staysuite_login.sh -i <ip> [OPTIONS]

REQUIRED:
  -i <ip>              Client IPv4 address

NAT:
  -a <action>          NAT: accept | snat | masq  (default: masq)
  -s <snat_ip>         SNAT target IP  (required when -a snat)
  -L <0|1>             DNAT hairpin  (default: 0, only with -a snat)

POOL (IP pool root class — creates if not exists):
  -P <pool_id>         BandwidthPool ID  (REQUIRED for bandwidth shaping)
  -R <kbps>            Pool total download rate
  -C <kbps>            Pool total download ceil
  -r <kbps>            Pool total upload rate   (default: same as -R)
  -c <kbps>            Pool total upload ceil   (default: same as -C)

USER BANDWIDTH (leaf class under pool root):
  -d <classid>         Download HTB class minor ID  (e.g. 2001)
  -u <classid>         Upload HTB class minor ID    (e.g. 3001)
  -D <kbps>            User download rate in kbps
  -U <kbps>            User upload rate in kbps
  -g <kbps>            Guaranteed download (default: 0)
  -G <kbps>            Guaranteed upload   (default: 0)

GATEWAY:
  -W <id>              Multi-gateway ID

SESSION:
  -S <id>              Session ID  (for state file / recovery)
  -m <mac>             MAC address  (AA:BB:CC:DD:EE:FF)
  -X <user_id>         StaySuite user ID

SECURITY:
  -o <policy_id>       Firewall policy chain ID

TC:
  -f <pref>            fw filter priority  (default: 100)

EXIT CODES:
  0  Success
  1  Invalid parameters
  3  nft failed
  4  tc failed
  5  Partial failure
EOF
    exit 1
}

# ─── Parse arguments ──────────────────────────────────────────────────
while getopts "i:a:s:L:P:R:C:r:c:d:u:D:U:g:G:W:S:m:X:o:f:t:" opt; do
    case "$opt" in
        i) IP="$OPTARG" ;;
        a) ACTION="$OPTARG" ;;
        s) SNAT_IP="$OPTARG" ;;
        L) MAP_LIVE="$OPTARG" ;;
        P) POOL_ID="$OPTARG" ;;
        R) POOL_RATE_DN="$OPTARG" ;;
        C) POOL_CEIL_DN="$OPTARG" ;;
        r) POOL_RATE_UP="$OPTARG" ;;
        c) POOL_CEIL_UP="$OPTARG" ;;
        d) DN_CLASSID="$OPTARG" ;;
        u) UP_CLASSID="$OPTARG" ;;
        D) DN_KBPS="$OPTARG" ;;
        U) UP_KBPS="$OPTARG" ;;
        g) DN_GUAR="$OPTARG" ;;
        G) UP_GUAR="$OPTARG" ;;
        W) GATEWAY_ID="$OPTARG" ;;
        S) SESSION_ID="$OPTARG" ;;
        m) MAC_ADDR="$OPTARG" ;;
        X) USER_ID="$OPTARG" ;;
        o) POLICY_ID="$OPTARG" ;;
        f) FW_PREF="$OPTARG" ;;
        t) ;;  # resttype compat, ignored
        \?) usage ;;
        *) usage ;;
    esac
done

# ─── Validate required ───────────────────────────────────────────────
[[ -z "$IP" ]] && { log_err "Missing: -i <ip>"; exit 1; }
[[ "$IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] || { log_err "Bad IP: $IP"; exit 1; }
[[ "$ACTION" != "accept" && "$ACTION" != "snat" && "$ACTION" != "masq" ]] && { log_err "Bad action: $ACTION"; exit 1; }
[[ "$ACTION" == "snat" && -z "$SNAT_IP" ]] && { log_err "SNAT requires -s"; exit 1; }
if [[ "$POOL_ID" -gt 0 ]]; then
    [[ "$DN_KBPS" -gt 0 && "$DN_CLASSID" -eq 0 ]] && { log_err "Bandwidth without -d classid"; exit 1; }
    [[ "$UP_KBPS" -gt 0 && "$UP_CLASSID" -eq 0 ]] && { log_err "Bandwidth without -u classid"; exit 1; }
fi

# Upload pool defaults to download values if not specified
[[ "$POOL_RATE_UP" -eq 0 ]] && POOL_RATE_UP="$POOL_RATE_DN"
[[ "$POOL_CEIL_UP" -eq 0 ]]  && POOL_CEIL_UP="$POOL_CEIL_DN"

# ─── Log all received parameters (copy-paste for manual debugging) ───
PARAM_LOG="LOGIN PARMS: -i $IP -a $ACTION"
[[ -n "$SNAT_IP" ]] && PARAM_LOG="$PARAM_LOG -s $SNAT_IP"
[[ "$POOL_ID" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -P $POOL_ID -R $POOL_RATE_DN -C $POOL_CEIL_DN -r $POOL_RATE_UP -c $POOL_CEIL_UP"
[[ "$DN_CLASSID" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -d $DN_CLASSID"
[[ "$UP_CLASSID" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -u $UP_CLASSID"
[[ "$DN_KBPS" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -D $DN_KBPS"
[[ "$UP_KBPS" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -U $UP_KBPS"
[[ "$DN_GUAR" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -g $DN_GUAR"
[[ "$UP_GUAR" -gt 0 ]] && PARAM_LOG="$PARAM_LOG -G $UP_GUAR"
[[ -n "$GATEWAY_ID" && "$GATEWAY_ID" != "-1" ]] && PARAM_LOG="$PARAM_LOG -W $GATEWAY_ID"
[[ -n "$SESSION_ID" ]] && PARAM_LOG="$PARAM_LOG -S $SESSION_ID"
[[ -n "$MAC_ADDR" ]] && PARAM_LOG="$PARAM_LOG -m $MAC_ADDR"
[[ -n "$USER_ID" ]] && PARAM_LOG="$PARAM_LOG -X $USER_ID"
[[ -n "$POLICY_ID" && "$POLICY_ID" != "0" ]] && PARAM_LOG="$PARAM_LOG -o $POLICY_ID"
[[ "$FW_PREF" -ne 100 ]] && PARAM_LOG="$PARAM_LOG -f $FW_PREF"
log_msg "$PARAM_LOG"
echo "$PARAM_LOG" >&2

# ─── File locking ────────────────────────────────────────────────────
LCK="/tmp/staysuite_login_${IP}.LCK"
exec 8>"$LCK"
flock -n 8 2>/dev/null || {
    flock -w 10 8 2>/dev/null || { log_err "Lock timeout for $IP"; exit 1; }
}

# ─── Helpers ─────────────────────────────────────────────────────────
# Convert IPv4 to hex mark: 192.168.1.100 → 0xC0A80164
ip_to_hex() {
    local IFS='.'
    read -ra o <<< "$1"
    printf "0x%02X%02X%02X%02X" "${o[0]}" "${o[1]}" "${o[2]}" "${o[3]}"
}

# Comment tag for nft rules (enables precise removal on logout)
TAG="ss_${IP//./_}"
MARK=$(ip_to_hex "$IP")

# ─── Step 1: Check duplicate ────────────────────────────────────────
if nft get element inet mangle loggedinusers "{ ${IP} }" >/dev/null 2>&1; then
    log_msg "DUPLICATE: $IP already in loggedinusers (session=$SESSION_ID)"
    exit 0
fi

log_msg "LOGIN: ip=$IP mark=$MARK action=$ACTION pool=$POOL_ID dn=${DN_KBPS}k up=${UP_KBPS}k session=$SESSION_ID"

# ─── Step 2: Add IP to all required nft sets ────────────────────────
# loggedinusers — authoritative set, used for duplicate detection
# usersset       — traffic flow (prerouting: ip saddr @usersset accept)
# usersdstset    — download direction (postrouting: ip daddr @usersdstset accept)
# llusersset     — low-latency accounting (prerouting: jump acctup)
# loggedinusersdstip — destination IP accept (prerouting: ip daddr @loggedinusersdstip accept)
SET_FAILED=0
nft add element inet mangle loggedinusers "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: +loggedinusers $IP" || { SET_FAILED=1; log_err "nft: failed to add $IP to loggedinusers"; }
nft add element inet mangle usersset "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: +usersset $IP" || { SET_FAILED=1; log_err "nft: failed to add $IP to usersset"; }
nft add element inet mangle usersdstset "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: +usersdstset $IP" || { SET_FAILED=1; log_err "nft: failed to add $IP to usersdstset"; }
nft add element inet mangle llusersset "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: +llusersset $IP" || { SET_FAILED=1; log_err "nft: failed to add $IP to llusersset"; }
nft add element inet mangle loggedinusersdstip "{ ${IP} }" 2>/dev/null \
    && log_msg "nft: +loggedinusersdstip $IP" || true  # non-critical

if [[ "$SET_FAILED" -eq 1 ]]; then
    log_err "nft: failed to add $IP to one or more sets — cleanup"
    echo "[NFT FAIL] set add failed for $IP — cleanup and exit 3" >&2
    nft delete element inet mangle loggedinusers "{ ${IP} }" 2>/dev/null
    nft delete element inet mangle usersset "{ ${IP} }" 2>/dev/null
    nft delete element inet mangle usersdstset "{ ${IP} }" 2>/dev/null
    nft delete element inet mangle llusersset "{ ${IP} }" 2>/dev/null
    exit 3
fi

# ─── Step 3: Insert nft fwmark rules in prerouting ──────────────────
# Dynamically find position: insert before the first @usersset check rule
# so marks are set BEFORE the terminal accept rules.
# Fallback: insert at chain start (safe — rules match specific IP only).
REF_HANDLE=""
REF_HANDLE=$(nft -a list chain inet mangle prerouting 2>/dev/null \
    | grep -m1 'ip saddr @usersset meta mark set ct mark' \
    | grep -oP 'handle \K[0-9]+')
INSERT_POS="position ${REF_HANDLE}"
if [[ -z "$REF_HANDLE" ]]; then
    INSERT_POS=""
    log_msg "nft: @usersset mark ref not found — inserting mark rules at chain start"
fi

NFT_SADDR_ERR=$(nft insert rule inet mangle prerouting ${INSERT_POS} \
    ip saddr "${IP}" meta mark set "${MARK}" \
    comment "${TAG}_mark" 2>&1)
if [[ $? -ne 0 ]]; then
    NFT_FAILED=1
    log_err "nft: failed saddr mark rule: ${NFT_SADDR_ERR}"
    echo "[NFT FAIL] saddr mark ${IP}: ${NFT_SADDR_ERR}" >&2
else
    log_msg "nft: prerouting saddr ${IP} → mark ${MARK}"
fi

NFT_DADDR_ERR=$(nft insert rule inet mangle prerouting ${INSERT_POS} \
    ip daddr "${IP}" meta mark set "${MARK}" \
    comment "${TAG}_mark_dn" 2>&1)
if [[ $? -ne 0 ]]; then
    NFT_FAILED=1
    log_err "nft: failed daddr mark rule: ${NFT_DADDR_ERR}"
    echo "[NFT FAIL] daddr mark ${IP}: ${NFT_DADDR_ERR}" >&2
else
    log_msg "nft: prerouting daddr ${IP} → mark ${MARK}"
fi

# ─── Step 4: NAT POSTROUTING ───────────────────────────────────────
case "$ACTION" in
    accept)
        nft add rule inet nat postrouting ip saddr "${IP}" counter accept \
            comment "\"${TAG}_nat\"" 2>/dev/null && log_msg "nft: postrouting accept $IP"
        ;;
    snat)
        nft add element inet mangle loggedinuserssnatip "{ ${SNAT_IP} }" 2>/dev/null \
            && log_msg "nft: +loggedinuserssnatip $SNAT_IP"
        nft add rule inet nat postrouting ip saddr "${IP}" counter snat to "${SNAT_IP}" \
            comment "\"${TAG}_nat\"" 2>/dev/null && log_msg "nft: postrouting snat $IP → $SNAT_IP"
        if [[ "$MAP_LIVE" == "1" ]]; then
            nft add rule inet nat prerouting ip daddr "${SNAT_IP}" counter dnat to "${IP}" \
                comment "\"${TAG}_hairpin\"" 2>/dev/null && log_msg "nft: prerouting hairpin $SNAT_IP → $IP"
        fi
        ;;
    masq)
        nft add rule inet nat postrouting ip saddr "${IP}" counter masquerade \
            comment "\"${TAG}_nat\"" 2>/dev/null && log_msg "nft: postrouting masq $IP"
        ;;
esac

# ─── Step 5: Multi-gateway ─────────────────────────────────────────
if [[ -n "$GATEWAY_ID" && "$GATEWAY_ID" != "-1" ]]; then
    nft add element inet nat "gw${GATEWAY_ID}_ipset" "{ ${IP} }" 2>/dev/null \
        && log_msg "nft: +gw${GATEWAY_ID}_ipset $IP"
fi

# ─── Step 6: Security policy ───────────────────────────────────────
if [[ -n "$POLICY_ID" && "$POLICY_ID" != "0" ]]; then
    nft add rule inet filter input ip saddr "${IP}" counter jump "${POLICY_ID}" \
        comment "\"${TAG}_policy\"" 2>/dev/null && log_msg "nft: filter policy $POLICY_ID $IP"
fi

# ─── Step 7: Heartbeat ──────────────────────────────────────────────
nft add rule inet filter intranetuploadaccounting ip saddr "${IP}" udp dport 6060 counter accept \
    comment "\"${TAG}_heartbeat\"" 2>/dev/null && log_msg "nft: heartbeat $IP:6060"

# ═══════════════════════════════════════════════════════════════════
#  TC / HTB BANDWIDTH SHAPING
# ═══════════════════════════════════════════════════════════════════
# initialization.sh creates the base:
#   ifb0: qdisc 1: htb → class 1:1 rate 10gbit  (download)
#   ifb1: qdisc 1: htb → class 1:1 rate 10gbit  (upload)
#
# Login adds:
#   1. Pool root class:   1:<pool_id>   parent 1:1
#   2. User leaf class:   1:<classid>   parent 1:<pool_id>
#   3. fw filter:  handle 0xIP_HEX → classid 1:<classid>
# ═══════════════════════════════════════════════════════════════════

# Verify TC HTB infrastructure exists before attempting bandwidth shaping.
# If the root qdisc is missing (e.g., initialization.sh not run), skip TC
# entirely rather than failing and triggering exit 5.
TC_INFRA_OK=1
tc qdisc show dev ifb0 2>/dev/null | grep -q 'qdisc htb 1:' || TC_INFRA_OK=0

if [[ "$TC_INFRA_OK" -eq 0 && "$POOL_ID" -gt 0 ]]; then
    log_msg "tc: HTB qdisc not found on ifb0 — trying initialization.sh"
    echo "[WARN] tc: HTB qdisc missing — attempting auto-initialization" >&2
    INIT_SCRIPT="/usr/local/scripts/staysuite_core/bwscripts/initialization.sh"
    if [[ -x "$INIT_SCRIPT" ]]; then
        $INIT_SCRIPT 2>/dev/null && TC_INFRA_OK=1 && log_msg "tc: initialization.sh succeeded" || log_err "tc: initialization.sh failed"
    else
        log_err "tc: $INIT_SCRIPT not found or not executable"
    fi
fi

if [[ "$POOL_ID" -gt 0 && "$TC_INFRA_OK" -eq 1 ]]; then

    log_msg "tc: TC section START — pool=$POOL_ID dn_cls=$DN_CLASSID up_cls=$UP_CLASSID dn=${DN_KBPS}k up=${UP_KBPS}k"
    echo "[TC] pool=$POOL_ID dn_cls=$DN_CLASSID up_cls=$UP_CLASSID dn=${DN_KBPS}k up=${UP_KBPS}k" >&2

    # ─── Step 8: Ensure pool root class exists ───────────────────────
    # classid 1:<pool_id> under parent 1:1 on both ifb0 and ifb1
    for dev in ifb0 ifb1; do
        # Determine rate/ceil for this device
        if [[ "$dev" == "ifb0" ]]; then
            prate="$POOL_RATE_DN"; pceil="$POOL_CEIL_DN"
        else
            prate="$POOL_RATE_UP"; pceil="$POOL_CEIL_UP"
        fi

        # Skip if pool has no bandwidth configured
        if [[ "$prate" -eq 0 ]]; then
            continue
        fi

        # Check if pool class already exists
        # NOTE: "tc class show ... classid X" returns exit 0 even when class
        # does NOT exist — must pipe through grep -q . to check for output
        if tc class show dev "$dev" classid "1:${POOL_ID}" 2>/dev/null | grep -q .; then
            log_msg "tc: pool root 1:${POOL_ID} already exists on $dev (rate=$prate ceil=$pceil)"
        else
            if tc class add dev "$dev" parent 1:1 classid "1:${POOL_ID}" htb \
                rate "${prate}kbit" ceil "${pceil}kbit" quantum 1500 2>/dev/null; then
                log_msg "tc: pool root 1:${POOL_ID} created on $dev (rate=${prate}kbit ceil=${pceil}kbit)"
            else
                TC_FAILED=1
                log_err "tc: failed to create pool root 1:${POOL_ID} on $dev"
            fi
        fi
    done

    # ─── Step 9: User leaf class on ifb0 (download) ─────────────────
    if [[ "$DN_KBPS" -gt 0 && "$DN_CLASSID" -gt 0 ]]; then
        DN_RATE="${DN_KBPS}kbit"
        DN_CEIL="${DN_KBPS}kbit"
        DN_GUAR_RATE="${DN_KBPS}kbit"
        [[ "$DN_GUAR" -gt 0 ]] && { DN_GUAR_RATE="${DN_GUAR}kbit"; DN_CEIL="${DN_GUAR}kbit"; }

        # Parent is pool root class: 1:<pool_id>
        # If pool has no download rate, fall back to root 1:1
        local_parent="1:${POOL_ID}"
        if [[ "$POOL_RATE_DN" -eq 0 ]]; then
            local_parent="1:1"
        fi

        if ! tc class add dev ifb0 parent "$local_parent" classid "1:${DN_CLASSID}" htb \
            rate "$DN_GUAR_RATE" ceil "$DN_CEIL" quantum 1500 2>/dev/null; then
            TC_FAILED=1
            log_err "tc: failed download class 1:${DN_CLASSID} on ifb0"
        else
            log_msg "tc: download 1:${DN_CLASSID} under $local_parent on ifb0 (rate=$DN_GUAR_RATE ceil=$DN_CEIL)"

            # fw filter: match mark set by nft → assign to user class
            if ! tc filter add dev ifb0 parent 1: protocol ip pref "$FW_PREF" fw \
                handle "${MARK}" classid "1:${DN_CLASSID}" 2>/dev/null; then
                TC_FAILED=1
                log_err "tc: failed download fw filter $MARK → 1:${DN_CLASSID}"
            else
                log_msg "tc: fw filter ifb0 handle $MARK → 1:${DN_CLASSID}"
            fi
        fi
    fi

    # ─── Step 10: User leaf class on ifb1 (upload) ──────────────────
    if [[ "$UP_KBPS" -gt 0 && "$UP_CLASSID" -gt 0 ]]; then
        UP_RATE="${UP_KBPS}kbit"
        UP_CEIL="${UP_KBPS}kbit"
        UP_GUAR_RATE="${UP_KBPS}kbit"
        [[ "$UP_GUAR" -gt 0 ]] && { UP_GUAR_RATE="${UP_GUAR}kbit"; UP_CEIL="${UP_GUAR}kbit"; }

        local_parent="1:${POOL_ID}"
        if [[ "$POOL_RATE_UP" -eq 0 ]]; then
            local_parent="1:1"
        fi

        if ! tc class add dev ifb1 parent "$local_parent" classid "1:${UP_CLASSID}" htb \
            rate "$UP_GUAR_RATE" ceil "$UP_CEIL" quantum 1500 2>/dev/null; then
            TC_FAILED=1
            log_err "tc: failed upload class 1:${UP_CLASSID} on ifb1"
        else
            log_msg "tc: upload 1:${UP_CLASSID} under $local_parent on ifb1 (rate=$UP_GUAR_RATE ceil=$UP_CEIL)"

            if ! tc filter add dev ifb1 parent 1: protocol ip pref "$FW_PREF" fw \
                handle "${MARK}" classid "1:${UP_CLASSID}" 2>/dev/null; then
                TC_FAILED=1
                log_err "tc: failed upload fw filter $MARK → 1:${UP_CLASSID}"
            else
                log_msg "tc: fw filter ifb1 handle $MARK → 1:${UP_CLASSID}"
            fi
        fi
    fi
elif [[ "$POOL_ID" -gt 0 ]]; then
    # Pool configured but TC infrastructure missing — skip bandwidth shaping
    log_msg "tc: HTB qdisc not found on ifb0 — skipping bandwidth shaping for $IP"
    echo "[WARN] tc: no HTB root qdisc on ifb0/ifb1 — bandwidth skipped for $IP" >&2
fi

# ─── Step 11: Save session state ────────────────────────────────────
if [[ -n "$SESSION_ID" ]]; then
    STATE_CONTENT="IP=${IP}
MARK=${MARK}
ACTION=${ACTION}
SNAT_IP=${SNAT_IP}
POOL_ID=${POOL_ID}
POOL_RATE_DN=${POOL_RATE_DN}
POOL_CEIL_DN=${POOL_CEIL_DN}
POOL_RATE_UP=${POOL_RATE_UP}
POOL_CEIL_UP=${POOL_CEIL_UP}
DN_CLASSID=${DN_CLASSID}
UP_CLASSID=${UP_CLASSID}
DN_KBPS=${DN_KBPS}
UP_KBPS=${UP_KBPS}
DN_GUAR=${DN_GUAR}
UP_GUAR=${UP_GUAR}
GATEWAY_ID=${GATEWAY_ID}
POLICY_ID=${POLICY_ID}
MAC_ADDR=${MAC_ADDR}
USER_ID=${USER_ID}
MAP_LIVE=${MAP_LIVE}
FW_PREF=${FW_PREF}
TIMESTAMP=$(date +%s)"

    # Save to tmpfs (fast lookup for logout)
    echo "$STATE_CONTENT" > "${STATEDIR}/${SESSION_ID}.state"
    # Save to persistent storage (survives reboot for recovery)
    echo "$STATE_CONTENT" > "${PERSIST_STATEDIR}/${SESSION_ID}.state"
    log_msg "state saved: $SESSION_ID"
fi

# ─── Step 12: Backup nft set elements (for reboot recovery) ────────
nft list elements inet mangle loggedinusers 2>/dev/null > /var/lib/staysuite/nft_loggedinusers.set 2>/dev/null || true
nft list elements inet mangle usersset 2>/dev/null > /var/lib/staysuite/nft_usersset.set 2>/dev/null || true
nft list elements inet mangle usersdstset 2>/dev/null > /var/lib/staysuite/nft_usersdstset.set 2>/dev/null || true
nft list elements inet mangle loggedinuserssnatip 2>/dev/null > /var/lib/staysuite/nft_loggedinuserssnatip.set 2>/dev/null || true

# ─── Cleanup helper (used on partial failure) ───────────────────────
cleanup_all_sets() {
    log_msg "cleanup: removing $IP from all sets"
    nft delete element inet mangle loggedinusers "{ ${IP} }" 2>/dev/null
    nft delete element inet mangle usersset "{ ${IP} }" 2>/dev/null
    nft delete element inet mangle usersdstset "{ ${IP} }" 2>/dev/null
    nft delete element inet mangle llusersset "{ ${IP} }" 2>/dev/null
    nft delete element inet mangle loggedinusersdstip "{ ${IP} }" 2>/dev/null
    # Clean up orphaned NAT rules (by comment tag)
    nft -a list chain inet nat postrouting 2>/dev/null \
        | grep "\"${TAG}_nat\"" | grep -oP 'handle \K[0-9]+' | sort -rn | while read h; do
            nft delete rule inet nat postrouting handle "$h" 2>/dev/null \
                && log_msg "cleanup: nat postrouting handle $h"
        done
    # Clean up orphaned heartbeat rules
    nft -a list chain inet filter intranetuploadaccounting 2>/dev/null \
        | grep "\"${TAG}_heartbeat\"" | grep -oP 'handle \K[0-9]+' | sort -rn | while read h; do
            nft delete rule inet filter intranetuploadaccounting handle "$h" 2>/dev/null \
                && log_msg "cleanup: heartbeat handle $h"
        done
}

# ─── Final result ────────────────────────────────────────────────────
if [[ "$NFT_FAILED" -eq 1 && "$TC_FAILED" -eq 1 ]]; then
    log_err "PARTIAL FAIL $IP: nft+tc both failed — cleanup"
    echo "[LOGIN FAIL] ${IP}: nft+tc both failed — full cleanup (exit 5)" >&2
    cleanup_all_sets
    exit 5
elif [[ "$NFT_FAILED" -eq 1 ]]; then
    log_err "PARTIAL FAIL $IP: nft failed, tc OK — cleanup sets"
    echo "[LOGIN FAIL] ${IP}: nft mark insert failed — cleanup (exit 3)" >&2
    cleanup_all_sets
    exit 3
elif [[ "$TC_FAILED" -eq 1 ]]; then
    log_err "PARTIAL FAIL $IP: tc failed, nft OK (user still has internet, no bandwidth limits)"
    echo "[LOGIN WARN] ${IP}: tc failed — user has internet, no bandwidth limits" >&2
    # TC failure is non-fatal — user gets internet without bandwidth limits
fi

log_msg "OK: ip=$IP mark=$MARK session=$SESSION_ID"
exit 0
