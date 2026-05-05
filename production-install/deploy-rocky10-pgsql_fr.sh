#!/usr/bin/env bash
###############################################################################
# StaySuite HospitalityOS — Zero-Touch Production Deployment
# =============================================================================
# Rocky Linux 10 + PostgreSQL 16/17 + FreeRADIUS 3.x + Node.js 22 + Bun + PM2
#
# ONE SCRIPT. NO MANUAL STEPS. RUN AND FORGET.
#
# What this script does (in order):
#   1.  System prerequisites check (RAM, disk, OS)
#   2.  dnf system update + EPEL
#   3.  PostgreSQL 16/17 from PGDG (production-tuned)
#   4.  Create 'staysuite' database + 'staysuite' & 'radius' users
#   5.  FreeRADIUS 3.x install + Cryptsk VSA dictionary + PostgreSQL SQL module config
#   6.  Node.js 22 LTS + Bun runtime
#   7.  Clone StaySuite-HospitalityOS from GitHub
#   8.  Install dependencies (bun install)
#   9.  prisma db push (creates ~231 PMS tables)
#  10.  complete-database.sql (4 helper tables, 6 views, 8 functions)
#  10b. nftables-service-tables.sql (5 tables for firewall mini-service)
#  11.  Seed demo data (properties, rooms, plans, users)
#  12.  Build Next.js standalone
#  13.  Install PM2 + generate production ecosystem.config.js
#  14.  Start ALL services via PM2 (Next.js + 9 mini-services)
#  15.  Configure FreeRADIUS CoA (port 3799)
#  16.  Set up cron jobs (data usage processing)
#  17.  Install conntrack-tools + configure nftables LOG rules for TLS SNI capture (NFLOG)
#  18.  ClickHouse IPDR tables creation (nat_log, sni_log)
#  19.  Print deployment summary
#
# Usage:
#   chmod +x deploy-rocky10-postgresql.sh
#   sudo ./deploy-rocky10-postgresql.sh
#
# Options:
#   --db-password PASS    PostgreSQL password (default: Staysuite2025)
#   --mikrotik-ip IP      MikroTik NAS IP (default: 192.168.88.1)
#   --cryptsk-ip IP       Cryptsk gateway IP for multimode (default: 127.0.0.1)
#   --shared-secret KEY   RADIUS shared secret (default: localkey)
#   --app-dir DIR         Install directory (default: /opt/staysuite)
#   --skip-mikrotik       Skip MikroTik NAS client config
#   --skip-cryptsk        Skip Cryptsk VSA + NAS client config
#   --yes                 Skip all confirmation prompts
#
# Idempotent: safe to re-run (backs up existing DB).
###############################################################################
set -euo pipefail

# ── Color helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

trap 'echo -e "\\n${RED}ERROR: Command failed at line $LINENO (exit code $?). Check log: ${LOG_FILE}${NC}" >&2; exit 1' ERR

info()    { echo -e "${BLUE}  -> ${NC}$*"; }
success() { echo -e "${GREEN}  OK ${NC}$*"; }
warn()    { echo -e "${YELLOW}  !! ${NC}$*"; }
error()   { echo -e "${RED}  XX ${NC}$*"; }
step()    { echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BOLD}${CYAN}  STEP $1/$STEPS │ $2${NC}"; echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
die()     { error "$@"; exit 1; }

# ── Robust wait helpers (eliminates all race conditions) ─────────────────
# Wait for pg_isready to succeed (up to $1 seconds, default 30)
wait_for_pg() {
  local timeout="${1:-30}"
  local host="${2:-127.0.0.1}"
  local port="${3:-5432}"
  local i
  for i in $(seq 1 "$timeout"); do
    if pg_isready -h "$host" -p "$port" -q 2>/dev/null; then
      return 0
    fi
    sleep 3
  done
  return 1
}

# Wait for a systemd service to be active (up to $1 seconds, default 30)
wait_for_service() {
  local service="${1:?service name required}"
  local timeout="${2:-30}"
  local i
  for i in $(seq 1 "$timeout"); do
    if systemctl is-active --quiet "$service" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Wait for a TCP port to be listening (up to $1=port $2=timeout $3=host)
wait_for_tcp() {
  local port="${1:?port required}"
  local host="${3:-127.0.0.1}"
  local timeout="${2:-30}"
  local i
  for i in $(seq 1 "$timeout"); do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# ── PostgreSQL restart helper (now with TCP verification) ────────────────────
restart_pg() {
  systemctl reset-failed "postgresql-${PG_MAJOR}" 2>/dev/null || true
  systemctl restart "postgresql-${PG_MAJOR}"
  systemctl enable "postgresql-${PG_MAJOR}" 2>/dev/null || true
  info "Waiting for PostgreSQL to become TCP-ready..."
  if ! wait_for_pg 10; then
    error "PostgreSQL ${PG_MAJOR} failed to become TCP-ready after restart!"
    journalctl -u "postgresql-${PG_MAJOR}" -n 20 --no-pager 2>&1
    die "Fix the error above and re-run the script."
  fi
}

banner() {
  clear
  echo -e "${BOLD}${CYAN}"
  echo "  ╔═══════════════════════════════════════════════════════════════╗"
  echo "  ║                                                               ║"
  echo "  ║        StaySuite HospitalityOS — Zero-Touch Deploy            ║"
  echo "  ║        Rocky Linux 10 + PostgreSQL + FreeRADIUS + PM2         ║"
  echo "  ║                                                               ║"
  echo "  ╚═══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo -e "${DIM}  This script will install and configure everything from scratch.${NC}"
  echo ""
}

# ── Parse arguments ───────────────────────────────────────────────────────────
MIKROTIK_IP=""
CRYPTSK_IP=""
SHARED_SECRET=""
DB_PASSWORD=""
APP_DIR="/opt/staysuite"
SKIP_MIKROTIK=false
SKIP_CRYPTSK=false
AUTO_YES=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --db-password)    DB_PASSWORD="$2"; shift 2 ;;
    --mikrotik-ip)    MIKROTIK_IP="$2"; shift 2 ;;
    --cryptsk-ip)     CRYPTSK_IP="$2"; shift 2 ;;
    --shared-secret)  SHARED_SECRET="$2"; shift 2 ;;
    --app-dir)        APP_DIR="$2"; shift 2 ;;
    --skip-mikrotik)  SKIP_MIKROTIK=true; shift ;;
    --skip-cryptsk)   SKIP_CRYPTSK=true; shift ;;
    --yes|-y)         AUTO_YES=true; shift ;;
    *) die "Unknown option: $1. Use --help." ;;
  esac
done

STEPS=19
DEFAULT_DB_PASSWORD="Staysuite2025"

confirm() {
  if $AUTO_YES; then return 0; fi
  read -rp "$(echo -e "${YELLOW}  ? $* [Y/n]: ${NC}")" ans
  [[ "$ans" =~ ^[Yy]?$ ]]
}

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_FILE="/var/log/staysuite-deploy-$(date +%Y%m%d-%H%M%S).log"
mkdir -p /var/log
exec > >(tee -a "$LOG_FILE") 2>&1

# ════════════════════════════════════════════════════════════════════════════════
# STEP 1: Prerequisites
# ════════════════════════════════════════════════════════════════════════════════
banner

step 1 "Prerequisites" "Checking system requirements"

[[ $EUID -ne 0 ]] && die "This script must be run as root (use sudo)."

if ! grep -qi "rocky" /etc/os-release 2>/dev/null && ! grep -qi "rocky" /etc/redhat-release 2>/dev/null; then
  die "This script is designed for Rocky Linux. Detected: $(cat /etc/os-release 2>/dev/null | head -1)"
fi
OS_VERSION=$(grep 'VERSION_ID=' /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"')
info "Rocky Linux ${OS_VERSION} detected"

TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))
if [[ $TOTAL_RAM_GB -lt 2 ]]; then
  warn "Only ${TOTAL_RAM_GB}GB RAM. Recommended: 4 GB+"
  confirm "Continue anyway?" || die "Aborted."
else
  success "RAM: ${TOTAL_RAM_GB} GB"
fi

FREE_DISK_GB=$(df / | awk 'NR==2 {print int($4/1024/1024)}')
if [[ $FREE_DISK_GB -lt 10 ]]; then
  warn "Only ${FREE_DISK_GB}GB free disk. Recommended: 20 GB+"
  confirm "Continue anyway?" || die "Aborted."
else
  success "Disk: ${FREE_DISK_GB} GB free"
fi

success "Prerequisites check passed"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 2: System Update
# ════════════════════════════════════════════════════════════════════════════════
step 2 "System Update" "Installing base packages"

info "Running dnf update..."
dnf update -y --quiet 2>&1 | tail -3
dnf install -y --quiet curl wget git unzip gnupg2 ca-certificates \
  policycoreutils-python-utils lsof which jq epel-release

success "System packages updated"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 3: PostgreSQL
# ════════════════════════════════════════════════════════════════════════════════
step 3 "PostgreSQL" "Installing PostgreSQL from PGDG repository"

# Install PGDG repo
if [[ ! -f /etc/yum.repos.d/pgdg-redhat-all.repo ]]; then
  info "Installing PGDG repository..."
  dnf install -y --quiet https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm
fi
dnf -y -q module disable postgresql 2>/dev/null || true

