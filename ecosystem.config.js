module.exports = {
  apps: [{
    name: 'staysuite',
    script: 'npx',
    args: 'next dev -p 3000',
    cwd: '/home/z/my-project',
    env: {
      DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30',
      NODE_OPTIONS: '--max-old-space-size=2048',
      PORT: 3000,
    },
    max_memory_restart: '6G',  // Auto-restart if memory exceeds 6GB
    max_restarts: 20,          // Max restarts
    restart_delay: 5000,       // 5 second delay between restarts
    autorestart: true,         // Auto-restart on crash
    watch: false,              // Don't watch files (Turbopack handles that)
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/home/z/my-project/logs/pm2-error.log',
    out_file: '/home/z/my-project/logs/pm2-out.log',
    merge_logs: true,
  }]
};
