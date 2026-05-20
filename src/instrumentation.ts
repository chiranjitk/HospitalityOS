/**
 * Next.js Instrumentation — runs once on server startup.
 *
 * Pool class initialization for bandwidth shaping is handled by the
 * staysuite-scheduler process (separate from Next.js) to avoid
 * Turbopack tracing the script-runner dependency tree which includes
 * child_process, fs, net etc. — causing Edge Runtime analysis to
 * consume 4-5GB RAM and trigger OOM kills.
 *
 * Scheduler: cd /home/z/my-project && DATABASE_URL="..." npx tsx scripts/scheduler-runner.ts
 */
export const runtime = 'nodejs';

export async function register() {
  if (typeof window !== 'undefined') return;
  if (typeof process?.versions?.node === 'undefined') {
    console.warn('[Instrumentation] Skipping — not in Node.js runtime');
    return;
  }

  // Pool initialization is deferred to the scheduler process.
  // This file intentionally does NOT import script-runner or paths.ts
  // to prevent Turbopack from tracing the heavy dependency tree during
  // Edge Runtime analysis (which causes OOM on 8GB memory limits).
  console.log('[Instrumentation] Next.js server started — pool init deferred to scheduler');
}
