#!/usr/bin/env bash
# =============================================================================
# StaySuite-HospitalityOS — PostgreSQL 17 Start Script
# =============================================================================
# Plug-and-play PostgreSQL startup. The entire runtime (binaries + data)
# lives inside the project folder. No system-level PostgreSQL required.
#
# Usage:
#   ./pgsql-runtime/start-pgsql.sh          # Start PG
#   ./pgsql-runtime/start-pgsql.sh stop     # Stop PG
#   ./pgsql-runtime/start-pgsql.sh restart  # Restart PG
#   ./pgsql-runtime/start-pgsql.sh status   # Check status
#
# Port: 5432 (default)
# Database: staysuite
# Connection: psql -h localhost -p 5432 -d staysuite
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PG_BIN="$SCRIPT_DIR/bin"
PG_DATA="$SCRIPT_DIR/data"
PG_LOG="$SCRIPT_DIR/pgsql.log"
PG_PORT="${PG_PORT:-5432}"

export PATH="$PG_BIN:$PATH"
export LD_LIBRARY_PATH="$SCRIPT_DIR/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# Create unix socket directory if it doesn't exist
mkdir -p /tmp/.s.PGSQL.${PG_PORT} 2>/dev/null || true

case "${1:-start}" in
  start)
    # Check if already running
    if pg_isready -h localhost -p "$PG_PORT" > /dev/null 2>&1; then
      echo "PostgreSQL is already running on port $PG_PORT"
      exit 0
    fi

    echo "Starting PostgreSQL 17..."
    echo "  Binaries: $PG_BIN"
    echo "  Data dir: $PG_DATA"
    echo "  Log file: $PG_LOG"
    echo "  Port:     $PG_PORT"

    "$PG_BIN/pg_ctl" -D "$PG_DATA" \
      -l "$PG_LOG" \
      -o "-p $PG_PORT -k /tmp/.s.PGSQL.${PG_PORT}" \
      start

    # Wait for ready
    for i in $(seq 1 10); do
      if pg_isready -h localhost -p "$PG_PORT" > /dev/null 2>&1; then
        echo "PostgreSQL 17 is ready on port $PG_PORT"
        echo "  Connect: psql -h localhost -p $PG_PORT -d staysuite"
        exit 0
      fi
      sleep 0.5
    done
    echo "ERROR: PostgreSQL did not start within 5 seconds. Check $PG_LOG"
    exit 1
    ;;

  stop)
    echo "Stopping PostgreSQL..."
    "$PG_BIN/pg_ctl" -D "$PG_DATA" -m fast stop 2>&1 || true
    echo "PostgreSQL stopped."
    ;;

  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;

  status)
    if pg_isready -h localhost -p "$PG_PORT" > /dev/null 2>&1; then
      echo "PostgreSQL is RUNNING on port $PG_PORT"
      psql -h localhost -p "$PG_PORT" -d staysuite -c "SELECT version();" 2>/dev/null | head -1
    else
      echo "PostgreSQL is STOPPED"
    fi
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
