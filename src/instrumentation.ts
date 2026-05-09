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

/**
 * Use direct import() — NOT Function() constructor.
 *
 * Why NOT Function():
 *   Function('return import(p)') runs outside the module resolution scope.
 *   - @/ path aliases are NOT available (Node.js doesn't know about them)
 *   - In standalone mode, cwd = /opt/staysuite/.next/standalone/ and
 *     source .ts files don't exist there anyway
 *
 * Why direct import() works:
 *   - Next.js resolves @/ aliases at BUILD TIME in the compiled output
 *   - In standalone, the compiled chunks have correct resolved paths
 *   - In dev, Turbopack handles the resolution at compile time
 *   - runtime = 'nodejs' tells Turbopack this is Node.js-only
 */
export async function register() {
  // Only run on the server side
  if (typeof window !== 'undefined') return;

  // Guard: skip if not in a Node.js runtime (Edge, etc.)
  if (typeof process?.versions?.node === 'undefined') {
    console.warn('[Instrumentation] Skipping — not running in Node.js runtime');
    return;
  }

  // Delay slightly to let the server fully start
  setTimeout(async () => {
    try {
      const schedulerModule = await import('@/lib/jobs/scheduler');
      if (schedulerModule?.initializeScheduler) {
        schedulerModule.initializeScheduler();
        console.log('[Instrumentation] Background scheduler initialized');
      } else {
        console.warn('[Instrumentation] Scheduler module not available');
      }
    } catch (err) {
      console.error('[Instrumentation] Scheduler import error:', (err as Error)?.message || err);
    }

    // Initialize all pool TC classes (creates HTB root classes for bandwidth pools)
    setTimeout(async () => {
      try {
        const scriptRunnerModule = await import('@/lib/network/script-runner');
        if (scriptRunnerModule?.initializeAllPoolClasses) {
          const result = await scriptRunnerModule.initializeAllPoolClasses();
          if (result.created > 0) {
            console.log(`[Instrumentation] Pool classes initialized: ${result.created} created, ${result.failed} failed`);
          }
          if (result.details.length > 0 && result.details[0] !== 'No enabled BandwidthPools found in database') {
            result.details.forEach((d: string) => console.log(`[Instrumentation]   ${d}`));
          }
        } else {
          console.warn('[Instrumentation] Script-runner module not available');
        }
      } catch (err) {
        console.error('[Instrumentation] Script-runner import error:', (err as Error)?.message || err);
      }
    }, 2000);
  }, 3000);
}
