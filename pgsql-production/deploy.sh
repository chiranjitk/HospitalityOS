#!/usr/bin/env bash
# ============================================================================
# StaySuite-HospitalityOS — Production Database Deployment
# ============================================================================
# Deploys the complete database schema, views, and seed data for the
# StaySuite-HospitalityOS application (PostgreSQL + FreeRADIUS + Prisma).
#
# Usage:
#   bash pgsql-production/deploy.sh [database_url]
#
# Examples:
#   bash pgsql-production/deploy.sh
#   bash pgsql-production/deploy.sh postgresql://user:pass@host:5432/dbname
#
# Prerequisites:
#   - PostgreSQL client (psql) installed and accessible
#   - Node.js + npm/npx installed
#   - Bun runtime installed
#   - Database server running and accessible
# ============================================================================

set -euo pipefail

DB_URL="${1:-postgresql://z@localhost:5432/staysuite}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "╔══════════════════════════════════════════════════╗"
echo "║  StaySuite-HospitalityOS — Database Deploy      ║"
echo "╚══════════════════════════════════════════════════╝"
echo "Database: $DB_URL"
echo "Script directory: $SCRIPT_DIR"
echo "Project directory: $PROJECT_DIR"
echo ""

# Check prerequisites
if ! command -v psql &>/dev/null; then
    echo "ERROR: psql not found. Install PostgreSQL client."
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  macOS: brew install postgresql"
    exit 1
fi

if ! command -v npx &>/dev/null; then
    echo "ERROR: npx not found. Install Node.js."
    echo "  https://nodejs.org/"
    exit 1
fi

if ! command -v bun &>/dev/null; then
    echo "ERROR: bun not found. Install Bun runtime."
    echo "  curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Verify database connectivity
echo "[0/7] Verifying database connectivity..."
if ! psql "$DB_URL" -c "SELECT 1;" &>/dev/null; then
    echo "ERROR: Cannot connect to database: $DB_URL"
    echo "  Ensure PostgreSQL is running and the URL is correct."
    exit 1
fi
echo "  ✓ Database connection verified"
echo ""

# Step 1: Push Prisma schema
echo "[1/7] Pushing Prisma schema (226 tables)..."
DATABASE_URL="$DB_URL" npx prisma db push --schema "$SCRIPT_DIR/schema.prisma" --accept-data-loss 2>&1
echo "  ✓ Prisma tables created"

# Step 2: FreeRADIUS schema
echo "[2/7] Creating FreeRADIUS tables..."
psql "$DB_URL" -f "$SCRIPT_DIR/01-freeradius-schema.sql" 2>&1
echo "  ✓ 7 FreeRADIUS tables + indexes created"

# Step 3: Custom views + helper table
echo "[3/7] Creating custom views..."
psql "$DB_URL" -f "$SCRIPT_DIR/02-staysuite-views.sql" 2>&1
echo "  ✓ 5 views + data_usage_by_period table created"

# Step 4: IP Pool functions + default pool seed
echo "[4/7] Creating IP pool functions & seeding default pool..."
psql "$DB_URL" -f "$SCRIPT_DIR/04-ip-pool-functions.sql" 2>&1
echo "  ✓ 2 IP pool functions + default pool seeded"

# Step 5: App seed
echo "[5/7] Seeding application data..."
(cd "$PROJECT_DIR" && DATABASE_URL="$DB_URL" bun run prisma/seed.ts) 2>&1
echo "  ✓ App data seeded"

# Step 6: WiFi module seed
echo "[6/7] Seeding WiFi module data..."
(cd "$PROJECT_DIR" && DATABASE_URL="$DB_URL" bun run prisma/wifi-seed.ts) 2>&1
echo "  ✓ WiFi data seeded"

# Step 7: FreeRADIUS native seed
echo "[7/7] Seeding FreeRADIUS native tables..."
psql "$DB_URL" -f "$SCRIPT_DIR/03-radius-seed.sql" 2>&1
echo "  ✓ RADIUS seed data inserted"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo ""
echo "  Test logins:"
echo "    admin@royalstay.in / admin123"
echo "    frontdesk@royalstay.in / staff123"
echo "    platform@staysuite.com / admin123"
echo ""
echo "  Test RADIUS:"
echo "    radtest guest.amit.mukherjee Welcome@123 localhost 1812 testing123"
echo "═══════════════════════════════════════════════════"
