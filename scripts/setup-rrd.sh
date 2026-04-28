#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# RRD Production Setup Script
#
# Sets up everything needed for RRD-based system health monitoring:
#   1. Checks/installs rrdtool binary
#   2. Creates RRD data directories
#   3. Bootstraps all RRD files
#   4. Sets up cron job for data collection
#
# Usage:
#   bash scripts/setup-rrd.sh              # Full setup (interactive)
#   bash scripts/setup-rrd.sh --non-interactive  # Non-interactive mode
#   bash scripts/setup-rrd.sh --uninstall      # Remove cron + RRD files
#
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# RRD paths
RRD_BIN="${RRD_BIN_PATH:-$PROJECT_ROOT/rrdtool/bin/rrdtool}"
RRD_DATA="${RRD_DATA_PATH:-$PROJECT_ROOT/data/rrd}"
RRD_SYSTEM="$RRD_DATA/system"
CRON_SCRIPT="$SCRIPT_DIR/rrd-cron-runner.sh"
LOG_DIR="$PROJECT_ROOT/logs"
CRON_LOG="$LOG_DIR/rrd-cron.log"

NON_INTERACTIVE=false
UNINSTALL=false

# Parse args
for arg in "$@"; do
  case "$arg" in
    --non-interactive) NON_INTERACTIVE=true ;;
    --uninstall) UNINSTALL=true ;;
    --help|-h)
      echo "Usage: bash scripts/setup-rrd.sh [--non-interactive] [--uninstall]"
      exit 0
      ;;
  esac
done

# ─── Helpers ────────────────────────────────────────────────────────────────

info()  { echo -e "${BLUE}  [INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}  [OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}  [WARN]${NC} $1"; }
fail()  { echo -e "${RED}  [FAIL]${NC} $1"; }

confirm() {
  if $NON_INTERACTIVE; then return 0; fi
  read -r -p "$(echo -e "${BLUE}  [?]${NC} $1 (y/N): ")" response
  [[ "$response" =~ ^[Yy]$ ]]
}

separator() {
  echo ""
  echo "  ─────────────────────────────────────────────────────────────"
  echo ""
}

# ─── Uninstall ──────────────────────────────────────────────────────────────

if $UNINSTALL; then
  echo ""
  echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║              RRD Uninstall — Removing All Data              ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Remove cron job
  info "Removing cron job..."
  (crontab -l 2>/dev/null | grep -v "rrd-cron-runner.sh") | crontab - 2>/dev/null || true
  ok "Cron job removed"

  # Remove RRD data
  if [ -d "$RRD_DATA" ]; then
    if confirm "Delete all RRD data files in $RRD_DATA?"; then
      rm -rf "$RRD_DATA"
      ok "RRD data directory removed"
    else
      warn "RRD data directory kept"
    fi
  else
    info "No RRD data directory found"
  fi

  echo ""
  ok "Uninstall complete"
  exit 0
fi

# ─── Main Setup ─────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           RRD Production Setup — System Health              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Project Root : $PROJECT_ROOT"
echo "  rrdtool bin  : $RRD_BIN"
echo "  RRD data dir : $RRD_DATA"
echo "  Log file     : $CRON_LOG"
echo ""

# ─── Step 1: Check rrdtool ─────────────────────────────────────────────────

separator
echo -e "${BLUE}  Step 1: Check rrdtool${NC}"
echo ""

if [ -x "$RRD_BIN" ]; then
  RRD_VERSION=$("$RRD_BIN" --version 2>&1 | head -1 || echo "version unknown")
  ok "rrdtool found: $RRD_VERSION"
elif command -v rrdtool &>/dev/null; then
  RRD_BIN=$(command -v rrdtool)
  RRD_VERSION=$(rrdtool --version 2>&1 | head -1 || echo "version unknown")
  ok "System rrdtool found: $RRD_VERSION"
  warn "Using system rrdtool. Set RRD_BIN_PATH to use bundled binary."
else
  fail "rrdtool not found!"
  echo ""
  info "Install rrdtool:"
  info "  Ubuntu/Debian: sudo apt-get install rrdtool"
  info "  RHEL/CentOS:   sudo yum install rrdtool"
  info "  Alpine:        sudo apk add rrdtool"
  echo ""
  if ! confirm "Try to install rrdtool now?"; then
    exit 1
  fi

  # Detect package manager
  if command -v apt-get &>/dev/null; then
    sudo apt-get update && sudo apt-get install -y rrdtool
  elif command -v yum &>/dev/null; then
    sudo yum install -y rrdtool
  elif command -v apk &>/dev/null; then
    sudo apk add rrdtool
  else
    fail "Cannot auto-install. Please install rrdtool manually and re-run."
    exit 1
  fi

  RRD_BIN=$(command -v rrdtool)
  ok "rrdtool installed: $RRD_BIN"
fi

# ─── Step 2: Create directories ────────────────────────────────────────────

separator
echo -e "${BLUE}  Step 2: Create directories${NC}"
echo ""

mkdir -p "$RRD_SYSTEM"
mkdir -p "$LOG_DIR"
ok "Created $RRD_SYSTEM"
ok "Created $LOG_DIR"

# ─── Step 3: Initialize RRD files ─────────────────────────────────────────

separator
echo -e "${BLUE}  Step 3: Initialize RRD files${NC}"
echo ""

if command -v npx &>/dev/null; then
  cd "$PROJECT_ROOT"
  npx tsx scripts/init-rrd.ts
else
  fail "npx not found. Install Node.js first."
  exit 1
fi

# ─── Step 4: Set up cron job ───────────────────────────────────────────────

separator
echo -e "${BLUE}  Step 4: Set up cron job${NC}"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "rrd-cron-runner.sh"; then
  warn "Cron job already exists. Skipping."
  echo ""
  info "Current cron entries:"
  crontab -l 2>/dev/null | grep "rrd-cron" | sed 's/^/    /'
else
  # Make cron script executable
  chmod +x "$CRON_SCRIPT"

  # Add cron job (every minute)
  (crontab -l 2>/dev/null; echo "* * * * * cd $PROJECT_ROOT && $CRON_SCRIPT") | crontab -
  ok "Cron job installed (runs every minute)"
  echo ""
  info "Cron entry: * * * * * cd $PROJECT_ROOT && $CRON_SCRIPT"
fi

# ─── Done ──────────────────────────────────────────────────────────────────

separator
echo -e "${GREEN}  ✓ Setup Complete!${NC}"
echo ""
echo "  RRD files location: $RRD_SYSTEM"
echo "  Collector cron:     Every minute"
echo "  Cron log:           $CRON_LOG"
echo ""
echo "  Useful commands:"
echo "    npx tsx scripts/init-rrd.ts --check    # Verify RRD files"
echo "    npx tsx scripts/init-rrd.ts --force    # Recreate all RRD files"
echo "    bash scripts/setup-rrd.sh --uninstall  # Remove everything"
echo "    tail -f $CRON_LOG                     # Monitor collector"
echo ""
