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
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@localhost:5432/staysuite',
        APP_SECRET: 'dev-secret-key-for-staysuite-hospitality-os-2024',
        NEXTAUTH_SECRET: 'staysuite-dev-secret-2024',
        NEXTAUTH_URL: 'http://localhost:3000',
        RADIUS_SECRET: 'Staysuite2025',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
  ],
};
