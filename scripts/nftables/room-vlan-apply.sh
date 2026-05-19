#!/bin/bash
###########################################################################
#  StaySuite HospitalityOS — Room VLAN nftables Rule Manager
#
#  Purpose:  Manage per-room VLAN isolation via dedicated nftables chains
#            and TC/HTB bandwidth shaping. Creates VLAN sub-interfaces,
#            assigns IP addresses, drops inter-VLAN traffic, and applies
#            per-VLAN bandwidth limits.
#
#  Architecture:
#    - Table:   inet room_vlan_isolation
#    - Chain:   room_vlan_isolation (type filter, hook forward, priority 0)
#    - Per-VLAN: sub-interface eth0.{vlanId}, IP assignment, TC HTB qdisc
#    - Inter-VLAN isolation: drop traffic between VLAN subnets
#    - Allowed: DHCP (67/68), DNS (53), HTTP (80), HTTPS (443), gateway
#    - Established/related connections always accepted
#
#  Usage:
#    room-vlan-apply.sh apply       — Read JSON rules from stdin, apply
#    room-vlan-apply.sh flush       — Flush all room-vlan chains and remove sub-interfaces
#    room-vlan-apply.sh status      — Output JSON status
#
#  Exit codes:
#    0 = success
#    1 = partial success (some rules failed)
#    2 = error (critical failure)
#
#  JSON Input (apply, via stdin):
#    {
#      "rules": [{
#        "vlanId": 100,
#        "subnet": "10.0.100.0/24",
#        "gateway": "10.0.100.1",
#        "roomType": "standard",
#        "action": "create" | "delete",
#        "bandwidthDown": 10485760,
#        "bandwidthUp": 5242880
#      }],
#      "flush": false
#    }
#
#  NOTE: Idempotent — safe to run multiple times.
#        All rules carry a "rvlan:" comment prefix for identification.
#
###########################################################################

set -uo pipefail

LOG_TAG="room-vlan-apply"
LOG_FILE="${STAYSUITE_DIR:-/usr/local/staysuite}/logs/room-vlan.log"
TABLE="inet room_vlan_isolation"
CHAIN="room_vlan_isolation"
PARENT_IFACE="${ROOM_VLAN_PARENT_IFACE:-eth0}"
TC_ROOT_HANDLE="1:"
TC_VLAN_BASE_HANDLE="10"

# ═══════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════

log() {
    local level="${1:-INFO}"
    shift
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [${LOG_TAG}] [${level}] $*"
    echo "$msg" | tee -a "$LOG_FILE" 2>/dev/null || echo "$msg"
}

validate_subnet() {
    local subnet="$1"
    if [[ "$subnet" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$ ]]; then
        return 0
    fi
    return 1
}

validate_vlan_id() {
    local vid="$1"
    if [[ "$vid" =~ ^[0-9]+$ ]] && [ "$vid" -ge 1 ] && [ "$vid" -le 4094 ]; then
        return 0
    fi
    return 1
}

# Extract prefix length from CIDR (e.g. "24" from "10.0.100.0/24")
cidr_prefix() {
    echo "${1#*/}"
}

# Extract network address without prefix (e.g. "10.0.100.0" from "10.0.100.0/24")
cidr_addr() {
    echo "${1%%/*}"
}

# ═══════════════════════════════════════════════════════════════════════════
#  Chain Management
# ═══════════════════════════════════════════════════════════════════════════

ensure_table() {
    if ! nft list tables 2>/dev/null | grep -q "^inet room_vlan_isolation$"; then
        log "INFO" "Creating inet room_vlan_isolation table"
        nft add table inet room_vlan_isolation 2>/dev/null || {
            log "ERROR" "Failed to create table"
            return 1
        }
    fi
    return 0
}

