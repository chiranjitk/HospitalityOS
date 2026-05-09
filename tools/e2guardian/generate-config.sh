#!/bin/bash
# ============================================================================
# StaySuite → e2guardian Config Generator
# ============================================================================
# Reads ContentFilter table from PostgreSQL, generates e2guardian banned site
# lists organized by category. Also generates IP group mappings based on
# WiFi plans to assign per-plan filter groups.
#
# Usage:
#   ./generate-config.sh [output_dir]
#   ./generate-config.sh /etc/e2guardian/lists/banned
#
# Environment Variables:
#   DATABASE_URL  - PostgreSQL connection string (default: postgresql://staysuite:staysuite@localhost:5432/staysuite)
#   E2G_CONF_DIR  - e2guardian config directory (default: /etc/e2guardian)
#   DRY_RUN       - If set, prints what would be generated without writing files
#
# Category Mapping (StaySuite → e2guardian file):
#   adult         → staysuite_adult
#   malware       → staysuite_malware
#   phishing      → staysuite_phishing
#   social_media  → staysuite_social_media
#   streaming     → staysuite_streaming
#   gambling      → staysuite_gambling
#   drugs         → staysuite_drugs
#   violence      → staysuite_violence
#   proxy         → staysuite_proxy
#   vpn           → staysuite_vpn
#   ads           → staysuite_ads
#   custom        → staysuite_custom
# ============================================================================

set -euo pipefail

# --- Configuration ---
OUTPUT_DIR="${1:-/etc/e2guardian/lists/banned}"
DB_URL="${DATABASE_URL:-postgresql://staysuite:staysuite@localhost:5432/staysuite}"
E2G_CONF_DIR="${E2G_CONF_DIR:-/etc/e2guardian}"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

# --- Category mapping ---
declare -A CATEGORY_MAP=(
    [adult]="staysuite_adult"
    [malware]="staysuite_malware"
    [phishing]="staysuite_phishing"
    [social_media]="staysuite_social_media"
    [streaming]="staysuite_streaming"
    [gambling]="staysuite_gambling"
    [drugs]="staysuite_drugs"
    [violence]="staysuite_violence"
    [proxy]="staysuite_proxy"
    [vpn]="staysuite_vpn"
    [ads]="staysuite_ads"
    [custom]="staysuite_custom"
)

# --- Colors for output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${CYAN}[STEP]${NC}  $*"; }

# --- Pre-flight checks ---
check_dependencies() {
    local missing=()

    if ! command -v psql &>/dev/null; then
        missing+=("psql")
    fi

    # Check for JSON parser (prefer jq, fallback to python3)
    if command -v jq &>/dev/null; then
        JSON_PARSER="jq"
    elif command -v python3 &>/dev/null; then
        JSON_PARSER="python3"
    else
        missing+=("jq or python3")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing[*]}"
        log_error "Install with: dnf install postgresql jq   (Rocky/RHEL)"
        exit 1
    fi

    # Check database connectivity
    log_step "Checking database connectivity..."
    if ! psql "$DB_URL" -t -A -c "SELECT 1" &>/dev/null; then
        log_error "Cannot connect to PostgreSQL at $DB_URL"
        log_error "Ensure PostgreSQL is running and credentials are correct"
        exit 1
    fi
    log_info "Database connection OK"
}

# --- Parse JSON array to domain list ---
# Uses jq if available, otherwise falls back to python3
parse_domains() {
    local json_str="$1"

    if [[ "$JSON_PARSER" == "jq" ]]; then
        echo "$json_str" | jq -r '.[]' 2>/dev/null
    else
        echo "$json_str" | python3 -c "
import sys, json
try:
    domains = json.load(sys.stdin)
    for d in domains:
        if isinstance(d, str) and d.strip():
            print(d.strip())
except: pass
" 2>/dev/null
    fi
}

