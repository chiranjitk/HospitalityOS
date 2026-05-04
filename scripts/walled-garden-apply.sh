#!/bin/bash
###########################################################################
#  StaySuite HospitalityOS — Walled Garden / Portal Whitelist Firewall Script
#
#  Purpose:   Manage nftables rules and dnsmasq config for captive portal
#             whitelist (walled garden) bypass. All nftables commands are
#             executed from this script — NEVER from application code.
#
#  Usage:
#    walled-garden-apply.sh apply          — Build & apply walled garden rules
#    walled-garden-apply.sh remove         — Remove all walled garden rules
#    walled-garden-apply.sh status         — Output JSON status
#    walled-garden-apply.sh help           — Show usage
#
#  Environment Variables:
#    DB_HOST       — PostgreSQL host       (default: 127.0.0.1)
#    DB_PORT       — PostgreSQL port       (default: 5432)
#    DB_USER       — PostgreSQL user       (default: staysuite)
#    DB_PASSWORD   — PostgreSQL password   (default: staysuite)
#    DB_NAME       — PostgreSQL database   (default: staysuite)
#    PORTAL_IP     — Captive portal IP     (default: auto-detect from eth0)
#    DNSMASQ_CONF  — dnsmasq config path   (default: /etc/dnsmasq.d/staysuite-walled-garden.conf)
#    NFT_TABLE     — nftables table name   (default: inet staysuite_firewall)
#    NFT_SET       — nftables set name     (default: staysuite_walled_garden)
#    NFT_CHAIN     — nftables chain name   (default: prerouting)
#    LOG_FILE      — Script log file       (default: /var/log/staysuite/walled-garden.log)
#
#  Idempotent: safe to run multiple times.
#  Exit codes: 0 = success, 1 = error
###########################################################################

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────────

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-staysuite}"
DB_PASSWORD="${DB_PASSWORD:-staysuite}"
DB_NAME="${DB_NAME:-staysuite}"

PORTAL_IP="${PORTAL_IP:-}"
DNSMASQ_CONF="${DNSMASQ_CONF:-/etc/dnsmasq.d/staysuite-walled-garden.conf}"
NFT_TABLE="${NFT_TABLE:-inet staysuite_firewall}"
NFT_SET="staysuite_walled_garden"
NFT_CHAIN="prerouting"
LOG_FILE="${LOG_FILE:-/var/log/staysuite/walled-garden.log}"

# ─── Logging ───────────────────────────────────────────────────────────────────

_ensure_log_dir() {
    mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true
}

log() {
    local level="${1:-INFO}"
    shift
    _ensure_log_dir
    local ts
    ts="$(date '+%Y-%m-%d %H:%M:%S')"
    printf "[%s] [WG-%-5s] %s\n" "${ts}" "${level}" "$*" >> "${LOG_FILE}" 2>/dev/null || true
}

# ─── JSON Output ───────────────────────────────────────────────────────────────

# Output structured JSON to stdout
# Usage: json_output <success:bool> <data_json> [error_string]
json_output() {
    local success="$1"
    local data="${2:-{}}"
    local error="${3:-}"
    local timestamp
    timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

    if [[ "${success}" == "true" ]]; then
        printf '{"success":true,"data":%s,"error":"","timestamp":"%s"}\n' \
            "${data}" "${timestamp}"
    else
        error="${error//\"/\\\"}"
        error="${error//$'\n'/\\n}"
        printf '{"success":false,"data":{},"error":"%s","timestamp":"%s"}\n' \
            "${error}" "${timestamp}"
    fi
}

# ─── Helpers ───────────────────────────────────────────────────────────────────

# Auto-detect portal IP from eth0 or fall back to 10.0.0.1
detect_portal_ip() {
    if [[ -n "${PORTAL_IP}" ]]; then
        echo "${PORTAL_IP}"
        return
    fi
    # Try to get the primary IP from eth0
    local ip
    ip="$(ip -4 addr show eth0 2>/dev/null | grep -oP 'inet \K[0-9.]+' | head -1)" || true
    if [[ -n "${ip}" ]]; then
        echo "${ip}"
        return
    fi
    # Fallback: try the default route interface
    local iface
    iface="$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')" || true
    if [[ -n "${iface}" ]]; then
        ip="$(ip -4 addr show "${iface}" 2>/dev/null | grep -oP 'inet \K[0-9.]+' | head -1)" || true
    fi
    if [[ -n "${ip}" ]]; then
        echo "${ip}"
        return
    fi
    echo "10.0.0.1"
}

