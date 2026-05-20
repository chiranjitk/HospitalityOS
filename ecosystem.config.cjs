module.exports = {
  apps: [
    {
      name: 'staysuite-postgresql',
      script: 'pg_ctl',
      args: '-D /home/z/my-project/pgsql-runtime/data start -o "-p 5432 -k /tmp/.s.PGSQL.5432" -w',
      cwd: '/home/z/my-project',
      interpreter: 'none',
      watch: false,
      autorestart: false,
    },
    {
      name: 'staysuite-freeradius',
      script: '/home/z/my-project/freeradius-install/sbin/radiusd',
      args: '-d /home/z/my-project/freeradius-install/etc/raddb -f -D /home/z/my-project/freeradius-install/share/freeradius',
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
      script: '/home/z/my-project/start-next.sh',
      cwd: '/home/z/my-project',
      interpreter: '/bin/bash',
      watch: false,
      autorestart: true,
      max_restarts: 30,
      restart_delay: 5000,
      kill_timeout: 15000,
      listen_timeout: 120000,
      env: {
        STAYSUITE_MAX_MEM: '5500',
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30',
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
  ],
};