# Detect best PG version
PG_MAJOR=""
for ver in 17 16; do
  if dnf list "postgresql${ver}-server" --quiet 2>/dev/null | grep -q "postgresql${ver}-server"; then
    PG_MAJOR="$ver"; break
  fi
done
[[ -z "$PG_MAJOR" ]] && die "PostgreSQL 16/17 not found in PGDG repo."

info "Installing PostgreSQL ${PG_MAJOR}..."
dnf install -y --quiet "postgresql${PG_MAJOR}-server" "postgresql${PG_MAJOR}-contrib"

# Initialize (always fresh — wipe and re-init on every run)
PG_DATA="/var/lib/pgsql/${PG_MAJOR}/data"
info "Initializing PostgreSQL ${PG_MAJOR}..."
systemctl stop "postgresql-${PG_MAJOR}" 2>/dev/null || true
sleep 1
if [[ -d "${PG_DATA}" ]]; then
  warn "Wiping existing PG data: ${PG_DATA}"
  rm -rf "${PG_DATA}"
fi
"/usr/pgsql-${PG_MAJOR}/bin/postgresql-${PG_MAJOR}-setup" initdb
chown -R postgres:postgres "${PG_DATA}"
chmod 700 "${PG_DATA}"
restorecon -R "${PG_DATA}" 2>/dev/null || true

# Resolve port conflicts
for pgver in 17 16 15 14 13; do
  systemctl stop "postgresql-${pgver}" 2>/dev/null || true
done
sleep 1
if ss -tlnp | grep -q ':5432 '; then
  die "Port 5432 in use. Kill manually: fuser -k 5432/tcp"
fi

# Production tuning
PG_CONF="${PG_DATA}/postgresql.conf"
TUNE_MARKER="# StaySuite Production Tuning"
if grep -q "$TUNE_MARKER" "$PG_CONF" 2>/dev/null; then
  sed -i "/${TUNE_MARKER}/,/# End StaySuite Tuning/d" "$PG_CONF"
fi

# Remove any existing max_connections and superuser_reserved_connections
# from previous installs (they override our tuning block if placed earlier)
sed -i '/^max_connections\s*=/d' "$PG_CONF"
sed -i '/^superuser_reserved_connections\s*=/d' "$PG_CONF"
sed -i '/^shared_buffers\s*=/d' "$PG_CONF"
sed -i '/^effective_cache_size\s*=/d' "$PG_CONF"
sed -i '/^maintenance_work_mem\s*=/d' "$PG_CONF"
sed -i '/^work_mem\s*=/d' "$PG_CONF"
sed -i '/^wal_buffers\s*=/d' "$PG_CONF"
sed -i '/^checkpoint_completion_target\s*=/d' "$PG_CONF"

# Auto-adjust shared_buffers based on RAM
if [[ $TOTAL_RAM_GB -ge 8 ]]; then
  SHARED_BUFFERS="2GB"
  EFFECTIVE_CACHE="6GB"
elif [[ $TOTAL_RAM_GB -ge 4 ]]; then
  SHARED_BUFFERS="1GB"
  EFFECTIVE_CACHE="3GB"
else
  SHARED_BUFFERS="512MB"
  EFFECTIVE_CACHE="1536MB"
fi

# Force TCP listen on explicit IPs (avoid 'localhost' DNS ambiguity on some systems)
# Use BOTH sed on postgresql.conf AND write to postgresql.auto.conf for reliability.
# postgresql.auto.conf has highest priority and survives package upgrades.
sed -i "s/^#\?listen_addresses\s*=.*/listen_addresses = '127.0.0.1'/" "$PG_CONF"
grep -q "^listen_addresses" "$PG_CONF" || echo "listen_addresses = '127.0.0.1'" >> "$PG_CONF"
sed -i "s/^#\?port\s*=.*/port = 5432/" "$PG_CONF"
grep -q "^port" "$PG_CONF" || echo "port = 5432" >> "$PG_CONF"

# Also write to postgresql.auto.conf (highest priority — overrides conf.d/ includes)
# Wipe it first to remove any leftover settings from previous installs
cat > "${PG_DATA}/postgresql.auto.conf" <<'PGAUTO'
# Do not edit this file manually! It is managed by StaySuite deploy script.
listen_addresses = '127.0.0.1'
port = 5432
PGAUTO
chown postgres:postgres "${PG_DATA}/postgresql.auto.conf"
chmod 640 "${PG_DATA}/postgresql.auto.conf"

# Remove any conf.d/*.conf files that might override listen_addresses
PG_CONF_D="${PG_DATA}/conf.d"
if [[ -d "$PG_CONF_D" ]]; then
  for f in "$PG_CONF_D"/*.conf; do
    [[ -f "$f" ]] && {
      if grep -q 'listen_addresses\|port\s*=' "$f" 2>/dev/null; then
        warn "Removing conf.d override: $(basename $f)"
        rm -f "$f"
      fi
    }
  done
fi

# ── pg_hba.conf: ALL TRUST (must be set BEFORE first start) ──────────────────
# Write trust-based pg_hba.conf here in Step 3 so it's active from the very
# first startup. Without this, PG starts with default scram-sha-256 auth
# and all subsequent psql/radiusd connections fail.
cat > "${PG_DATA}/pg_hba.conf" <<'EOF'
# StaySuite pg_hba.conf — ALL TRUST (no password authentication needed)
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             0.0.0.0/0               trust
host    all             all             ::1/128                 trust
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
EOF
chown postgres:postgres "${PG_DATA}/pg_hba.conf"
chmod 640 "${PG_DATA}/pg_hba.conf"

cat >> "$PG_CONF" <<PGTUNE

# StaySuite Production Tuning
shared_buffers = ${SHARED_BUFFERS}
effective_cache_size = ${EFFECTIVE_CACHE}
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
work_mem = 8MB
max_connections = 1000
superuser_reserved_connections = 5
log_min_duration_statement = 500
log_line_prefix = '%t [%p]: db=%d,user=%u,app=%a,client=%h '
# End StaySuite Tuning
PGTUNE

# Start PostgreSQL (pg_hba.conf is already set to trust)
info "Starting PostgreSQL ${PG_MAJOR}..."
systemctl reset-failed "postgresql-${PG_MAJOR}" 2>/dev/null || true
systemctl start "postgresql-${PG_MAJOR}" || {
  error "PostgreSQL failed to start!"
  PG_LOG="${PG_DATA}/log"
  [[ -d "$PG_LOG" ]] && cat "$(ls -t "$PG_LOG"/*.log 2>/dev/null | head -1)" | tail -30
  die "Check logs above."
}
systemctl is-active --quiet "postgresql-${PG_MAJOR}" || die "PostgreSQL not running."
systemctl enable "postgresql-${PG_MAJOR}"

# Verify TCP connectivity — wait up to 60s for fresh initdb to fully start
info "Waiting for PostgreSQL TCP readiness (up to 60s)..."
if ! wait_for_pg 20; then
  error "PostgreSQL not accepting TCP connections on 127.0.0.1:5432"
  echo "--- Diagnostic info ---"
  echo "listen_addresses in postgresql.conf:"
  grep -n 'listen_addresses' "$PG_CONF" | head -3
  echo "listen_addresses in postgresql.auto.conf:"
  grep -n 'listen_addresses' "${PG_DATA}/postgresql.auto.conf" 2>/dev/null | head -3
  echo "conf.d/ files:"
  ls -la "${PG_DATA}/conf.d/" 2>/dev/null
  echo "Port 5432 listeners:"
  ss -tlnp | grep 5432 || echo "  (none)"
  echo "--- PostgreSQL log ---"
  journalctl -u "postgresql-${PG_MAJOR}" -n 20 --no-pager 2>&1
  die "Check listen_addresses and conf.d/ overrides above."
fi
info "PostgreSQL TCP ready"

success "PostgreSQL ${PG_MAJOR} installed, tuned, and running (TCP verified)"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 4: Database Setup
# ════════════════════════════════════════════════════════════════════════════════
step 4 "Database" "Creating staysuite database and users"

# Verify psql connectivity
sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1 || {
  PG_HBA="${PG_DATA}/pg_hba.conf"
  sed -i '1i local   all             postgres                                trust' "$PG_HBA" 2>/dev/null
  systemctl reload "postgresql-${PG_MAJOR}"
  sleep 1
  sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1 || die "Cannot connect to PostgreSQL."
}
success "PostgreSQL connectivity verified"

# Password
[[ -z "$DB_PASSWORD" ]] && DB_PASSWORD="$DEFAULT_DB_PASSWORD"
info "Database password: ${DB_PASSWORD}"

# Backup if exists
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='staysuite'" 2>/dev/null || echo "")
if [[ "$DB_EXISTS" == "1" ]]; then
  warn "Database 'staysuite' already exists."
  confirm "Drop and recreate (loses all data)?" || die "Aborted."
  mkdir -p /var/lib/pgsql/backups
  BACKUP_FILE="/var/lib/pgsql/backups/staysuite-$(date +%Y%m%d-%H%M%S).dump"
  info "Backing up to ${BACKUP_FILE}..."
  sudo -u postgres pg_dump -Fc staysuite > "$BACKUP_FILE" 2>/dev/null || true
  sudo -u postgres psql -c "DROP DATABASE staysuite;" 2>/dev/null
fi

# Create database, users, permissions
PSQL_SQL=$(cat <<'EOSQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'staysuite') THEN
    CREATE ROLE staysuite WITH LOGIN PASSWORD '__PASS__';
  ELSE
    ALTER ROLE staysuite WITH PASSWORD '__PASS__';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'radius') THEN
    CREATE ROLE radius WITH LOGIN PASSWORD '__PASS__';
  ELSE
    ALTER ROLE radius WITH PASSWORD '__PASS__';
  END IF;
END $$;
SELECT 'CREATE DATABASE staysuite OWNER staysuite' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'staysuite')\gexec
GRANT ALL PRIVILEGES ON DATABASE staysuite TO staysuite;
\c staysuite
CREATE EXTENSION IF NOT EXISTS citext;
GRANT ALL ON SCHEMA public TO staysuite;
GRANT ALL ON SCHEMA public TO radius;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO staysuite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO radius;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO staysuite;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO radius;
EOSQL
)
PSQL_SQL="${PSQL_SQL//__PASS__/$DB_PASSWORD}"
echo "$PSQL_SQL" | sudo -u postgres psql || die "Failed to create database."

# pg_hba.conf — trust all connections (no password needed)
cat > "${PG_DATA}/pg_hba.conf" <<'EOF'
# StaySuite pg_hba.conf
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             0.0.0.0/0               trust
host    replication     all             127.0.0.1/32            trust
EOF
chown postgres:postgres "${PG_DATA}/pg_hba.conf"
chmod 640 "${PG_DATA}/pg_hba.conf"
restart_pg
success "Database 'staysuite' + users 'staysuite'/'radius' created"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 5: FreeRADIUS
# ════════════════════════════════════════════════════════════════════════════════
step 5 "FreeRADIUS" "Installing and configuring FreeRADIUS 3.x"

info "Installing FreeRADIUS packages..."
dnf install -y --quiet freeradius freeradius-utils freeradius-postgresql

RADD="/etc/raddb"

# ── 5a: Enable required modules ──────────────────────────────────────────────
info "Enabling required FreeRADIUS modules..."
REQUIRED_MODS="sql pap chap mschap expr preprocess expiration logintime detail detail.exec exec date always"
for mod in $REQUIRED_MODS; do
  [[ -f "${RADD}/mods-available/$mod" ]] && ln -sf "../mods-available/$mod" "${RADD}/mods-enabled/$mod" 2>/dev/null || true
done
# Disable unwanted
for mod in sqlippool dhcp eap; do
  rm -f "${RADD}/mods-enabled/$mod" 2>/dev/null || true
done

# ── 5a2: Comment out EAP references in site configs ─────────────────────────
# Rocky 10's default sites-available/default and inner-tunnel have 'eap' uncommented
# in authenticate/authorize sections, but we disabled the eap module above.
# FreeRADIUS will fail config check if eap is referenced but not enabled.
for site_file in "${RADD}/sites-available/default" "${RADD}/sites-available/inner-tunnel"; do
  [[ -f "$site_file" ]] || continue
  info "  Commenting out eap references in $(basename "$site_file")..."
  # Comment out 'eap { ... }' blocks (authorize section)
  sed -i '/^[[:space:]]*eap[[:space:]]*{/,/^[[:space:]]*}/ s/^[[:space:]]*/# /' "$site_file"
  # Comment out standalone 'eap' lines (authenticate section, Post-Auth-Type REJECT)
  sed -i '/^[[:space:]]*#.*eap/! { /^[[:space:]]*eap[[:space:]]*$/ s/^[[:space:]]*/# / }' "$site_file"