# Validate IPv4 address
validate_ipv4() {
    local ip="$1"
    if [[ "${ip}" =~ ^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]]; then
        for i in 1 2 3 4; do
            local octet="${BASH_REMATCH[${i}]}"
            if (( octet > 255 )); then
                return 1
            fi
        done
        return 0
    fi
    return 1
}

# Resolve a domain to IP addresses using dig.
# Skips CNAME-only responses, returns only A records.
# Gracefully handles DNS failures.
resolve_domain() {
    local domain="$1"
    local ips
    ips="$(dig +short A "${domain}" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)"
    echo "${ips}"
}

# Query PostgreSQL for active whitelist entries
# Returns: tab-separated lines: domain<TAB>protocol<TAB>bypassAuth
query_whitelist_entries() {
    PGPASSWORD="${DB_PASSWORD}" psql \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -t -A -F $'\t' \
        -c "SELECT \"domain\", \"protocol\", \"bypassAuth\", \"status\"
            FROM \"PortalWhitelist\"
            WHERE \"status\" = 'active'
            ORDER BY priority DESC, \"domain\" ASC;" \
        2>/dev/null || true
}

# Reload dnsmasq if running
reload_dnsmasq() {
    if pgrep -x dnsmasq &>/dev/null; then
        log "INFO" "Reloading dnsmasq..."
        if dnsmasq --test &>/dev/null; then
            # Send SIGHUP to reload
            kill -HUP "$(pgrep -x dnsmasq)" 2>/dev/null || true
            log "INFO" "dnsmasq reloaded successfully"
        else
            log "WARN" "dnsmasq config test failed, skipping reload"
        fi
    else
        log "INFO" "dnsmasq is not running, skipping reload"
    fi
}

# Check if nftables set exists
nft_set_exists() {
    nft list sets 2>/dev/null | grep -q "${NFT_SET}" || false
}

# Count elements in nftables set
nft_set_count() {
    local count
    count="$(nft list set "${NFT_TABLE}" "${NFT_SET}" 2>/dev/null \
        | grep -oP 'elements = \{.*\}' \
        | grep -oP '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' \
        | wc -l)" || true
    echo "${count}"
}

# ─── Apply Command ─────────────────────────────────────────────────────────────

