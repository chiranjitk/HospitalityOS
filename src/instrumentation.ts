/**
 * Next.js Instrumentation — runs once on server startup.
 *
 * Pool class initialization for bandwidth shaping is handled by the
 * staysuite-scheduler process (separate from Next.js) to avoid
 * Turbopack tracing the script-runner dependency tree which includes
 * child_process, fs, net etc. — causing Edge Runtime analysis to
 * consume 4-5GB RAM and trigger OOM kills.
 *
 * License verification is also deferred to the scheduler process.
 * This file intentionally avoids any Node.js-only imports to prevent
 * Turbopack Edge Runtime analysis crashes.
 */
export const runtime = 'nodejs';

export async function register() {
  if (typeof window !== 'undefined') return;
  if (typeof process?.versions?.node === 'undefined') {
    console.warn('[Instrumentation] Skipping — not in Node.js runtime');
    return;
  }

  console.log('[Instrumentation] Next.js server started — license check deferred to scheduler');

  // License periodic check is handled by the scheduler process.
  // Kick off a one-time HTTP call to our own /api/license/check endpoint
  // which runs in Node.js runtime (not Edge) and can safely use fs/crypto/etc.
  try {
    const port = process.env.PORT || 3000;
    // Fire-and-forget: don't await, let it run in background
    fetch(`http://127.0.0.1:${port}/api/license/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start-periodic' }),
    }).catch(() => {
      // Silently ignore — scheduler handles periodic checks anyway
    });
  } catch {
    // Ignore — scheduler handles periodic checks
  }
}
