#!/usr/bin/env bash
# ============================================================================
# StaySuite-HospitalityOS — FreeRADIUS Server Start Script
# ============================================================================
# Starts FreeRADIUS v3.2.7 in debug mode (foreground).
# FreeRADIUS talks DIRECTLY to PostgreSQL — no mini-service needed.
#
# Usage:
#   ./start-freeradius.sh          # Start in debug mode (foreground)
#   ./start-freeradius.sh -d       # Start as daemon
#   ./start-freeradius.sh stop     # Stop daemon
#   ./start-freeradius.sh status   # Check status
#   ./start-freeradius.sh test     # Test config
# ============================================================================

set -e

# Auto-detect project root (this script lives in project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FREERADIUS_HOME="$SCRIPT_DIR/freeradius-install"
TALLOC_HOME="/home/z/talloc-install"
export LD_LIBRARY_PATH="$TALLOC_HOME/lib:$FREERADIUS_HOME/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PATH="$FREERADIUS_HOME/sbin:$FREERADIUS_HOME/bin:$PATH"

RADDB="$FREERADIUS_HOME/etc/raddb"
RADPID="$FREERADIUS_HOME/var/run/radiusd/radiusd.pid"
RADLOG="$FREERADIUS_HOME/var/log/radiusd/radius.log"

case "${1:-start}" in
  start)
    echo "Starting FreeRADIUS v3.2.7..."
    echo "  Config: $RADDB"
    echo "  Log:   $RADLOG"
    echo "  DB:    staysuite (PostgreSQL)"
    echo ""
    $FREERADIUS_HOME/sbin/radiusd -f -d "$RADDB" -D "$FREERADIUS_HOME/share/freeradius" -l "$RADLOG" &
    echo "  PID: $!"
    sleep 2
    if kill -0 $! 2>/dev/null; then
      echo "  ✓ FreeRADIUS started successfully"
    else
      echo "  ✗ FreeRADIUS failed to start"
      exit 1
    fi
    ;;
  -d|daemon)
    echo "Starting FreeRADIUS as daemon..."
    $FREERADIUS_HOME/sbin/radiusd -d "$RADDB" -D "$FREERADIUS_HOME/share/freeradius" -l "$RADLOG"
    sleep 2
    if [ -f "$RADPID" ]; then
      echo "  ✓ FreeRADIUS started (PID: $(cat $RADPID))"
    else
      echo "  ✗ Failed to start"
      exit 1
    fi
    ;;
  stop)
    if [ -f "$RADPID" ]; then
      PID=$(cat "$RADPID")
      echo "Stopping FreeRADIUS (PID: $PID)..."
      kill "$PID" 2>/dev/null || true
      sleep 1
      rm -f "$RADPID"
      echo "  ✓ Stopped"
    else
      echo "FreeRADIUS is not running (no PID file)"
    fi
    ;;
  restart)
    $0 stop
    sleep 1
    $0 "${2:-start}"
    ;;
  status)
    if kill -0 $(cat "$RADPID" 2>/dev/null) 2>/dev/null; then
      echo "FreeRADIUS is RUNNING (PID: $(cat $RADPID))"
    else
      echo "FreeRADIUS is STOPPED"
    fi
    ;;
  test|check)
    echo "Testing configuration..."
    $FREERADIUS_HOME/sbin/radiusd -XC -d "$RADDB" -D "$FREERADIUS_HOME/share/freeradius" 2>&1 | tail -5
    ;;
  *)
    echo "Usage: $0 {start|-d|stop|restart|status|test}"
    exit 1
    ;;
esac
