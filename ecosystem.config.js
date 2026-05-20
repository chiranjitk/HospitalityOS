module.exports = {
  apps: [
    {
      name: 'staysuite',
      script: '/home/z/my-project/node_modules/.bin/next',
      args: 'dev -p 3000',
      cwd: '/home/z/my-project',
      interpreter: 'none',
      env: {
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30',
        NODE_ENV: 'development',
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/z/.bun/bin',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 10000,
      min_uptime: '30s',
      kill_timeout: 15000,
      listen_timeout: 60000,
    },
  ],
};
