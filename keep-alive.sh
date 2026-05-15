#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export NODE_OPTIONS="--max-old-space-size=4096"
export NEXT_DISABLE_TURBOPACK=1
while true; do
  node_modules/.bin/next dev -p 3000 -H 0.0.0.0 </dev/null
  sleep 2
done
