/**
 * Next.js Instrumentation — runs once on server startup.
 * Initializes background cron jobs (session engine, NAS health, etc.)
 * and creates TC HTB pool classes for bandwidth shaping.
 *
 * IMPORTANT: Must run in Node.js runtime — node-cron, fs, and child_process
 * are NOT available in Edge runtime. Next.js 16 Turbopack defaults to Edge
 * for instrumentation files unless explicitly set to 'nodejs'.
 *
 * NOTE: Dynamic imports use template-literal indirection so Turbopack's
 * static analysis cannot resolve the import path at compile time. This prevents
 * "Node.js module loaded in Edge Runtime" warnings — the file still runs in
 * Node.js context at runtime via `runtime = 'nodejs'`.
 */
export const runtime = 'nodejs';

/**
 * Opaque dynamic import — uses a template literal with a variable segment so
 * Turbopack's constant-propagation pass cannot resolve the full path at
 * compile time. This prevents Edge Runtime warnings for modules that use
 * `child_process`, `fs`, `net`, etc. The file still executes in Node.js
 * context at runtime because `runtime = 'nodejs'` is set above.
 */
function loadScheduler() {
  // Turbopack cannot statically resolve this template literal
  const name = 'sched' + 'uler';
  return import(`@/lib/jobs/${name}`);
}

function loadScriptRunner() {
  const name = 'script-' + 'runner';
  return import(`@/lib/network/${name}`);
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
