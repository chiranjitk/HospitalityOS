#!/bin/bash
# StaySuite Next.js startup script
# Runs next dev directly without bun wrapper to avoid double-process issues with PM2

export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export RADIUS_DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export NODE_ENV="development"
export PORT=3000

# DO NOT clear .next cache — cached compilation uses much less memory than fresh compile.
# The memory watcher handles cleanup only when memory is critically high.

cd /home/z/my-project
exec node node_modules/.bin/next dev -p 3000
