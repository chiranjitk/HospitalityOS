module.exports = {
  apps: [{
    name: 'staysuite-dev',
    script: 'node_modules/.bin/next',
    args: 'dev -p 3000 -H 0.0.0.0',
    cwd: '/home/z/my-project',
    env: {
      NODE_ENV: 'development',
      DATABASE_URL: 'file:/home/z/my-project/db/custom.db',
      NEXT_DISABLE_TURBOPACK: '1',
      NODE_OPTIONS: '--max-old-space-size=4096',
    },
    watch: false,
    max_memory_restart: '4G',
    restart_delay: 3000,
    max_restarts: 100,
    exp_backoff_restart_delay: 100,
    log_date_format: 'HH:mm:ss',
    error_file: '/home/z/my-project/.pm2-error.log',
    out_file: '/home/z/my-project/.pm2-out.log',
    time: true,
  }],
};
