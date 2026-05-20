#!/bin/bash
# StaySuite — Start all services via PM2
# Usage: ./start-dev.sh
cd /home/z/my-project
pm2 start ecosystem.config.js
pm2 save
echo "All services started. Use 'pm2 logs' to monitor, 'pm2 monit' for dashboard."
