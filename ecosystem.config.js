module.exports = {
  apps: [
    {
      name: 'staysuite',
      script: 'npx',
      args: 'next dev -p 3000',
      cwd: '/home/z/my-project',
      env: {
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30',
        NODE_ENV: 'development',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
