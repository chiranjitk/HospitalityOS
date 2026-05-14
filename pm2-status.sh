#!/usr/bin/env bash
# =============================================================================
# StaySuite — PM2 Status with Port Numbers
# =============================================================================
# Shows all services (PM2 managed + PostgreSQL) with port numbers.
# Usage: ./pm2-status.sh
# =============================================================================

# Collect real PIDs from process list
FR_PID=$(pgrep -f "radiusd.*freeradius-install" | head -1)
NX_PID=$(pgrep -f "next dev" | head -1)
PG_RUNNING=0
PATH="/home/z/my-project/pgsql-runtime/bin:$PATH"
pg_isready -h localhost -p 5432 > /dev/null 2>&1 && PG_RUNNING=1

echo ""
echo "  ┌─────┬─────────────────────────┬──────────┬────────┬───────┬─────────┬────────┐"
echo "  │ ID  │ Name                    │ Port     │ PID    │ CPU   │ Memory  │ Status │"
echo "  ├─────┼─────────────────────────┼──────────┼────────┼───────┼─────────┼────────┤"

# FreeRADIUS
FR_CPU=$(ps -p $FR_PID -o %cpu= 2>/dev/null | awk '{printf "%.1f%%", $1}')
FR_MEM=$(ps -p $FR_PID -o rss= 2>/dev/null | awk '{printf "%.0fMB", $1/1024}')
FR_CPU=${FR_CPU:-"0.0%"}
FR_MEM=${FR_MEM:-"0MB"}
FR_ST="ONLINE"
[ -z "$FR_PID" ] && FR_ST="STOPPED"
printf "  │ 0   │ staysuite-freeradius     │ 1812/13 │ %-6s │ %-5s │ %-7s │ %-6s │\n" "${FR_PID:-"-" }" "$FR_CPU" "$FR_MEM" "$FR_ST"

# Next.js
NX_CPU=$(ps -p $NX_PID -o %cpu= 2>/dev/null | awk '{printf "%.1f%%", $1}')
NX_MEM=$(ps -p $NX_PID -o rss= 2>/dev/null | awk '{printf "%.0fMB", $1/1024}')
NX_CPU=${NX_CPU:-"0.0%"}
NX_MEM=${NX_MEM:-"0MB"}
NX_ST="ONLINE"
[ -z "$NX_PID" ] && NX_ST="STOPPED"
printf "  │ 1   │ staysuite-nextjs         │ 3000     │ %-6s │ %-5s │ %-7s │ %-6s │\n" "${NX_PID:-"-" }" "$NX_CPU" "$NX_MEM" "$NX_ST"

echo "  ├─────┼─────────────────────────┼──────────┼────────┼───────┼─────────┼────────┤"

# PostgreSQL (not PM2 managed)
PG_PID=$(pgrep -f "postgres.*-D.*pgsql-runtime" | head -1)
PG_ST="ONLINE"
[ "$PG_RUNNING" -eq 0 ] && PG_ST="STOPPED"
printf "  │ -   │ PostgreSQL (pg_ctl)     │ 5432     │ %-6s │       │         │ %-6s │\n" "${PG_PID:-"-" }" "$PG_ST"

echo "  └─────┴─────────────────────────┴──────────┴────────┴───────┴─────────┴────────┘"
echo ""
