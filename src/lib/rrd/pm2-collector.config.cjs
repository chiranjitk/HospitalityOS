/**
 * RRD Collector PM2 Configuration
 *
 * Runs the bandwidth collector daemon as a separate PM2 process.
 * Starts with: pm2 start src/lib/rrd/pm2-collector.config.cjs
 */

const APP_DIR = __dirname;

module.exports = {
  apps: [
    {
      name: 'staysuite-rrd-collector',
      script: 'src/lib/rrd/collector-standalone.ts',
      interpreter: 'node',
      cwd: APP_DIR,
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
      },
      error_file: `${APP_DIR}/logs/rrd-collector-error.log`,
      out_file: `${APP_DIR}/logs/rrd-collector-out.log`,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
