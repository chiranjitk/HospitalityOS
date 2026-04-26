#!/usr/bin/env bash
# =============================================================================
# StaySuite-HospitalityOS — One-Click Setup & Start
# =============================================================================
# This script sets up the entire environment and starts both PostgreSQL and
# the Next.js application. Designed for plug-and-play after git clone.
#
# Usage:
#   ./setup.sh              # Full setup + start everything
#   ./setup.sh --start     # Only start (skip install)
#   ./setup.sh --stop      # Stop everything
#
# Prerequisites: bun, node, npm (pm2 installed automatically)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo "========================================"
echo "  StaySuite-HospitalityOS"
echo "  Plug-and-Play Setup"
echo "========================================"
echo ""

# ---- Step 0: Start only (skip install) ----
if [ "${1:-}" = "--start" ]; then
  log_info "Starting services (skip install)..."
  bash "$PROJECT_DIR/pgsql-runtime/start-pgsql.sh" start

  log_info "Starting Next.js with PM2..."
  cd "$PROJECT_DIR"
  pm2 delete staysuite-nextjs 2>/dev/null || true
  export PATH="$PROJECT_DIR/pgsql-runtime/bin:$PATH"
  export LD_LIBRARY_PATH="$PROJECT_DIR/pgsql-runtime/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  pm2 start ecosystem.main-only.config.js
  pm2 save
  echo ""
  log_ok "Next.js running: http://localhost:3000"
  log_ok "Admin login: admin@royalstay.in / admin123"
  echo ""
  pm2 list
  exit 0
fi

if [ "${1:-}" = "--stop" ]; then
  log_info "Stopping all services..."
  cd "$PROJECT_DIR"
  pm2 delete staysuite-nextjs 2>/dev/null || true
  bash "$PROJECT_DIR/pgsql-runtime/start-pgsql.sh" stop
  log_ok "All services stopped."
  exit 0
fi

# ---- Step 1: Check prerequisites ----
log_info "Checking prerequisites..."

if ! command -v bun &>/dev/null; then
  log_error "bun not found. Install: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
log_ok "bun $(bun --version)"

if ! command -v node &>/dev/null; then
  log_error "node not found."
  exit 1
fi
log_ok "node $(node --version)"

if ! command -v npx &>/dev/null; then
  log_error "npx not found."
  exit 1
fi

# Install pm2 if not present
if ! command -v pm2 &>/dev/null; then
  log_info "Installing pm2 globally..."
  npm install -g pm2
  log_ok "pm2 installed"
else
  log_ok "pm2 $(pm2 --version 2>/dev/null | head -1)"
fi

# ---- Step 2: Install npm dependencies ----
log_info "Installing project dependencies..."
cd "$PROJECT_DIR"
bun install
log_ok "Dependencies installed"

# ---- Step 3: Generate Prisma client ----
log_info "Generating Prisma client..."
export PATH="$PROJECT_DIR/pgsql-runtime/bin:$PATH"
export LD_LIBRARY_PATH="$PROJECT_DIR/pgsql-runtime/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
DATABASE_URL="postgresql://z@localhost:5432/staysuite" bunx prisma generate
log_ok "Prisma client generated"

# ---- Step 4: Start PostgreSQL ----
log_info "Starting PostgreSQL 17..."
bash "$PROJECT_DIR/pgsql-runtime/start-pgsql.sh" start

# Wait for database to be ready
for i in $(seq 1 10); do
  if "$PROJECT_DIR/pgsql-runtime/bin/pg_isready" -h localhost -p 5432 > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# ---- Step 5: Verify database ----
log_info "Verifying database..."
TABLE_COUNT=$("$PROJECT_DIR/pgsql-runtime/bin/psql" -h localhost -p 5432 -d staysuite -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")
if [ "$TABLE_COUNT" -lt 100 ]; then
  log_warn "Database appears empty ($TABLE_COUNT tables). Running schema push..."
  DATABASE_URL="postgresql://z@localhost:5432/staysuite" bunx prisma db push --accept-data-loss
fi
log_ok "Database ready ($TABLE_COUNT tables)"

# ---- Step 6: Start Next.js ----
log_info "Starting Next.js with PM2..."
pm2 delete staysuite-nextjs 2>/dev/null || true
pm2 start ecosystem.main-only.config.js
pm2 save

echo ""
echo "========================================"
log_ok  "Setup complete!"
echo "========================================"
echo ""
log_ok  "PostgreSQL: Running on port 5432"
log_ok  "Next.js:     http://localhost:3000"
echo ""
log_info "Login credentials:"
echo "  Admin:      admin@royalstay.in / admin123"
echo "  Front Desk: frontdesk@royalstay.in / staff123"
echo "  Platform:   platform@staysuite.com / admin123"
echo ""
pm2 list
