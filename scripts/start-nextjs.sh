#!/usr/bin/env bash
set -e

export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export RADIUS_DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export NODE_ENV="development"
export PORT=3000

cd /home/z/my-project
exec npx next dev -p 3000
