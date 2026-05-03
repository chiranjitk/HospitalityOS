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
#    staysuite-traffic-counters.sh remove <ip>   — Remove counter rules for user
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
###########################################################################

set -euo pipefail

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

    # Check if rules already exist
    if nft list chain inet staysuite_count forward -a 2>/dev/null | grep -q "user_in_${safe_ip}"; then
        log "WARN" "Counter rules already exist for $ip, skipping"
        return 0
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

    # Remove by handle — find rules with our counter names
    # nft -a list shows handles, we use the counter name to identify
    local handles
    handles=$(nft -a list chain inet staysuite_count forward 2>/dev/null | \
        grep "user_${safe_ip}" | \
        grep -oP 'handle \K[0-9]+' || true)

    if [ -z "$handles" ]; then
        log "WARN" "No counter rules found for $ip"
        return 0
    fi

    # Remove rules in reverse handle order (highest first) to avoid handle shift
    for handle in $(echo "$handles" | sort -rn); do
        nft delete rule inet staysuite_count forward handle "$handle" 2>/dev/null || true
    done

    log "INFO" "Counter rules removed for $ip"
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

    # Extract download bytes (counter for dst=ip → user_in)
    local download_match
    download_match=$(echo "$output" | grep "user_in_${safe_ip}" | grep -oP 'bytes \K[0-9]+' || true)
    if [ -n "$download_match" ]; then
        download_bytes="$download_match"
    fi

    # Extract upload bytes (counter for src=ip → user_out)
    local upload_match
    upload_match=$(echo "$output" | grep "user_out_${safe_ip}" | grep -oP 'bytes \K[0-9]+' || true)
    if [ -n "$upload_match" ]; then
        upload_bytes="$upload_match"
    fi

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
  add <ip>           Add counter rules for a user IP
  remove <ip>        Remove counter rules for a user IP
  read <ip>          Read byte counts: ip download_bytes upload_bytes
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
