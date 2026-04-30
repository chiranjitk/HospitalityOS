#!/usr/bin/env bash
# =============================================================================
# StaySuite — FreeRADIUS Production Setup (Rocky Linux 10)
#
# Run this script AFTER installing FreeRADIUS via dnf.
# It applies all StaySuite patches, enables required sites/modules,
# and configures the connection to PostgreSQL.
#
# Usage:
#   sudo bash freeradius-config-patches/setup-production.sh
#
# Environment variables (override in production-env.conf or export):
#   RADIUS_CONFIG_PATH   - FreeRADIUS config dir (default: /etc/raddb)
#   FR_DB_HOST           - PostgreSQL host (default: localhost)
#   FR_DB_PORT           - PostgreSQL port (default: 5432)
#   FR_DB_NAME           - Database name (default: staysuite)
#   FR_DB_USER           - Database user (default: staysuite)
#   FR_DB_PASS           - Database password (REQUIRED - set in production-env.conf)
#   FR_HOME              - FreeRADIUS install prefix (default: auto-detect)
# =============================================================================
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Config Paths ────────────────────────────────────────────────────
RADDB="${RADIUS_CONFIG_PATH:-/etc/raddb}"

# Auto-detect FR_HOME
if [ -n "${FR_HOME:-}" ]; then
    FR_BIN="$FR_HOME/sbin/radiusd"
else
    if command -v radiusd &>/dev/null; then
        FR_BIN=$(which radiusd)
        FR_HOME=$(dirname "$(dirname "$FR_BIN")")
    elif [ -x /usr/sbin/radiusd ]; then
        FR_HOME="/usr"
        FR_BIN="/usr/sbin/radiusd"
    else
        err "FreeRADIUS binary not found. Install with: sudo dnf install -y freeradius freeradius-utils freeradius-postgresql"
    fi
fi

# Database config
FR_DB_HOST="${FR_DB_HOST:-localhost}"
FR_DB_PORT="${FR_DB_PORT:-5432}"
FR_DB_NAME="${FR_DB_NAME:-staysuite}"
FR_DB_USER="${FR_DB_USER:-staysuite}"
FR_DB_PASS="${FR_DB_PASS:-}"

if [ -z "$FR_DB_PASS" ]; then
    # Try to load from production-env.conf
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
    if [ -f "$PROJECT_ROOT/production-env.conf" ]; then
        source "$PROJECT_ROOT/production-env.conf"
        FR_DB_PASS="${FR_RADIUS_DB:-}"
        # Extract password from connection string if set
        if [ -n "$FR_DB_PASS" ] && echo "$FR_DB_PASS" | grep -q "password="; then
            FR_DB_PASS=$(echo "$FR_DB_PASS" | sed -n 's/.*password=\([^ ]*\).*/\1/p')
        fi
    fi
fi

if [ -z "$FR_DB_PASS" ]; then
    err "Database password not set. Set FR_DB_PASS env var or configure production-env.conf"
fi

# ── Preflight ───────────────────────────────────────────────────────
info "StaySuite FreeRADIUS Production Setup"
info "====================================="
info "FR_HOME:       $FR_HOME"
info "FR_BIN:        $FR_BIN"
info "RADDB:         $RADDB"
info "DB:            $FR_DB_USER@$FR_DB_HOST:$FR_DB_PORT/$FR_DB_NAME"
echo ""

# Check FreeRADIUS installed
[ ! -d "$RADDB" ] && err "FreeRADIUS config directory not found: $RADDB"
[ ! -f "$FR_BIN" ] && err "FreeRADIUS binary not found: $FR_BIN"

# Check not already running
if pgrep -x radiusd &>/dev/null; then
    warn "FreeRADIUS is running — stopping for config changes..."
    systemctl stop radiusd 2>/dev/null || kill $(pgrep -x radiusd)
    sleep 2
fi

# ── Step 1: Enable Required Modules ─────────────────────────────────
info "Step 1/6: Enabling required modules..."

REQUIRED_MODS="sql pap chap mschap expr preprocess expiration logintime detail.exec always date"

