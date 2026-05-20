#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30"

# Start background scheduler in separate process
npx tsx scripts/scheduler-runner.ts &
SCHEDULER_PID=$!
echo "Scheduler PID: $SCHEDULER_PID"

# Start Next.js dev server (foreground)
exec npx next dev -p 3000
