#!/bin/bash
# Wrapper script for PM2 — runs bun run dev and keeps it alive
cd /home/z/my-project
export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30"
export NODE_ENV=development
exec /home/z/.bun/bin/bun run dev