ensure_chain() {
    if nft list chain inet room_vlan_isolation room_vlan_isolation 2>/dev/null | grep -q "chain room_vlan_isolation"; then
        log "INFO" "Chain room_vlan_isolation already exists — skipping creation"
        return 0
    fi

    log "INFO" "Creating room_vlan_isolation base chain (hook forward, priority 0)"
    nft add chain inet room_vlan_isolation room_vlan_isolation \
        '{ type filter hook forward priority 0; policy accept; }' 2>/dev/null || {
        log "ERROR" "Failed to create room_vlan_isolation chain"
        return 1
    }
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════
#  VLAN Sub-Interface Management
# ═══════════════════════════════════════════════════════════════════════════

create_vlan_interface() {
    local vlan_id="$1"
    local gateway="$2"
    local prefix="$3"
    local iface="${PARENT_IFACE}.${vlan_id}"

    # Check if sub-interface already exists
    if ip link show "$iface" 2>/dev/null | grep -q "$iface"; then
        log "INFO" "VLAN sub-interface $iface already exists — skipping creation"
    else
        log "INFO" "Creating VLAN sub-interface $iface (VLAN $vlan_id)"
        ip link add link "$PARENT_IFACE" name "$iface" type vlan id "$vlan_id" 2>/dev/null || {
            log "ERROR" "Failed to create VLAN sub-interface $iface"
            return 1
        }
    fi

    # Bring interface up
    ip link set "$iface" up 2>/dev/null || {
        log "WARN" "Failed to bring up $iface"
    }

    # Assign gateway IP (idempotent — won't fail if already assigned)
    local full_addr="${gateway}/${prefix}"
    if ip addr show "$iface" 2>/dev/null | grep -q "$full_addr"; then
        log "INFO" "Address $full_addr already assigned on $iface — skipping"
    else
        log "INFO" "Assigning $full_addr to $iface"
        ip addr add "$full_addr" dev "$iface" 2>/dev/null || {
            log "WARN" "Failed to assign address $full_addr to $iface (may already exist)"
        }
    fi

    return 0
}

delete_vlan_interface() {
    local vlan_id="$1"
    local iface="${PARENT_IFACE}.${vlan_id}"

    # Remove TC qdisc first
    tc qdisc del dev "$iface" root 2>/dev/null || true
    tc qdisc del dev "$iface" ingress 2>/dev/null || true

    if ip link show "$iface" 2>/dev/null | grep -q "$iface"; then
        log "INFO" "Removing VLAN sub-interface $iface"
        ip link del "$iface" 2>/dev/null || {
            log "WARN" "Failed to remove VLAN sub-interface $iface"
        }
    else
        log "INFO" "VLAN sub-interface $iface does not exist — skipping"
    fi
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════
#  TC/HTB Bandwidth Shaping
# ═══════════════════════════════════════════════════════════════════════════

setup_bandwidth() {
    local vlan_id="$1"
    local iface="${PARENT_IFACE}.${vlan_id}"
    local bw_down="${2:-0}"
    local bw_up="${3:-0}"

    # Convert bytes/s to kbit/s for tc (1 byte = 8 bits, then /1000 for kbit)
    local bw_down_kbit=$((bw_down * 8 / 1000))
    local bw_up_kbit=$((bw_up * 8 / 1000))

    # Ensure minimum bandwidth
    bw_down_kbit=$((bw_down_kbit < 64 ? 64 : bw_down_kbit))
    bw_up_kbit=$((bw_up_kbit < 64 ? 64 : bw_up_kbit))

    # Egress (download from guest perspective → tc root on the VLAN interface)
    # Remove existing qdisc first
    tc qdisc del dev "$iface" root 2>/dev/null || true

    log "INFO" "Setting egress HTB on $iface: ${bw_down_kbit}kbit"
    tc qdisc add dev "$iface" root handle "${TC_ROOT_HANDLE}" htb default 10 2>/dev/null || {
        log "WARN" "Failed to add HTB root qdisc on $iface"
        return 1
    }
    tc class add dev "$iface" parent "${TC_ROOT_HANDLE}" classid 1:1 htb rate "${bw_down_kbit}kbit" ceil "$((bw_down_kbit * 2))kbit" burst 15k 2>/dev/null || {
        log "WARN" "Failed to add HTB class on $iface"
        return 1
    }

    # Ingress (upload from guest perspective → tc ingress on the VLAN interface)
    tc qdisc del dev "$iface" ingress 2>/dev/null || true

    log "INFO" "Setting ingress HTB on $iface: ${bw_up_kbit}kbit"
    tc qdisc add dev "$iface" handle ffff: ingress 2>/dev/null || {
        log "WARN" "Failed to add ingress qdisc on $iface"
        return 1
    }

    # Use u32 to match and police ingress traffic
    tc filter add dev "$iface" parent ffff: protocol ip u32 match u32 0 0 \
        police rate "${bw_up_kbit}kbit" burst 15k drop flowid :1 2>/dev/null || {
        log "WARN" "Failed to add ingress filter on $iface"
        return 1
    }

    log "INFO" "Bandwidth shaping applied on $iface (down: ${bw_down_kbit}kbit, up: ${bw_up_kbit}kbit)"
    return 0
}

remove_bandwidth() {
    local vlan_id="$1"
    local iface="${PARENT_IFACE}.${vlan_id}"

    tc qdisc del dev "$iface" root 2>/dev/null || true
    tc qdisc del dev "$iface" ingress 2>/dev/null || true
    log "INFO" "Bandwidth shaping removed from $iface"
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════
#  nftables Rule Management
# ═══════════════════════════════════════════════════════════════════════════

# Remove all rules for a specific VLAN from the chain
flush_vlan_rules() {
    local vlan_id="$1"
    local iface="${PARENT_IFACE}.${vlan_id}"

    # Delete rules with our comment prefix that mention this VLAN
    nft list chain inet room_vlan_isolation room_vlan_isolation -a 2>/dev/null | \
        grep -n "rvlan:vlan${vlan_id}" | \
        awk -F: '{print $1}' | \
        sort -rn | \
        while read -r _line_num; do
            # We can't easily delete by line number with nft; instead we'll
            # use handle numbers from -a output
            :
        done

    # Alternative: flush entire chain and re-add rules for remaining VLANs
    # This is simpler and more reliable
    :
}

# Add isolation rules for a single VLAN
add_vlan_rules() {
    local vlan_id="$1"
    local subnet="$2"
    local gateway="$3"
    local iface="${PARENT_IFACE}.${vlan_id}"
    local network_addr
    network_addr=$(cidr_addr "$subnet")

    # Allow established/related connections (always first)
    nft add rule inet room_vlan_isolation room_vlan_isolation \
        iifname "$iface" ct state established,related accept \
        comment "\"rvlan:vlan${vlan_id}:established\"" 2>/dev/null || {
        log "WARN" "Failed to add established rule for VLAN $vlan_id"
        return 1
    }

    # Allow DHCP
    nft add rule inet room_vlan_isolation room_vlan_isolation \
        iifname "$iface" udp dport { 67, 68 } accept \
        comment "\"rvlan:vlan${vlan_id}:dhcp\"" 2>/dev/null || true

    nft add rule inet room_vlan_isolation room_vlan_isolation \
        oifname "$iface" udp sport { 67, 68 } accept \
        comment "\"rvlan:vlan${vlan_id}:dhcp\"" 2>/dev/null || true

    # Allow DNS
    nft add rule inet room_vlan_isolation room_vlan_isolation \
        iifname "$iface" udp dport 53 accept \
        comment "\"rvlan:vlan${vlan_id}:dns\"" 2>/dev/null || true

    nft add rule inet room_vlan_isolation room_vlan_isolation \
        iifname "$iface" tcp dport 53 accept \
        comment "\"rvlan:vlan${vlan_id}:dns\"" 2>/dev/null || true

    # Allow HTTP/HTTPS
    nft add rule inet room_vlan_isolation room_vlan_isolation \
        iifname "$iface" tcp dport { 80, 443 } accept \
        comment "\"rvlan:vlan${vlan_id}:http\"" 2>/dev/null || true

    # Drop inter-VLAN traffic (traffic from this VLAN to any other VLAN subnet)
    # This is handled by the blanket inter-VLAN drop rule added after all VLANs

    # Allow traffic to/from gateway (for management)
    nft add rule inet room_vlan_isolation room_vlan_isolation \
        iifname "$iface" ip daddr "$gateway" accept \
        comment "\"rvlan:vlan${vlan_id}:gateway\"" 2>/dev/null || true

    # Allow forwarded traffic to the internet (non-VLAN destinations)
    # Traffic from VLAN interface that is NOT going to another VLAN subnet → accept
    # This rule is implicitly handled by the accept at the end

    log "INFO" "nftables rules added for VLAN $vlan_id ($iface)"
    return 0
}

# Add the blanket inter-VLAN isolation rule (blocks traffic between VLANs)
add_inter_vlan_drop() {
    local vlan_subnets=("$@")

    for subnet in "${vlan_subnets[@]}"; do
        nft add rule inet room_vlan_isolation room_vlan_isolation \
            ip daddr "$subnet" iifname "$PARENT_IFACE.*" drop \
            comment "\"rvlan:intervlan_drop:${subnet}\"" 2>/dev/null || true
    done
}

# ═══════════════════════════════════════════════════════════════════════════
#  Commands
# ═══════════════════════════════════════════════════════════════════════════

cmd_apply() {
    local stdin_json
    stdin_json=$(cat)

    if ! command -v jq &>/dev/null; then
        log "ERROR" "jq is required but not found in PATH"
        echo '{"success":false,"appliedCount":0,"errors":1,"output":"jq not found"}'
        return 2
    fi

    local rule_count flush_flag
    rule_count=$(echo "$stdin_json" | jq -r '.rules | length' 2>/dev/null)
    flush_flag=$(echo "$stdin_json" | jq -r '.flush' 2>/dev/null)

    if [[ "$rule_count" == "null" || ! "$rule_count" =~ ^[0-9]+$ ]]; then
        log "ERROR" "Invalid JSON input: missing or invalid 'rules' array"
        echo '{"success":false,"appliedCount":0,"errors":1,"output":"Invalid JSON"}'
        return 2
    fi

    log "INFO" "Apply: ${rule_count} rules, flush=${flush_flag}"

    # Step 1: Ensure table and chain exist
    ensure_table || {
        echo '{"success":false,"appliedCount":0,"errors":1,"output":"Failed to create table"}'
        return 2
    }
    ensure_chain || {
        echo '{"success":false,"appliedCount":0,"errors":1,"output":"Failed to create chain"}'
        return 2
    }

    # Step 2: Flush if requested
    if [[ "$flush_flag" == "true" ]]; then
        log "INFO" "Flush requested — removing all room-vlan chains and sub-interfaces"
        nft flush chain inet room_vlan_isolation room_vlan_isolation 2>/dev/null || true

        # Remove all room-vlan sub-interfaces and bandwidth
        local all_vlan_ids
        all_vlan_ids=$(ip link show 2>/dev/null | grep -oP "${PARENT_IFACE}\.\K[0-9]+" | sort -un || true)
        for vid in $all_vlan_ids; do
            remove_bandwidth "$vid"
            delete_vlan_interface "$vid"
        done
        log "INFO" "Flush complete"
    fi

    # Step 3: Process rules
    local applied=0
    local errors=0
    local deleted=0
    local vlan_subnets=()

    for (( i=0; i<rule_count; i++ )); do
        local vlan_id subnet gateway room_type action bw_down bw_up

        vlan_id=$(echo "$stdin_json" | jq -r ".rules[$i].vlanId" 2>/dev/null)
        subnet=$(echo "$stdin_json" | jq -r ".rules[$i].subnet" 2>/dev/null)
        gateway=$(echo "$stdin_json" | jq -r ".rules[$i].gateway" 2>/dev/null)
        room_type=$(echo "$stdin_json" | jq -r ".rules[$i].roomType" 2>/dev/null)
        action=$(echo "$stdin_json" | jq -r ".rules[$i].action" 2>/dev/null)
        bw_down=$(echo "$stdin_json" | jq -r ".rules[$i].bandwidthDown" 2>/dev/null)
        bw_up=$(echo "$stdin_json" | jq -r ".rules[$i].bandwidthUp" 2>/dev/null)

        # Default bandwidth if not specified (10 Mbps down, 5 Mbps up for standard)
        bw_down="${bw_down:-10485760}"
        bw_up="${bw_up:-5242880}"

        # Adjust bandwidth based on room type if not explicitly set
        if [[ "$bw_down" == "null" || -z "$bw_down" ]]; then bw_down=10485760; fi
        if [[ "$bw_up" == "null" || -z "$bw_up" ]]; then bw_up=5242880; fi

        case "$room_type" in
            suite)
                bw_down="${bw_down:-20971520}"
                bw_up="${bw_up:-10485760}"
                ;;
            vip)
                bw_down="${bw_down:-52428800}"
                bw_up="${bw_up:-26214400}"
                ;;
            conference)
                bw_down="${bw_down:-20971520}"
                bw_up="${bw_up}-10485760"
                ;;
        esac

        # Validate
        if ! validate_vlan_id "$vlan_id"; then
            log "WARN" "Invalid VLAN ID: ${vlan_id} — skipping"
            errors=$((errors + 1))
            continue
        fi

        if ! validate_subnet "$subnet"; then
            log "WARN" "Invalid subnet for VLAN ${vlan_id}: ${subnet} — skipping"
            errors=$((errors + 1))
            continue
        fi

        local prefix
        prefix=$(cidr_prefix "$subnet")

        if [[ "$action" == "delete" ]]; then
            # Delete VLAN interface and bandwidth
            remove_bandwidth "$vlan_id"
            delete_vlan_interface "$vlan_id"
            deleted=$((deleted + 1))
            log "INFO" "VLAN $vlan_id deleted"
            continue
        fi

        # Create action (default)
        # Create VLAN sub-interface and assign IP
        if ! create_vlan_interface "$vlan_id" "$gateway" "$prefix"; then
            log "ERROR" "Failed to create VLAN interface for VLAN $vlan_id"
            errors=$((errors + 1))
            continue
        fi

        # Setup bandwidth shaping
        setup_bandwidth "$vlan_id" "$bw_down" "$bw_up" || {
            log "WARN" "Bandwidth setup failed for VLAN $vlan_id (non-fatal)"
        }

        # Track subnets for inter-VLAN drop rules
        vlan_subnets+=("$subnet")

        applied=$((applied + 1))
        log "INFO" "VLAN $vlan_id applied (subnet: $subnet, room: $room_type, bw: ${bw_down}/${bw_up})"
    done

    # Step 4: Rebuild nftables rules from scratch for all active VLAN sub-interfaces
    # This ensures clean state and proper inter-VLAN isolation
    if [[ "$flush_flag" == "true" || "$applied" -gt 0 ]]; then
        log "INFO" "Rebuilding nftables chain with all active VLAN rules"

        # Flush chain to rebuild cleanly
        nft flush chain inet room_vlan_isolation room_vlan_isolation 2>/dev/null || true

        # Add established/related first (applies to all VLANs)
        nft add rule inet room_vlan_isolation room_vlan_isolation \
            ct state established,related accept \
            comment '"rvlan:global:established"' 2>/dev/null || true

        # Collect all current VLAN sub-interfaces
        local current_vlans
        current_vlans=$(ip link show 2>/dev/null | grep -oP "${PARENT_IFACE}\.\K[0-9]+" | sort -un || true)
        local all_subnets=()

        for vid in $current_vlans; do
            local iface="${PARENT_IFACE}.${vid}"
            # Get the subnet for this VLAN from the rules input if available,
            # otherwise derive from the interface IP
            local v_subnet=""
            for (( j=0; j<rule_count; j++ )); do
                local r_vlan_id
                r_vlan_id=$(echo "$stdin_json" | jq -r ".rules[$j].vlanId" 2>/dev/null)
                if [[ "$r_vlan_id" == "$vid" ]]; then
                    v_subnet=$(echo "$stdin_json" | jq -r ".rules[$j].subnet" 2>/dev/null)
                    break
                fi
            done

            # If no subnet from input, try to get from interface IP
            if [[ -z "$v_subnet" || "$v_subnet" == "null" ]]; then
                local iface_ip
                iface_ip=$(ip -4 addr show "$iface" 2>/dev/null | grep -oP 'inet \K[0-9.]+' | head -1 || true)
                if [[ -n "$iface_ip" ]]; then
                    v_subnet="${iface_ip}/24"
                fi
            fi

            if [[ -n "$v_subnet" && "$v_subnet" != "null" ]]; then
                all_subnets+=("$v_subnet")
                add_vlan_rules "$vid" "$v_subnet" "" "$iface"
            fi
        done

        # Add inter-VLAN isolation: drop traffic from any VLAN interface to other VLAN subnets
        for snet in "${all_subnets[@]}"; do
            nft add rule inet room_vlan_isolation room_vlan_isolation \
                iifname "${PARENT_IFACE}.*" ip daddr "$snet" drop \
                comment "\"rvlan:intervlan_drop\"" 2>/dev/null || true
        done

        # Final accept rule for all other forwarded traffic
        nft add rule inet room_vlan_isolation room_vlan_isolation \
            counter accept \
            comment '"rvlan:global:default_accept"' 2>/dev/null || true
    fi

    local exit_code=0
    if [[ "$errors" -gt 0 && "$applied" -eq 0 ]]; then
        exit_code=2  # All failed
    elif [[ "$errors" -gt 0 ]]; then
        exit_code=1  # Partial success
    fi

    log "INFO" "Apply complete: ${applied} applied, ${deleted} deleted, ${errors} errors (exit=${exit_code})"
    echo "{\"success\":true,\"appliedCount\":${applied},\"deletedCount\":${deleted},\"errors\":${errors},\"output\":\"${applied} VLAN rules applied, ${deleted} deleted, ${errors} errors\"}"
    return $exit_code
}

