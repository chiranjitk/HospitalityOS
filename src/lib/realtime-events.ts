/**
 * Real-Time Dashboard Events
 *
 * Fire-and-forget HTTP POST to the realtime-service (WebSocket/SSE relay)
 * so that the dashboard can update in real-time when backend operations occur.
 */

const REALTIME_SERVICE_PORT = process.env.NEXT_PUBLIC_REALTIME_SERVICE_PORT || '3003';

/**
 * Emit a dashboard update event to the realtime service.
 * This is fire-and-forget — errors are silently swallowed to avoid
 * disrupting the primary request flow.
 */
export function emitDashboardUpdate(eventType: string, data: Record<string, unknown>): void {
  const url = `/?XTransformPort=${REALTIME_SERVICE_PORT}`;
  const payload = { eventType, data, timestamp: new Date().toISOString() };

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Fire-and-forget: silently ignore errors
  });
}
