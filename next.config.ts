import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: "standalone",
  // Exclude native/binary packages and Node.js-only modules from bundling.
  // These are loaded at runtime via dynamic import from instrumentation.ts (Node.js runtime).
  // Without this, Turbopack traces them into the Edge Runtime analysis and emits warnings.
  serverExternalPackages: [
    'node-pre-gyp', '@mapbox/node-pre-gyp', 'node-cron',
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
      'data/rrd/**',
      'restricted-network.txt',
      '*.log',
    ],
  },
  typescript: {
    // Skip type-checking during build to avoid OOM on servers with limited RAM.
    // The project has 700+ source files; tsc requires >2GB which exceeds typical VPS memory.
    // Run `npx tsc --noEmit` separately in CI/CD if type-checking is needed.
    ignoreBuildErrors: true,
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
      'react-syntax-highlighter',
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
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'self'" },
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
};

export default withNextIntl(nextConfig);
