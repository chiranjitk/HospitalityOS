/**
 * Next.js Instrumentation — runs once on server startup.
 * Initializes background cron jobs (session engine, NAS health, etc.).
 */

export async function register() {
  // Only run on the server side
  if (typeof window !== 'undefined') return;

  // Delay slightly to let the server fully start
  setTimeout(async () => {
    try {
      const { initializeScheduler } = await import('@/lib/jobs/scheduler');
      initializeScheduler();
      console.log('[Instrumentation] Background scheduler initialized');
    } catch (err) {
      console.error('[Instrumentation] Failed to initialize scheduler:', err);
    }
  }, 3000);
}