done

# ── 5b: Write SQL module ─────────────────────────────────────────────────────
info "Configuring SQL module for PostgreSQL..."
FR_SQL_CONF=$(cat <<'EOCONF'
sql {
  driver = "rlm_sql_postgresql"
  dialect = "postgresql"
  server = "127.0.0.1"
  port = 5432
  login = "radius"
  password = "__DBPASS__"
  radius_db = "staysuite"

  pool {
    start = 1
    min = 1
    max = 10
    spare = 3
    uses = 0
    lifetime = 0
    idle_timeout = 60
    connect_timeout = 5.0
  }

  read_clients = yes
  client_table = "nas"

  accounting {
    reference = "%{tolower:type.%{Acct-Status-Type}.query}"
    type {
      accounting-on {
        query = "\
          UPDATE nasreload SET reloadtime = NOW() WHERE nasipaddress = '%{NAS-IP-Address}'; \
          INSERT INTO nasreload (nasipaddress, reloadtime) SELECT '%{NAS-IP-Address}', NOW() \
          WHERE NOT EXISTS (SELECT 1 FROM nasreload WHERE nasipaddress = '%{NAS-IP-Address}');"
      }
      accounting-off { query = "${..accounting-on.query}" }
      start {
        query = "\
          INSERT INTO radacct (acctsessionid, acctuniqueid, username, realm, nasipaddress, \
            nasportid, nasporttype, acctstarttime, acctupdatetime, acctauthentic, \
            connectinfo_start, calledstationid, callingstationid, servicetype, framedprotocol, \
            framedipaddress, framedipv6address, framedipv6prefix, framedinterfaceid, \
            delegatedipv6prefix, \"class\") VALUES \
            ('%{Acct-Session-Id}', '%{Acct-Unique-Session-Id}', '%{SQL-User-Name}', '%{Realm}', \
            '%{NAS-IP-Address}', '%{NAS-Port}', '%{NAS-Port-Type}', '%S', '%S', '%{Acct-Authentic}', \
            '%{Connect-Info}', '%{Called-Station-Id}', '%{Calling-Station-Id}', '%{Service-Type}', \
            '%{Framed-Protocol}', NULLIF('%{Framed-IP-Address}', ''), NULLIF('%{Framed-IPv6-Address}', ''), \
            NULLIF('%{Framed-IPv6-Prefix}', ''), NULLIF('%{Framed-Interface-Id}', ''), \
            NULLIF('%{Delegated-IPv6-Prefix}', ''), NULLIF('%{Class}', ''))"
      }
      interim-update {
        query = "\
          UPDATE radacct SET framedipaddress = NULLIF('%{Framed-IP-Address}', ''), \
            framedipv6address = NULLIF('%{Framed-IPv6-Address}', ''), \
            acctsessiontime = '%{Acct-Session-Time}', \
            acctinputoctets = '%{Acct-Input-Octets}', \
            acctoutputoctets = '%{Acct-Output-Octets}', \
            acctupdatetime = NOW(), \"class\" = NULLIF('%{Class}', '') \
          WHERE acctuniqueid = '%{Acct-Unique-Session-Id}' AND acctstoptime IS NULL"
      }
      stop {
        query = "\
          UPDATE radacct SET acctstoptime = '%S', acctsessiontime = '%{Acct-Session-Time}', \
            acctinputoctets = '%{Acct-Input-Octets}', acctoutputoctets = '%{Acct-Output-Octets}', \
            acctterminatecause = '%{Acct-Terminate-Cause}', connectinfo_stop = '%{Connect-Info}', \
            framedipaddress = NULLIF('%{Framed-IP-Address}', ''), \
            framedipv6address = NULLIF('%{Framed-IPv6-Address}', ''), \
            \"class\" = NULLIF('%{Class}', '') \
          WHERE acctuniqueid = '%{Acct-Unique-Session-Id}' AND acctstoptime IS NULL"
      }
    }
  }

  post-auth {
    query = "\
      INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, \
        nasipaddress, clientipaddress, authdate, \"class\") \
      VALUES ('%{SQL-User-Name}', '%{%{User-Password}:-%{Chap-Password}}', '%{reply:Packet-Type}', \
        '%{Called-Station-Id}', '%{Calling-Station-Id}', \
        '%{NAS-IP-Address}', NULLIF('%{Framed-IP-Address}', ''), NOW(), NULLIF('%{Class}', ''))"
  }
}
EOCONF
)
FR_SQL_CONF="${FR_SQL_CONF//__DBPASS__/$DB_PASSWORD}"
echo "$FR_SQL_CONF" > "${RADD}/mods-enabled/sql"
chown root:radiusd "${RADD}/mods-enabled/sql" 2>/dev/null || true
chmod 640 "${RADD}/mods-enabled/sql" 2>/dev/null || true

# ── 5c: Custom queries.conf ──────────────────────────────────────────────────
info "Writing custom queries.conf..."
mkdir -p "${RADD}/mods-config/sql/main/postgresql"
cat > "${RADD}/mods-config/sql/main/postgresql/queries.conf" <<'EOQUERY'
authorize_check_query = "SELECT id, username, attribute, value, op FROM radcheck WHERE username = '%{SQL-User-Name}' ORDER BY id"
authorize_reply_query = "SELECT id, username, attribute, value, op FROM radreply WHERE username = '%{SQL-User-Name}' ORDER BY id"
groupcheck_query = "SELECT id, groupname, attribute, op, value FROM radgroupcheck WHERE groupname = '%{Sql-Group}' ORDER BY id"
groupreply_query = "SELECT id, groupname, attribute, op, value FROM radgroupreply WHERE groupname = '%{Sql-Group}' ORDER BY id"
usergroup_query = "SELECT groupname FROM radusergroup WHERE username = '%{SQL-User-Name}' ORDER BY priority"
simul_count_query = "SELECT COUNT(*) FROM radacct WHERE username = '%{SQL-User-Name}' AND acctstoptime IS NULL"
simul_verify_query = "SELECT radacctid FROM radacct WHERE username = '%{SQL-User-Name}' AND acctstoptime IS NULL AND callingstationid = '%{Calling-Station-Id}' LIMIT 1"
EOQUERY

