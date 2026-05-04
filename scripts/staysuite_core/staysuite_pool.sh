#!/bin/bash
###########################################################################
#       Script : StaySuite Pool Management
#       OS     : Rocky Linux 10 (nftables v1.1.1 + tc HTB)
#       Reason : Create/delete/list IP pool root HTB classes
#
#  Each BandwidthPool gets a root HTB class on ifb0 (download) and
#  ifb1 (upload). User leaf classes are created under their pool root.
#
#  TC Hierarchy:
#    1:1 (root, 10gbit)
#    ├── 1:<pool_id> (pool root, rate/ceil from BandwidthPool)
#    │   ├── 1:<user_class_dn> (user download leaf)
#    │   └── 1:<user_class_up> (user upload leaf)
#    └── ... (other pools)
#
#  Usage:
#    staysuite_pool.sh create -P <id> -R <dn_rate> -C <dn_ceil> [-r <up_rate>] [-c <up_ceil>]
#    staysuite_pool.sh delete -P <id>
#    staysuite_pool.sh list
#    staysuite_pool.sh stats
#    staysuite_pool.sh cleanup   (remove empty pools with no child classes)
###########################################################################

set -euo pipefail

LOGFILE="${LOGFILE:-/var/log/staysuite_login.log}"
log_msg()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [POOL] $*" >> "$LOGFILE" 2>/dev/null; }
log_err()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [POOL][ERR] $*" >> "$LOGFILE" 2>/dev/null; }

POOL_ID=0
DN_RATE=0
DN_CEIL=0
UP_RATE=0
UP_CEIL=0
CMD=""

usage() {
    cat <<'EOF'
Usage: staysuite_pool.sh <command> [OPTIONS]

COMMANDS:
  create   Create pool root HTB classes on ifb0/ifb1
  delete   Delete pool root classes (fails if users exist under pool)
  list     List all pool root classes with utilization
  stats    Show pool statistics (bytes sent/received via tc -s)
  cleanup  Remove empty pool classes (no child users)

CREATE OPTIONS:
  -P <id>          Pool ID  (REQUIRED — becomes HTB classid minor)
  -R <kbps>        Download rate
  -C <kbps>        Download ceil
  -r <kbps>        Upload rate   (default: same as -R)
  -c <kbps>        Upload ceil   (default: same as -C)

DELETE OPTIONS:
  -P <id>          Pool ID  (REQUIRED)
  -f               Force delete even if users exist
EOF
    exit 1
}

# ─── Parse ────────────────────────────────────────────────────────────
CMD="${1:-list}"; shift 2>/dev/null || true
[[ "$CMD" == "-h" || "$CMD" == "--help" || -z "$CMD" ]] && usage

while getopts "P:R:C:r:c:f" opt; do
    case "$opt" in
        P) POOL_ID="$OPTARG" ;;
        R) DN_RATE="$OPTARG" ;;
        C) DN_CEIL="$OPTARG" ;;
        r) UP_RATE="$OPTARG" ;;
        c) UP_CEIL="$OPTARG" ;;
        f) FORCE=1 ;;
        \?) usage ;;
    esac
done
[[ "$UP_RATE" -eq 0 ]] && UP_RATE="$DN_RATE"
[[ "$UP_CEIL" -eq 0 ]]  && UP_CEIL="$DN_CEIL"

