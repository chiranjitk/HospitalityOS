#!/bin/bash
###########################################################################
#  StaySuite HospitalityOS — ZTNA nftables Rule Manager
#
#  Purpose:  Manage Zero Trust Network Access firewall rules via dedicated
#            nftables chains in the inet mangle table. Marks packets with
#            trust-level class IDs or jumps to quarantine drop chain.
#
#  Architecture:
#    - Table:   inet mangle (reuses existing mangle table for packet marking)
#    - Chains:  ztna_prerouting  (hook prerouting, priority -100, policy accept)
#               ztna_quarantine  (regular chain, counter + drop)
#    - Trust levels map to packet marks (class IDs):
#        trusted    → mark 10
#        standard   → mark 20
#        restricted → mark 30
#        quarantine → jump to ztna_quarantine (counter + drop)
#
#  Usage:
#    ztna-apply.sh apply     — Read JSON from stdin, apply rules
#    ztna-apply.sh flush     — Flush all ZTNA rules from chains
#    ztna-apply.sh status    — Output JSON status of ZTNA chains
#
#  Examples:
#    echo '{"assignments":[...]}' | ./ztna-apply.sh apply
#    ./ztna-apply.sh flush
#    ./ztna-apply.sh status
#
#  NOTE: All rules carry a "ztna:" comment prefix for identification
#        and cleanup. Handle-based operations use grep -oP.
#
###########################################################################

set -uo pipefail

LOG_TAG="ztna-apply"
LOG_FILE="${STAYSUITE_DIR:-/usr/local/staysuite}/logs/ztna.log"
TABLE="inet mangle"
CHAIN_PREROUTING="ztna_prerouting"
CHAIN_QUARANTINE="ztna_quarantine"

# Trust level → class ID mapping
CLASS_ID_TRUSTED=10
CLASS_ID_STANDARD=20
CLASS_ID_RESTRICTED=30

# ═══════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════

log() {
    local level="${1:-INFO}"
    shift
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [${LOG_TAG}] [${level}] $*"
    echo "$msg" | tee -a "$LOG_FILE" 2>/dev/null || echo "$msg"
}

validate_mac() {
    local mac="$1"
    if [[ "$mac" =~ ^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$ ]]; then
        return 0
    fi
    return 1
}

normalize_mac() {
    # Convert to uppercase and validate
    local mac="$1"
    if ! validate_mac "$mac"; then
        return 1
    fi
    echo "$mac" | tr '[:lower:]' '[:upper:]'
}

# ═══════════════════════════════════════════════════════════════════════════
#  Chain Management
# ═══════════════════════════════════════════════════════════════════════════

ensure_mangle_table() {
    # Ensure the inet mangle table exists (may already exist from other uses)
    if ! nft list tables 2>/dev/null | grep -q "^inet mangle$"; then
        log "INFO" "Creating inet mangle table"
        nft add table inet mangle 2>/dev/null || {
            log "ERROR" "Failed to create inet mangle table"
            return 1
        }
    fi
    return 0
}

ensure_prerouting_chain() {
    # Check if chain already exists in inet mangle
    if nft list chain inet mangle ztna_prerouting 2>/dev/null | grep -q "chain ztna_prerouting"; then
        log "INFO" "Chain ztna_prerouting already exists — skipping creation"
        return 0
    fi

    # Create as base chain: hook prerouting, priority -100
    log "INFO" "Creating ztna_prerouting base chain (hook prerouting, priority -100)"
    nft add chain inet mangle ztna_prerouting \
        '{ type filter hook prerouting priority -100; policy accept; }' 2>/dev/null || {
        log "ERROR" "Failed to create ztna_prerouting chain"
        return 1
    }
    return 0
}