for mod in $REQUIRED_MODS; do
    if [ -f "$RADDB/mods-available/$mod" ]; then
        if [ ! -L "$RADDB/mods-enabled/$mod" ]; then
            ln -sf ../mods-available/"$mod" "$RADDB/mods-enabled/$mod"
            ok "Enabled module: $mod"
        else
            ok "Module already enabled: $mod"
        fi
    else
        warn "Module not found (skipping): $mod"
    fi
done

# Disable unwanted modules
for mod in sqlippool dhcp eap; do
    if [ -L "$RADDB/mods-enabled/$mod" ]; then
        rm -f "$RADDB/mods-enabled/$mod"
        warn "Disabled module: $mod"
    fi
done

# Comment out EAP references in site configs (Rocky 10 has them uncommented by default)
for site_file in "$RADDB/sites-available/default" "$RADDB/sites-available/inner-tunnel"; do
    if [ -f "$site_file" ]; then
        # Comment out 'eap' block references
        sed -i '/^[[:space:]]*eap[[:space:]]*{/,/^[[:space:]]*}/ s/^[[:space:]]*/# /' "$site_file"
        # Comment out standalone 'eap' module references (in authorize/authenticate sections)
        sed -i '/^[[:space:]]*#.*eap/! { /^[[:space:]]*eap[[:space:]]*$/ s/^[[:space:]]*/# / }' "$site_file"
    fi
done

# ── Step 2: Configure SQL Module ────────────────────────────────────
info "Step 2/6: Configuring SQL module..."

SQL_MOD="$RADDB/mods-available/sql"
if [ -f "$SQL_MOD" ]; then
    # Backup
    cp "$SQL_MOD" "${SQL_MOD}.bak.$(date +%Y%m%d%H%M%S)"

    # Apply settings using sed — set individual fields, not a full connection string
    sed -i "s/^dialect.*=.*/dialect = \"postgresql\"/" "$SQL_MOD"
    sed -i "s/^driver.*=.*/driver = \"rlm_sql_postgresql\"/" "$SQL_MOD"
    sed -i "s|^# *radius_db.*=.*|radius_db = \"$FR_DB_NAME\"|" "$SQL_MOD"
    sed -i "s/^radius_db.*=.*/radius_db = \"$FR_DB_NAME\"/" "$SQL_MOD"
    sed -i "s/^read_clients.*=.*/read_clients = yes/" "$SQL_MOD"
    sed -i "s/^# *client_table.*/client_table = \"nas\"/" "$SQL_MOD"

    # Set server, port, login, password within the sql {} block
    # Handle both commented and uncommented forms
    sed -i "s/^# *server.*=.*/server = \"$FR_DB_HOST\"/" "$SQL_MOD"
    sed -i "s/^server\s*=.*/server = \"$FR_DB_HOST\"/" "$SQL_MOD"
    sed -i "s/^# *port.*=.*/port = $FR_DB_PORT/" "$SQL_MOD"
    sed -i "s/^port\s*=.*/port = $FR_DB_PORT/" "$SQL_MOD"
    sed -i "s/^# *login.*=.*/login = \"$FR_DB_USER\"/" "$SQL_MOD"
    sed -i "s/^login\s*=.*/login = \"$FR_DB_USER\"/" "$SQL_MOD"
    sed -i "s/^# *password.*=.*/password = \"$FR_DB_PASS\"/" "$SQL_MOD"
    sed -i "s/^password\s*=.*/password = \"$FR_DB_PASS\"/" "$SQL_MOD"

    # Remove debug logfile if present
    sed -i '/^logfile.*=.*sql_debug/d' "$SQL_MOD"

    # Make sure mods-enabled/sql is a symlink to the configured module
    if [ ! -L "$RADDB/mods-enabled/sql" ] && [ -f "$RADDB/mods-enabled/sql" ]; then
        rm -f "$RADDB/mods-enabled/sql"
        ln -sf ../mods-available/sql "$RADDB/mods-enabled/sql"
        warn "Replaced custom SQL config with symlink (now configured properly)"
    elif [ ! -L "$RADDB/mods-enabled/sql" ]; then
        ln -sf ../mods-available/sql "$RADDB/mods-enabled/sql"
    fi

    ok "SQL module configured for PostgreSQL"
