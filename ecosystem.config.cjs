module.exports = {
  apps: [
    {
      name: 'staysuite-freeradius',
      script: '/home/z/my-project/StaySuite-HospitalityOS/freeradius-install/sbin/radiusd',
      args: '-d /home/z/my-project/StaySuite-HospitalityOS/freeradius-install/etc/raddb -D /home/z/my-project/StaySuite-HospitalityOS/freeradius-install/share/freeradius -l /home/z/my-project/StaySuite-HospitalityOS/freeradius-install/var/log/radius.log -f',
      cwd: '/home/z/my-project/StaySuite-HospitalityOS',
      interpreter: 'none',
      watch: false,
      autorestart: true,
      env: {
        LD_LIBRARY_PATH: '/home/z/my-project/StaySuite-HospitalityOS/freeradius-install/lib',
      },
    },
    {
      name: 'staysuite-nextjs',
      script: 'bun',
      args: 'run dev',
      cwd: '/home/z/my-project/StaySuite-HospitalityOS',
      watch: false,
      autorestart: true,
      env: {
        PORT: 3000,
        DATABASE_URL: 'postgresql://z@localhost:5432/staysuite',
        NODE_OPTIONS: '--max-old-space-size=1536',
      },
      max_memory_restart: '2G',
    },
  ],
};
