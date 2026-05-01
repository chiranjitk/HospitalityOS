#!/usr/bin/env bash
# ============================================================================
# StaySuite-HospitalityOS — Full Production Deploy
# ============================================================================
# Includes RADIUS seed data (radcheck, radgroupreply, nas, etc.)
# Use setup.sh for a simpler fresh setup.
#
# USAGE:
#   cd StaySuite-HospitalityOS
#   bash pgsql-production/deploy.sh
#
# PREREQUISITES:
#   - PostgreSQL 17+ running
#   - Database created: CREATE DATABASE staysuite;
#   - Node.js + Bun installed
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PSQL=""
if [ -x "$PROJECT_DIR/pgsql-runtime/bin/psql" ]; then
    PSQL="$PROJECT_DIR/pgsql-runtime/bin/psql"
elif command -v psql &>/dev/null; then
    PSQL="psql"
else
    echo "ERROR: psql not found."
    exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-staysuite}"
DB_USER="${DB_USER:-z}"
DB_PASS="${DB_PASS:-postgres}"

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

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
echo "║  StaySuite-HospitalityOS — Full Production Deploy        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "[1/4] Ensuring citext extension..."
$PSQL $DB_CONN -c "CREATE EXTENSION IF NOT EXISTS citext;" 2>&1 | grep -v NOTICE || true

echo "[2/4] Pushing Prisma schema..."
cd "$PROJECT_DIR"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  node "$PROJECT_DIR/node_modules/prisma/build/index.js" db push \
  --schema="$SCHEMA_PATH" --skip-generate --accept-data-loss 2>&1

echo "[3/4] Creating database structure..."
$PSQL $DB_CONN -f "$SCRIPT_DIR/complete-database.sql" 2>&1 | grep -v NOTICE

# nftables-service tables (firewall mini-service DB storage)
echo "[3b/4] Creating nftables-service tables..."
if [[ -f "$SCRIPT_DIR/nftables-service-tables.sql" ]]; then
    $PSQL $DB_CONN -f "$SCRIPT_DIR/nftables-service-tables.sql" 2>&1 | grep -v NOTICE
    echo "  OK nftables-service tables (NftGuiRule, NftPortForward, NftRateLimit, NftQuickBlock, NftSchedule)"
fi

echo "[4/4] Seeding demo data..."
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  npx tsx prisma/seed.ts 2>&1

echo ""
echo "Deploy complete! Test: admin@royalstay.in / admin123"