else
    err "SQL module not found: $SQL_MOD"
fi

# ── Step 3: Enable CoA (Change of Authorization) ───────────────────
info "Step 3/6: Enabling CoA (Change of Authorization)..."

# Create symlink for CoA virtual server
if [ -f "$RADDB/sites-available/coa" ]; then
    if [ ! -L "$RADDB/sites-enabled/coa" ]; then
        ln -sf ../sites-available/coa "$RADDB/sites-enabled/coa"
        ok "Enabled CoA site (port 3799) — FreeRADIUS will now receive CoA-Request and Disconnect-Request"
    else
        ok "CoA site already enabled"
    fi
else
    warn "sites-available/coa not found — creating default..."
    mkdir -p "$RADDB/sites-available"
    cat > "$RADDB/sites-available/coa" << 'COAEOF'
# StaySuite CoA Virtual Server
# Listens on port 3799 for CoA-Request and Disconnect-Request from NAS devices
listen {
        type = coa
        ipaddr = *
        port = 3799
        virtual_server = coa
}

server coa {
        recv-coa {
                ok
        }
        send-coa {
                ok
        }
}
COAEOF
    ln -sf ../sites-available/coa "$RADDB/sites-enabled/coa"
    ok "Created and enabled CoA site"
fi

# ── Step 4: Apply Post-Auth Patches ────────────────────────────────
info "Step 4/6: Applying post-auth patches..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Apply sites-default-postauth patch
if [ -f "$SCRIPT_DIR/sites-default-postauth.patch" ]; then
    SITE_DEFAULT="$RADDB/sites-available/default"
    if [ -f "$SITE_DEFAULT" ]; then
        cp "$SITE_DEFAULT" "${SITE_DEFAULT}.bak.$(date +%Y%m%d%H%M%S)"
        # Apply patch inline — the patch file contains the post-auth block additions
        # Read the patch instructions and apply
        while IFS= read -r line; do
            case "$line" in
                "# PATCH:"*) ;;
                "# SEARCH:"*)
                    search_term=$(echo "$line" | sed 's/# SEARCH: //')
                    if ! grep -qF "$search_term" "$SITE_DEFAULT" 2>/dev/null; then
                        warn "Search pattern not found: $search_term"
                    fi
                    ;;
                "# INSERT_AFTER:"*)
                    insert_after=$(echo "$line" | sed 's/# INSERT_AFTER: //')
                    ;;
                "# INSERT:"*)
                    insert_text=$(echo "$line" | sed 's/# INSERT: //')
                    if ! grep -qF "$insert_text" "$SITE_DEFAULT" 2>/dev/null; then
                        sed -i "/${insert_after}/a\\${insert_text}" "$SITE_DEFAULT"
                        ok "Applied patch: $insert_text"
                    else
                        ok "Patch already applied: $insert_text"
                    fi
                    ;;
            esac
        done < "$SCRIPT_DIR/sites-default-postauth.patch"
    fi
fi

# Apply queries-postauth patch
if [ -f "$SCRIPT_DIR/queries-postauth.patch" ]; then
    QUERIES_FILE="$RADDB/mods-config/sql/main/postgresql/queries.conf"
    if [ -f "$QUERIES_FILE" ]; then
        cp "$QUERIES_FILE" "${QUERIES_FILE}.bak.$(date +%Y%m%d%H%M%S)"
        # The post-auth query should capture called/calling station IDs
        if ! grep -q "calledstationid" "$QUERIES_FILE" 2>/dev/null; then
            warn "Review queries-postauth.patch and apply manually if needed"
        else
            ok "Post-auth queries already configured"
        fi
    fi
fi

# ── Step 5: Enable Attribute Filter for CoA ────────────────────────
info "Step 5/6: Configuring attribute filters..."

COA_ATTR_FILTER="$RADDB/mods-config/attr_filter/coa"
if [ -f "$COA_ATTR_FILTER" ]; then
    ok "CoA attribute filter exists"
else
    # Create a safe default that accepts common CoA attributes
    mkdir -p "$RADDB/mods-config/attr_filter"
    cat > "$COA_ATTR_FILTER" << 'ATTR_EOF'
