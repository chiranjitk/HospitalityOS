/**
 * Next.js Instrumentation — runs once on server startup.
 * Initializes pool classes for bandwidth shaping.
 *
 * BACKGROUND SCHEDULER: Run separately via:
 *   cd /home/z/my-project && DATABASE_URL="..." npx tsx scripts/scheduler-runner.ts &
 *
 * The scheduler runs as a separate process because its dependency graph
 * (node-cron → node:crypto, twilio → querystring, wifi/adapters → net)
 * is too heavy for Turbopack's static analysis, causing OOM kills.
 *
 * The script-runner imported here is lightweight (only db + shell),
 * so a static import is safe — it does NOT trigger the OOM issue.
 */
export const runtime = 'nodejs';

import { initializeAllPoolClasses } from '@/lib/network/script-runner';

export async function register() {
  if (typeof window !== 'undefined') return;
  if (typeof process?.versions?.node === 'undefined') {
    console.warn('[Instrumentation] Skipping — not in Node.js runtime');
    return;
  }

  // Initialize pool classes (lightweight — only db + shell).
  // Uses setTimeout to avoid blocking the Next.js server startup sequence.
  // The static import above is safe: script-runner is NOT the heavy
  // dependency that caused OOM — that was the scheduler (now separate).
  setTimeout(async () => {
    try {
      const result = await initializeAllPoolClasses();
      if (result.created > 0) {
        console.log(`[Instrumentation] Pool classes initialized: ${result.created} created, ${result.failed} failed`);
      }
      if (result.details.length > 0 && result.details[0] !== 'No enabled BandwidthPools found in database') {
        result.details.forEach((d: string) => console.log(`[Instrumentation]   ${d}`));
      }
    } catch (err) {
      console.error('[Instrumentation] Script-runner error:', (err as Error)?.message || err);
    }
  }, 3000);
}
