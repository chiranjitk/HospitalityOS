module.exports = {
  apps: [
    {
      name: 'staysuite-postgresql',
      script: '/home/z/my-project/pgsql-runtime/bin/pg_ctl',
      args: '-D /home/z/my-project/pgsql-runtime/data start -o "-p 5432 -k /tmp/.s.PGSQL.5432" -w',
      cwd: '/home/z/my-project',
      interpreter: 'none',
      watch: false,
      autorestart: false,
    },
    {
      name: 'staysuite-freeradius',
      script: '/home/z/my-project/freeradius-install/sbin/radiusd',
      args: '-d /home/z/my-project/freeradius-install/etc/raddb -f',
      cwd: '/home/z/my-project',
      interpreter: 'none',
      watch: false,
      autorestart: true,
      env: {
        LD_LIBRARY_PATH: '/home/z/freeradius-install/lib:/home/z/my-project/freeradius-install/lib:/home/z/my-project/pgsql-runtime/lib',
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
    {
      name: 'staysuite-realtime',
      script: 'mini-services/realtime-service/index.ts',
      cwd: '/home/z/my-project',
      interpreter: 'bun',
      args: '--hot',
      watch: false,
      autorestart: true,
      env: {
        PORT: 3003,
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/staysuite',
      },
    },
  ],
};
