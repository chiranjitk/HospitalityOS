import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Enable standalone output for production deployment (PM2, Docker, etc.)
  // Generates .next/standalone/ with a minimal server.js + pruned node_modules.
  output: 'standalone',
  // Exclude native/binary packages and Node.js-only modules from bundling.
  serverExternalPackages: [
    'node-pre-gyp', '@mapbox/node-pre-gyp', 'node-cron',
    'nodemailer',       // Node.js-only — requires 'stream', 'net', 'fs'
    'sharp',            // Native binary — must be external
    'bcryptjs',         // Native optional dependency
    'pg',               // Node.js-only — requires 'net'
    'pg-native',
    'twilio',           // Node.js-only SDK — uses deprecated 'querystring'
  ],
  // Exclude non-essential paths from output file tracing.
  // WARNING: Do NOT add 'node_modules/**' here — it breaks standalone mode!
  // The file tracer needs to trace INTO node_modules to copy required runtime
  // files (e.g. next/dist/build/output/log.js) into .next/standalone/node_modules/.
  outputFileTracingExcludes: {
    '*': [
      '.git/**',
      '.next/cache/**',
      'logs/**',
      '.staysuite/**',
      'data/**',
      'restricted-network.txt',
      'upload/**',
      'freeradius-install/**',
      'pgsql-runtime/**',
      'rrdtool/**',
      'dhcp-local/**',
      'scripts/**',
      '*.log',
      '*.pcap',
      '*.rrd',
      '*.txt',
      // Prevent NFT from tracing node_modules/.cache, test files, etc.
      'node_modules/.cache/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**',
    ],
  },
  typescript: {
    // Skip type-checking during build to avoid OOM on servers with limited RAM.
    // The project has 700+ source files; tsc requires >2GB which exceeds typical VPS memory.
    // Run `npx tsc --noEmit` separately in CI/CD if type-checking is needed.
    ignoreBuildErrors: true,
  },
  // Turbopack configuration
  turbopack: {
    // Resolve Node.js built-in modules correctly under Turbopack.
    // This prevents Turbopack from trying to bundle native modules
    // and avoids the "overly broad file patterns" warnings.
    resolveAlias: {
      'node:crypto': 'crypto',
      'node:fs': 'fs',
      'node:net': 'net',
      'node:tls': 'tls',
      'node:stream': 'stream',
      'node:http': 'http',
      'node:https': 'https',
      'node:querystring': 'querystring',
      'node:util': 'util',
      'node:os': 'os',
      'node:path': 'path',
      'node:child_process': 'child_process',
      'node:buffer': 'buffer',
      'node:events': 'events',
      'node:dns': 'dns',
      'node:dgram': 'dgram',
      'node:zlib': 'zlib',
    },
  },
  experimental: {
    // Only bundle the specific sub-paths actually used from each package.
    // This dramatically reduces build-time memory for projects with many files
    // importing from large icon / chart / date utility libraries.
    optimizePackageImports: [
      'lucide-react',       // Re-enabled: Next.js 16.2.4 Turbopack handles this correctly
      'date-fns',
      'date-fns-jalali',
      'recharts',
      'sonner',
      '@radix-ui/react-icons',
      'framer-motion',      // Heavy animation library — tree-shake unused features
      '@tanstack/react-table',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
    ],
  },
  reactStrictMode: false,
  allowedDevOrigins: (() => {
    const origins = ['*.space.z.ai', '*.space-z.ai', '10.121.18.163', 'staysuite.accsium.com'];
    // Allow the APP_URL / server IP dynamically so PM2 dev works on any host
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
    try {
      const url = new URL(appUrl);
      if (url.hostname && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        origins.push(url.hostname);
      }
    } catch {}
    // Also allow NEXTAUTH_URL host
    const authUrl = process.env.NEXTAUTH_URL || '';
    try {
      const url = new URL(authUrl);
      if (url.hostname && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && !origins.includes(url.hostname)) {
        origins.push(url.hostname);
      }
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
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; connect-src 'self' ws: wss: https:; frame-ancestors 'self'" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // NOTE: Removed custom Cache-Control for /_next/static/* — it breaks
      // Next.js dev mode (causes recompilation on every request → OOM).
      // The dev server already handles cache-busting via content hashes.
    ];
  },
  images: {
    remotePatterns: [
      // Restrict to known image CDN / S3 domains — add your domains here
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Allow localhost for development
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  // Webpack configuration — adds Node.js polyfills and resolves node-cron properly
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side: add polyfills for Node.js built-ins
      config.plugins.push(new NodePolyfillPlugin());
      // Mark server-only modules as empty for client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
        net: false,
        tls: false,
        dgram: false,
        dns: false,
        crypto: false,
        os: false,
        path: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        util: false,
        buffer: false,
        events: false,
      };
    } else {
      // Server-side: mark Node.js built-ins as external so webpack doesn't try to bundle them
      config.externals = config.externals || [];
      const nodeBuiltins = ['crypto', 'fs', 'child_process', 'net', 'tls', 'dgram', 'dns', 'os', 'path', 'stream', 'http', 'https', 'zlib', 'util', 'buffer', 'events', 'querystring'];
      if (Array.isArray(config.externals)) {
        config.externals.push(...nodeBuiltins);
      }
    }
    // Fix node-cron ESM import that requires 'stream' — force CJS resolution
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      'node-cron': require.resolve('node-cron'),
      // Handle node: protocol imports (used by node-cron, twilio, etc.)
      'node:crypto': 'crypto',
      'node:fs': 'fs',
      'node:net': 'net',
      'node:tls': 'tls',
      'node:stream': 'stream',
      'node:http': 'http',
      'node:https': 'https',
      'node:querystring': 'querystring',
      'node:util': 'util',
      'node:os': 'os',
      'node:path': 'path',
      'node:child_process': 'child_process',
      'node:buffer': 'buffer',
      'node:events': 'events',
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
