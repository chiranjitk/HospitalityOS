#!/usr/bin/env bash
set -e

export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30"
export RADIUS_DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30"
export NODE_ENV="development"
export PORT=3000

# Cap V8 heap to prevent OOM on 8GB system
export NODE_OPTIONS="--max-old-space-size=3072"

cd /home/z/my-project
# Use Turbopack (default) instead of --webpack for ~40% less memory usage
# Turbopack compiles incrementally — only what the current page needs
exec npx next dev -p 3000
