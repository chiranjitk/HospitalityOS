module.exports = {
  apps: [
    // ─── Next.js Dev Server ─────────────────────────────────────────
    {
      name: 'staysuite-nextjs',
      script: '/home/z/my-project/scripts/start-nextjs.sh',
      interpreter: 'none',
      cwd: '/home/z/my-project',
      env: {
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30',
        NODE_OPTIONS: '--max-old-space-size=4096',
        PORT: 3000,
      },
      max_memory_restart: '5500M',
      max_restarts: 15,
      restart_delay: 8000,
      autorestart: true,
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/home/z/my-project/logs/pm2-nextjs-error.log',
      out_file: '/home/z/my-project/logs/pm2-nextjs-out.log',
      merge_logs: true,
    },
    // ─── Background Scheduler (separate process — prevents OOM) ────
    // Runs cron jobs: session engine, NAS health, WiFi alerts, reports, etc.
    // Isolated from Next.js to prevent Turbopack from tracing heavy deps
    // (node-cron, twilio, wifi/adapters → net) during page compilation.
    {
      name: 'staysuite-scheduler',
      script: 'npx',
      args: 'tsx scripts/scheduler-runner.ts',
      cwd: '/home/z/my-project',
      env: {
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30',
        NODE_OPTIONS: '--max-old-space-size=512',
      },
      max_memory_restart: '800M',
      max_restarts: 10,
      restart_delay: 5000,
      autorestart: true,
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '/home/z/my-project/logs/pm2-scheduler-error.log',
      out_file: '/home/z/my-project/logs/pm2-scheduler-out.log',
      merge_logs: true,
    },
  ],
};
