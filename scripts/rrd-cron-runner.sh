#!/bin/bash
# RRD collector cron runner — called by crontab every minute
# Collects: user bandwidth, interface bandwidth, and system health RRDs

# Determine project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$PROJECT_ROOT"

export LD_LIBRARY_PATH="${PROJECT_ROOT}/rrdtool/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export RRD_BIN_PATH="${PROJECT_ROOT}/rrdtool/bin/rrdtool"
export RRD_LIB_PATH="${PROJECT_ROOT}/rrdtool/lib"
export RRD_DATA_PATH="${PROJECT_ROOT}/data/rrd"

# Ensure log directory exists
mkdir -p "${PROJECT_ROOT}/logs"

# Resolve bun path — cron runs with a minimal PATH that doesn't include
# ~/.bun/bin, so we must locate bun explicitly.
BUN_BIN="$(command -v bun 2>/dev/null || true)"
if [ -z "$BUN_BIN" ] && [ -x "$HOME/.bun/bin/bun" ]; then
  BUN_BIN="$HOME/.bun/bin/bun"
elif [ -z "$BUN_BIN" ] && [ -x "/root/.bun/bin/bun" ]; then
  BUN_BIN="/root/.bun/bin/bun"
fi
if [ -z "$BUN_BIN" ] && [ -x "/usr/local/bin/bun" ]; then
  BUN_BIN="/usr/local/bin/bun"
fi
if [ -z "$BUN_BIN" ]; then
  echo "[$(date -Iseconds)] ERROR: bun not found. Install bun or add it to PATH." >> "${PROJECT_ROOT}/logs/rrd-cron.log"
  exit 1
fi

exec "$BUN_BIN" run src/lib/rrd/collector-cron.ts >> "${PROJECT_ROOT}/logs/rrd-cron.log" 2>&1
