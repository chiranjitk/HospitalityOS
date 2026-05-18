#!/usr/bin/env bash
# =============================================================================
# StaySuite HospitalityOS - Next.js Production Server Wrapper
# =============================================================================
# On Rocky Linux 10, the OS sets HOSTNAME to the machine hostname which may
# DNS-resolve to an IPv6 link-local address (fe80::...). Node.js
# server.listen() with a link-local IPv6 address fails with EINVAL because
# link-local IPv6 requires a zone/scope ID (e.g., fe80::1%eth0).
#
# Next.js `next start` reads process.env.HOSTNAME to determine the listen
# address. PM2 cannot reliably override the system HOSTNAME env var.
#
# This wrapper explicitly sets HOSTNAME=0.0.0.0 before launching the server,
# ensuring it listens on all IPv4 interfaces.
#
# NOTE: We use `npx next start` (NOT standalone mode). Standalone mode
# (`output: "standalone"` in next.config) was removed because it caused
# excessive memory usage (5-6GB) during build and is not needed for
# single-server deployments.
#
# Usage:
#   chmod +x start-nextjs.sh
#   ./start-nextjs.sh
#
# With PM2 (see ecosystem.config.js):
#   pm2 start ecosystem.config.js
# =============================================================================

set -e

# Force listen address to all IPv4 interfaces
export HOSTNAME='0.0.0.0'

# Determine the directory where this script lives (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The standalone server must be run from the project root (DEPLOY_DIR)
# because it uses relative paths for .next/standalone/ assets
cd "$SCRIPT_DIR"

# RRD paths — must be set explicitly because __dirname is unreliable
# in Next.js standalone compiled code (gets compiled to source path
# which doesn't exist on production servers).
export RRD_BIN_PATH="${SCRIPT_DIR}/rrdtool/bin/rrdtool"
export RRD_LIB_PATH="${SCRIPT_DIR}/rrdtool/lib"
export RRD_DATA_PATH="${SCRIPT_DIR}/data/rrd"
export LD_LIBRARY_PATH="${RRD_LIB_PATH}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

# exec replaces this bash process with next start — PM2 keeps tracking the same PID
exec npx next start -p ${PORT:-3000} "$@"
