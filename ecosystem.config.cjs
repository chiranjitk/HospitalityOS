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
        LD_LIBRARY_PATH: '/home/z/my-project/freeradius-install/lib:/home/z/my-project/pgsql-runtime/lib',
      },
    },
    {
      name: 'staysuite-nextjs',
      script: 'bun',
      args: 'run dev',
      cwd: '/home/z/my-project',
      watch: false,
      autorestart: true,
      env: {
        PORT: 3000,
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/staysuite',
        NEXT_DISABLE_TURBOPACK: '1',
        NODE_OPTIONS: '--max-old-space-size=1536',
      },
      max_memory_restart: '2G',
    },
  ],
};