cmd_flush() {
    log "INFO" "Flushing all room VLAN configuration"

    # Remove nftables rules
    nft flush chain inet room_vlan_isolation room_vlan_isolation 2>/dev/null || {
        log "WARN" "Could not flush chain (may not exist)"
    }

    # Remove all room-vlan sub-interfaces
    local all_vlan_ids
    all_vlan_ids=$(ip link show 2>/dev/null | grep -oP "${PARENT_IFACE}\.\K[0-9]+" | sort -un || true)
    local removed=0
    for vid in $all_vlan_ids; do
        remove_bandwidth "$vid"
        delete_vlan_interface "$vid"
        removed=$((removed + 1))
    done

    log "INFO" "Flush complete: ${removed} VLAN interfaces removed"
    echo "{\"success\":true,\"flushed\":true,\"interfacesRemoved\":${removed}}"
    return 0
}

cmd_status() {
    local chain_exists=false
    local rule_count=0
    local vlan_count=0
    local vlan_details="[]"

    if nft list chain inet room_vlan_isolation room_vlan_isolation 2>/dev/null | grep -q "chain room_vlan_isolation"; then
        chain_exists=true
        rule_count=$(nft list chain inet room_vlan_isolation room_vlan_isolation 2>/dev/null \
            | grep -c '^\s*iifname\|^\s*oifname\|^\s*ct\s\|^\s*ip\s\|^\s*udp\s\|^\s*tcp\s\|^\s*counter\|^\s*drop\|^\s*accept' \
            2>/dev/null || echo 0)
    fi

    # Count VLAN sub-interfaces
    local all_vlan_ids
    all_vlan_ids=$(ip link show 2>/dev/null | grep -oP "${PARENT_IFACE}\.\K[0-9]+" | sort -un || true)
    if [[ -n "$all_vlan_ids" ]]; then
        vlan_count=$(echo "$all_vlan_ids" | wc -w)
        # Build VLAN details JSON
        vlan_details="["
        local first=true
        for vid in $all_vlan_ids; do
            local iface="${PARENT_IFACE}.${vid}"
            local iface_ip
            iface_ip=$(ip -4 addr show "$iface" 2>/dev/null | grep -oP 'inet \K[0-9./]+' | head -1 || echo "unknown")
            local iface_state
            iface_state=$(ip link show "$iface" 2>/dev/null | grep -oP 'state \K\w+' || echo "unknown")

            if [[ "$first" == "true" ]]; then
                first=false
            else
                vlan_details+=","
            fi
            vlan_details+="{\"vlanId\":${vid},\"interface\":\"${iface}\",\"ip\":\"${iface_ip}\",\"state\":\"${iface_state}\"}"
        done
        vlan_details+="]"
    fi

    local chain_exists_json="false"
    [[ "$chain_exists" == "true" ]] && chain_exists_json="true"

    echo "{\"success\":true,\"chain\":{\"exists\":${chain_exists_json},\"rules\":${rule_count}},\"vlans\":{\"count\":${vlan_count},\"interfaces\":${vlan_details}}}"
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════════

usage() {
    cat << 'EOF'
StaySuite Room VLAN nftables Rule Manager

Usage: room-vlan-apply.sh <command>

Commands:
  apply        Read JSON rules from stdin, apply nftables + VLAN interfaces + TC
  flush        Flush all room-VLAN chains and remove sub-interfaces
  status       Output JSON status of room-VLAN chains and interfaces

Apply Input (JSON via stdin):
  {
    "rules": [
      {
        "vlanId": 100,
        "subnet": "10.0.100.0/24",
        "gateway": "10.0.100.1",
        "roomType": "standard",
        "action": "create",
        "bandwidthDown": 10485760,
        "bandwidthUp": 5242880
      }
    ],
    "flush": false
  }

Exit Codes:
  0 = success
  1 = partial (some rules failed)
  2 = error (critical failure)

Examples:
  echo '{"rules":[{"vlanId":100,"subnet":"10.0.100.0/24","gateway":"10.0.100.1","roomType":"standard","action":"create"}],"flush":false}' | ./room-vlan-apply.sh apply
  ./room-vlan-apply.sh flush
  ./room-vlan-apply.sh status
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
