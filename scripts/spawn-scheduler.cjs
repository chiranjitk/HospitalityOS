/**
 * Scheduler Spawn Script — runs background cron jobs in a SEPARATE process.
 *
 * This is forked from instrumentation.ts to isolate the heavy dependency graph
 * (node-cron, twilio, wifi/adapters) from Turbopack's module analysis.
 *
 * Uses require() with explicit .js paths since this is plain CJS, not ESM.
 */
const path = require('path');

// Ensure DATABASE_URL is available (inherited from parent process)
if (!process.env.DATABASE_URL) {
  // Try to load from .env file
  try {
    const fs = require('fs');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        const match = line.match(/^DATABASE_URL=(.+)$/);
        if (match) {
          process.env.DATABASE_URL = match[1].replace(/^["']|["']$/g, '');
          break;
        }
      }
    }
  } catch {}
}

if (!process.env.DATABASE_URL) {
  console.error('[Scheduler] ERROR: DATABASE_URL not set — scheduler cannot start');
  process.exit(1);
}

async function main() {
  try {
    // Dynamic import of the scheduler module
    // In Node.js CJS context, we need to use the compiled path
    const schedulerModule = require('../src/lib/jobs/scheduler.ts');
    if (schedulerModule?.initializeScheduler) {
      schedulerModule.initializeScheduler();
      console.log('[Scheduler] Initialized from child process');
    } else {
      // Try the compiled version
      console.warn('[Scheduler] Trying compiled path...');
      const compiledPath = path.join(process.cwd(), '.next', 'server', 'chunks', 'ssr');
      console.error('[Scheduler] Module loaded but initializeScheduler not found');
      process.exit(1);
    }
  } catch (err) {
    console.error('[Scheduler] Failed to initialize:', err.message);
    // Try alternative: use tsx to run TypeScript
    try {
      const { execSync } = require('child_process');
      const schedulerTsPath = path.join(process.cwd(), 'src', 'lib', 'jobs', 'scheduler.ts');
      const result = execSync(
        `npx tsx -e "import('${schedulerTsPath}').then(m => { m.initializeScheduler(); console.log('[Scheduler] Initialized via tsx'); })"`,
        { stdio: 'inherit', timeout: 30000 }
      );
      console.log(result?.toString());
    } catch (tsxErr) {
      console.error('[Scheduler] tsx fallback also failed:', tsxErr.message);
      process.exit(1);
    }
  }
}

main();

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[Scheduler] Received SIGTERM, shutting down...');
  try {
    const { stopScheduler } = require('../src/lib/jobs/scheduler.ts');
    if (stopScheduler) stopScheduler();
  } catch {}
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Scheduler] Received SIGINT, shutting down...');
  try {
    const { stopScheduler } = require('../src/lib/jobs/scheduler.ts');
    if (stopScheduler) stopScheduler();
  } catch {}
  process.exit(0);
});
