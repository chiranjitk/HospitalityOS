/**
 * StaySuite HospitalityOS - PM2 Ecosystem Configuration
 * For Rocky Linux 10 / Debian 13 deployment
 *
 * IMPORTANT: All mini-services use bun directly (NOT npm start).
 * Using "npm start" causes PM2 to lose track of the child bun process,
 * resulting in crash-loop restarts (↺ keeps incrementing).
 *
 * IMPORTANT: Next.js standalone server + Rocky 10 IPv6 EINVAL fix.
 * The standalone server (.next/standalone/server.js) reads process.env.HOSTNAME
 * to determine the listen address. It does NOT parse --hostname CLI args.
 * On Rocky 10, HOSTNAME is set by the OS to the machine hostname, which
 * DNS-resolves to a link-local IPv6 address (fe80::...) — causing EINVAL.
 * PM2 cannot reliably override the system HOSTNAME env var.
 *
 * FIX: Use start-nextjs.sh wrapper which explicitly sets HOSTNAME=0.0.0.0
 * before launching the standalone server.
 *
 * Usage:
 *   chmod +x start-nextjs.sh          # Make wrapper executable
 *   pm2 delete all                    # Kill old processes first
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

const BUN_PATH = process.env.BUN_PATH || '/usr/bin/bun';
const APP_DIR = __dirname;
const LOG_DIR = `${APP_DIR}/logs`;

module.exports = {
  apps: [
    // =========================================================================
    // Next.js Application (production standalone)
    // =========================================================================
    {
      name: 'staysuite-nextjs',
      // CRITICAL: start-nextjs.sh wrapper sets HOSTNAME=0.0.0.0 to prevent
      // EINVAL crash on Rocky 10. The standalone server.js reads process.env
      // .HOSTNAME but ignores --hostname CLI args. PM2 cannot reliably
      // override the system HOSTNAME env var, so a bash wrapper is needed.
      script: 'start-nextjs.sh',
      interpreter: 'bash',
      cwd: APP_DIR,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        CRON_SECRET: 'staysuite-cron-secret-2025',
        RRD_BIN_PATH: `${APP_DIR}/rrdtool/bin/rrdtool`,
        RRD_LIB_PATH: `${APP_DIR}/rrdtool/lib`,
        RRD_DATA_PATH: `${APP_DIR}/data/rrd`,
      },
      max_memory_restart: '2G',
      error_file: `${LOG_DIR}/next-error.log`,
      out_file: `${LOG_DIR}/next-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },

    // =========================================================================
    // Mini Services (all use bun directly)
    // =========================================================================
    {
      name: 'availability-service',
      script: 'server.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/availability-service`,
      error_file: `${LOG_DIR}/availability-service-error.log`,
      out_file: `${LOG_DIR}/availability-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
      },
    },
    {
      name: 'realtime-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/realtime-service`,
      error_file: `${LOG_DIR}/realtime-service-error.log`,
      out_file: `${LOG_DIR}/realtime-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
      },
    },
    {
      name: 'dhcp-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/dhcp-service`,
      error_file: `${LOG_DIR}/dhcp-service-error.log`,
      out_file: `${LOG_DIR}/dhcp-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3011,
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
      },
    },
    {
      name: 'dns-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/dns-service`,
      error_file: `${LOG_DIR}/dns-service-error.log`,
      out_file: `${LOG_DIR}/dns-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3012,
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
      },
    },
    {
      name: 'freeradius-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/freeradius-service`,
      error_file: `${LOG_DIR}/freeradius-service-error.log`,
      out_file: `${LOG_DIR}/freeradius-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },
    {
      name: 'nftables-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/nftables-service`,
      error_file: `${LOG_DIR}/nftables-service-error.log`,
      out_file: `${LOG_DIR}/nftables-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3013,
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
      },
    },
    {
      name: 'captive-redirect',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/captive-redirect`,
      error_file: `${LOG_DIR}/captive-redirect-error.log`,
      out_file: `${LOG_DIR}/captive-redirect-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 8888,
        PORTAL_PORT: 3000,
      },
    },
    {
      name: 'live-speed-service',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/live-speed-service`,
      error_file: `${LOG_DIR}/live-speed-service-error.log`,
      out_file: `${LOG_DIR}/live-speed-service-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3018,
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
      },
    },

    // =========================================================================
    // IPDR Network Logging Pipeline (WiFi gateway analytics + TRAI compliance)
    // =========================================================================
    {
      name: 'conntrack-bridge',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/conntrack-bridge`,
      error_file: `${LOG_DIR}/conntrack-bridge-error.log`,
      out_file: `${LOG_DIR}/conntrack-bridge-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3020,
        CLICKHOUSE_URL: 'http://127.0.0.1:8123',
        CONNTRACK_BIN: '/usr/sbin/conntrack',
      },
    },
    {
      name: 'sni-parser',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/sni-parser`,
      error_file: `${LOG_DIR}/sni-parser-error.log`,
      out_file: `${LOG_DIR}/sni-parser-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 3022,
        CLICKHOUSE_URL: 'http://127.0.0.1:8123',
        SNI_LOG_FILE: '/var/log/sni-queries.log',
      },
    },
  ],
};
