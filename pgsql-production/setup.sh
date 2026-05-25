#!/usr/bin/env bash
# ============================================================================
# StaySuite-HospitalityOS — One-Shot Fresh Database Setup
# ============================================================================
# Replaces ALL 8+ SQL files with a single command.
#
# USAGE (fresh setup):
#   cd StaySuite-HospitalityOS
#   bash pgsql-production/setup.sh
#
# WHAT IT DOES:
#   0. Create citext extension (required before prisma push)
#   1. prisma db push          → Creates all ~231 Prisma-managed tables
#   2. prisma generate          → Generates Prisma Client
#   3. complete-database.sql    → Creates extensions, 4 helper tables,
#                                  6 views, 8 functions, + ALTER TABLE columns
#   4. Seed demo data           → Inserts ALL demo data
#
# PREREQUISITES:
#   - PostgreSQL 17+ running
#   - Database created: CREATE DATABASE staysuite;
#   - Node.js dependencies installed (bun install)
#
# SAFE TO RE-RUN: Yes — views are dropped/recreated, functions are replaced.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Find psql binary (bundled in pgsql-runtime/)
PSQL=""
if [ -x "$PROJECT_DIR/pgsql-runtime/bin/psql" ]; then
    PSQL="$PROJECT_DIR/pgsql-runtime/bin/psql"
elif command -v psql &>/dev/null; then
    PSQL="psql"
else
    echo "ERROR: psql not found. Install PostgreSQL client or use the bundled pgsql-runtime."
    exit 1
fi

# Connection defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-staysuite}"
DB_USER="${DB_USER:-z}"
DB_PASS="${DB_PASS:-postgres}"

# Override from .env if exists
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

# Parse DATABASE_URL if set
if [ -n "${DATABASE_URL:-}" ]; then
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|^postgresql://\([^:]*\):.\{0,\}@\([^:]*\):\{0,\}\([0-9]*\)/\(.*\)$|\1|p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|^postgresql://[^:]*:\([^@]*\)@.*$|\1|p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|^postgresql://[^@]*@\([^:]*\).*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|^postgresql://[^@]*@\([^:]*\):\([0-9]*\)/.*$|\2|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|^postgresql://.*/\([^?]*\).*|\1|p')
fi

export PGPASSWORD="$DB_PASS"
DB_CONN="-h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
SCHEMA_PATH="$PROJECT_DIR/prisma/schema.prisma"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  StaySuite-HospitalityOS — Database Setup (Fresh)        ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  DB: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Verify connectivity
echo "[0/5] Verifying database connectivity..."
if ! $PSQL $DB_CONN -c "SELECT 1;" &>/dev/null; then
    echo "  ERROR: Cannot connect to database."
    echo "  Ensure PostgreSQL is running and credentials are correct."
    exit 1
fi
echo "  OK Database connection verified"
echo ""

# Step 0: Create citext extension (must exist BEFORE prisma push)
echo "[0/5] Ensuring citext extension exists..."
$PSQL $DB_CONN -c "CREATE EXTENSION IF NOT EXISTS citext;" 2>&1 | grep -v NOTICE || true
echo "  OK citext extension ready"
echo ""

# Step 1: Prisma schema push (use absolute --schema path to avoid parent dir SQLite schema)
echo "[1/5] Pushing Prisma schema (~231 tables)..."
cd "$PROJECT_DIR"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  node "$PROJECT_DIR/node_modules/prisma/build/index.js" db push \
  --schema="$SCHEMA_PATH" \
  --skip-generate \
  --accept-data-loss 2>&1
echo "  OK Prisma tables created"
echo ""

# Step 2: Generate Prisma client
echo "[2/5] Generating Prisma client..."
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  node "$PROJECT_DIR/node_modules/prisma/build/index.js" generate \
  --schema="$SCHEMA_PATH" 2>&1
echo "  OK Prisma client generated"
echo ""

# Step 3: Extensions + helper tables + views + functions
echo "[3/5] Creating extensions, tables, views, functions..."
$PSQL $DB_CONN -f "$SCRIPT_DIR/complete-database.sql" 2>&1 | grep -v "^$" | grep -v NOTICE
echo "  OK Structure created:"
echo "       - 4 helper tables  (nas, nasreload, data_usage_by_period, fup_switch_log)"
echo "       - 6 views          (v_session_history, v_active_sessions, v_auth_logs,"
echo "                           v_user_usage, v_wifi_users, v_fup_switch_logs)"
echo "       - 8 functions      (fn_check_ip_pool, fn_get_user_pool_info,"
echo "                           fn_get_pool_attr, fn_check_fup, fn_check_login_limit,"
echo "                           fn_get_effective_bandwidth, fn_get_mikrotik_rate_limit,"
echo "                           fn_is_fup_throttled)"
echo "       - ALTER TABLE      (radpostauth.clientipaddress,"
echo "                           FairAccessPolicy.throttleDownKbps/throttleUpKbps)"
echo ""

# Step 3b: (removed — nftables tables are managed by the mini-service)

# Step 4: Seed demo data
echo "[4/5] Seeding demo data..."
cd "$PROJECT_DIR"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  npx tsx prisma/seed.ts 2>&1
echo "  OK Demo data seeded"
echo ""

# Step 5: Verify
echo "[5/5] Verifying..."
VIEW_COUNT=$($PSQL $DB_CONN -t -c "SELECT count(*) FROM pg_views WHERE schemaname='public';")
FUNC_COUNT=$($PSQL $DB_CONN -t -c "SELECT count(*) FROM information_schema.routines WHERE routine_schema='public' AND routine_name LIKE 'fn_%';")
TABLE_COUNT=$($PSQL $DB_CONN -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "  OK Tables: $TABLE_COUNT | Views: $VIEW_COUNT | Functions: $FUNC_COUNT"
echo ""

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Setup complete!                                         ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Test logins:                                            ║"
echo "║    admin@royalstay.in   / admin123                       ║"
echo "║    frontdesk@royalstay.in / staff123                     ║"
echo "╚══════════════════════════════════════════════════════════╝"
