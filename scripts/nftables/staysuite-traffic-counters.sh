#!/bin/bash
###########################################################################
#  StaySuite HospitalityOS — Per-IP Traffic Counter Helper (nftables)
#
#  Purpose:  Manage per-user byte counters for interim accounting.
#            When a user authenticates, this script adds counter rules
#            to track their download/upload bytes. The Session Engine
#            reads these counters every 60s to generate interim updates.
#
#  Architecture:
#    - Uses a dedicated table "inet staysuite_count" with a forward chain
#    - Two counter rules per user: one for download (dst=IP), one for upload (src=IP)
#    - Anonymous counters with name embedded in comment for cross-version compatibility
#      ("user_in_<ip>" / "user_out_<ip>" in comment field for grep-based lookup)
#    - This table does NOT filter traffic — it only COUNTS (policy accept)
#
#  Usage:
#    staysuite-traffic-counters.sh setup         — Create counter table + chain
#    staysuite-traffic-counters.sh teardown      — Remove counter table
#    staysuite-traffic-counters.sh add <ip>      — Add counter rules for user
#    staysuite-traffic-counters.sh remove <ip>   — Remove ALL counter rules for user
#    staysuite-traffic-counters.sh read <ip>     — Read byte counts for user
#    staysuite-traffic-counters.sh read-all      — Read byte counts for ALL users
#    staysuite-traffic-counters.sh flush         — Remove all counter rules
#
#  Examples:
#    ./staysuite-traffic-counters.sh setup
#    ./staysuite-traffic-counters.sh add 192.168.1.100
#    ./staysuite-traffic-counters.sh read 192.168.1.100
#    # Output: 192.168.1.100 1234567 987654
#    #         (ip download_bytes upload_bytes)
#
#  NOTE: The logout script (staysuite_logout.sh) also performs counter
#  cleanup independently via nft handle scanning. This script is used by
#  the TypeScript session engine for read/add/remove operations.
#
###########################################################################

set -uo pipefail

LOG_TAG="staysuite-counters"
LOG_FILE="${STAYSUITE_DIR:-/usr/local/staysuite}/logs/counters.log"
TABLE="inet staysuite_count"
CHAIN="forward"

log() {
    local level="${1:-INFO}"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${LOG_TAG}] [${level}] $*" \
        | tee -a "$LOG_FILE" 2>/dev/null || echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${LOG_TAG}] [${level}] $*"
}

validate_ip() {
    local ip="$1"
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        local IFS='.'
        read -ra octets <<< "$ip"
        for octet in "${octets[@]}"; do
            if [ "$octet" -gt 255 ] 2>/dev/null; then
                return 1
            fi
        done
        return 0
    fi
    return 1
}

# Convert IP to safe nft counter name: 192.168.1.100 → 192_168_1_100
ip_to_counter_name() {
    echo "${1//./_}"
}

# ═══════════════════════════════════════════════════════════════════════════
#  Commands
# ═══════════════════════════════════════════════════════════════════════════

cmd_setup() {
    # Create the counter table if it doesn't exist
    if nft list tables 2>/dev/null | grep -q "staysuite_count"; then
        log "INFO" "Counter table already exists"
        return 0
    fi

    nft add table inet staysuite_count
    nft add chain inet staysuite_count forward \
        '{ type filter hook forward priority filter - 10; policy accept; }'

    log "INFO" "Counter table created: ${TABLE} ${CHAIN}"
}

cmd_teardown() {
    nft delete table inet staysuite_count 2>/dev/null && \
        log "INFO" "Counter table removed" || \
        log "WARN" "Counter table not found"
}

cmd_add() {
    local ip="$1"
    if ! validate_ip "$ip"; then
        log "ERROR" "Invalid IP: $ip"
        return 1
    fi

    # Ensure table exists
    if ! nft list tables 2>/dev/null | grep -q "staysuite_count"; then
        cmd_setup
    fi

    local safe_ip
    safe_ip=$(ip_to_counter_name "$ip")

    # ── BUG FIX: Check for EXISTING rules and clean them up first ──
    # Previously, if rules existed from a prior session (logout didn't clean),
    # the duplicate check would find user_in_ and skip — leaving stale rules.
    # Now: if ANY rules exist for this IP, remove them all first, then add fresh.
    local existing_handles
    existing_handles=$(nft -a list chain inet staysuite_count forward 2>/dev/null | \
        grep -E "user_(in|out)_${safe_ip}" | \
        grep -oP 'handle \K[0-9]+' | sort -rn || true)

    if [[ -n "$existing_handles" ]]; then
        log "WARN" "Found ${#existing_handles[@]} stale counter rules for $ip — cleaning up before add"
        for handle in $existing_handles; do
            nft delete rule inet staysuite_count forward handle "$handle" 2>/dev/null || true
        done
    fi

    # Add download counter: traffic TO this user (dst = user IP)
    # Uses anonymous counter + comment (compatible with all nftables/kernel versions)
    # Named counters ("counter name") require kernel >= 5.18 which may not be available
    nft add rule inet staysuite_count forward \
        ip daddr "$ip" counter comment "\"user_in_${safe_ip} stayuser $ip\""

    # Add upload counter: traffic FROM this user (src = user IP)
    nft add rule inet staysuite_count forward \
        ip saddr "$ip" counter comment "\"user_out_${safe_ip} stayuser $ip\""

    log "INFO" "Counter rules added for $ip"
}