cmd_apply() {
    log "INFO" "=== Walled Garden APPLY started ==="

    local portal_ip
    portal_ip="$(detect_portal_ip)"
    log "INFO" "Portal IP: ${portal_ip}"

    # 1. Query active whitelist entries from database
    log "INFO" "Querying PortalWhitelist entries from database..."
    local entries
    entries="$(query_whitelist_entries)"

    if [[ -z "${entries}" ]]; then
        log "WARN" "No active whitelist entries found in database"
        json_output true '{"active":false,"entries":0,"domains":[],"ips":[],"configExists":false,"message":"No active entries found"}'
        return 0
    fi

    local entry_count
    entry_count="$(echo "${entries}" | wc -l)"
    log "INFO" "Found ${entry_count} active whitelist entries"

    # 2. Ensure nftables table exists
    if ! nft list tables 2>/dev/null | grep -q "staysuite_firewall"; then
        log "INFO" "Creating nftables table: ${NFT_TABLE}"
        nft add table inet staysuite_firewall 2>/dev/null || {
            log "ERROR" "Failed to create nftables table"
            json_output false "{}" "Failed to create nftables table ${NFT_TABLE}"
            return 1
        }
    fi

    # 3. Ensure prerouting chain exists (with nat hook for dstnat priority)
    if ! nft list chain inet staysuite_firewall prerouting &>/dev/null; then
        log "INFO" "Creating prerouting chain in ${NFT_TABLE}"
        nft add chain inet staysuite_firewall prerouting \
            '{ type nat hook prerouting priority dstnat; }' 2>/dev/null || {
            log "ERROR" "Failed to create prerouting chain"
            json_output false "{}" "Failed to create prerouting chain"
            return 1
        }
    fi

    # 4. Flush existing set or create new one
    if nft_set_exists; then
        log "INFO" "Flushing existing nftables set: ${NFT_SET}"
        nft flush set "${NFT_TABLE}" "${NFT_SET}" 2>/dev/null || true
    else
        log "INFO" "Creating nftables set: ${NFT_SET}"
        nft add set "${NFT_TABLE}" "${NFT_SET}" \
            '{ type ipv4_addr; flags interval; }' 2>/dev/null || {
            log "ERROR" "Failed to create nftables set"
            json_output false "{}" "Failed to create nftables set ${NFT_SET}"
            return 1
        }
    fi

    # 5. Remove old walled garden prerouting rule (if any) so we can re-add it
    #    Match by comment to identify our rule
    local existing_handles
    existing_handles="$(nft -a list chain "${NFT_TABLE}" "${NFT_CHAIN}" 2>/dev/null \
        | grep "staysuite-walled-garden" \
        | grep -oP 'handle \K[0-9]+' || true)"
    if [[ -n "${existing_handles}" ]]; then
        log "INFO" "Removing existing walled garden rules"
        for handle in $(echo "${existing_handles}" | sort -rn); do
            nft delete rule "${NFT_TABLE}" "${NFT_CHAIN}" handle "${handle}" 2>/dev/null || true
        done
    fi

    # 6. Resolve domains and collect IPs
    log "INFO" "Resolving whitelist domains to IP addresses..."
    local all_ips=()
    local resolved_domains=()
    local failed_domains=()
    local dnsmasq_entries=()

    while IFS=$'\t' read -r domain protocol bypass_auth status; do
        [[ -z "${domain}" ]] && continue

        # Handle wildcard domains: *.example.com → resolve example.com and common subdomains
        if [[ "${domain}" == \** ]]; then
            local base_domain="${domain#\*.}"  # Strip leading *.
            log "INFO" "Wildcard domain: ${domain} → base: ${base_domain}"

            # Resolve the base domain
            local base_ips
            base_ips="$(resolve_domain "${base_domain}")"
            if [[ -n "${base_ips}" ]]; then
                while IFS= read -r ip; do
                    [[ -z "${ip}" ]] && continue
                    if validate_ipv4 "${ip}"; then
                        all_ips+=("${ip}")
                        log "INFO" "  Resolved ${base_domain} → ${ip}"
                    fi
                done <<< "${base_ips}"
                resolved_domains+=("${base_domain}")
            else
                log "WARN" "  Failed to resolve ${base_domain}"
                failed_domains+=("${base_domain}")
            fi

            # Add dnsmasq address entry for wildcard (points entire domain to portal IP)
            dnsmasq_entries+=("address=/${base_domain}/${portal_ip}")
        else
            # Exact domain
            log "INFO" "Exact domain: ${domain}"
            local domain_ips
            domain_ips="$(resolve_domain "${domain}")"
            if [[ -n "${domain_ips}" ]]; then
                while IFS= read -r ip; do
                    [[ -z "${ip}" ]] && continue
                    if validate_ipv4 "${ip}"; then
                        all_ips+=("${ip}")
                        log "INFO" "  Resolved ${domain} → ${ip}"
                    fi
                done <<< "${domain_ips}"
                resolved_domains+=("${domain}")
            else
                log "WARN" "  Failed to resolve ${domain}"
                failed_domains+=("${domain}")
            fi

            # Add dnsmasq address entry
            dnsmasq_entries+=("address=/${domain}/${portal_ip}")
        fi
    done <<< "${entries}"

    # Deduplicate IPs
    local unique_ips
    unique_ips="$(printf '%s\n' "${all_ips[@]}" | sort -u)" || true

    local ip_count
    ip_count="$(echo "${unique_ips}" | grep -c '[0-9]' || true)"

    if [[ "${ip_count}" -eq 0 ]]; then
        log "WARN" "No IPs resolved from any whitelist domain"
        # Still write dnsmasq config even if DNS resolution failed
        write_dnsmasq_config "${dnsmasq_entries[@]}"
        json_output true "{\"active\":false,\"entries\":${entry_count},\"domains\":[],\"ips\":[],\"failedDomains\":$(printf '%s' "${failed_domains[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]'),\"configExists\":true,\"message\":\"No IPs resolved\"}"
        return 0
    fi

    # 7. Add IPs to nftables set
    log "INFO" "Adding ${ip_count} unique IPs to nftables set ${NFT_SET}..."

    # Build a comma-separated list for batch add
    local ip_list
    ip_list="$(printf '%s, ' "${unique_ips}" | sed 's/, $//')"

    nft add element "${NFT_TABLE}" "${NFT_SET}" "{ ${ip_list} }" 2>/dev/null || {
        # Fallback: add one by one if batch fails
        log "WARN" "Batch add failed, adding IPs individually..."
        while IFS= read -r ip; do
            [[ -z "${ip}" ]] && continue
            nft add element "${NFT_TABLE}" "${NFT_SET}" "{ ${ip} }" 2>/dev/null || {
                log "WARN" "  Failed to add IP: ${ip}"
            }
        done <<< "${unique_ips}"
    }

    log "INFO" "IPs added to nftables set successfully"

    # 8. Add prerouting rule to bypass captive portal for walled garden IPs
    #    This rule must run BEFORE the mark 10000 redirect rule.
    #    We use 'position 0' to insert at the very top of the chain,
    #    ensuring walled garden traffic is accepted before being redirected.
    log "INFO" "Adding walled garden bypass rule to prerouting chain..."

    # Accept traffic destined to walled garden IPs (bypass redirect)
    nft insert rule "${NFT_TABLE}" "${NFT_CHAIN}" position 0 \
        ip daddr "@${NFT_SET}" accept \
        comment "\"staysuite-walled-garden bypass\"" 2>/dev/null || {
        log "ERROR" "Failed to insert walled garden bypass rule"
        json_output false "{}" "Failed to insert walled garden bypass rule in prerouting chain"
        return 1
    }

    log "INFO" "Walled garden bypass rule added at position 0 in prerouting chain"

    # 9. Generate dnsmasq config
    write_dnsmasq_config "${dnsmasq_entries[@]}"

    # 10. Reload dnsmasq
    reload_dnsmasq

    # 11. Build JSON response
    local final_ip_count
    final_ip_count="$(nft_set_count)"

    local domains_json
    domains_json="$(printf '%s\n' "${resolved_domains[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')"

    local ips_json
    ips_json="$(echo "${unique_ips}" | jq -R . | jq -s . 2>/dev/null || echo '[]')"

    local failed_json
    failed_json="$(printf '%s\n' "${failed_domains[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')"

    log "INFO" "=== Walled Garden APPLY completed: ${final_ip_count} IPs from ${entry_count} entries ==="

    json_output true "{
        \"active\": true,
        \"entries\": ${entry_count},
        \"domains\": ${domains_json},
        \"ips\": ${ips_json},
        \"ipCount\": ${final_ip_count},
        \"failedDomains\": ${failed_json},
        \"configExists\": true,
        \"portalIp\": \"${portal_ip}\",
        \"table\": \"${NFT_TABLE}\",
        \"set\": \"${NFT_SET}\"
    }"
}

# ─── Write dnsmasq Config ──────────────────────────────────────────────────────

write_dnsmasq_config() {
    local entries=("$@")

    log "INFO" "Writing dnsmasq config: ${DNSMASQ_CONF}"

    local conf_dir
    conf_dir="$(dirname "${DNSMASQ_CONF}")"
    if [[ ! -d "${conf_dir}" ]]; then
        mkdir -p "${conf_dir}" 2>/dev/null || {
            log "WARN" "Cannot create dnsmasq config directory: ${conf_dir}"
            return 1
        }
    fi

    {
        echo "# StaySuite HospitalityOS — Walled Garden DNS Configuration"
        echo "# Auto-generated by walled-garden-apply.sh"
        echo "# Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
        echo "# WARNING: This file is managed automatically. Manual edits will be overwritten."
        echo "#"
        echo "# These entries redirect whitelisted domains to the captive portal IP"
        echo "# so that unauthenticated guests can resolve and access them."
        echo ""
        for entry in "${entries[@]}"; do
            echo "${entry}"
        done
        echo ""
    } > "${DNSMASQ_CONF}" 2>/dev/null || {
        log "WARN" "Cannot write dnsmasq config (permission denied?). Trying with sudo..."
        sudo tee "${DNSMASQ_CONF}" > /dev/null <<< "" 2>/dev/null || true
        {
            echo "# StaySuite HospitalityOS — Walled Garden DNS Configuration"
            echo "# Auto-generated by walled-garden-apply.sh"
            echo "# Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
            echo ""
            for entry in "${entries[@]}"; do
                echo "${entry}"
            done
            echo ""
        } | sudo tee "${DNSMASQ_CONF}" > /dev/null 2>/dev/null || {
            log "WARN" "Failed to write dnsmasq config even with sudo"
            return 1
        }
    }

    log "INFO" "dnsmasq config written with ${#entries[@]} entries"
}

# ─── Remove Command ────────────────────────────────────────────────────────────

cmd_remove() {
    log "INFO" "=== Walled Garden REMOVE started ==="

    local errors=0

    # 1. Remove walled garden prerouting rules (by comment)
    log "INFO" "Removing walled garden rules from prerouting chain..."
    local handles
    handles="$(nft -a list chain "${NFT_TABLE}" "${NFT_CHAIN}" 2>/dev/null \
        | grep "staysuite-walled-garden" \
        | grep -oP 'handle \K[0-9]+' || true)"
    if [[ -n "${handles}" ]]; then
        for handle in $(echo "${handles}" | sort -rn); do
            nft delete rule "${NFT_TABLE}" "${NFT_CHAIN}" handle "${handle}" 2>/dev/null || {
                log "WARN" "Failed to delete rule handle ${handle}"
                errors=$((errors + 1))
            }
        done
        log "INFO" "Walled garden rules removed from prerouting chain"
    else
        log "INFO" "No walled garden rules found in prerouting chain"
    fi

    # 2. Flush and destroy the nftables set
    if nft_set_exists; then
        log "INFO" "Flushing and destroying nftables set: ${NFT_SET}"
        nft flush set "${NFT_TABLE}" "${NFT_SET}" 2>/dev/null || {
            log "WARN" "Failed to flush set"
            errors=$((errors + 1))
        }
        nft delete set "${NFT_TABLE}" "${NFT_SET}" 2>/dev/null || {
            log "WARN" "Failed to delete set"
            errors=$((errors + 1))
        }
        log "INFO" "nftables set destroyed"
    else
        log "INFO" "nftables set does not exist, skipping"
    fi

    # 3. Remove dnsmasq config file
    if [[ -f "${DNSMASQ_CONF}" ]]; then
        log "INFO" "Removing dnsmasq config: ${DNSMASQ_CONF}"
        rm -f "${DNSMASQ_CONF}" 2>/dev/null || {
            sudo rm -f "${DNSMASQ_CONF}" 2>/dev/null || {
                log "WARN" "Failed to remove dnsmasq config"
                errors=$((errors + 1))
            }
        }
        log "INFO" "dnsmasq config removed"
    else
        log "INFO" "dnsmasq config does not exist, skipping"
    fi

    # 4. Reload dnsmasq
    reload_dnsmasq

    log "INFO" "=== Walled Garden REMOVE completed (errors: ${errors}) ==="

    json_output true "{
        \"active\": false,
        \"entries\": 0,
        \"configExists\": false,
        \"removed\": true
    }"
}

# ─── Status Command ────────────────────────────────────────────────────────────

cmd_status() {
    log "INFO" "Checking walled garden status..."

    local set_exists=false
    local ip_count=0
    local config_exists=false
    local table_exists=false
    local chain_exists=false

    # Check table
    if nft list tables 2>/dev/null | grep -q "staysuite_firewall"; then
        table_exists=true
    fi

    # Check chain
    if nft list chain inet staysuite_firewall prerouting &>/dev/null; then
        chain_exists=true
    fi

    # Check set
    if nft_set_exists; then
        set_exists=true
        ip_count="$(nft_set_count)"
    fi

    # Check dnsmasq config
    if [[ -f "${DNSMASQ_CONF}" ]]; then
        config_exists=true
    fi

    # Check if bypass rule exists in prerouting chain
    local rule_exists=false
    if nft -a list chain "${NFT_TABLE}" "${NFT_CHAIN}" 2>/dev/null | grep -q "staysuite-walled-garden"; then
        rule_exists=true
    fi

    local active=false
    if [[ "${set_exists}" == "true" ]] && [[ "${rule_exists}" == "true" ]] && [[ "${ip_count}" -gt 0 ]]; then
        active=true
    fi

    # Get entry count from database
    local db_entries
    db_entries="$(query_whitelist_entries)"
    local db_entry_count=0
    if [[ -n "${db_entries}" ]]; then
        db_entry_count="$(echo "${db_entries}" | wc -l)"
    fi

    local portal_ip
    portal_ip="$(detect_portal_ip)"

    log "INFO" "Status: active=${active}, set_exists=${set_exists}, ip_count=${ip_count}, config_exists=${config_exists}, db_entries=${db_entry_count}"

    json_output true "{
        \"active\": ${active},
        \"entries\": ${db_entry_count},
        \"ipCount\": ${ip_count},
        \"setExists\": ${set_exists},
        \"ruleExists\": ${rule_exists},
        \"tableExists\": ${table_exists},
        \"chainExists\": ${chain_exists},
        \"configExists\": ${config_exists},
        \"portalIp\": \"${portal_ip}\",
        \"table\": \"${NFT_TABLE}\",
        \"set\": \"${NFT_SET}\"
    }"
}

# ─── Usage ─────────────────────────────────────────────────────────────────────

usage() {
    cat << 'EOF'
StaySuite HospitalityOS — Walled Garden / Portal Whitelist Firewall Script

Manages nftables rules and dnsmasq configuration for captive portal whitelist
(walled garden) bypass. All nftables commands are executed from this script.

Usage: walled-garden-apply.sh <command>

Commands:
  apply    Build & apply walled garden rules from database entries
  remove   Remove all walled garden rules, set, and dnsmasq config
  status   Output current status as JSON
  help     Show this usage message

Environment Variables:
  DB_HOST       PostgreSQL host       (default: 127.0.0.1)
  DB_PORT       PostgreSQL port       (default: 5432)
  DB_USER       PostgreSQL user       (default: staysuite)
  DB_PASSWORD   PostgreSQL password   (default: staysuite)
  DB_NAME       PostgreSQL database   (default: staysuite)
  PORTAL_IP     Captive portal IP     (default: auto-detect from eth0)
  DNSMASQ_CONF  dnsmasq config path   (default: /etc/dnsmasq.d/staysuite-walled-garden.conf)

Examples:
  ./walled-garden-apply.sh apply
  ./walled-garden-apply.sh status
  ./walled-garden-apply.sh remove

  DB_PASSWORD=mypassword ./walled-garden-apply.sh apply

Output:
  All commands output JSON to stdout with structure:
  { "success": bool, "data": object, "error": string, "timestamp": string }
EOF
    exit 0
}

# ─── Main ──────────────────────────────────────────────────────────────────────

main() {
    _ensure_log_dir

    local cmd="${1:-}"

    case "${cmd}" in
        apply)
            cmd_apply
            ;;
        remove)
            cmd_remove
            ;;
        status)
            cmd_status
            ;;
        -h|--help|help)
            usage
            ;;
        *)
            log "ERROR" "Unknown command: ${cmd}"
            json_output false "{}" "Unknown command: ${cmd}. Use 'apply', 'remove', or 'status'."
            exit 1
            ;;
    esac
}

main "$@"