# ── 5d: Install Cryptsk VSA Dictionary ──────────────────────────────────────
# Cryptsk (IANA Vendor ID 64179) is used in MULTIMODE where the product acts
# as both captive-portal gateway AND RADIUS server. The VSA dictionary defines
# all Cryptsk-specific attributes (rate-limit, bandwidth, FUP, VLAN, etc.)
if ! $SKIP_CRYPTSK; then
  info "Installing Cryptsk VSA dictionary (Vendor ID 64179)..."

  # Use the project's standalone dictionary file if available
  if [[ -f "${APP_DIR}/freeradius-install/etc/raddb/dictionary.cryptsk" ]]; then
    cp "${APP_DIR}/freeradius-install/etc/raddb/dictionary.cryptsk" "${RADD}/dictionary.cryptsk"
  else
    # Fallback: write the dictionary inline (idempotent)
    cat > "${RADD}/dictionary.cryptsk" << 'CRYPTEOF'
# =============================================================================
# CRYPTSK PRIVATE LIMITED  —  Vendor-Specific Attributes (VSA)
# IANA Private Enterprise Code: 64179
# =============================================================================

VENDOR    Cryptsk          64179

BEGIN-VENDOR Cryptsk

# Core Traffic Shaping (1-10)
ATTRIBUTE       Cryptsk-Rate-Limit              1       string
ATTRIBUTE       Cryptsk-Bandwidth-Max-Down      2       integer
ATTRIBUTE       Cryptsk-Bandwidth-Max-Up        3       integer
ATTRIBUTE       Cryptsk-Total-Limit             4       integer
ATTRIBUTE       Cryptsk-Max-Input-Octets        5       integer
ATTRIBUTE       Cryptsk-Max-Output-Octets       6       integer

# Session & Access Control (11-20)
ATTRIBUTE       Cryptsk-Session-Timeout         11      integer
ATTRIBUTE       Cryptsk-Idle-Timeout            12      integer
ATTRIBUTE       Cryptsk-Max-Sessions            13      integer

# Network Assignment (21-30)
ATTRIBUTE       Cryptsk-Pool-Name               21      string
ATTRIBUTE       Cryptsk-VLAN-ID                 22      integer
ATTRIBUTE       Cryptsk-Static-IP               23      ipaddr

# Portal & Filtering (31-40)
ATTRIBUTE       Cryptsk-Redirect-URL            31      string
ATTRIBUTE       Cryptsk-Filter-Id               32      string
ATTRIBUTE       Cryptsk-User-Profile            33      string
ATTRIBUTE       Cryptsk-Plan-Name               34      string

# FUP & Policy (41-50)
ATTRIBUTE       Cryptsk-FUP-Rate-Limit          41      string
ATTRIBUTE       Cryptsk-FUP-Threshold-Bytes     42      integer
ATTRIBUTE       Cryptsk-Data-Reset-Interval     43      integer
ATTRIBUTE       Cryptsk-QoS-Priority            44      integer
ATTRIBUTE       Cryptsk-Billing-Class           45      string

END-VENDOR Cryptsk
CRYPTEOF
  fi

  # Ensure the main dictionary includes dictionary.cryptsk
  if ! grep -q '\\$INCLUDE.*dictionary\\.cryptsk' "${RADD}/dictionary" 2>/dev/null; then
    echo '$INCLUDE dictionary.cryptsk' >> "${RADD}/dictionary"
  fi
  chown root:radiusd "${RADD}/dictionary.cryptsk" 2>/dev/null || true
  chmod 644 "${RADD}/dictionary.cryptsk" 2>/dev/null || true
  success "Cryptsk VSA dictionary installed (Vendor ID 64179)"
fi

# ── 5e: Configure sites ─────────────────────────────────────────────────────
info "Configuring FreeRADIUS sites..."
SITES_DEFAULT="${RADD}/sites-available/default"
[[ -f "$SITES_DEFAULT" ]] && sed -i 's/^#\s*-sql/-sql/' "$SITES_DEFAULT"
[[ -f "${RADD}/sites-available/accounting" ]] && sed -i 's/^#\s*-sql/-sql/' "${RADD}/sites-available/accounting"
[[ -f "${RADD}/sites-available/session" ]] && sed -i 's/^#\s*-sql/-sql/' "${RADD}/sites-available/session"

# CoA (Change of Authorization) for bandwidth change, session disconnect
if [[ -f "${RADD}/sites-available/coa" ]]; then
  ln -sf ../sites-available/coa "${RADD}/sites-enabled/coa" 2>/dev/null || true
else
  mkdir -p "${RADD}/sites-available"
  cat > "${RADD}/sites-available/coa" <<'COAEOF'
listen { type = coa; ipaddr = *; port = 3799; }
server coa { recv-coa { ok } send-coa { ok } }
COAEOF
  ln -sf ../sites-available/coa "${RADD}/sites-enabled/coa"
fi

# ── 5f: MikroTik NAS client ─────────────────────────────────────────────────
if ! $SKIP_MIKROTIK; then
  [[ -z "$MIKROTIK_IP" ]] && MIKROTIK_IP="${MIKROTIK_IP:-192.168.88.1}"
  [[ -z "$SHARED_SECRET" ]] && SHARED_SECRET="${SHARED_SECRET:-localkey}"

  if ! $AUTO_YES && [[ -z "${MIKROTIK_IP:-}" ]]; then
    read -rp "  Enter MikroTik NAS IP [192.168.88.1]: " MIKROTIK_IP
    MIKROTIK_IP="${MIKROTIK_IP:-192.168.88.1}"
    read -rp "  Enter RADIUS shared secret [localkey]: " SHARED_SECRET
    SHARED_SECRET="${SHARED_SECRET:-localkey}"
  fi

  mkdir -p "${RADD}/clients.d"
  cat > "${RADD}/clients.d/mikrotik.conf" <<EOCLIENT
client mikrotik {
  ipaddr = ${MIKROTIK_IP}
  secret = ${SHARED_SECRET}
  shortname = mikrotik
  coa_server = mikrotik-coa
  response_window = 6.0
}
home_server mikrotik-coa {
  type = coa
  ipaddr = ${MIKROTIK_IP}
  port = 3799
  secret = ${SHARED_SECRET}
}
EOCLIENT

  [[ ! -f "${RADD}/clients.d/localhost.conf" ]] && cat > "${RADD}/clients.d/localhost.conf" <<'EOCLIENT'
client localhost { ipaddr = 127.0.0.1; secret = testing123; shortname = localhost; }
EOCLIENT

  success "MikroTik NAS client configured (${MIKROTIK_IP})"
fi

# ── 5g: Cryptsk Gateway NAS client (Multimode) ─────────────────────────────
if ! $SKIP_CRYPTSK; then
  [[ -z "$CRYPTSK_IP" ]] && CRYPTSK_IP="127.0.0.1"
  [[ -z "$SHARED_SECRET" ]] && SHARED_SECRET="${SHARED_SECRET:-localkey}"

  if ! $AUTO_YES && [[ -z "${CRYPTSK_IP:-}" ]]; then
    read -rp "  Enter Cryptsk Gateway IP [127.0.0.1]: " CRYPTSK_IP
    CRYPTSK_IP="${CRYPTSK_IP:-127.0.0.1}"
  fi

  mkdir -p "${RADD}/clients.d"
  cat > "${RADD}/clients.d/cryptsk.conf" <<EOCLIENT
client cryptsk {
  ipaddr = ${CRYPTSK_IP}
  secret = ${SHARED_SECRET}
  shortname = cryptsk
  coa_server = cryptsk-coa
  response_window = 6.0
}
home_server cryptsk-coa {
  type = coa
  ipaddr = ${CRYPTSK_IP}
  port = 3799
  secret = ${SHARED_SECRET}
}
EOCLIENT

  success "Cryptsk Gateway NAS client configured (${CRYPTSK_IP}) — MULTIMODE ready"
fi

# ── 5g2: Apply Post-Auth Business Logic Patches ──────────────────────────
info "Applying post-auth business logic patches to sites-available/default..."

