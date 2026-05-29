module.exports = {
  apps: [
    {
      name: 'staysuite-freeradius',
      script: '/home/z/my-project/freeradius-install/sbin/radiusd',
      args: '-d /home/z/my-project/freeradius-install/etc/raddb -D /home/z/my-project/freeradius-install/share/freeradius -f',
      cwd: '/home/z/my-project',
      interpreter: 'none',
      watch: false,
      autorestart: true,
      env: {
        LD_LIBRARY_PATH: '/home/z/my-project/freeradius-install/lib',
      },
    },
    {
      name: 'staysuite-nextjs',
      script: 'npx',
      args: 'next dev -p 3000',
      cwd: '/home/z/my-project',
      watch: false,
      autorestart: true,
      max_memory_restart: '2G',
      env: {
        PORT: 3000,
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30',
        NEXTAUTH_SECRET: 'dev-secret-key-staysuite-2025-sandbox',
        NEXTAUTH_URL: 'http://localhost:3000',
        RADIUS_SECRET: 'Staysuite2025',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
  ],
};
