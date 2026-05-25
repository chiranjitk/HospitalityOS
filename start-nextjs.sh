#!/bin/bash
# =============================================================================
# StaySuite Next.js Production Server — PM2 Wrapper
# =============================================================================
# This script is referenced by ecosystem.config.js_dont-touch.
# PM2 cannot reliably override the Rocky 10 system HOSTNAME env var
# (which resolves to an IPv6 link-local address → EINVAL crash).
# This wrapper forces HOSTNAME=0.0.0.0 before launching Next.js.
#
# Usage: PM2 manages this script — do NOT run manually in production.
# =============================================================================

set -euo pipefail

# Determine project root from this script's location (works at any path)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

# Rocky 10 fix: System HOSTNAME resolves to IPv6 link-local → EINVAL
# Next.js reads process.env.HOSTNAME to determine the listen address.
# PM2 cannot override system env vars, so we force it here.
export HOSTNAME="0.0.0.0"

# Load .env file for DATABASE_URL and other runtime vars.
# Next.js reads .env automatically, but we need DATABASE_URL in this
# shell context for any pre-start checks.
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

# Memory limit for Node.js (production — lower than dev's 4GB)
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

# Port from env or default
PORT="${PORT:-3000}"

# Graceful restart loop — restarts Next.js on crash without PM2 overhead.
# PM2's autorestart is the final safety net if this script itself dies.
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Next.js production server on port ${PORT}..."
  if npx next start -p "$PORT" 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Next.js exited cleanly — restarting in 5s..."
  else
    EXIT_CODE=$?
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Next.js crashed (exit code ${EXIT_CODE}) — restarting in 5s..."
  fi
  sleep 5
done
