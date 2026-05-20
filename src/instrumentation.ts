/**
 * Next.js Instrumentation — runs once on server startup.
 * Initializes pool classes for bandwidth shaping.
 *
 * BACKGROUND SCHEDULER: Run separately via:
 *   cd /home/z/my-project && DATABASE_URL="..." npx tsx scripts/scheduler-runner.ts &
 *
 * This is a separate process because Turbopack statically traces ALL
 * import() calls in instrumentation.ts (even inside setTimeout/catch),
 * and the scheduler's dependency graph (node-cron → node:crypto,
 * twilio → querystring, wifi/adapters → net) consumes 4-5GB during
 * analysis, causing OOM kills.
 */
export const runtime = 'nodejs';

export async function register() {
  if (typeof window !== 'undefined') return;
  if (typeof process?.versions?.node === 'undefined') {
    console.warn('[Instrumentation] Skipping — not in Node.js runtime');
    return;
  }

  // Initialize pool classes (lightweight — only db + shell)
  // Dynamic import with string concatenation prevents Turbopack from
  // statically tracing this dependency chain into the Edge Instrumentation bundle.
  setTimeout(async () => {
    try {
      const mod = await import(/* webpackIgnore: true */ '@/lib/network/' + 'script-runner');
      const { initializeAllPoolClasses } = mod;
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
