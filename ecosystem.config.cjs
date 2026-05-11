/**
 * StaySuite HospitalityOS - PM2 Sandbox/Dev Configuration
 *
 * This config is used for the sandbox preview environment.
 * Uses bun dev server (not production standalone).
 *
 * Production config: ecosystem.config.js
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
        // Sandbox database — PostgreSQL running on this container
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
        LD_LIBRARY_PATH: '/home/z/my-project/freeradius-install/lib:/home/z/my-project/freeradius-install/lib/freeradius:/home/z/my-project/pgsql-runtime/lib',
        // Sandbox RRD paths (project-relative, NOT /opt/staysuite)
        RRD_BIN_PATH: `${APP_DIR}/rrdtool/bin/rrdtool`,
        RRD_LIB_PATH: `${APP_DIR}/rrdtool/lib`,
        RRD_DATA_PATH: `${APP_DIR}/data/rrd`,
        CRON_SECRET: 'staysuite-cron-secret-2025',
      },
    },
  ],
};
