#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="postgresql://staysuite:Staysuite2025@localhost:5432/staysuite"
while true; do
  npx next dev -p 3000 --webpack 2>&1
  echo "[$(date)] Next.js exited, restarting in 3s..."
  sleep 3
done
