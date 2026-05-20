#!/bin/bash
# StaySuite Watchdog - Keeps the Next.js dev server alive
# Automatically restarts the process if it gets OOM-killed or crashes
#
# Usage: ./watchdog.sh [max-restarts-per-hour]
# Default: 10 restarts per hour max

MAX_RESTARTS_PER_HOUR=${1:-10}
RESTART_COUNT=0
RESTART_TIMES=()
LOG_FILE="/home/z/my-project/watchdog.log"
NEXT_LOG="/home/z/my-project/dev.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Watchdog] $1" | tee -a "$LOG_FILE"
}

cleanup_stale() {
  # Kill any existing next processes
  pkill -f "next dev" 2>/dev/null
  pkill -f "next-server" 2>/dev/null
  sleep 2
}

count_recent_restarts() {
  local now=$(date +%s)
  local one_hour_ago=$((now - 3600))
  local count=0
  RESTART_TIMES=($(for t in "${RESTART_TIMES[@]}"; do
    if [ "$t" -gt "$one_hour_ago" ] 2>/dev/null; then
      echo "$t"
      count=$((count + 1))
    fi
  done))
  echo $count
}

start_next() {
  log "Starting Next.js dev server..."
  
  cd /home/z/my-project
  
  # Clear the dev log
  > "$NEXT_LOG"
  
  # Start Next.js with heap limit to reduce OOM risk
  DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30" \
  NODE_OPTIONS="--max-old-space-size=4096" \
  nohup npx next dev -p 3000 >> "$NEXT_LOG" 2>&1 &
  
  local pid=$!
  log "Next.js started with PID $pid"
  
  # Wait for server to be ready
  local retries=0
  while [ $retries -lt 30 ]; do
    sleep 1
    if curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
      log "Server is ready and responding on port 3000"
      return 0
    fi
    # Check if process is still alive
    if ! kill -0 $pid 2>/dev/null; then
      log "Process $pid died during startup"
      return 1
    fi
    retries=$((retries + 1))
  done
  
  # Even if curl didn't succeed, the process might still be starting
  if kill -0 $pid 2>/dev/null; then
    log "Process is alive but not yet responding (may be compiling)"
    return 0
  fi
  
  return 1
}

# Main loop
log "=== StaySuite Watchdog Started ==="
log "Max restarts per hour: $MAX_RESTARTS_PER_HOUR"

cleanup_stale

while true; do
  # Start the server
  if start_next; then
    # Monitor the process - wait for it to die
    while true; do
      # Check if next-server is running
      NEXT_PID=$(pgrep -f "next-server" 2>/dev/null | head -1)
      
      if [ -z "$NEXT_PID" ]; then
        # Check if the parent npx process is still running
        NPX_PID=$(pgrep -f "next dev" 2>/dev/null | head -1)
        if [ -z "$NPX_PID" ]; then
          log "Next.js process has died!"
          break
        fi
      fi
      
      sleep 10
    done
  else
    log "Failed to start Next.js"
  fi
  
  # Track restart
  RESTART_TIMES+=($(date +%s))
  local recent=$(count_recent_restarts)
  
  if [ "$recent" -ge "$MAX_RESTARTS_PER_HOUR" ]; then
    log "Too many restarts ($recent in the last hour). Waiting 5 minutes..."
    sleep 300
    RESTART_TIMES=()
  fi
  
  log "Restarting in 5 seconds..."
  sleep 5
  
  cleanup_stale
done
