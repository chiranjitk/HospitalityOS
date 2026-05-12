module.exports = {
  apps: [
    {
      name: 'staysuite-nextjs',
      script: 'npx',
      args: 'next dev -p 3000',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite',
        NEXT_DISABLE_TURBOPACK: '1',
        PORT: '3000',
        PATH: __dirname + '/pgsql-runtime/bin:' + process.env.PATH,
        LD_LIBRARY_PATH: __dirname + '/pgsql-runtime/lib' + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : ''),
      },
      max_memory_restart: '2G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: __dirname + '/logs/err.log',
      out_file: __dirname + '/logs/out.log',
      merge_logs: true,
    },
  ],
};
