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

export async function register() {
  if (typeof window !== 'undefined') return;
  if (typeof process?.versions?.node === 'undefined') {
    console.warn('[Instrumentation] Skipping — not in Node.js runtime');
    return;
  }

  console.log('[Instrumentation] Next.js server started — license check deferred to scheduler');

  // L-37: CRON_SECRET production safety check.
  if (process.env.NODE_ENV === 'production') {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error(
        '╔══════════════════════════════════════════════════════════════════════╗\n' +
        '║  ⛔  SECURITY WARNING: CRON_SECRET is not set in production!       ║\n' +
        '║  All cron endpoints (/api/cron/*) are UNPROTECTED.                  ║\n' +
        '║  Set CRON_SECRET env var immediately.                                ║\n' +
        '╚══════════════════════════════════════════════════════════════════════╝'
      );
    } else if (cronSecret === 'dev-only-cron-secret') {
      console.error(
        '╔══════════════════════════════════════════════════════════════════════╗\n' +
        '║  ⚠️  SECURITY WARNING: CRON_SECRET is still the default value!       ║\n' +
        '║  Generate a secure secret:                                          ║\n' +
        '║    export CRON_SECRET=$(openssl rand -hex 32)                      ║\n' +
        '╚══════════════════════════════════════════════════════════════════════╝'
      );
    }
  }

  // License periodic check — fire-and-forget to scheduler
  try {
    const port = process.env.PORT || 3000;
    fetch(`http://127.0.0.1:${port}/api/license/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start-periodic' }),
    }).catch(() => {});
  } catch {
    // Ignore — scheduler handles periodic checks
  }
}
