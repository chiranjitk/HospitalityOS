/**
 * Scheduler Runner — Entry point for the forked scheduler child process.
 * 
 * This file is spawned by spawn-scheduler.cjs using tsx to run TypeScript.
 * It initializes all background cron jobs (session engine, NAS health, etc.)
 * in an isolated process to prevent Turbopack OOM during dev compilation.
 */

async function main() {
  try {
    const { initializeScheduler, stopScheduler } = await import('../src/lib/jobs/scheduler');
    initializeScheduler();
    console.log('[Scheduler] Initialized in isolated child process');

    // Graceful shutdown
    const shutdown = () => {
      console.log('[Scheduler] Shutting down...');
      stopScheduler();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('[Scheduler] Failed to initialize:', err);
    process.exit(1);
  }
}

main();