ensure_quarantine_chain() {
    # Check if chain already exists in inet mangle
    if nft list chain inet mangle ztna_quarantine 2>/dev/null | grep -q "chain ztna_quarantine"; then
        log "INFO" "Chain ztna_quarantine already exists — skipping creation"
        return 0
    fi

    # Create as regular chain (no hook)
    log "INFO" "Creating ztna_quarantine regular chain"
    nft add chain inet mangle ztna_quarantine 2>/dev/null || {
        log "ERROR" "Failed to create ztna_quarantine chain"
        return 1
    }
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════
#  Commands
# ═══════════════════════════════════════════════════════════════════════════

cmd_apply() {
    # Read JSON from stdin
    local stdin_json
    stdin_json=$(cat)

    # Validate jq is available
    if ! command -v jq &>/dev/null; then
        log "ERROR" "jq is required but not found in PATH"
        echo '{"success":false,"rulesApplied":0,"errors":1,"chains":[]}'
        return 1
    fi

    # Parse assignments count
    local assignment_count
    assignment_count=$(echo "$stdin_json" | jq -r '.assignments | length' 2>/dev/null)
    if [[ "$assignment_count" == "null" || ! "$assignment_count" =~ ^[0-9]+$ ]]; then
        log "ERROR" "Invalid JSON input: missing or invalid 'assignments' array"
        echo '{"success":false,"rulesApplied":0,"errors":1,"chains":[]}'
        return 1
    fi

    log "INFO" "Apply: ${assignment_count} assignments in input"

    # Step 1: Ensure chains exist
    ensure_mangle_table || {
        echo '{"success":false,"rulesApplied":0,"errors":1,"chains":[]}'
        return 1
    }
    ensure_prerouting_chain || {
        echo '{"success":false,"rulesApplied":0,"errors":1,"chains":[]}'
        return 1
    }
    ensure_quarantine_chain || {
        echo '{"success":false,"rulesApplied":0,"errors":1,"chains":[]}'
        return 1
    }

    # Step 2: Flush both chains
    nft flush chain inet mangle ztna_prerouting 2>/dev/null || true
    nft flush chain inet mangle ztna_quarantine 2>/dev/null || true
    log "INFO" "Chains flushed"

    # Step 3: Add quarantine drop rule
    nft add rule inet mangle ztna_quarantine counter comment '"ztna:quarantine_drop"' 2>/dev/null || {
        log "ERROR" "Failed to add quarantine drop rule"
        echo '{"success":false,"rulesApplied":0,"errors":1,"chains":["ztna_prerouting","ztna_quarantine"]}'
        return 1
    }

    # Step 4: Process assignments
    local rules_applied=0
    local errors=0

    for (( i=0; i<assignment_count; i++ )); do
        local mac_raw trust_level class_id is_active

        mac_raw=$(echo "$stdin_json" | jq -r ".assignments[$i].macAddress" 2>/dev/null)
        trust_level=$(echo "$stdin_json" | jq -r ".assignments[$i].trustLevel" 2>/dev/null)
        class_id=$(echo "$stdin_json" | jq -r ".assignments[$i].classId" 2>/dev/null)
        is_active=$(echo "$stdin_json" | jq -r ".assignments[$i].isActive" 2>/dev/null)

        # Skip inactive assignments
        if [[ "$is_active" != "true" ]]; then
            continue
        fi

        # Validate and normalize MAC
        local mac_normalized
        mac_normalized=$(normalize_mac "$mac_raw" 2>/dev/null)
        if [[ $? -ne 0 || -z "$mac_normalized" ]]; then
            log "WARN" "Invalid MAC address: ${mac_raw} — skipping"
            errors=$((errors + 1))
            continue
        fi

        if [[ "$trust_level" == "quarantine" ]]; then
            # Quarantine: jump to quarantine chain
            if nft add rule inet mangle ztna_prerouting \
                ether saddr "$mac_normalized" jump ztna_quarantine \
                comment "\"ztna:quarantine:${mac_normalized}\"" 2>/dev/null; then
                rules_applied=$((rules_applied + 1))
                log "INFO" "Quarantine rule added for ${mac_normalized}"
            else
                log "ERROR" "Failed to add quarantine rule for ${mac_normalized}"
                errors=$((errors + 1))
            fi
        else
            # trusted/standard/restricted: set packet mark
            # Use classId from input if valid, otherwise map from trust level
            local mark_value
            if [[ "$class_id" =~ ^[0-9]+$ && "$class_id" -gt 0 ]]; then
                mark_value="$class_id"
            else
                case "$trust_level" in
                    trusted)    mark_value=$CLASS_ID_TRUSTED ;;
                    standard)   mark_value=$CLASS_ID_STANDARD ;;
                    restricted) mark_value=$CLASS_ID_RESTRICTED ;;
                    *)
                        log "WARN" "Unknown trust level '${trust_level}' for ${mac_normalized} — defaulting to standard"
                        mark_value=$CLASS_ID_STANDARD
                        ;;
                esac
            fi

            if nft add rule inet mangle ztna_prerouting \
                ether saddr "$mac_normalized" meta mark set "$mark_value" \
                comment "\"ztna:mark:${mac_normalized}:cls${mark_value}\"" 2>/dev/null; then
                rules_applied=$((rules_applied + 1))
                log "INFO" "Mark rule added for ${mac_normalized} → cls${mark_value}"
            else
                log "ERROR" "Failed to add mark rule for ${mac_normalized}"
                errors=$((errors + 1))
            fi
        fi
    done

    log "INFO" "Apply complete: ${rules_applied} rules applied, ${errors} errors"
    echo "{\"success\":true,\"rulesApplied\":${rules_applied},\"errors\":${errors},\"chains\":[\"ztna_prerouting\",\"ztna_quarantine\"]}"
    return 0
}