POST_AUTH_PATCH="/tmp/staysuite-post-auth-blocks.txt"
cat > "$POST_AUTH_PATCH" << 'PAEOF'
        # -- StaySuite: IP Pool Restriction Check ------------------------------
        # Check if user's IP is within their assigned IP pool.
        # Priority: User Override > Plan Pool > Default Pool > No restriction.
        if (&Framed-IP-Address) {
            update control {
                &Tmp-Integer-0 := "%{sql:SELECT fn_check_ip_pool('%{User-Name}', '%{Framed-IP-Address}'::inet)}"
            }
            if (&control:Tmp-Integer-0 == 0) {
                update reply {
                    &Reply-Message := "Access denied - IP not in allowed pool for this user"
                }
                reject
            }
            # -- StaySuite: Push Gateway from IP Pool --------------------------
            update control {
                &Tmp-String-0 := "%{sql:SELECT fn_get_pool_attr('%{User-Name}', 'gateway')}"
            }
            if (&control:Tmp-String-0 && &control:Tmp-String-0 != '') {
                update reply {
                    &Framed-Route := "0.0.0.0/0 %{control:Tmp-String-0}"
                }
            }
        }

        # -- StaySuite: FUP Switch-Over Bandwidth Override ----------------------
        # Sets BOTH Mikrotik-Rate-Limit AND Cryptsk-Rate-Limit for dual-mode.
        update control {
            &Tmp-String-2 := "%{sql:SELECT fn_get_mikrotik_rate_limit('%{User-Name}')}"
        }
        update reply {
            &Mikrotik-Rate-Limit := "%{control:Tmp-String-2}"
            &Cryptsk-Rate-Limit := "%{control:Tmp-String-2}"
        }

PAEOF

if ! grep -q "StaySuite: IP Pool Restriction Check" "$SITES_DEFAULT"; then
  # Insert post-auth blocks BEFORE the first '-sql' line inside the post-auth section
  awk '/^post-auth[[:space:]]*\{/{found=1} found && /^[[:space:]]*-[[:space:]]*sql/ && !done{
    while((getline line < "'"$POST_AUTH_PATCH"'")>0) print line
    close("'$POST_AUTH_PATCH'")
    done=1
  } {print}' "$SITES_DEFAULT" > "${SITES_DEFAULT}.new" \
    && mv "${SITES_DEFAULT}.new" "$SITES_DEFAULT" \
    && success "Post-auth patches applied (IP pool + gateway + FUP)" \
    || warn "Failed to apply post-auth patches — check manually"
else
  success "Post-auth patches already applied"
fi
rm -f "$POST_AUTH_PATCH"

# ── 5g3: CoA Attribute Filter ───────────────────────────────────────────
info "Setting up CoA attribute filter..."
COA_ATTR_FILTER="${RADD}/mods-config/attr_filter/coa"
if [[ ! -f "$COA_ATTR_FILTER" ]]; then
  mkdir -p "${RADD}/mods-config/attr_filter"
  cat > "$COA_ATTR_FILTER" << 'COAEOF'
DEFAULT
        Session-Timeout
        Idle-Timeout
        Termination-Action
        Acct-Interim-Interval
        WISPr-Bandwidth-Max-Down
        WISPr-Bandwidth-Max-Up
        WISPr-Volume-Total-Octets
        Cryptsk-Rate-Limit
        Cryptsk-Bandwidth-Max-Down
        Cryptsk-Bandwidth-Max-Up
        Cryptsk-Total-Limit
        Cryptsk-FUP-Rate-Limit
        Cryptsk-Session-Timeout
        Cryptsk-Idle-Timeout
        Cryptsk-Filter-Id
        Cryptsk-Redirect-URL
        Cryptsk-User-Profile
        Cryptsk-Plan-Name
        Mikrotik-Rate-Limit
        Mikrotik-Total-Limit
        Filter-Id
        Reply-Message
COAEOF
  success "CoA attribute filter created"
else
  success "CoA attribute filter already exists"
fi

# ── 5h: Increase systemd timeout for radiusd (SQL pool init can be slow after fresh PG) ──
info "Setting FreeRADIUS systemd timeout..."
mkdir -p /etc/systemd/system/radiusd.service.d
cat > /etc/systemd/system/radiusd.service.d/timeout.conf <<'EOF'
[Service]
TimeoutStartSec=120
EOF
systemctl daemon-reload

# ── 5i: Test and start FreeRADIUS ───────────────────────────────────────────
# Ensure PG is accepting TCP connections before FreeRADIUS tries to connect
info "Verifying PostgreSQL is ready for FreeRADIUS..."
if ! pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
  warn "PostgreSQL not accepting connections — restarting..."
  restart_pg
fi
info "Testing FreeRADIUS configuration..."
RADIUS_TEST=$(timeout 15 radiusd -XC 2>&1)
RC=$?
if [[ $RC -ne 0 ]]; then
  warn "FreeRADIUS config check had issues (RC=$RC) — showing last 15 lines:"
  echo "$RADIUS_TEST" | tail -15
  warn "Continuing anyway — FreeRADIUS will validate on systemd start"
fi
systemctl enable radiusd
systemctl reset-failed radiusd 2>/dev/null || true
systemctl restart radiusd
if ! wait_for_service radiusd 90; then
  error "FreeRADIUS failed to start within 90s!"
  journalctl -u radiusd -n 30 --no-pager 2>&1
  die "Check logs above."
fi
success "FreeRADIUS installed, configured, and running"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 6: Node.js + Bun
# ════════════════════════════════════════════════════════════════════════════════
step 6 "Runtime" "Installing Node.js 22 + Bun"

if command -v node >/dev/null 2>&1 && node --version | grep -q "v22"; then
  info "Node.js $(node --version) already installed"
else
  dnf module disable nodejs -y 2>/dev/null || true
  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - 2>&1 | tail -3
  dnf install -y --quiet nodejs
fi
success "Node.js $(node --version)"

if command -v bun >/dev/null 2>&1; then
  info "Bun $(bun --version) already installed"
else
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  ln -sf "$BUN_INSTALL/bin/bun" /usr/local/bin/bun
fi
success "Bun $(bun --version)"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 7: Clone Project
# ════════════════════════════════════════════════════════════════════════════════
step 7 "Project" "Cloning StaySuite HospitalityOS"

if [[ -d "${APP_DIR}/.git" ]]; then
  info "Updating existing clone at ${APP_DIR}..."
  cd "$APP_DIR" && git pull origin main || warn "Git pull failed, using existing code"
else
  [[ -d "$APP_DIR" ]] && mv "$APP_DIR" "${APP_DIR}.bak.$(date +%s)"
  info "Cloning from GitHub to ${APP_DIR}..."
  git clone https://github.com/chiranjitk/StaySuite-HospitalityOS.git "$APP_DIR" \
    || die "Failed to clone repository."
fi
cd "$APP_DIR"
success "Project ready at ${APP_DIR}"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 8: Configure .env
# ════════════════════════════════════════════════════════════════════════════════
step 8 "Environment" "Creating .env configuration"

APP_SECRET="${APP_SECRET:-$(head -c 32 /dev/urandom | xxd -p | tr -d '\n' | head -c 64)}"

cat > "${APP_DIR}/.env" <<EOENV
# StaySuite HospitalityOS — Production Environment
# Generated: $(date -Iseconds)

