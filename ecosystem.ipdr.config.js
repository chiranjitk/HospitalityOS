/**
 * StaySuite IPDR Mini-Services - PM2 Configuration
 * conntrack-bridge (3020) → ipdr.nat_log
 * sni-parser (3022) → ipdr.sni_log
 */

const BUN_PATH = process.env.BUN_PATH || '/root/.bun/bin/bun';
const APP_DIR = __dirname;

module.exports = {
  apps: [
    {
      name: 'conntrack-bridge',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/conntrack-bridge`,
      env: {
        PORT: '3020',
        CLICKHOUSE_URL: 'http://127.0.0.1:8123',
      },
      max_restarts: 10,
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: `${APP_DIR}/logs/conntrack-bridge-error.log`,
      out_file: `${APP_DIR}/logs/conntrack-bridge-out.log`,
    },
    {
      name: 'sni-parser',
      script: 'index.ts',
      interpreter: BUN_PATH,
      cwd: `${APP_DIR}/mini-services/sni-parser`,
      env: {
        PORT: '3022',
        CLICKHOUSE_URL: 'http://127.0.0.1:8123',
        SNI_LOG_FILE: '/var/log/ulogd2/sni.json',
      },
      max_restarts: 10,
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: `${APP_DIR}/logs/sni-parser-error.log`,
      out_file: `${APP_DIR}/logs/sni-parser-out.log`,
    },
  ],
};
