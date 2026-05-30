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
      max_memory_restart: '512M',
      env: {
        LD_LIBRARY_PATH: '/home/z/my-project/freeradius-install/lib',
      },
    },
    {
      name: 'staysuite-nextjs',
      script: 'bun',
      args: 'run dev',
      cwd: '/home/z/my-project',
      watch: false,
      autorestart: true,
      max_memory_restart: '2G',
      env: {
        PORT: 3000,
        NODE_OPTIONS: '--max-old-space-size=1536',
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@localhost:5432/staysuite',
      },
    },
  ],
};