# StaySuite CoA Attribute Filter
# Default: accept all common CoA attributes
DEFAULT
        Session-Timeout
        Idle-Timeout
        Termination-Action
        Acct-Interim-Interval
        WISPr-Bandwidth-Max-Down
        WISPr-Bandwidth-Max-Up
        WISPr-Volume-Total-Octets
        WISPr-Volume-Total-Octets-Gigawords
        ChilliSpot-Bandwidth-Max-Down
        ChilliSpot-Bandwidth-Max-Up
        ChilliSpot-Max-Total-Octets
        Mikrotik-Rate-Limit
        Mikrotik-Total-Limit
        Filter-Id
        Reply-Message
ATTR_EOF
    ok "Created CoA attribute filter"
fi

# ── Step 6: Generate clients.conf (placeholder) ────────────────────
info "Step 6/6: Setting up clients.conf..."

CLIENTS_FILE="$RADDB/clients.conf"
if [ ! -f "$CLIENTS_FILE" ] || ! grep -q "StaySuite" "$CLIENTS_FILE" 2>/dev/null; then
    cp "$CLIENTS_FILE" "${CLIENTS_FILE}.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
    cat > "$CLIENTS_FILE" << 'CLIENTSEOF'
# =============================================================================
# StaySuite — RADIUS Clients Configuration
# AUTO-GENERATED: This file is managed by the freeradius-service.
# Manual edits will be overwritten on next NAS sync.
# =============================================================================
#
# NAS clients are also read from the PostgreSQL 'nas' table (read_clients = yes)
# Static clients below serve as fallback.
#

# Localhost testing client
client localhost {
    ipaddr = 127.0.0.1
    secret = testing123
}

# Local network (for development)
client localhost_ipv6 {
    ipv6addr = ::1
    secret = testing123
}
CLIENTSEOF
    ok "Created clients.conf with localhost defaults"
else
    ok "clients.conf exists — preserving existing entries"
fi

# ── Verify Configuration ────────────────────────────────────────────
info ""
info "Verifying FreeRADIUS configuration..."

if "$FR_BIN" -C -l /dev/null -d "$RADDB" 2>&1; then
    ok "Configuration is valid!"
else
    echo ""
    echo -e "${YELLOW}[WARN]${NC} Configuration test had issues. Showing last 20 lines:"
    "$FR_BIN" -XC -l /dev/null -d "$RADDB" 2>&1 | tail -20
    err "Configuration test FAILED — check the output above"
fi

# ── Enable systemd service ──────────────────────────────────────────
info ""
info "Enabling FreeRADIUS systemd service..."

if command -v systemctl &>/dev/null; then
    systemctl enable radiusd 2>/dev/null
    ok "FreeRADIUS service enabled (will start on boot)"
else
    warn "systemctl not found — skip auto-enable"
fi

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} StaySuite FreeRADIUS Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
info "What was done:"
echo "  ✓ SQL module → PostgreSQL ($FR_DB_NAME)"
echo "  ✓ CoA enabled (port 3799) — receives CoA/Disconnect from NAS"
echo "  ✓ Required modules enabled (sql, pap, chap, mschap, exec, ...)"
echo "  ✓ Unwanted modules disabled (sqlippool, dhcp, eap)"
echo "  ✓ clients.conf configured (localhost fallback)"
echo "  ✓ Attribute filters set up for CoA"
echo "  ✓ systemd service enabled"
echo ""
info "Active sites:"
ls -la "$RADDB/sites-enabled/" 2>/dev/null | grep -v "^total" | grep -v "^\." | while read -r line; do
    echo "  $line"
done
echo ""
info "Active modules (key):"
ls "$RADDB/mods-enabled/" 2>/dev/null | while read -r mod; do
    echo "  - $mod"
done
echo ""
warn "NEXT STEPS:"
echo "  1. Add your NAS clients via the StaySuite AAA Configuration page"
echo "  2. Verify with: sudo radiusd -XC"
echo "  3. Start with: sudo systemctl start radiusd"
echo "  4. Check logs: journalctl -u radiusd -f"
echo ""