cmd_remove() {
    local ip="$1"
    if ! validate_ip "$ip"; then
        return 1
    fi

    local safe_ip
    safe_ip=$(ip_to_counter_name "$ip")

    # Remove by handle — find ALL rules with our counter names
    # Matches both user_in_<ip> and user_out_<ip>
    local handles
    handles=$(nft -a list chain inet staysuite_count forward 2>/dev/null | \
        grep -E "user_(in|out)_${safe_ip}" | \
        grep -oP 'handle \K[0-9]+' | sort -rn || true)

    if [ -z "$handles" ]; then
        log "WARN" "No counter rules found for $ip"
        return 0
    fi

    local count=0
    # Remove rules in reverse handle order (highest first) to avoid handle shift
    for handle in $handles; do
        if nft delete rule inet staysuite_count forward handle "$handle" 2>/dev/null; then
            count=$((count + 1))
        fi
    done

    log "INFO" "Removed ${count} counter rules for $ip"
}

cmd_read() {
    local ip="$1"
    if ! validate_ip "$ip"; then
        return 1
    fi

    local safe_ip
    safe_ip=$(ip_to_counter_name "$ip")

    # Parse counters from nft list output
    local output
    output=$(nft -a list chain inet staysuite_count forward 2>/dev/null)

    local download_bytes=0
    local upload_bytes=0

    # ── BUG FIX: Sum ALL matching rules (handles accumulated duplicates) ──
    # Previously, grep -oP only extracted the FIRST match's bytes.
    # Now we sum all download/upload byte values for this IP.

    # Extract ALL download bytes values (counter for dst=ip → user_in)
    while IFS= read -r val; do
        [[ -n "$val" ]] && download_bytes=$((download_bytes + val))
    done < <(echo "$output" | grep "user_in_${safe_ip}" | grep -oP 'bytes \K[0-9]+' || true)

    # Extract ALL upload bytes values (counter for src=ip → user_out)
    while IFS= read -r val; do
        [[ -n "$val" ]] && upload_bytes=$((upload_bytes + val))
    done < <(echo "$output" | grep "user_out_${safe_ip}" | grep -oP 'bytes \K[0-9]+' || true)

    # Output format: ip download_bytes upload_bytes
    echo "$ip $download_bytes $upload_bytes"
}

cmd_read_all() {
    local output
    output=$(nft -a list chain inet staysuite_count forward 2>/dev/null)

    # Extract all unique IPs from stayuser comments
    local ips
    ips=$(echo "$output" | grep -oP 'stayuser \K[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | sort -u)

    if [ -z "$ips" ]; then
        echo "# No active user counters"
        return 0
    fi

    # Header
    echo "# ip download_bytes upload_bytes"
    for ip in $ips; do
        cmd_read "$ip"
    done
}

cmd_flush() {
    log "WARN" "Flushing ALL user counters!"
    # Remove and recreate the chain
    nft flush chain inet staysuite_count forward 2>/dev/null || true
    log "INFO" "All counter rules flushed"
}

# ═══════════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════════

usage() {
    cat << 'EOF'
StaySuite Per-IP Traffic Counter Helper (nftables)

Usage: staysuite-traffic-counters.sh <command> [args]

Commands:
  setup              Create counter table and chain (run once at startup)
  teardown           Remove counter table entirely
  add <ip>           Add counter rules for a user IP (cleans stale rules first)
  remove <ip>        Remove ALL counter rules for a user IP
  read <ip>          Read byte counts (sums accumulated duplicates): ip download_bytes upload_bytes
  read-all           Read byte counts for ALL tracked users
  flush              Remove all counter rules (keep table)

Examples:
  ./staysuite-traffic-counters.sh setup
  ./staysuite-traffic-counters.sh add 192.168.1.100
  ./staysuite-traffic-counters.sh read 192.168.1.100
  ./staysuite-traffic-counters.sh read-all
  ./staysuite-traffic-counters.sh remove 192.168.1.100
EOF
    exit 1
}

main() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

    local cmd="${1:-}"
    case "$cmd" in
        setup)        cmd_setup ;;
        teardown)     cmd_teardown ;;
        add)          cmd_add "$2" ;;
        remove)       cmd_remove "$2" ;;
        read)         cmd_read "$2" ;;
        read-all)     cmd_read_all ;;
        flush)        cmd_flush ;;
        -h|--help|help) usage ;;
        *)            log "ERROR" "Unknown command: $cmd"; usage ;;
    esac
}

main "$@"
