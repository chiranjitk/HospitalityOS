/**
 * RRD Collector — Standalone Entry Point
 *
 * Run directly with: npx tsx src/lib/rrd/collector-standalone.ts
 * Or via PM2: pm2 start src/lib/rrd/pm2-collector.config.cjs
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Force-load project .env (overrides inherited shell env)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

import { startCollector, stopCollector } from './collector';

async function main() {
  console.log('='.repeat(60));
  console.log(`[${new Date().toISOString()}] StaySuite RRD Collector starting`);
  console.log('='.repeat(60));

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down gracefully...`);
    await stopCollector();
    console.log(`[${new Date().toISOString()}] Collector stopped. Exiting.`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toISOString()}] Uncaught exception:`, err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error(`[${new Date().toISOString()}] Unhandled rejection:`, reason);
  });

  // Start the collector
  try {
    await startCollector();
    console.log(`[${new Date().toISOString()}] Collector is running. Press Ctrl+C to stop.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to start collector:`, err);
    process.exit(1);
  }
}

main();
