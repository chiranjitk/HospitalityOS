#!/bin/bash
# Permanent watchdog for PostgreSQL and Next.js
# Runs every 30 seconds via cron, auto-restarts services if down
# Also kills orphaned Chrome processes to free memory

export PATH=/home/z/my-project/pgsql-runtime/bin:$PATH
export LD_LIBRARY_PATH=/home/z/my-project/pgsql-runtime/lib:$LD_LIBRARY_PATH
PGDATA="/home/z/my-project/pgsql-runtime/data"

# --- 1. PostgreSQL watchdog ---
if ! pg_isready -h /tmp -p 5432 >/dev/null 2>&1; then
    echo "$(date): PostgreSQL DOWN - restarting..." >> /home/z/my-project/watchdog.log
    # Kill any stale postgres processes
    pkill -9 -f "postgres.*5432" 2>/dev/null
    sleep 2
    # Remove stale PID file
    rm -f "$PGDATA/postmaster.pid"
    # Start PostgreSQL
    pg_ctl -D "$PGDATA" -l /home/z/my-project/pgsql-runtime/logfile -o "-p 5432 -k /tmp" start >> /home/z/my-project/watchdog.log 2>&1
    sleep 3
    # Verify
    if pg_isready -h /tmp -p 5432 >/dev/null 2>&1; then
        echo "$(date): PostgreSQL restarted successfully" >> /home/z/my-project/watchdog.log
    else
        echo "$(date): PostgreSQL FAILED to restart" >> /home/z/my-project/watchdog.log
    fi
fi

# --- 2. Kill orphaned Chrome processes (free ~700MB) ---
CHROME_COUNT=$(pgrep -c -f "chrome.*headless" 2>/dev/null || echo 0)
if [ "$CHROME_COUNT" -gt 0 ]; then
    echo "$(date): Killing $CHROME_COUNT orphaned Chrome processes" >> /home/z/my-project/watchdog.log
    pkill -9 -f "chrome.*headless" 2>/dev/null
fi

# --- 3. PM2 process guard ---
if ! pm2 pid staysuite-nextjs >/dev/null 2>&1; then
    echo "$(date): Next.js DOWN - restarting via PM2" >> /home/z/my-project/watchdog.log
    cd /home/z/my-project && pm2 restart staysuite-nextjs >> /home/z/my-project/watchdog.log 2>&1
fi

if ! pm2 pid staysuite-freeradius >/dev/null 2>&1; then
    echo "$(date): FreeRADIUS DOWN - restarting via PM2" >> /home/z/my-project/watchdog.log
    cd /home/z/my-project && pm2 restart staysuite-freeradius >> /home/z/my-project/watchdog.log 2>&1
fi

# --- 4. Log rotation (keep last 200 lines) ---
if [ -f /home/z/my-project/watchdog.log ]; then
    tail -200 /home/z/my-project/watchdog.log > /tmp/watchdog.tmp 2>/dev/null && mv /tmp/watchdog.tmp /home/z/my-project/watchdog.log
fi
