import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  // Standalone output ONLY in production — in dev mode it forces expensive
  // file tracing on every compilation pass (30s+ TTFB for 2000+ files).
  ...(isDev ? {} : {
    output: 'standalone' as const,
    outputFileTracingExcludes: {
      '*': [
        '.git/**', '.next/cache/**', 'logs/**', '.staysuite/**', 'data/**',
        'restricted-network.txt', 'upload/**', 'freeradius-install/**',
        'pgsql-runtime/**', 'rrdtool/**', 'dhcp-local/**', 'scripts/**',
        '*.log', '*.pcap', '*.rrd', '*.txt',
        'node_modules/.cache/**', '**/*.test.*', '**/*.spec.*', '**/__tests__/**',
      ],
    },
  }),
  serverExternalPackages: [
    'node-pre-gyp', '@mapbox/node-pre-gyp', 'node-cron',
    'nodemailer', 'sharp', 'bcryptjs',
    'pg', 'pg-native', 'twilio',
  ],
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    resolveAlias: {
      'node:crypto': 'crypto', 'node:fs': 'fs', 'node:net': 'net',
      'node:tls': 'tls', 'node:stream': 'stream', 'node:http': 'http',
      'node:https': 'https', 'node:querystring': 'querystring', 'node:util': 'util',
      'node:os': 'os', 'node:path': 'path', 'node:child_process': 'child_process',
      'node:buffer': 'buffer', 'node:events': 'events', 'node:dns': 'dns',
      'node:dgram': 'dgram', 'node:zlib': 'zlib',
    },
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react', 'date-fns', 'date-fns-jalali', 'recharts', 'sonner',
      '@radix-ui/react-icons', 'framer-motion', '@tanstack/react-table',
      '@dnd-kit/core', '@dnd-kit/sortable',
    ],
  },
  reactStrictMode: false,
  allowedDevOrigins: (() => {
    const origins = ['*.space.z.ai', '*.space-z.ai', '10.121.18.163', 'staysuite.accsium.com'];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
    try {
      const url = new URL(appUrl);
      if (url.hostname && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') origins.push(url.hostname);
    } catch {}
    const authUrl = process.env.NEXTAUTH_URL || '';
    try {
      const url = new URL(authUrl);
      if (url.hostname && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && !origins.includes(url.hostname)) origins.push(url.hostname);
    } catch {}
    return origins;
  })(),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; connect-src 'self' ws: wss: https:; frame-ancestors 'self'" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  // Webpack config — ONLY active during production build.
  // In dev mode Turbopack is the bundler and ignores webpack config.
  // Lazy-require NodePolyfillPlugin to avoid loading it in dev.
  ...(isDev ? {} : {
    webpack: (config: any, { isServer }: { isServer: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
      if (!isServer) {
        config.plugins.push(new NodePolyfillPlugin());
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false, child_process: false, net: false, tls: false,
          dgram: false, dns: false, crypto: false, os: false, path: false,
          stream: false, http: false, https: false, zlib: false,
          util: false, buffer: false, events: false,
        };
      } else {
        config.externals = config.externals || [];
        if (Array.isArray(config.externals)) {
          config.externals.push(
            'crypto', 'fs', 'child_process', 'net', 'tls', 'dgram',
            'dns', 'os', 'path', 'stream', 'http', 'https', 'zlib',
            'util', 'buffer', 'events', 'querystring',
          );
        }
      }
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        'node-cron': require.resolve('node-cron'),
        'node:crypto': 'crypto', 'node:fs': 'fs', 'node:net': 'net',
        'node:tls': 'tls', 'node:stream': 'stream', 'node:http': 'http',
        'node:https': 'https', 'node:querystring': 'querystring',
        'node:util': 'util', 'node:os': 'os', 'node:path': 'path',
        'node:child_process': 'child_process', 'node:buffer': 'buffer',
        'node:events': 'events',
      };
      return config;
    },
  }),
};

export default withNextIntl(nextConfig);
