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

exec bun run src/lib/rrd/collector-cron.ts >> "${PROJECT_ROOT}/logs/rrd-cron.log" 2>&1
