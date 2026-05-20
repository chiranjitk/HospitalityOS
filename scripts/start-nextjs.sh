#!/bin/bash
# StaySuite Next.js Dev Server
# NOTE: Do NOT clear .next/cache — the cache preserves compiled pages
# and avoids re-compilation which uses 4-5GB RAM via Turbopack.
# The instrumentation.ts has been simplified to avoid Turbopack tracing
# the script-runner dependency tree (child_process, fs, net) which
# previously caused Edge Runtime analysis OOM kills.
export NODE_OPTIONS="--max-old-space-size=4096"
export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30"
cd /home/z/my-project
exec node --max-old-space-size=4096 node_modules/.bin/next dev -p 3000
