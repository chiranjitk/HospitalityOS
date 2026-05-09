module.exports = {
  apps: [
    {
      name: 'staysuite-postgresql',
      script: 'pg_ctl',
      args: '-D /home/z/my-project/pgsql-runtime/data start -o "-p 5432" -w',
      cwd: '/home/z/my-project',
      interpreter: 'none',
      watch: false,
      autorestart: false,
    },
    {
      name: 'staysuite-freeradius',
      script: '/home/z/my-project/freeradius-install/sbin/radiusd',
      args: '-d /home/z/my-project/freeradius-install/etc/raddb -D /home/z/my-project/freeradius-install/share/freeradius -f',
      cwd: '/home/z/my-project',
      interpreter: 'none',
      watch: false,
      autorestart: true,
      env: {
        LD_LIBRARY_PATH: '/home/z/my-project/freeradius-install/lib:/home/z/my-project/freeradius-install/lib/freeradius:/home/z/my-project/pgsql-runtime/lib',
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
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
        LD_LIBRARY_PATH: '/home/z/my-project/freeradius-install/lib:/home/z/my-project/freeradius-install/lib/freeradius:/home/z/my-project/pgsql-runtime/lib',
      },
    },
  ],
};
