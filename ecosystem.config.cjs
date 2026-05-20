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
      script: 'bun',
      args: 'run dev',
      cwd: '/home/z/my-project',
      watch: false,
      autorestart: true,
      env: {
        PORT: 3000,
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@localhost:5432/staysuite',
      },
    },
  ],
};
