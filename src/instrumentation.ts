/**
 * Next.js Instrumentation — runs once on server startup.
 * Initializes background cron jobs (session engine, NAS health, etc.)
 * and creates TC HTB pool classes for bandwidth shaping.
 *
 * IMPORTANT: Must run in Node.js runtime — node-cron, fs, and child_process
 * are NOT available in Edge runtime. Next.js 16 Turbopack defaults to Edge
 * for instrumentation files unless explicitly set to 'nodejs'.
 */
export const runtime = 'nodejs';

export async function register() {
  // Only run on the server side
  if (typeof window !== 'undefined') return;

  // Delay slightly to let the server fully start
  setTimeout(async () => {
    try {
      const { initializeScheduler } = await import('@/lib/jobs/scheduler');
      initializeScheduler();
      console.log('[Instrumentation] Background scheduler initialized');
    } catch (err) {
      console.error('[Instrumentation] Failed to initialize scheduler:', err);
    }

    // Initialize all pool TC classes (creates HTB root classes for bandwidth pools)
    setTimeout(async () => {
      try {
        const { initializeAllPoolClasses } = await import('@/lib/network/script-runner');
        const result = await initializeAllPoolClasses();
        if (result.created > 0) {
          console.log(`[Instrumentation] Pool classes initialized: ${result.created} created, ${result.failed} failed`);
        }
        if (result.details.length > 0 && result.details[0] !== 'No enabled BandwidthPools found in database') {
          result.details.forEach(d => console.log(`[Instrumentation]   ${d}`));
        }
      } catch (err) {
        console.error('[Instrumentation] Failed to initialize pool classes:', err);
      }
    }, 2000);
  }, 3000);
}