cmd_flush() {
    local flushed=true

    if nft flush chain inet mangle ztna_prerouting 2>/dev/null; then
        log "INFO" "Flushed ztna_prerouting chain"
    else
        log "WARN" "Could not flush ztna_prerouting (chain may not exist)"
    fi

    if nft flush chain inet mangle ztna_quarantine 2>/dev/null; then
        log "INFO" "Flushed ztna_quarantine chain"
    else
        log "WARN" "Could not flush ztna_quarantine (chain may not exist)"
    fi

    echo '{"success":true,"flushed":true}'
    return 0
}

cmd_status() {
    # Count rules in ztna_prerouting
    local prerouting_exists=false
    local prerouting_rules=0

    if nft list chain inet mangle ztna_prerouting -a 2>/dev/null | grep -q "chain ztna_prerouting"; then
        prerouting_exists=true
        prerouting_rules=$(nft -a list chain inet mangle ztna_prerouting 2>/dev/null | grep -c '^\s*ether\|^\s*meta\|^\s*jump\|^\s*counter\|^\s*drop\|^\s*accept\|^\s*reject\|^\s*return\|^\s*ct\|^\s*ip\s\|^\s*ip6\s\|^\s*tcp\s\|^\s*udp\s\|^\s*icmp' 2>/dev/null || echo 0)
    fi

    # Count rules in ztna_quarantine
    local quarantine_exists=false
    local quarantine_rules=0

    if nft list chain inet mangle ztna_quarantine -a 2>/dev/null | grep -q "chain ztna_quarantine"; then
        quarantine_exists=true
        quarantine_rules=$(nft -a list chain inet mangle ztna_quarantine 2>/dev/null | grep -c '^\s*ether\|^\s*meta\|^\s*jump\|^\s*counter\|^\s*drop\|^\s*accept\|^\s*reject\|^\s*return\|^\s*ct\|^\s*ip\s\|^\s*ip6\s\|^\s*tcp\s\|^\s*udp\s\|^\s*icmp' 2>/dev/null || echo 0)
    fi

    # Convert booleans to lowercase JSON
    local pr_exists_json="false"
    [[ "$prerouting_exists" == "true" ]] && pr_exists_json="true"
    local q_exists_json="false"
    [[ "$quarantine_exists" == "true" ]] && q_exists_json="true"

    echo "{\"success\":true,\"chains\":{\"ztna_prerouting\":{\"exists\":${pr_exists_json},\"rules\":${prerouting_rules}},\"ztna_quarantine\":{\"exists\":${q_exists_json},\"rules\":${quarantine_rules}}}}"
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════════

usage() {
    cat << 'EOF'
StaySuite ZTNA nftables Rule Manager

Usage: ztna-apply.sh <command>

Commands:
  apply        Read JSON assignments from stdin, apply nftables rules
  flush        Flush all ZTNA rules from both chains
  status       Output JSON status of ZTNA chains (rule counts)

Apply Input (JSON via stdin):
  {
    "assignments": [
      {
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "trustLevel": "standard",
        "classId": 20,
        "isActive": true
      }
    ]
  }

Trust Levels:
  trusted    → mark 10
  standard   → mark 20
  restricted → mark 30
  quarantine → jump to ztna_quarantine (counter + drop)

Examples:
  echo '{"assignments":[{"macAddress":"AA:BB:CC:DD:EE:FF","trustLevel":"standard","classId":20,"isActive":true}]}' | ./ztna-apply.sh apply
  ./ztna-apply.sh flush
  ./ztna-apply.sh status
EOF
    exit 1
}

main() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

    local cmd="${1:-}"
    case "$cmd" in
        apply)            cmd_apply ;;
        flush)            cmd_flush ;;
        status)           cmd_status ;;
        -h|--help|help)   usage ;;
        *)                log "ERROR" "Unknown command: $cmd"; usage ;;
    esac
}

main "$@"
