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
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/staysuite',
        NEXTAUTH_SECRET: 'staysecret-dev-key-2024',
        NEXTAUTH_URL: 'http://localhost:3000',
        NEXT_DISABLE_TURBOPACK: '1',
        NODE_OPTIONS: '--max-old-space-size=1536',
      },
      max_memory_restart: '2G',
    },
    {
      name: 'staysuite-captive-redirect',
      script: '/usr/local/bin/bun',
      args: '--hot index.ts',
      cwd: '/home/z/my-project/mini-services/captive-redirect',
      watch: false,
      autorestart: true,
      env: {
        PORT: 8888,
        PORTAL_PORT: 3000,
      },
    },
    {
      name: 'staysuite-realtime',
      script: '/usr/local/bin/bun',
      args: 'index.ts',
      cwd: '/home/z/my-project/mini-services/realtime-service',
      watch: false,
      autorestart: true,
      env: {
        PORT: 3003,
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/staysuite',
      },
    },
  ],
};
  },
  {
    name: 'staysuite-realtime',
    script: 'bun',
    args: 'run index.ts',
    cwd: '/home/z/my-project/mini-services/realtime-service',
    interpreter: 'none',
    watch: false,
    autorestart: true,
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/staysuite',
      PORT: '3003',
    },
  },
  {
    name: 'staysuite-captive-redirect',
    script: 'bun',
    args: 'run index.ts',
    cwd: '/home/z/my-project/mini-services/captive-redirect',
    interpreter: 'none',
    watch: false,
    autorestart: true,
    env: {
      PORT: '8888',
      PORTAL_PORT: '3000',
    },
  },
  {
    name: 'staysuite-captive-redirect',
    script: 'bun',
    args: 'index.ts',
    cwd: '/home/z/my-project/mini-services/captive-redirect',
    interpreter: 'none',
    watch: false,
    autorestart: true,
    env: {
      PORT: '8888',
      PORTAL_PORT: '3000',
    },
  }
];
