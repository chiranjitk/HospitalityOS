/**
 * StaySuite HospitalityOS - PM2 Sandbox/Dev Configuration
 *
 * This config is used for the sandbox preview environment.
 * Uses bun dev server (not production standalone).
 *
 * Production config: ecosystem.config.js
 *
 * FIX (L-4): Cron jobs are handled via the Next.js API routes:
 *   - Scheduled Charges: POST /api/scheduled-charges/cron (CRON_SECRET auth)
 *   - Night Audit: POST /api/night-audit/cron (CRON_SECRET auth)
 *   - In production, use system crontab or pm2-cron-module:
 *     */5 * * * * curl -s -X POST http://localhost:3000/api/scheduled-charges/cron -H "x-cron-secret: $CRON_SECRET"
 *     0 2 * * * curl -s -X POST http://localhost:3000/api/night-audit/cron -H "x-cron-secret: $CRON_SECRET"
 *   For PM2, install pm2-cron: pm2 install pm2-cron-module
 *     pm2 set pm2-cron-module:staysuite-scheduled-charges "*/5 * * * *"
 *     pm2 set pm2-cron-module:staysuite-scheduled-charges_cmd "curl -s -X POST http://localhost:3000/api/scheduled-charges/cron"
 */
const APP_DIR = __dirname;

module.exports = {
  apps: [
    {
      name: 'staysuite-freeradius',
      script: '/home/z/my-project/freeradius-install/sbin/radiusd',
      args: '-d /home/z/my-project/freeradius-install/etc/raddb -D /home/z/my-project/freeradius-install/share/freeradius -f',
      cwd: APP_DIR,
      interpreter: 'none',
      watch: false,
      autorestart: true,
      env: {
        LD_LIBRARY_PATH: '/home/z/my-project/freeradius-install/lib:/home/z/my-project/freeradius-install/lib/freeradius:/home/z/my-project/pgsql-runtime/lib',
        PORT: '1812/1813',  // FreeRADIUS auth/acct ports (cosmetic for pm2 display)
      },
    },
    {
      name: 'staysuite-nextjs',
      script: 'bun',
      args: 'run dev',
      cwd: APP_DIR,
      watch: false,
      autorestart: true,
      env: {
        PORT: 3000,
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
        LD_LIBRARY_PATH: '/home/z/my-project/freeradius-install/lib:/home/z/my-project/freeradius-install/lib/freeradius:/home/z/my-project/pgsql-runtime/lib',
        RRD_BIN_PATH: `${APP_DIR}/rrdtool/bin/rrdtool`,
        RRD_LIB_PATH: `${APP_DIR}/rrdtool/lib`,
        RRD_DATA_PATH: `${APP_DIR}/data/rrd`,
        CRON_SECRET: 'staysuite-cron-secret-2025',
      },
    },
  ],
};
