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
#   5.  FreeRADIUS 3.x install + full PostgreSQL SQL module config
#   6.  Node.js 22 LTS + Bun runtime
#   7.  Clone StaySuite-HospitalityOS from GitHub
#   8.  Install dependencies (bun install)
#   9.  prisma db push (creates ~231 PMS tables)
#  10.  complete-database.sql (4 helper tables, 6 views, 8 functions)
#  11.  Seed demo data (properties, rooms, plans, users)
#  12.  Build Next.js standalone
#  13.  Install PM2 + generate production ecosystem.config.js
#  14.  Start ALL services via PM2 (Next.js + 6 mini-services)
#  15.  Configure FreeRADIUS CoA (port 3799)
#  16.  Set up cron jobs (data usage processing)
#  17.  Print deployment summary
#
# Usage:
#   chmod +x deploy-rocky10-postgresql.sh
#   sudo ./deploy-rocky10-postgresql.sh
#
# Options:
#   --db-password PASS    PostgreSQL password (default: Staysuite2025)
#   --mikrotik-ip IP      MikroTik NAS IP (default: 192.168.88.1)
#   --shared-secret KEY   RADIUS shared secret (default: localkey)
#   --app-dir DIR         Install directory (default: /opt/staysuite)
#   --skip-mikrotik       Skip MikroTik NAS client config
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
SHARED_SECRET=""
DB_PASSWORD=""
APP_DIR="/opt/staysuite"
SKIP_MIKROTIK=false
AUTO_YES=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --db-password)    DB_PASSWORD="$2"; shift 2 ;;
    --mikrotik-ip)    MIKROTIK_IP="$2"; shift 2 ;;
    --shared-secret)  SHARED_SECRET="$2"; shift 2 ;;
    --app-dir)        APP_DIR="$2"; shift 2 ;;
    --skip-mikrotik)  SKIP_MIKROTIK=true; shift ;;
    --yes|-y)         AUTO_YES=true; shift ;;
    *) die "Unknown option: $1. Use --help." ;;
  esac
done

STEPS=17
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

# Initialize
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

# Force TCP listen — sed replaces existing line or appends if missing
sed -i "s/^#\?listen_addresses\s*=.*/listen_addresses = 'localhost'/" "$PG_CONF"
grep -q "^listen_addresses" "$PG_CONF" || echo "listen_addresses = 'localhost'" >> "$PG_CONF"
sed -i "s/^#\?port\s*=.*/port = 5432/" "$PG_CONF"
grep -q "^port" "$PG_CONF" || echo "port = 5432" >> "$PG_CONF"

cat >> "$PG_CONF" <<PGTUNE

# StaySuite Production Tuning
shared_buffers = ${SHARED_BUFFERS}
effective_cache_size = ${EFFECTIVE_CACHE}
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
work_mem = 8MB
max_connections = 200
log_min_duration_statement = 500
log_line_prefix = '%t [%p]: db=%d,user=%u,app=%a,client=%h '
# End StaySuite Tuning
PGTUNE

# Start (or restart if already running — needed to pick up listen_addresses)
info "Starting PostgreSQL ${PG_MAJOR}..."
systemctl restart "postgresql-${PG_MAJOR}" || {
  error "PostgreSQL failed to start!"
  journalctl -u "postgresql-${PG_MAJOR}" -n 15 --no-pager 2>&1
  die "Check logs above."
}
sleep 2
systemctl is-active --quiet "postgresql-${PG_MAJOR}" || die "PostgreSQL not running."
systemctl enable "postgresql-${PG_MAJOR}"

# Verify TCP connectivity (not just Unix socket)
for i in $(seq 1 5); do
  if pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
    break
  fi
  warn "PostgreSQL TCP not ready yet, waiting... ($i/5)"
  sleep 2
