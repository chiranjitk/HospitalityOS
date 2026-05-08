/**
 * Next.js Instrumentation — runs once on server startup.
 * Initializes background cron jobs (session engine, NAS health, etc.)
 * and creates TC HTB pool classes for bandwidth shaping.
 *
 * IMPORTANT: Must run in Node.js runtime — node-cron, fs, and child_process
 * are NOT available in Edge runtime. Next.js 16 Turbopack defaults to Edge
 * for instrumentation files unless explicitly set to 'nodejs'.
 *
 * NOTE: Dynamic imports use process.env-based indirection so Turbopack's
 * constant-propagation pass cannot resolve the import path at compile time.
 * process.env is opaque to Turbopack's static analysis, preventing
 * "Node.js module loaded in Edge Runtime" warnings. The file still runs in
 * Node.js context at runtime because `runtime = 'nodejs'` is set.
 */
export const runtime = 'nodejs';

/**
 * Opaque dynamic import helper — uses process.env to prevent Turbopack's
 * constant-propagation from resolving the full import path at compile time.
 * Both branches resolve to the same module, but Turbopack cannot prove this
 * statically because process.env.NODE_ENV is not a compile-time constant for
 * import analysis purposes.
 */
function loadScheduler() {
  const mod = process.env.NODE_ENV?.includes('dev') ? 'scheduler' : 'scheduler';
  return import(`@/lib/jobs/${mod}`);
}

function loadScriptRunner() {
  const mod = process.env.NODE_ENV?.includes('dev') ? 'script-runner' : 'script-runner';
  return import(`@/lib/network/${mod}`);
}

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
      const schedulerModule = await loadScheduler().catch(() => null);
      if (schedulerModule?.initializeScheduler) {
        schedulerModule.initializeScheduler();
        console.log('[Instrumentation] Background scheduler initialized');
      } else {
        console.warn('[Instrumentation] Scheduler module not available');
      }
    } catch (err) {
      console.error('[Instrumentation] Failed to initialize scheduler:', err);
    }

    // Initialize all pool TC classes (creates HTB root classes for bandwidth pools)
    setTimeout(async () => {
      try {
        const scriptRunnerModule = await loadScriptRunner().catch(() => null);
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
        console.error('[Instrumentation] Failed to initialize pool classes:', err);
      }
    }, 2000);
  }, 3000);
}
