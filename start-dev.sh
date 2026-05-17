#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export NEXT_DISABLE_TURBOPACK=1
while true; do
  echo "[$(date)] Starting Next.js dev server..."
  node_modules/.bin/next dev -p 3000 </dev/null
  echo "[$(date)] Server exited, restarting in 2s..."
  sleep 2
done