DATABASE_URL=postgresql://staysuite:${DB_PASSWORD}@127.0.0.1:5432/staysuite?connect_timeout=60&connection_limit=10&pool_timeout=120
RADIUS_DB_URL=postgresql://radius:${DB_PASSWORD}@127.0.0.1:5432/staysuite
NODE_ENV=production
PORT=3000
NEXTAUTH_SECRET=${APP_SECRET}
NEXTAUTH_URL=\${NEXTAUTH_URL:-http://localhost}
EOENV
chmod 600 "${APP_DIR}/.env"
success ".env created"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 9: Install Dependencies
# ════════════════════════════════════════════════════════════════════════════════
step 9 "Dependencies" "Installing npm/bun packages"

cd "$APP_DIR"
info "Installing main project dependencies..."
bun install 2>&1 | tail -3

info "Installing mini-service dependencies..."
for svc_dir in "${APP_DIR}/mini-services/"*/; do
  svc_name=$(basename "$svc_dir")
  [[ "$svc_name" == "radius-server" || "$svc_name" == "shared" || "$svc_name" == ".gitkeep" ]] && continue
  [[ -f "${svc_dir}/package.json" ]] && { info "  ${svc_name}..."; cd "$svc_dir" && bun install 2>&1 | tail -1; cd "$APP_DIR"; }
done
success "All dependencies installed"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 10: Prisma Schema Push
# ════════════════════════════════════════════════════════════════════════════════
step 10 "Prisma" "Pushing schema (~231 PMS tables)"

cd "$APP_DIR"
export DATABASE_URL="postgresql://staysuite:${DB_PASSWORD}@127.0.0.1:5432/staysuite?connect_timeout=60&connection_limit=10&pool_timeout=120"

# Ensure pg_hba.conf is trust (something may have changed it since Step 4)
cat > "${PG_DATA}/pg_hba.conf" <<'EOF'
# StaySuite pg_hba.conf
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             0.0.0.0/0               trust
host    replication     all             127.0.0.1/32            trust
EOF
chown postgres:postgres "${PG_DATA}/pg_hba.conf"
restart_pg

# restart_pg already verified TCP readiness — confirm with actual query
psql -h 127.0.0.1 -U staysuite -d staysuite -c "SELECT 1" >/dev/null 2>&1 \
  || die "PostgreSQL connection failed after restart — check listen_addresses and pg_hba.conf"

# Ensure citext exists before prisma push
sudo -u postgres psql -d staysuite -c "CREATE EXTENSION IF NOT EXISTS citext;" 2>/dev/null

info "Running prisma db push..."
npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 | tail -10

info "Running prisma generate..."
npx prisma generate --schema=prisma/schema.prisma 2>&1 | tail -3
success "Prisma schema pushed and client generated"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 11: Complete Database (complete-database.sql)
# ════════════════════════════════════════════════════════════════════════════════
step 11 "Schema" "Applying complete-database.sql (tables, views, functions)"

# This creates: nas, nasreload, data_usage_by_period, fup_switch_log,
# 6 reporting views, 8 database functions, ALTER TABLE columns
if [[ -f "${APP_DIR}/pgsql-production/complete-database.sql" ]]; then
  psql -h 127.0.0.1 -U staysuite -d staysuite -f "${APP_DIR}/pgsql-production/complete-database.sql" 2>&1 | tail -5
  success "complete-database.sql applied (4 tables, 6 views, 8 functions)"
else
  warn "complete-database.sql not found, skipping advanced schema"
fi

# nftables-service tables (firewall mini-service DB storage)
if [[ -f "${APP_DIR}/pgsql-production/nftables-service-tables.sql" ]]; then
  psql -h 127.0.0.1 -U staysuite -d staysuite -f "${APP_DIR}/pgsql-production/nftables-service-tables.sql" 2>&1 | grep -v NOTICE
  success "nftables-service-tables.sql applied (5 tables: NftGuiRule, NftPortForward, NftRateLimit, NftQuickBlock, NftSchedule)"
else
  warn "nftables-service-tables.sql not found, skipping"
fi

# Re-grant all permissions (after prisma push and complete-database.sql)
sudo -u postgres psql -d staysuite <<'EOSQL'
-- Re-grant all table/sequence permissions to both users
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO staysuite, radius;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO staysuite, radius;
-- Execute permission on all custom functions
DO $$ DECLARE r RECORD;
BEGIN FOR r IN SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname LIKE 'fn_%' OR p.proname LIKE 'fr_%'
LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %I(%s) TO staysuite, radius', r.proname, r.args);
END LOOP; END $$;
EOSQL
success "All permissions re-granted"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 12: Seed Database
# ════════════════════════════════════════════════════════════════════════════════
step 12 "Seed" "Inserting demo data"

cd "$APP_DIR"
export DATABASE_URL="postgresql://staysuite:${DB_PASSWORD}@127.0.0.1:5432/staysuite?connect_timeout=60&connection_limit=10&pool_timeout=120"

if [[ -f "prisma/seed.ts" ]]; then
  info "Running seed script..."
  npx tsx prisma/seed.ts 2>&1 | tail -10
  success "Database seeded"
elif [[ -f "prisma/wifi-seed.ts" ]]; then
  npx tsx prisma/wifi-seed.ts 2>&1 | tail -10
  success "WiFi seed data inserted"
else
  warn "No seed file found, skipping"
fi

# ════════════════════════════════════════════════════════════════════════════════
# STEP 13: Build Next.js
# ════════════════════════════════════════════════════════════════════════════════
step 13 "Build" "Building Next.js application (standalone)"

cd "$APP_DIR"
export NODE_OPTIONS='--max-old-space-size=8192'
export DATABASE_URL="postgresql://staysuite:${DB_PASSWORD}@127.0.0.1:5432/staysuite?connect_timeout=60&connection_limit=10&pool_timeout=120"

info "Building Next.js (this may take a few minutes)..."
bun run build 2>&1 | tail -10
success "Next.js build complete"

# Rebuild native addons (lzma-native for speedtest-net) inside standalone output
# The standalone build copies .js files but native .node binaries must be
# compiled for the production Node.js ABI version.
if [[ -d "${APP_DIR}/.next/standalone/node_modules/lzma-native" ]]; then
  info "Rebuilding native addons in standalone output..."
  cd "${APP_DIR}/.next/standalone"
  npm rebuild lzma-native 2>&1 | tail -3
  cd "$APP_DIR"
  success "Native addons rebuilt"
fi

# ════════════════════════════════════════════════════════════════════════════════
# STEP 14: PM2 + All Services
# ════════════════════════════════════════════════════════════════════════════════
step 14 "PM2" "Installing PM2 and starting all services"

npm install -g pm2 2>&1 | tail -2

# Detect bun path
BUN_PATH="${BUN_INSTALL:-$HOME/.bun}/bin/bun"
[[ ! -x "$BUN_PATH" ]] && BUN_PATH=$(which bun)
[[ ! -x "$BUN_PATH" ]] && die "Bun not found!"

# Ensure start-nextjs.sh is executable (Rocky 10 IPv6 fix wrapper)
chmod +x "${APP_DIR}/start-nextjs.sh" 2>/dev/null || true

# Create production ecosystem.config.js
# Use a template with __PLACEHOLDER__ markers, then sed to inject values.
# This avoids heredoc escaping nightmares with JS template literals.
mkdir -p "${APP_DIR}/logs"
cat > "${APP_DIR}/ecosystem.config.js" <<'JSEOF'
/**
 * StaySuite HospitalityOS — PM2 Production Configuration
 * AUTO-GENERATED by deploy-rocky10-postgresql.sh
 * DO NOT EDIT — changes will be overwritten on next deploy.
 */

const BUN_PATH = '__BUN_PATH__';
const APP_DIR  = '__APP_DIR__';

const DB_URL = 'postgresql://staysuite:__DBPASS__@127.0.0.1:5432/staysuite?connect_timeout=60&connection_limit=10&pool_timeout=120';

module.exports = {
  apps: [
    // Next.js — uses start-nextjs.sh wrapper to fix Rocky 10 IPv6 EINVAL
    {
      name: 'staysuite-nextjs',
      script: 'start-nextjs.sh',
      interpreter: 'bash',
      cwd: APP_DIR,
      env: { NODE_ENV: 'production', PORT: 3000, DATABASE_URL: DB_URL },
      max_memory_restart: '2G',
      max_restarts: 10,
      restart_delay: 3000,
    },
    // Mini-services (all use bun directly — NOT npm start)
    {
      name: 'availability-service',
      script: 'server.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/availability-service`,
      env: { NODE_ENV: 'production', PORT: 3002, DATABASE_URL: DB_URL },
      max_restarts: 10, restart_delay: 3000,
    },
    {
      name: 'realtime-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/realtime-service`,
      env: { NODE_ENV: 'production', PORT: 3003, DATABASE_URL: DB_URL },
      max_restarts: 10, restart_delay: 3000,
    },
    {
      name: 'freeradius-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/freeradius-service`,
      env: { NODE_ENV: 'production', PORT: 3010, DATABASE_URL: DB_URL },
      max_restarts: 10, restart_delay: 3000,
    },
    {
      name: 'dhcp-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/dhcp-service`,
      env: { NODE_ENV: 'production', PORT: 3011, DATABASE_URL: DB_URL },
      max_restarts: 10, restart_delay: 3000,
    },
    {
      name: 'dns-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/dns-service`,
      env: { NODE_ENV: 'production', PORT: 3012, DATABASE_URL: DB_URL },
      max_restarts: 10, restart_delay: 3000,
    },
    {
      name: 'nftables-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/nftables-service`,
      env: { NODE_ENV: 'production', PORT: 3013, DATABASE_URL: DB_URL },
      max_restarts: 10, restart_delay: 3000,
    },
    {
      name: 'captive-redirect',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/captive-redirect`,
      env: { NODE_ENV: 'production', PORT: 8888 },
      max_restarts: 10, restart_delay: 3000,
    },
    // IPDR Network Logging Pipeline (WiFi gateway analytics + TRAI compliance)
    {
      name: 'conntrack-bridge',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/conntrack-bridge`,
      env: {
        NODE_ENV: 'production',
        PORT: 3020,
        CLICKHOUSE_URL: 'http://127.0.0.1:8123',
        CONNTRACK_BIN: '/usr/sbin/conntrack',
      },
      max_restarts: 10, restart_delay: 3000,
    },

    {
      name: 'sni-parser',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/sni-parser`,
      env: {
        NODE_ENV: 'production',
        PORT: 3022,
        CLICKHOUSE_URL: 'http://127.0.0.1:8123',
        SNI_LOG_FILE: '/var/log/sni-queries.log',
      },
      max_restarts: 10, restart_delay: 3000,
    },
  ],
};
JSEOF

# Replace placeholders (use bash parameter expansion — no sed special char issues)
TMP_FILE=$(cat "${APP_DIR}/ecosystem.config.js")
TMP_FILE="${TMP_FILE//__BUN_PATH__/$BUN_PATH}"
TMP_FILE="${TMP_FILE//__APP_DIR__/$APP_DIR}"
TMP_FILE="${TMP_FILE//__DBPASS__/$DB_PASSWORD}"
echo "$TMP_FILE" > "${APP_DIR}/ecosystem.config.js"

# Stop old processes and start fresh
pm2 delete all 2>/dev/null || true
cd "$APP_DIR"
pm2 start ecosystem.config.js 2>&1 | tail -15
# Wait for Next.js to be ready on port 3000
if wait_for_tcp 3000 127.0.0.1 60 2>/dev/null; then
  info "Next.js is listening on port 3000"
else
  warn "Next.js not yet listening on port 3000 (may still be starting)"
fi

# Stop all PM2 services — save config but keep them stopped to avoid
# saturating PostgreSQL during remaining setup steps (FreeRADIUS, cron, IPDR)
info "Stopping PM2 services to free resources for remaining setup..."
pm2 stop all 2>/dev/null
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
success "PM2 configured — 11 services (stopped, will start at end)"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 14b: dnsmasq (DNS + DHCP server)
# ════════════════════════════════════════════════════════════════════════════════
info "Installing and configuring dnsmasq..."
dnf install -y --quiet dnsmasq 2>&1 | tail -2

# Write a MINIMAL main config — all real config comes from /etc/dnsmasq.d/
# generated by dns-service (staysuite.conf) and dhcp-service (staysuite-dhcp.conf).
# CRITICAL: Do NOT set bind-interfaces, listen-address, or server= here —
# those are managed by dns-service and will conflict if duplicated.
cat > /etc/dnsmasq.conf << 'EOF'
# StaySuite — dnsmasq main config
# All settings are in /etc/dnsmasq.d/*.conf (auto-generated by StaySuite services)
# DO NOT add bind-interfaces, listen-address, server=, or bind-dynamic here.

# PID file
pid-file=/run/dnsmasq/dnsmasq.pid

# Lease file (shared between dns-service and dhcp-service)
dhcp-leasefile=/var/lib/dnsmasq/dnsmasq.leases

# Include all StaySuite-generated configs
conf-dir=/etc/dnsmasq.d,*.conf
EOF

# Ensure directories exist
mkdir -p /etc/dnsmasq.d /run/dnsmasq /var/lib/dnsmasq
chown root:root /etc/dnsmasq.conf
chmod 644 /etc/dnsmasq.conf

# Clear any leftover dnsmasq env options that might conflict
# (Rocky Linux may ship /etc/sysconfig/dnsmasq with DNSMASQ_OPTS="--bind-interfaces")
if [[ -f /etc/sysconfig/dnsmasq ]]; then
  sed -i 's/^DNSMASQ_OPTS=.*/DNSMASQ_OPTS=""/' /etc/sysconfig/dnsmasq
  info "Cleared /etc/sysconfig/dnsmasq (removed conflicting DNSMASQ_OPTS)"
fi

# Enable dnsmasq to start on boot
systemctl enable dnsmasq 2>/dev/null || true

# Stop dnsmasq now — PM2 services (dns-service, dhcp-service) will generate
# configs and start it when they boot
systemctl stop dnsmasq 2>/dev/null || true

success "dnsmasq installed and configured (configs managed by dns-service + dhcp-service)"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 15: FreeRADIUS Final Restart + Verification
# ════════════════════════════════════════════════════════════════════════════════
step 15 "Verify" "FreeRADIUS final configuration restart and verification"

# All FreeRADIUS patches (post-auth, CoA, SQL module, attribute filters)
# are now applied directly in Step 5 (5a through 5g3) — NO dependency on
# freeradius-config-patches/setup-production.sh which would overwrite
# the custom SQL module config (accounting + post-auth queries).

# Verify post-auth patches were applied
if ! grep -q "StaySuite: IP Pool Restriction Check" "$SITES_DEFAULT" 2>/dev/null; then
  warn "Post-auth patches NOT found in sites-available/default!"
  warn "IP pool checks, gateway push, and FUP bandwidth override will NOT work."
  warn "Check: Step 5g2 may have failed. Run: grep -c 'StaySuite' ${RADD}/sites-available/default"
else
  success "Post-auth patches verified (IP pool + gateway + FUP)"
fi

# Verify CoA site is enabled
if [[ -L "${RADD}/sites-enabled/coa" ]]; then
  success "CoA site enabled (port 3799)"
else
  warn "CoA site NOT enabled — CoA/Disconnect requests will fail"
fi

# Verify custom SQL module is intact (not overwritten by symlink)
if [[ -f "${RADD}/mods-enabled/sql" && ! -L "${RADD}/mods-enabled/sql" ]]; then
  success "Custom SQL module intact"
elif [[ -L "${RADD}/mods-enabled/sql" ]]; then
  warn "mods-enabled/sql is a SYMLINK — custom accounting/post-auth queries may be missing"
fi

# Restart FreeRADIUS with final config
# Ensure PG is still accepting connections after heavy schema/seed/PM2 steps
info "Verifying PostgreSQL is still ready before FreeRADIUS restart..."
if ! pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
  warn "PostgreSQL stopped responding — restarting..."
  restart_pg
fi
# Also verify PG actually accepts queries (not just TCP)
psql -h 127.0.0.1 -U staysuite -d staysuite -c "SELECT 1" >/dev/null 2>&1 \
  || { warn "PG not queryable — full restart"; restart_pg; }

info "Testing FreeRADIUS configuration..."
RADIUS_TEST2=$(timeout 15 radiusd -XC 2>&1)
if [[ $? -eq 0 ]]; then {
  systemctl reset-failed radiusd 2>/dev/null || true
  systemctl restart radiusd
  if wait_for_service radiusd 90; then
    success "FreeRADIUS restarted with all patches applied"
  else
    warn "FreeRADIUS restart timed out — trying stop/start..."
    systemctl stop radiusd 2>/dev/null || true
    sleep 2
    systemctl start radiusd
    if wait_for_service radiusd 90; then
      success "FreeRADIUS started with all patches applied"
    else
      warn "FreeRADIUS not running — check: journalctl -u radiusd -n 30"
    fi
  fi
} || {
  warn "FreeRADIUS config check issues (non-fatal):"
  echo "$RADIUS_TEST2" | tail -10
  systemctl reset-failed radiusd 2>/dev/null || true
  systemctl restart radiusd 2>/dev/null || true
  if wait_for_service radiusd 90; then
    success "FreeRADIUS restarted (running with warnings)"
  else
    warn "FreeRADIUS not running — check: journalctl -u radiusd -n 30"
  fi
}
fi

# ════════════════════════════════════════════════════════════════════════════════
# STEP 16: Cron Jobs
# ════════════════════════════════════════════════════════════════════════════════
step 16 "Cron" "Setting up automated data processing"

CRON_FILE="/etc/cron.d/staysuite"
cat > "$CRON_FILE" << 'CRONEOF'
# StaySuite HospitalityOS — Scheduled Tasks
# Generated by deploy-rocky10-postgresql.sh
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin:/usr/pgsql-17/bin

# Hourly data usage period creation
0 * * * * postgres psql -d staysuite -c 'SELECT fr_new_data_usage_period();' > /dev/null 2>&1

# Data usage aggregation every 5 minutes
*/5 * * * * postgres psql -d staysuite -c 'SELECT fr_update_data_usage();' > /dev/null 2>&1

# Cleanup old data_usage_by_period (>90 days) at 3 AM
0 3 * * * postgres psql -d staysuite -c 'DELETE FROM data_usage_by_period WHERE period_start < NOW() - INTERVAL '"'"'90 days'"'"';' > /dev/null 2>&1
CRONEOF
chmod 644 "$CRON_FILE"
success "Cron jobs configured (hourly + 5min + daily cleanup)"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 17: Network Logging Pipeline (IPDR)
# ════════════════════════════════════════════════════════════════════════════════
step 17 "IPDR Pipeline" "Installing conntrack-tools + configuring nftables LOG rules"

info "Installing network logging packages..."
dnf install -y --quiet conntrack-tools iptables-nft 2>/dev/null || {
  warn "Some network packages may not be available..."
  dnf install -y --quiet conntrack-tools 2>/dev/null || true
  dnf install -y --quiet iptables-nft 2>/dev/null || true
}

# Verify conntrack binary
if command -v conntrack >/dev/null 2>&1; then
  CONNTRACK_BIN=$(which conntrack)
  success "conntrack-tools installed (binary: ${CONNTRACK_BIN})"
else
  warn "conntrack binary not found — conntrack-bridge will run in simulation mode"
fi

# Create SNI log directory + file for TLS SNI capture
mkdir -p /var/log/staysuite
touch /var/log/sni-queries.log
chmod 644 /var/log/sni-queries.log

# Log rotation for SNI logs
cat > /etc/logrotate.d/staysuite-ipdr << 'LOGEOF'
/var/log/sni-queries.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
    maxsize 500M
}
LOGEOF

# IMPORTANT: We do NOT log DNS (port 53) via NFLOG.
# DNS logs from dnsmasq are NOT a trusted IPDR source because users can
# change their global DNS (8.8.8.8, 1.1.1.1) and bypass dnsmasq entirely.
# SNI from TLS ClientHello is the correct and trusted domain source.
info "Configuring nftables LOG rules for TLS SNI capture (NFLOG)..."
NFT_LOG_SCRIPT="/usr/local/bin/staysuite-nftables-logging.sh"
cat > "$NFT_LOG_SCRIPT" <<'NFTEOF'
#!/bin/bash
# StaySuite — nftables LOG rules for IPDR network logging
# Run this AFTER the main nftables rules are loaded
# This adds logging rules that feed the sni-parser service

NFT=$(which nft 2>/dev/null || echo "/usr/sbin/nft")

$NFT add table inet staysuite_log 2>/dev/null || true
$NFT flush table inet staysuite_log 2>/dev/null || true

# Log TLS SYN packets (TCP port 443, SYN only) — parsed by sni-parser service
# Only SYN packets contain TLS ClientHello with SNI (no payload in SYN-ACK)
$NFT add chain inet staysuite_log input { type filter hook input priority -150 \; }
$NFT add rule inet staysuite_log input iifname != "lo" tcp dport 443 tcp flags syn tcp flags & (fin|syn|rst|psh|ack|urg) == syn log prefix "TLS_SYN: " counter

# Log to syslog so parsers can read them
# The LOG rules above send to kernel log which syslog/journalctl captures
echo "nftables LOG rules installed for TLS SNI capture (NFLOG)"
NFTEOF
chmod +x "$NFT_LOG_SCRIPT"

# Try to apply the logging rules (non-fatal if nftables not ready)
if command -v nft >/dev/null 2>&1; then
  bash "$NFT_LOG_SCRIPT" 2>/dev/null && success "nftables LOG rules installed (TLS port 443 SYN only — NFLOG)" \
    || warn "nftables LOG rules not applied (nft may not be configured yet — rules will be applied when nftables starts)"
else
  warn "nft not found — LOG rules will be applied when nftables is configured"
fi

success "IPDR network logging pipeline configured"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 18: ClickHouse IPDR Schema
# ════════════════════════════════════════════════════════════════════════════════
step 18 "ClickHouse" "Configuring IPDR database schema"

# Check if ClickHouse is available
CH_URL="http://127.0.0.1:8123"
if curl -s --max-time 5 "${CH_URL}/?query=SELECT%201" >/dev/null 2>&1; then
  info "ClickHouse detected — applying IPDR schema..."

  # Apply the IPDR schema from the project
  if [[ -f "${APP_DIR}/tools/clickhouse/schemas/ipdr_schema.sql" ]]; then
    # Read schema and execute each statement
    while IFS= read -r sql_line; do
      [[ -z "$sql_line" || "$sql_line" =~ ^-- ]] && continue
      curl -s --max-time 10 "${CH_URL}/" -d "$sql_line" >/dev/null 2>&1 || \
        warn "ClickHouse DDL warning (non-fatal): $sql_line"
    done < "${APP_DIR}/tools/clickhouse/schemas/ipdr_schema.sql"
    success "ClickHouse IPDR schema applied (2 tables: nat_log, sni_log)"
  else
    warn "IPDR schema file not found — ClickHouse tables will be auto-created by logging services"
  fi

  # Add CLICKHOUSE_URL to .env
  if ! grep -q "CLICKHOUSE_URL" "${APP_DIR}/.env" 2>/dev/null; then
    echo "CLICKHOUSE_URL=${CH_URL}" >> "${APP_DIR}/.env"
    echo "CLICKHOUSE_USER=default" >> "${APP_DIR}/.env"
    echo "CLICKHOUSE_PASSWORD=" >> "${APP_DIR}/.env"
  fi

  # Restart logging services to pick up ClickHouse
  pm2 restart conntrack-bridge sni-parser 2>/dev/null || true
  success "Logging services restarted with ClickHouse connection"
else
  warn "ClickHouse not detected at ${CH_URL}"
  info "The IPDR logging services will work in ring-buffer-only mode until ClickHouse is installed."
  info "To install ClickHouse later:"
  echo "    dnf install -y clickhouse-server clickhouse-client"
  echo "    systemctl start clickhouse-server"
  echo "    bash ${APP_DIR}/tools/clickhouse/schemas/apply-ipdr-schema.sh"
  echo ""
  info "Ring buffer (last 5000 events) will still be available for live viewing."
fi

success "IPDR database setup complete"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 19: Deployment Summary
# ════════════════════════════════════════════════════════════════════════════════
step 19 "Summary" "Deployment complete"

SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${BOLD}${GREEN}=================================================================${NC}"
echo -e "${BOLD}${GREEN}   StaySuite HospitalityOS — DEPLOYMENT COMPLETE!              ${NC}"
echo -e "${BOLD}${GREEN}=================================================================${NC}"
echo ""

echo -e "${BOLD}  APPLICATION${NC}"
echo "    URL:              http://${SERVER_IP}:3000"
echo "    App Directory:    ${APP_DIR}"
echo "    Environment:      ${APP_DIR}/.env"
echo ""

echo -e "${BOLD}  CREDENTIALS${NC}"
echo "    DB (app):         postgresql://staysuite:${DB_PASSWORD}@127.0.0.1:5432/staysuite"
echo "    DB (radius):      postgresql://radius:${DB_PASSWORD}@127.0.0.1:5432/staysuite"
echo "    NextAuth Secret:  ${APP_SECRET}"
if ! $SKIP_MIKROTIK; then
echo "    MikroTik IP:      ${MIKROTIK_IP}"
fi
if ! $SKIP_CRYPTSK; then
echo "    Cryptsk IP:       ${CRYPTSK_IP} (Multimode)"
fi
echo "    RADIUS Secret:    ${SHARED_SECRET}"
echo ""

echo -e "${BOLD}  SYSTEM SERVICES${NC}"
for svc in "postgresql-${PG_MAJOR}" radiusd; do
  STATUS=$(systemctl is-active "$svc" 2>/dev/null || echo "unknown")
  ICON="FAIL"; [[ "$STATUS" == "active" ]] && ICON=" OK "
  echo "    [${ICON}] ${svc}"
done
echo ""

echo -e "${BOLD}  PM2 SERVICES${NC}"
for svc_name in staysuite-nextjs availability-service realtime-service freeradius-service dhcp-service dns-service nftables-service captive-redirect conntrack-bridge sni-parser; do
  SVC_PID=$(pm2 pid "$svc_name" 2>/dev/null)
  ICON="FAIL"; [[ -n "$SVC_PID" ]] && ICON=" OK "
  echo "    [${ICON}] ${svc_name}"
done
echo ""

echo -e "${BOLD}  PORTS${NC}"
echo "    3000  Next.js Application"
echo "    3002  Availability Service"
echo "    3003  Realtime Service (WebSocket)"
echo "    3010  FreeRADIUS Management Service"
echo "    3011  DHCP Service (dnsmasq)"
echo "    3012  DNS Service"
echo "    3013  nftables Service"
echo "    8888  Captive Portal Redirect (HTTP 302)"
echo "    3020  Conntrack Bridge (IPDR NAT logging)"
echo "    3022  SNI Parser (IPDR TLS domain capture)"
echo "    1812  FreeRADIUS Auth (UDP)"
echo "    1813  FreeRADIUS Accounting (UDP)"
echo "    3799  FreeRADIUS CoA (UDP)"
echo ""

echo -e "${BOLD}  HEALTHCHECK${NC}"
echo "    PostgreSQL:   sudo -u postgres psql -d staysuite -c 'SELECT 1;'"
echo "    FreeRADIUS:   sudo radiusd -XC"
echo "    RADIUS Test:  echo 'User-Name=test,User-Password=test' | radclient -x 127.0.0.1 auth testing123"
echo "    PM2 Status:   pm2 status"
echo "    App Logs:     pm2 logs staysuite-nextjs --lines 50"
echo "    RADIUS Logs:  journalctl -u radiusd -f"
echo ""

echo -e "${BOLD}  LOG FILES${NC}"
echo "    Deploy Log:      ${LOG_FILE}"
echo "    App Logs:        ${APP_DIR}/logs/"
echo "    PM2 Logs:        pm2 logs"
echo "    PostgreSQL:      ${PG_DATA}/log/"
echo "    FreeRADIUS:      journalctl -u radiusd"
echo ""

echo -e "${BOLD}${YELLOW}  NEXT STEPS${NC}"
if ! $SKIP_MIKROTIK; then
echo "    1. Configure MikroTik Router for RADIUS:"
echo "       Server: ${SERVER_IP}, Auth: 1812/UDP, Acct: 1813/UDP, Secret: ${SHARED_SECRET}"
echo "    2. Log in to StaySuite and configure property, rooms, WiFi plans."
echo "    3. Test RADIUS auth: radclient -x 127.0.0.1 auth testing123"
elif ! $SKIP_CRYPTSK; then
echo "    1. Multimode active — Cryptsk gateway is the NAS (IP: ${CRYPTSK_IP})"
echo "       Cryptsk VSA (Vendor 64179) installed in FreeRADIUS dictionary"
echo "    2. Log in to StaySuite and configure property, rooms, WiFi plans."
echo "    3. Test RADIUS auth: radclient -x 127.0.0.1 auth testing123"
else
echo "    1. Log in to StaySuite and configure property, rooms, WiFi plans."
echo "    2. Add NAS clients via StaySuite AAA Configuration page"
echo "    3. Test RADIUS auth: radclient -x 127.0.0.1 auth testing123"
fi
echo ""

# ════════════════════════════════════════════════════════════════════════════════
# FINAL: Start all PM2 services (after all setup complete)
# ════════════════════════════════════════════════════════════════════════════════
echo ""
info "Starting all PM2 services..."
pm2 restart all 2>/dev/null
sleep 3
pm2 save

# Quick health check
ALL_OK=true
for svc_name in staysuite-nextjs availability-service realtime-service freeradius-service dhcp-service dns-service nftables-service captive-redirect conntrack-bridge sni-parser; do
  SVC_PID=$(pm2 pid "$svc_name" 2>/dev/null)
  if [[ -z "$SVC_PID" ]]; then
    warn "$svc_name — not running"
    ALL_OK=false
  fi
done
if $ALL_OK; then
  success "All PM2 services started successfully"
else
  warn "Some PM2 services failed — run: pm2 status"
fi
echo ""

echo -e "${BOLD}${GREEN}=================================================================${NC}"
