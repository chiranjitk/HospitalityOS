module.exports = {
  apps: [
    // ─── Next.js Dev Server ─────────────────────────────────────────
    {
      name: 'staysuite-nextjs',
      script: 'npx',
      args: 'next dev -p 3000',
      cwd: '/home/z/my-project',
      env: {
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30',
        NODE_OPTIONS: '--max-old-space-size=2048',
        PORT: 3000,
      },
      max_memory_restart: '3G',
      max_restarts: 30,
      restart_delay: 3000,
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
        NODE_OPTIONS: '--max-old-space-size=1024',
      },
      max_memory_restart: '1500M',
      max_restarts: 20,
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
