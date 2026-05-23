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
const fs = require('fs');

const INSTALL_DIR = process.env.INSTALL_DIR || __dirname;
const FREERADIUS_HOME = process.env.FREERADIUS_HOME || path.join(INSTALL_DIR, 'freeradius-install');

// Load .env file for PM2 (Next.js reads .env automatically, but PM2 env overrides it)
function loadDotEnv() {
  const envPath = path.join(INSTALL_DIR, '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const dotEnv = loadDotEnv();

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
        LD_LIBRARY_PATH: path.join(FREERADIUS_HOME, 'lib') + ':' + path.join(INSTALL_DIR, 'openssl-compat', 'lib64'),
        OPENSSL_MODULES: path.join(INSTALL_DIR, 'openssl-compat', 'lib64', 'ossl-modules'),
        OPENSSL_CONF: path.join(INSTALL_DIR, 'freeradius-install', 'etc', 'raddb', 'openssl.cnf'),
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
        ...dotEnv,
        PORT: 3000,
        NODE_ENV: 'development',
      },
    },
    // ─── Background Scheduler (session engine, NAS health, WiFi alerts) ────
    // Runs cron jobs in a separate process — session engine won't work without this.
    {
      name: 'staysuite-scheduler',
      script: 'npx',
      args: 'tsx scripts/scheduler-runner.ts',
      cwd: INSTALL_DIR,
      env: {
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
        NODE_OPTIONS: '--max-old-space-size=512',
        CRON_SECRET: process.env.CRON_SECRET || 'dev-cron-secret',
      },
      max_memory_restart: '800M',
      max_restarts: 10,
      restart_delay: 5000,
      autorestart: true,
      watch: false,
    },
  ],
};
