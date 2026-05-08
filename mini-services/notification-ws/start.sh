#!/bin/bash
cd /home/z/my-project/mini-services/notification-ws
while true; do
  bun index.ts 2>&1 | tee -a /tmp/notification-ws-restart.log
  echo "[Restart] Service died, restarting in 2s..." >> /tmp/notification-ws-restart.log
  sleep 2
done
