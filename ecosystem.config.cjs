module.exports = {
  apps: [
    {
      name: 'staysuite-freeradius',
      script: '/home/z/my-project/freeradius-install/sbin/radiusd',
      args: '-d /home/z/my-project/freeradius-install/etc/raddb -f',
      cwd: '/home/z/my-project',
      interpreter: 'none',
      watch: false,
      autorestart: true,
      env: {
        LD_LIBRARY_PATH: '/home/z/my-project/freeradius-install/lib',
      },
    },
    {
      name: 'staysuite-freeradius-service',
      script: 'bun',
      args: 'run --hot /home/z/my-project/mini-services/freeradius-service/index.ts',
      cwd: '/home/z/my-project/mini-services/freeradius-service',
      watch: false,
      autorestart: true,
      env: {
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/staysuite',
        PORT: 3010,
        NODE_ENV: 'development',
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
        NODE_OPTIONS: '--max-old-space-size=1536',
      },
      max_memory_restart: '2G',
    },
  ],
};