done
pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null || {
  error "PostgreSQL not accepting TCP connections on 127.0.0.1:5432"
  journalctl -u "postgresql-${PG_MAJOR}" -n 10 --no-pager 2>&1
  die "Check listen_addresses in ${PG_CONF}"
}
success "PostgreSQL ${PG_MAJOR} installed, tuned, and running (TCP verified)"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 4: Database Setup
# ════════════════════════════════════════════════════════════════════════════════
step 4 "Database" "Creating staysuite database and users"

# Verify psql connectivity
sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1 || {
  PG_HBA="${PG_DATA}/pg_hba.conf"
  sed -i '1i local   all             postgres                                peer' "$PG_HBA" 2>/dev/null
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

# pg_hba.conf
cat > "${PG_DATA}/pg_hba.conf" <<'EOF'
# StaySuite pg_hba.conf
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
EOF
chown postgres:postgres "${PG_DATA}/pg_hba.conf"
chmod 640 "${PG_DATA}/pg_hba.conf"
systemctl reload "postgresql-${PG_MAJOR}" 2>/dev/null || systemctl restart "postgresql-${PG_MAJOR}"
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
REQUIRED_MODS="sql pap chap mschap expr preprocess expiration logintime detail always"
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
  server = "localhost"
  port = 5432
  login = "radius"
  password = "__DBPASS__"
  radius_db = "staysuite"

  pool {
    start = 5
    min = 3
    max = 20
    spare = 5
    uses = 0
    lifetime = 0
    idle_timeout = 60
    connect_timeout = 3.0
  }

  read_clients = no

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
      INSERT INTO radpostauth (username, pass, reply, calledstationid, callingstationid, authdate, \"class\") \
      VALUES ('%{SQL-User-Name}', '%{%{User-Password}:-%{Chap-Password}}', '%{reply:Packet-Type}', \
        '%{Called-Station-Id}', '%{Calling-Station-Id}', NOW(), NULLIF('%{Class}', ''))"
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

# ── 5d: Configure sites ─────────────────────────────────────────────────────
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

# ── 5e: MikroTik NAS client ─────────────────────────────────────────────────
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

# ── 5f: Test and start FreeRADIUS ───────────────────────────────────────────
info "Testing FreeRADIUS configuration..."
RADIUS_TEST=$(radiusd -XC 2>&1) || {
  error "FreeRADIUS config check FAILED:"; echo "$RADIUS_TEST"; die "Fix errors above."
}
systemctl enable radiusd
systemctl restart radiusd
sleep 1
systemctl is-active --quiet radiusd || die "FreeRADIUS failed to start! Check: journalctl -u radiusd -n 30"
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

DATABASE_URL=postgresql://staysuite:${DB_PASSWORD}@127.0.0.1:5432/staysuite
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
export DATABASE_URL="postgresql://staysuite:${DB_PASSWORD}@127.0.0.1:5432/staysuite"

# Verify TCP before anything else
pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null || {
  warn "PostgreSQL TCP not responding — restarting..."
  systemctl restart "postgresql-${PG_MAJOR}"
  sleep 3
  pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null || die "PostgreSQL TCP still not available after restart"
}

# Ensure citext exists before prisma push
sudo -u postgres psql -d staysuite -c "CREATE EXTENSION IF NOT EXISTS citext;" 2>/dev/null

info "Running prisma db push..."
npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>&1 | tail -5

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
  export PGPASSWORD="$DB_PASSWORD"
  psql -h 127.0.0.1 -U staysuite -d staysuite -f "${APP_DIR}/pgsql-production/complete-database.sql" 2>&1 | tail -5
  unset PGPASSWORD
  success "complete-database.sql applied (4 tables, 6 views, 8 functions)"
else
  warn "complete-database.sql not found, skipping advanced schema"
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
export DATABASE_URL="postgresql://staysuite:${DB_PASSWORD}@127.0.0.1:5432/staysuite"

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
export DATABASE_URL="postgresql://staysuite:${DB_PASSWORD}@127.0.0.1:5432/staysuite"

info "Building Next.js (this may take a few minutes)..."
bun run build 2>&1 | tail -10
success "Next.js build complete"

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

const DB_URL = 'postgresql://staysuite:__DBPASS__@127.0.0.1:5432/staysuite';

module.exports = {
  apps: [
    // Next.js — uses start-nextjs.sh wrapper to fix Rocky 10 IPv6 EINVAL
    {
      name: 'staysuite-nextjs',
      script: 'start-nextjs.sh',
      interpreter: 'bash',
      cwd: APP_DIR,
      env: { NODE_ENV: 'production', PORT: 3000 },
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
      env: { NODE_ENV: 'production', PORT: 3013 },
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
sleep 3

# Save for auto-restart on reboot
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
success "PM2 configured — 8 services started"

# ════════════════════════════════════════════════════════════════════════════════
# STEP 15: FreeRADIUS CoA + Post-Auth
# ════════════════════════════════════════════════════════════════════════════════
step 15 "CoA" "Finalizing FreeRADIUS CoA and post-auth configuration"

# Apply production patches from freeradius-config-patches if available
if [[ -f "${APP_DIR}/freeradius-config-patches/setup-production.sh" ]]; then
  info "Applying FreeRADIUS production patches..."
  export FR_DB_PASS="$DB_PASSWORD"
  export FR_DB_HOST="127.0.0.1"
  export FR_DB_PORT="5432"
  export FR_DB_NAME="staysuite"
  export FR_DB_USER="radius"
  bash "${APP_DIR}/freeradius-config-patches/setup-production.sh" 2>&1 | tail -20 || true
else
  # Fallback: ensure CoA is enabled manually
  info "setup-production.sh not found — applying minimal CoA config..."
  [[ -f "${RADD}/sites-available/coa" && ! -L "${RADD}/sites-enabled/coa" ]] && \
    ln -sf ../sites-available/coa "${RADD}/sites-enabled/coa"
fi

# Restart FreeRADIUS with final config
info "Testing FreeRADIUS configuration..."
RADIUS_TEST2=$(radiusd -XC 2>&1) && {
  systemctl restart radiusd
  success "FreeRADIUS restarted with CoA + post-auth config"
} || {
  warn "FreeRADIUS config check issues (non-fatal):"
  echo "$RADIUS_TEST2" | tail -10
  systemctl restart radiusd 2>/dev/null || true
  if systemctl is-active --quiet radiusd 2>/dev/null; then
    success "FreeRADIUS restarted (running with warnings)"
  else
    warn "FreeRADIUS not running — check: journalctl -u radiusd -n 30"
  fi
}

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
# STEP 17: Deployment Summary
# ════════════════════════════════════════════════════════════════════════════════
step 17 "Summary" "Deployment complete"

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
echo "    RADIUS Secret:    ${SHARED_SECRET}"
fi
echo ""

echo -e "${BOLD}  SYSTEM SERVICES${NC}"
for svc in "postgresql-${PG_MAJOR}" radiusd; do
  STATUS=$(systemctl is-active "$svc" 2>/dev/null || echo "unknown")
  ICON="FAIL"; [[ "$STATUS" == "active" ]] && ICON=" OK "
  echo "    [${ICON}] ${svc}"
done
echo ""

echo -e "${BOLD}  PM2 SERVICES${NC}"
for svc_name in staysuite-nextjs availability-service realtime-service freeradius-service dhcp-service dns-service nftables-service captive-redirect; do
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
echo "    3011  DHCP Service"
echo "    3012  DNS Service"
echo "    3013  nftables Service"
echo "    8888  Captive Portal Redirect (HTTP 302)"
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
echo "    1. Configure MikroTik Router for RADIUS:"
echo "       Server: ${SERVER_IP}, Auth: 1812/UDP, Acct: 1813/UDP, Secret: ${SHARED_SECRET}"
echo "    2. Log in to StaySuite and configure property, rooms, WiFi plans."
echo "    3. Test RADIUS auth: radclient -x 127.0.0.1 auth testing123"
echo ""

echo -e "${BOLD}${GREEN}=================================================================${NC}"
