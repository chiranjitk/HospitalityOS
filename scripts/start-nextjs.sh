#!/bin/bash
# StaySuite Next.js Dev Server
# DATABASE_URL and other env vars are in .env.local (loaded by Next.js automatically)
# CRITICAL: Unset system-level DATABASE_URL (SQLite) so .env.local PostgreSQL takes effect
cd /home/z/my-project
unset DATABASE_URL
export NODE_OPTIONS="--max-old-space-size=4096"
exec node --max-old-space-size=4096 node_modules/.bin/next dev -p 3000
