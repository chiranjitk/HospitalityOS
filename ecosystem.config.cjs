/**
 * PM2 Ecosystem Configuration — StaySuite-HospitalityOS
 *
 * Portable across environments — no hardcoded paths.
 * All paths are derived from INSTALL_DIR (defaults to cwd).
 *
 * Environment variables:
 *   INSTALL_DIR           - Project root (default: cwd)
 *   DATABASE_URL          - PostgreSQL connection string
 *   FREERADIUS_HOME       - FreeRADIUS install prefix
 *   STAYSUITE_MAX_MEM     - Memory limit for Next.js watchdog (MB)
 */

const path = require('path');
const INSTALL_DIR = process.env.INSTALL_DIR || __dirname;
const FREERADIUS_HOME = process.env.FREERADIUS_HOME || path.join(INSTALL_DIR, 'freeradius-install');

module.exports = {
  apps: [
    {
      name: 'staysuite-postgresql',
      script: 'pg_ctl',
      args: `-D ${path.join(INSTALL_DIR, 'pgsql-runtime', 'data')} start -o "-p 5432 -k /tmp/.s.PGSQL.5432" -w`,
      cwd: INSTALL_DIR,
      interpreter: 'none',
      watch: false,
      autorestart: false,
    },
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
      script: path.join(INSTALL_DIR, 'start-next.sh'),
      cwd: INSTALL_DIR,
      interpreter: '/bin/bash',
      watch: false,
      autorestart: true,
      max_restarts: 30,
      restart_delay: 5000,
      kill_timeout: 15000,
      listen_timeout: 120000,
      env: {
        STAYSUITE_MAX_MEM: process.env.STAYSUITE_MAX_MEM || '7500',
        DATABASE_URL: process.env.DATABASE_URL || `postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30`,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '79Q1J3CSfIAokhOOBcMfGKpJ00RHWKhdFwAUzWizPY0=',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
  ],
};
