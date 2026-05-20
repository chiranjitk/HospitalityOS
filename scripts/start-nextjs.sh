#!/bin/bash
# Clean .next cache on every restart to prevent memory creep
rm -rf /home/z/my-project/.next/cache 2>/dev/null
export NODE_OPTIONS="--max-old-space-size=2048"
export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30"
cd /home/z/my-project
exec node --max-old-space-size=2048 node_modules/.bin/next dev -p 3000
