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

  // L-37: CRON_SECRET production safety check.
  // Warn loudly if CRON_SECRET is still the default value or unset in production.
  // CRON_SECRET is used to authenticate all cron job endpoints (/api/cron/*).
  // Setting a strong, unique secret is MANDATORY before deploying to production.
  //
  // To set: export CRON_SECRET=$(openssl rand -hex 32)
  // or in .env: CRON_SECRET=<64-char hex string>
  if (process.env.NODE_ENV === 'production') {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error(
        '╔══════════════════════════════════════════════════════════════════════╗\n' +
        '║  ⛔  SECURITY WARNING: CRON_SECRET is not set in production!       ║\n' +
        '║                                                                     ║\n' +
        '║  All cron endpoints (/api/cron/*) are UNPROTECTED.                  ║\n' +
        '║  Any attacker can trigger night audits, billing, and other cron     ║\n' +
        '║  jobs. Set CRON_SECRET env var immediately:                        ║\n' +
        '║                                                                     ║\n' +
        '║    export CRON_SECRET=$(openssl rand -hex 32)                      ║\n' +
        '║                                                                     ║\n' +
        '╚══════════════════════════════════════════════════════════════════════╝'
      );
    } else if (cronSecret === 'dev-only-cron-secret') {
      console.error(
        '╔══════════════════════════════════════════════════════════════════════╗\n' +
        '║  ⚠️  SECURITY WARNING: CRON_SECRET is still the default value!       ║\n' +
        '║                                                                     ║\n' +
        '║  The default secret "dev-only-cron-secret" is publicly known.       ║\n' +
        '║  All cron endpoints are effectively unprotected in production.      ║\n' +
        '║  Generate a secure secret:                                          ║\n' +
        '║                                                                     ║\n' +
        '║    export CRON_SECRET=$(openssl rand -hex 32)                      ║\n' +
        '║                                                                     ║\n' +
        '╚══════════════════════════════════════════════════════════════════════╝'
      );
    }
  }

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
