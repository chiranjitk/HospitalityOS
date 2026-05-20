/**
 * Next.js Instrumentation — runs once on server startup.
 * Initializes background cron jobs (session engine, NAS health, etc.)
 * and creates TC HTB pool classes for bandwidth shaping.
 *
 * IMPORTANT: The scheduler is spawned as a SEPARATE child process to prevent
 * Turbopack from statically analyzing its heavy dependency graph:
 *   node-cron → node:crypto, twilio → querystring, wifi/adapters → net
 * This was causing OOM kills in dev mode (~4GB compilation memory).
 */
export const runtime = 'nodejs';

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
    // ── Scheduler: spawned as separate process ──────────────────────────
    try {
      const { fork } = require('child_process') as typeof import('child_process');
      const path = require('path') as typeof import('path');
      const schedulerPath = require('path').join(__dirname, '..', 'scripts', 'spawn-scheduler.cjs');
      const child = fork(schedulerPath, [], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      child.stdout?.on('data', (d: Buffer) => {
        // eslint-disable-next-line no-console
        console.log('[Scheduler]', d.toString().trim());
      });
      child.stderr?.on('data', (d: Buffer) => {
        // eslint-disable-next-line no-console
        console.error('[Scheduler]', d.toString().trim());
      });
      child.on('exit', (code) => {
        console.log(`[Instrumentation] Scheduler process exited with code ${code}`);
      });
      console.log('[Instrumentation] Background scheduler spawned (pid:', child.pid, ')');
    } catch (err) {
      console.error('[Instrumentation] Scheduler spawn error:', (err as Error)?.message || err);
    }

    // ── Pool Classes: inline initialization (lightweight, no heavy deps) ──
    setTimeout(async () => {
      try {
        // Inline require — script-runner only depends on db + shell commands
        const scriptRunnerModule = require('@/lib/network/script-runner');
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
