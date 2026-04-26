#!/bin/bash
# =============================================================================
# StaySuite — Dev mode wrapper
# Starts PostgreSQL if not running, then launches Next.js dev server
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Set PG paths
export PATH="$SCRIPT_DIR/pgsql-runtime/bin:$PATH"
export LD_LIBRARY_PATH="$SCRIPT_DIR/pgsql-runtime/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export DATABASE_URL="postgresql://z@localhost:5432/staysuite"

# Start PG if not running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  bash "$SCRIPT_DIR/pgsql-runtime/start-pgsql.sh" start
fi

cd "$SCRIPT_DIR"
exec npx next dev -p 3000
