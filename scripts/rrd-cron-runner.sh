#!/bin/bash
# RRD collector cron runner — called by crontab every minute
cd /home/z/my-project/StaySuite-HospitalityOS
exec npx tsx src/lib/rrd/collector-cron.ts >> logs/rrd-cron.log 2>&1
