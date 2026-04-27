module.exports = {
  apps: [
    {
      name: 'staysuite-freeradius',
      script: '/home/z/my-project/StaySuite-HospitalityOS/freeradius/sbin/radiusd',
      args: '-d /home/z/my-project/StaySuite-HospitalityOS/freeradius/etc/raddb -f',
      cwd: '/home/z/my-project/StaySuite-HospitalityOS',
      interpreter: 'none',
      watch: false,
      autorestart: true,
      env: {
        LD_LIBRARY_PATH: '/home/z/my-project/StaySuite-HospitalityOS/freeradius-deps/lib:/home/z/my-project/StaySuite-HospitalityOS/freeradius/lib',
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
      },
    },
  ],
};
