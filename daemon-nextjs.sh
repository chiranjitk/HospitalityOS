#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="postgresql://staysuite:Staysuite2025@localhost:5432/staysuite"

# Double-fork to properly daemonize
(
  # First fork
  if [ $$
    # Second fork - this becomes the daemon
    exec setsid bash -c '
      cd /home/z/my-project
      export DATABASE_URL="postgresql://staysuite:Staysuite2025@localhost:5432/staysuite"
      while true; do
        npx next dev -p 3000 --webpack 2>&1
        echo "[$(date)] Restarting..." >> /home/z/my-project/dev.log
        sleep 3
      done
    ' >> /home/z/my-project/dev.log 2>&1 < /dev/null
  fi
) &
# Immediately exit the parent
exit 0
