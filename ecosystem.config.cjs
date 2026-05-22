/**
 * PM2 Ecosystem Configuration — StaySuite-HospitalityOS (Development)
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs                    # Start all
 *   pm2 start ecosystem.config.cjs --only staysuite-nextjs    # Start Next.js only
 *   pm2 start ecosystem.config.cjs --only staysuite-freeradius  # Start FreeRADIUS only
 *   pm2 logs staysuite-nextjs                         # View Next.js logs
 *   pm2 logs staysuite-freeradius                     # View FreeRADIUS logs
 *   pm2 status                                        # Check all services
 *
 * NOTE: PostgreSQL starts manually via pg_ctl, NOT via PM2
 */

const path = require('path');
const INSTALL_DIR = process.env.INSTALL_DIR || __dirname;
const FREERADIUS_HOME = process.env.FREERADIUS_HOME || path.join(INSTALL_DIR, 'freeradius-install');

module.exports = {
  apps: [
    {
      name: 'staysuite-freeradius',
      script: path.join(FREERADIUS_HOME, 'sbin', 'radiusd'),
      args: `-d ${path.join(FREERADIUS_HOME, 'etc', 'raddb')} -f -D ${path.join(FREERADIUS_HOME, 'share', 'freeradius')}`,
      cwd: INSTALL_DIR,
      interpreter: 'none',
      watch: false,
      autorestart: true,
      env: {
        LD_LIBRARY_PATH: path.join(FREERADIUS_HOME, 'lib'),
      },
    },
    {
      name: 'staysuite-nextjs',
      script: 'bun',
      args: 'run dev',
      cwd: INSTALL_DIR,
      watch: false,
      autorestart: true,
      max_restarts: 30,
      restart_delay: 5000,
      kill_timeout: 15000,
      listen_timeout: 30000,
      env: {
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'sandbox-nextauth-secret-dev-64chars-long-xxxx',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        NODE_ENV: 'development',
      },
    },
  ],
};
