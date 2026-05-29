#!/bin/bash
# StaySuite Next.js Dev Server
# NOTE: Do NOT clear .next/cache — the cache preserves compiled pages
# and avoids re-compilation which uses 4-5GB RAM via Turbopack.
export NODE_OPTIONS="--max-old-space-size=4096"
export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30"
export NEXTAUTH_SECRET="dev-secret-key-staysuite-2025-sandbox"
export NEXTAUTH_URL="http://localhost:3000"
cd /home/z/my-project

# Start Next.js dev server in background
node --max-old-space-size=4096 node_modules/.bin/next dev -p 3000 &
SERVER_PID=$!

# Pre-warm Turbopack compilation — trigger compilation of the most common routes
# before any user request arrives. This eliminates the 30s first-request delay.
warm_routes() {
  # Wait for the server to be ready
  local max_wait=60
  local waited=0
  while ! curl -s --max-time 2 -o /dev/null http://localhost:3000 2>/dev/null; do
    sleep 1
    waited=$((waited + 1))
    if [ $waited -ge $max_wait ]; then
      echo "[warm] Server did not start within ${max_wait}s, skipping warm-up"
      return
    fi
  done
  echo "[warm] Server is ready, pre-warming Turbopack compilation..."

  # Warm the main routes in background (non-blocking)
  (
    # Main dashboard page (the biggest compilation target)
    curl -s --max-time 120 -o /dev/null http://localhost:3000/ 2>/dev/null &
    # Login page
    curl -s --max-time 60 -o /dev/null http://localhost:3000/login 2>/dev/null &
    # Connect page (captive portal)
    curl -s --max-time 60 -o /dev/null http://localhost:3000/connect 2>/dev/null &

    # Wait for all warm-up requests to finish
    wait
    echo "[warm] Pre-warming complete — all routes compiled"
  ) &
}

warm_routes

# Bring server process to foreground (PM2 manages the lifecycle)
wait $SERVER_PID
