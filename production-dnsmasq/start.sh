#!/bin/bash
# ============================================================
# StaySuite dnsmasq Dev Server — Start Script
# ============================================================
# Starts the locally-compiled dnsmasq 2.90 with dev config.
# Uses port 5353 (no root needed) for DNS testing.
# DHCP config syntax is validated but not served (sandbox).
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DNSMASQ_BIN="$SCRIPT_DIR/src/dnsmasq"
DEV_CONF="$SCRIPT_DIR/etc/dnsmasq-dev.conf"
PROD_CONF="$SCRIPT_DIR/etc/dnsmasq.conf"
LOG_DIR="$SCRIPT_DIR/logs"
PID_FILE="$SCRIPT_DIR/run/dnsmasq.pid"
PID=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "$LOG_DIR" "$SCRIPT_DIR/run"

# Check if already running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo -e "${YELLOW}dnsmasq is already running (PID=$PID)${NC}"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

# Check binary exists
if [ ! -x "$DNSMASQ_BIN" ]; then
  echo -e "${RED}ERROR: dnsmasq binary not found at $DNSMASQ_BIN${NC}"
  echo "Run: cd production-dnsmasq && make -C src"
  exit 1
fi

# Validate full config syntax (DHCP + DNS)
echo -e "${YELLOW}Validating config syntax...${NC}"
if ! $DNSMASQ_BIN -C "$PROD_CONF" --test 2>&1; then
  echo -e "${RED}Config syntax error! Fix configs in dhcp-local/ and dns-local/${NC}"
  exit 1
fi
echo -e "${GREEN}Config syntax OK${NC}"

# Also validate dev config
if ! $DNSMASQ_BIN -C "$DEV_CONF" --test 2>&1; then
  echo -e "${RED}Dev config syntax error!${NC}"
  exit 1
fi

# Start dnsmasq
echo -e "${YELLOW}Starting dnsmasq 2.90 on port 5353...${NC}"
setsid $DNSMASQ_BIN \
  -C "$DEV_CONF" \
  --keep-in-foreground \
  > "$LOG_DIR/dnsmasq-stdout.log" 2>&1 &

sleep 2

# Get actual PID
ACTUAL_PID=$(pgrep -f "production-dnsmasq/src/dnsmasq" | head -1)
if [ -z "$ACTUAL_PID" ]; then
  echo -e "${RED}Failed to start dnsmasq. Check logs:${NC}"
  cat "$LOG_DIR/dnsmasq.log" 2>/dev/null | tail -10
  exit 1
fi

echo $ACTUAL_PID > "$PID_FILE"
echo -e "${GREEN}dnsmasq 2.90 started (PID=$ACTUAL_PID)${NC}"
echo -e "  Config:  $DEV_CONF"
echo -e "  DNS:     127.0.0.1:5353"
echo -e "  DHCP:    Config validated (not served — sandbox)"
echo -e "  Logs:    $LOG_DIR/dnsmasq.log"
echo ""
echo -e "  Test: ${YELLOW}dig @127.0.0.1 -p 5353 portal.staysuite.local +short${NC}"
