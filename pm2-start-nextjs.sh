#!/bin/bash
export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export RADIUS_DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite"
export NODE_ENV="development"
export PORT=3000
export SANDBOX_MODE=true
export LD_LIBRARY_PATH="/home/z/my-project/freeradius-install/lib:/home/z/my-project/freeradius-install/lib/freeradius:/home/z/my-project/pgsql-runtime/lib"
cd /home/z/my-project
exec bun run dev
