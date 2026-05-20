#!/bin/bash
# StaySuite Next.js Dev Server with Memory Watchdog
# Gives 5-minute grace period for compilation, then monitors memory.
# If next-server exceeds MAX_MEM_MB after grace period, restarts gracefully.

MAX_MEM_MB=${STAYSUITE_MAX_MEM:-5500}  # 5.5GB limit (OOM killer hits at ~6.5GB)
GRACE_PERIOD=300  # 5 minutes grace for initial compilation
CHECK_INTERVAL=60  # Check every 60 seconds after grace period
LOG_FILE="${INSTALL_DIR:-$(pwd)}/logs/memory-watchdog.log"
START_TIME=$(date +%s)

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MemWatchdog] $1" >> "$LOG_FILE"
}

# Start Next.js dev server in the background
cd "${INSTALL_DIR:-$(pwd)}"

DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30" \
NODE_OPTIONS="--max-old-space-size=4096" \
npx next dev -p 3000 &

NEXT_PID=$!
log "Started next dev with PID $NEXT_PID, memory limit: ${MAX_MEM_MB}MB, grace: ${GRACE_PERIOD}s"

# Wait for server to become ready first
RETRIES=0
while [ $RETRIES -lt 120 ]; do
  sleep 2
  if curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
    log "Server is ready and responding"
    break
  fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then
    log "Process $NEXT_PID died during startup"
    exit 1
  fi
  RETRIES=$((RETRIES + 1))
done

# Monitor loop
while true; do
  sleep $CHECK_INTERVAL
  
  NOW=$(date +%s)
  ELAPSED=$((NOW - START_TIME))
  
  # Find the actual next-server process
  SERVER_PID=$(pgrep -f "next-server" 2>/dev/null | head -1)
  
  if [ -z "$SERVER_PID" ]; then
    if ! kill -0 $NEXT_PID 2>/dev/null; then
      log "Next.js process $NEXT_PID has died. Exiting so PM2 can restart."
      exit 1
    fi
    continue
  fi
  
  # Get RSS memory in KB
  MEM_KB=$(cat /proc/$SERVER_PID/status 2>/dev/null | rg "^VmRSS:" | awk '{print $2}')
  
  if [ -z "$MEM_KB" ]; then
    continue
  fi
  
  MEM_MB=$((MEM_KB / 1024))
  
  # Skip memory check during grace period
  if [ "$ELAPSED" -lt "$GRACE_PERIOD" ]; then
    log "GRACE: next-server using ${MEM_MB}MB (${ELAPSED}s / ${GRACE_PERIOD}s grace)"
    continue
  fi
  
  if [ "$MEM_MB" -gt "$MAX_MEM_MB" ]; then
    log "WARNING: next-server (PID $SERVER_PID) using ${MEM_MB}MB — exceeds ${MAX_MEM_MB}MB limit. Restarting."
    kill -TERM $NEXT_PID 2>/dev/null
    sleep 3
    kill -9 $NEXT_PID 2>/dev/null
    pkill -9 -f "next-server" 2>/dev/null
    pkill -9 -f "next dev" 2>/dev/null
    pkill -9 -f "postcss" 2>/dev/null
    log "Process killed. PM2 will restart."
    exit 1
  fi
  
  log "OK: next-server using ${MEM_MB}MB (limit: ${MAX_MEM_MB}MB, age: ${ELAPSED}s)"
done
