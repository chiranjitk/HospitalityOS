#!/usr/bin/env bash
set -e

export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export RADIUS_DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export NODE_ENV="development"
export PORT=3000

# Cap V8 heap to prevent OOM on 8GB system — Next.js dev server can grow to 5.8GB+ without this
export NODE_OPTIONS="--max-old-space-size=3072"

cd /home/z/my-project
exec npx next dev -p 3000