# --- Main generation logic ---
generate_lists() {
    log_step "Creating output directory: $OUTPUT_DIR"
    if [[ -z "${DRY_RUN:-}" ]]; then
        mkdir -p "$OUTPUT_DIR"
    fi

    # Clear previous staysuite files
    if [[ -z "${DRY_RUN:-}" ]]; then
        log_step "Clearing previous staysuite list files..."
        find "$OUTPUT_DIR" -name "staysuite_*" -type f -delete 2>/dev/null || true
    fi

    # Query ContentFilter table for all enabled filters
    log_step "Querying ContentFilter table for enabled filters..."

    local total_domains=0
    local total_categories=0

    psql "$DB_URL" -t -A -c "
        SELECT category, domains, name
        FROM \"ContentFilter\"
        WHERE enabled = true
        ORDER BY category
    " | while IFS='|' read -r category domains_json filter_name; do
        # Skip empty rows
        if [[ -z "$category" || -z "$domains_json" ]]; then
            continue
        fi

        # Determine output filename
        local file_name="${CATEGORY_MAP[$category]:-${CATEGORY_MAP[custom]}}"
        local category_file="$OUTPUT_DIR/$file_name"

        # Parse and write domains
        local domain_count=0
        while IFS= read -r domain; do
            # Skip empty lines
            [[ -z "$domain" ]] && continue

            # Strip whitespace
            domain="$(echo "$domain" | xargs)"
            [[ -z "$domain" ]] && continue

            if [[ -z "${DRY_RUN:-}" ]]; then
                # Check if domain already exists in file (avoid duplicates)
                if ! grep -qxF "$domain" "$category_file" 2>/dev/null; then
                    echo "$domain" >> "$category_file"
                fi
            fi
            ((domain_count++)) || true
        done < <(parse_domains "$domains_json")

        if [[ $domain_count -gt 0 ]]; then
            log_info "Category '$category' ($filter_name) → $file_name ($domain_count domains)"
        else
            log_warn "Category '$category' ($filter_name) → $file_name (0 domains, skipping)"
            [[ -z "${DRY_RUN:-}" ]] && rm -f "$category_file" 2>/dev/null
        fi
    done

    # Also generate a master include file that pulls in all category files
    generate_master_file

    # Remove empty files
    if [[ -z "${DRY_RUN:-}" ]]; then
        find "$OUTPUT_DIR" -name "staysuite_*" -empty -delete 2>/dev/null || true
    fi

    # Summary
    local file_count
    file_count=$(find "$OUTPUT_DIR" -name "staysuite_*" -type f 2>/dev/null | wc -l)
    local domain_total
    domain_total=$(find "$OUTPUT_DIR" -name "staysuite_*" -type f -exec cat {} + 2>/dev/null | wc -l)

    echo ""
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "  Generation Summary"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "  Category files:   $file_count"
    log_info "  Total domains:    $domain_total"
    log_info "  Output directory: $OUTPUT_DIR"
    log_info "  Timestamp:        $TIMESTAMP"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# --- Generate master include file ---
generate_master_file() {
    local master_file="$OUTPUT_DIR/staysuite_master"

    if [[ -z "${DRY_RUN:-}" ]]; then
        : > "$master_file"
        # Add header
        cat > "$master_file" << MASTER_HEADER
# StaySuite e2guardian Master Include File
# Auto-generated on: $TIMESTAMP
# Source: ContentFilter table in PostgreSQL
# Usage: Reference this file from e2guardianfN.conf:
#   sitelist = 'name=banned,path=__LISTDIR__/../banned/staysuite_master'
#
# This file includes all category-specific blocklists.
MASTER_HEADER

        for f in "$OUTPUT_DIR"/staysuite_*; do
            [[ -f "$f" && "$(basename "$f")" != "staysuite_master" ]] || continue
            echo ".Include<${f}>" >> "$master_file"
        done

        log_info "Master file: $master_file"
    fi
}

# --- Generate IP group mapping based on WiFi plans ---
generate_ip_groups() {
    local ipgroups_file="$E2G_CONF_DIR/lists/authplugins/ipgroups"
    local ipgroups_bak="$E2G_CONF_DIR/lists/authplugins/ipgroups.bak"

    log_step "Generating IP group mappings from WiFi plans..."

    # Query WiFiPlan + NetworkConfig for filter group assignments
    # StaySuite plan → e2guardian filter group mapping:
    #   free/basic    → filter 1 (kids - most restrictive)
    #   standard     → filter 2 (basic - moderate filtering)
    #   premium/vip  → filter 3 (premium - minimal filtering)

    local query="
        SELECT
            n.\"guestNetworkCidr\",
            p.name AS plan_name,
            p.\"planType\",
            CASE
                WHEN p.\"planType\" IN ('free', 'basic') THEN 1
                WHEN p.\"planType\" IN ('standard', 'business') THEN 2
                WHEN p.\"planType\" IN ('premium', 'vip', 'enterprise') THEN 3
                ELSE 1
            END AS filter_group
        FROM \"WiFiPlan\" p
        LEFT JOIN \"NetworkConfig\" n ON n.\"propertyId\" = p.\"propertyId\"
        WHERE p.enabled = true
          AND n.\"guestNetworkCidr\" IS NOT NULL
          AND n.\"guestNetworkCidr\" != ''
        ORDER BY filter_group, p.\"planType\"
    "

    local result
    result=$(psql "$DB_URL" -t -A -c "$query" 2>/dev/null)

    if [[ -z "$result" ]]; then
        log_warn "No WiFi plan / network mappings found in database"
        log_warn "IP groups file not modified (ensure WiFiPlan and NetworkConfig tables are populated)"
        return
    fi

    if [[ -z "${DRY_RUN:-}" ]]; then
        # Backup existing file
        if [[ -f "$ipgroups_file" ]]; then
            cp "$ipgroups_file" "$ipgroups_bak"
        fi

        cat > "$ipgroups_file" << IPGROUPS_HEADER
# StaySuite IP → Filter Group Mapping
# Auto-generated on: $TIMESTAMP
# Source: WiFiPlan + NetworkConfig tables in PostgreSQL
#
# Filter Groups:
#   1 = kids    (most restrictive - blocks adult, social media, streaming, gambling)
#   2 = basic   (moderate - blocks adult, gambling, malware)
#   3 = premium (minimal - blocks malware, phishing only)
#
# Manual edits will be overwritten on next run.
# To preserve manual entries, add them to ipgroups.override

IPGROUPS_HEADER

        echo "$result" | while IFS='|' read -r cidr plan_name plan_type filter_group; do
            [[ -z "$cidr" || -z "$filter_group" ]] && continue
            # Clean up whitespace
            cidr="$(echo "$cidr" | xargs)"
            filter_group="$(echo "$filter_group" | xargs)"
            plan_name="$(echo "$plan_name" | xargs)"
            plan_type="$(echo "$plan_type" | xargs)"
            echo "# Plan: $plan_name (type=$plan_type)" >> "$ipgroups_file"
            echo "${cidr} = filter${filter_group}" >> "$ipgroups_file"
            echo "" >> "$ipgroups_file"
        done

        # Append manual override file if it exists
        if [[ -f "${ipgroups_file}.override" ]]; then
            echo "" >> "$ipgroups_file"
            echo "# --- Manual overrides ---" >> "$ipgroups_file"
            cat "${ipgroups_file}.override" >> "$ipgroups_file"
            log_info "Merged manual overrides from ipgroups.override"
        fi

        log_info "IP groups written to: $ipgroups_file"
    else
        echo "$result" | while IFS='|' read -r cidr plan_name plan_type filter_group; do
            [[ -z "$cidr" ]] && continue
            log_info "  $cidr → filter${filter_group} (plan: $plan_name / $plan_type)"
        done
    fi
}

# --- Generate per-group banned site includes ---
generate_group_configs() {
    log_step "Generating per-filter-group banned site includes..."

    # Group 1 (kids): adult, social_media, streaming, gambling, violence, drugs, proxy, vpn
    # Group 2 (basic): adult, gambling, malware, phishing, violence
    # Group 3 (premium): malware, phishing

    local groups_dir="$E2G_CONF_DIR/lists"
    local banned_dir="$OUTPUT_DIR"

    declare -A GROUP_CATEGORIES
    GROUP_CATEGORIES[1]="staysuite_adult staysuite_social_media staysuite_streaming staysuite_gambling staysuite_violence staysuite_drugs staysuite_proxy staysuite_vpn staysuite_ads"
    GROUP_CATEGORIES[2]="staysuite_adult staysuite_gambling staysuite_malware staysuite_phishing staysuite_violence staysuite_ads"
    GROUP_CATEGORIES[3]="staysuite_malware staysuite_phishing"

    declare -A GROUP_NAMES
    GROUP_NAMES[1]="kids"
    GROUP_NAMES[2]="basic"
    GROUP_NAMES[3]="premium"

    for group_num in 1 2 3; do
        local group_file="$groups_dir/group${group_num}/localbannedsitelist"
        local group_name="${GROUP_NAMES[$group_num]}"
        local categories="${GROUP_CATEGORIES[$group_num]}"

        if [[ -z "${DRY_RUN:-}" ]]; then
            mkdir -p "$(dirname "$group_file")"
            cat > "$group_file" << GROUP_HEADER
# StaySuite Filter Group $group_num ($group_name) - Local Banned Sites
# Auto-generated on: $TIMESTAMP
# Categories: ${categories// /, }
# Source: ContentFilter table in PostgreSQL

GROUP_HEADER

            local has_content=false
            for cat_file in $categories; do
                if [[ -f "$banned_dir/$cat_file" ]]; then
                    echo ".Include<${banned_dir}/${cat_file}>" >> "$group_file"
                    has_content=true
                fi
            done

            if $has_content; then
                log_info "Group $group_num ($group_name): $(dirname "$group_file")/localbannedsitelist"
            else
                log_warn "Group $group_num ($group_name): no matching category files found"
            fi
        else
            log_info "  Group $group_num ($group_name): would include ${categories// /, }"
        fi
    done
}

# --- Reload e2guardian if running ---
reload_e2guardian() {
    if [[ -n "${DRY_RUN:-}" ]]; then
        log_info "DRY RUN: would reload e2guardian"
        return
    fi

    if pgrep -x e2guardian > /dev/null 2>&1; then
        log_step "Reloading e2guardian..."
        if e2guardian -r 2>/dev/null; then
            log_info "e2guardian reloaded successfully"
        else
            log_warn "e2guardian reload failed — try: sudo systemctl restart e2guardian"
        fi
    else
        log_info "e2guardian is not running (skip reload)"
    fi
}

# --- Usage ---
usage() {
    cat << USAGE
StaySuite → e2guardian Config Generator

Usage:
  $(basename "$0") [OPTIONS] [output_dir]

Arguments:
  output_dir       Output directory for generated list files
                   Default: /etc/e2guardian/lists/banned

Options:
  --ip-groups       Generate IP group mappings from WiFi plans
  --group-configs   Generate per-filter-group banned site includes
  --reload          Reload e2guardian after generation
  --dry-run         Show what would be generated without writing files
  --help            Show this help message

Environment:
  DATABASE_URL      PostgreSQL connection string
  E2G_CONF_DIR      e2guardian config directory (default: /etc/e2guardian)

Examples:
  # Generate only banned site lists
  $(basename "$0")

  # Generate everything and reload e2guardian
  $(basename "$0") --ip-groups --group-configs --reload

  # Dry run to preview
  $(basename "$0") --ip-groups --group-configs --dry-run

  # Custom output directory
  $(basename "$0") /tmp/e2guardian-test
USAGE
}

# --- Main ---
main() {
    local do_ip_groups=false
    local do_group_configs=false
    local do_reload=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --ip-groups)
                do_ip_groups=true
                shift
                ;;
            --group-configs)
                do_group_configs=true
                shift
                ;;
            --reload)
                do_reload=true
                shift
                ;;
            --dry-run)
                DRY_RUN=1
                shift
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                OUTPUT_DIR="$1"
                shift
                ;;
        esac
    done

    if [[ -n "${DRY_RUN:-}" ]]; then
        log_warn "DRY RUN MODE — no files will be written"
    fi

    echo ""
    log_info "StaySuite → e2guardian Config Generator"
    log_info "Started at: $TIMESTAMP"
    echo ""

    # Run pre-flight checks
    check_dependencies

    # Generate banned site lists (always)
    generate_lists

    # Optional: IP group mappings
    if $do_ip_groups; then
        echo ""
        generate_ip_groups
    fi

    # Optional: Per-group configs
    if $do_group_configs; then
        echo ""
        generate_group_configs
    fi

    # Optional: Reload
    if $do_reload; then
        echo ""
        reload_e2guardian
    fi

    echo ""
    log_info "Done."
}

main "$@"
