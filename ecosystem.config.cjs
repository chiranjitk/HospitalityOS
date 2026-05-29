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
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
  ],
};
