#!/bin/bash
# ============================================================
# StaySuite dnsmasq Dev Server — Stop Script
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/run/dnsmasq.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
    echo "dnsmasq stopped (was PID=$PID)"
  else
    echo "dnsmasq was not running (stale PID file)"
  fi
  rm -f "$PID_FILE"
else
  # Try to find and kill by process name
  pkill -f "production-dnsmasq/src/dnsmasq" 2>/dev/null && echo "dnsmasq killed" || echo "dnsmasq not running"
fi