# ─── Commands ────────────────────────────────────────────────────────
case "$CMD" in
    create)
        [[ "$POOL_ID" -le 0 ]] && { log_err "create requires -P <pool_id>"; exit 1; }
        [[ "$DN_RATE" -le 0 ]] && { log_err "create requires -R <rate_kbps>"; exit 1; }

        for dev in ifb0 ifb1; do
            rate="$DN_RATE"; ceil="$DN_CEIL"
            [[ "$dev" == "ifb1" ]] && { rate="$UP_RATE"; ceil="$UP_CEIL"; }
            [[ "$rate" -le 0 ]] && continue

            # NOTE: "tc class show ... classid X" returns exit 0 even when the class
            # does NOT exist — must check if output is non-empty via grep -q .
            if tc class show dev "$dev" classid "1:${POOL_ID}" 2>/dev/null | grep -q .; then
                log_msg "pool 1:${POOL_ID} already exists on $dev — updating"
                if tc class change dev "$dev" parent 1:1 classid "1:${POOL_ID}" htb \
                    rate "${rate}kbit" ceil "${ceil}kbit" quantum 1500 2>/dev/null; then
                    log_msg "pool 1:${POOL_ID} updated on $dev (rate=${rate}kbit ceil=${ceil}kbit)"
                else
                    log_err "pool 1:${POOL_ID} change FAILED on $dev (class may not exist despite check — trying add)"
                    tc class add dev "$dev" parent 1:1 classid "1:${POOL_ID}" htb \
                        rate "${rate}kbit" ceil "${ceil}kbit" quantum 1500 2>/dev/null \
                        && log_msg "pool 1:${POOL_ID} fallback-add on $dev (rate=${rate}kbit ceil=${ceil}kbit)" \
                        || log_err "pool 1:${POOL_ID} add also FAILED on $dev"
                fi
            else
                if tc class add dev "$dev" parent 1:1 classid "1:${POOL_ID}" htb \
                    rate "${rate}kbit" ceil "${ceil}kbit" quantum 1500 2>/dev/null; then
                    log_msg "pool 1:${POOL_ID} created on $dev (rate=${rate}kbit ceil=${ceil}kbit)"
                else
                    log_err "pool 1:${POOL_ID} create FAILED on $dev"
                    exit 1
                fi
            fi
        done
        ;;

    delete)
        [[ "$POOL_ID" -le 0 ]] && { log_err "delete requires -P <pool_id>"; exit 1; }

        for dev in ifb0 ifb1; do
            tc class del dev "$dev" classid "1:${POOL_ID}" 2>/dev/null \
                && log_msg "pool 1:${POOL_ID} deleted from $dev" \
                || log_err "pool 1:${POOL_ID} not found on $dev (or has children)"
        done
        ;;

    list)
        echo "╔══════════════════════════════════════════════════════════════════════╗"
        echo "║  StaySuite Bandwidth Pool Classes                                  ║"
        echo "╠════════╤═════════════╤════════════╤══════════════╤════════════════════╣"
        echo "║ Pool   │ ifb0 DN     │ ifb0 Rate   │ ifb1 UP     │ ifb1 Rate        ║"
        echo "╠════════╪═════════════╪════════════╪══════════════╪════════════════════╣"

        for dev in ifb0 ifb1; do
            tc -s class show dev "$dev" 2>/dev/null | while IFS= read -r line; do
                # Parse: class htb 1:5 root rate 10240Kbit ceil 20480Kbit burst 1600b ...
                if [[ "$line" =~ class\ htb\ 1:([0-9]+)\ parent\ 1:1 ]]; then
                    pid="${BASH_REMATCH[1]}"
                    # Skip root class (1:1) and default
                    [[ "$pid" == "1" ]] && continue
                    rate=$(echo "$line" | grep -oP 'rate \K[0-9]+')
                    ceil=$(echo "$line" | grep -oP 'ceil \K[0-9]+')
                    # Convert Kbit to kbps
                    [[ "$rate" =~ Kbit$ ]] && rate="${rate/Kbit/}"
                    [[ "$ceil" =~ Kbit$ ]] && ceil="${ceil/Kbit/}"
                    # Count child classes
                    children=$(tc class show dev "$dev" 2>/dev/null \
                        | grep -c "parent 1:${pid}" 2>/dev/null || echo 0)
                    echo "║ ${pid}    │ ${dev} ${rate}K  │ ceil ${ceil}K │ users: ${children}   │"
                fi
            done
        done
        echo "╚════════╧═════════════╧════════════╧══════════════╧════════════════════╝"
        ;;

    stats)
        echo "=== Pool Statistics (tc -s class show dev ifb0) ==="
        tc -s class show dev ifb0 2>/dev/null | grep "parent 1:1\|class htb 1:1"
        echo ""
        echo "=== Pool Statistics (tc -s class show dev ifb1) ==="
        tc -s class show dev ifb1 2>/dev/null | grep "parent 1:1\|class htb 1:1"
        ;;

    cleanup)
        # Find pool classes on ifb0 that have no child classes, and delete them
        echo "Checking for empty pools..."
        for dev in ifb0 ifb1; do
            while IFS= read -r line; do
                if [[ "$line" =~ class\ htb\ 1:([0-9]+)\ parent\ 1:1 ]]; then
                    pid="${BASH_REMATCH[1]}"
                    [[ "$pid" == "1" ]] && continue
                    # Check if any class has this as parent
                    children=$(tc class show dev "$dev" 2>/dev/null \
                        | grep -c "parent 1:${pid} " 2>/dev/null || echo 0)
                    if [[ "$children" -eq 0 ]]; then
                        tc class del dev "$dev" classid "1:${pid}" 2>/dev/null \
                            && echo "Cleaned empty pool 1:${pid} from $dev"
                    fi
                fi
            done < <(tc class show dev "$dev" 2>/dev/null)
        done
        echo "Done."
        ;;

    *)
        usage
        ;;
esac

exit 0
