import { describe, it, expect } from 'vitest';
import { GET, POST } from '@/app/api/ota/webhooks/route';
import {
  createAuthRequest,
  buildUrl,
  TENANT_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

describe('OTA Webhooks API', () => {
  // ─── GET /api/ota/webhooks ─────────────────────────────────────

  describe('GET /api/ota/webhooks', () => {
    it('should return recent webhook logs', async () => {
      const url = buildUrl('/api/ota/webhooks');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.logs).toBeDefined();
      expect(Array.isArray(data.logs)).toBe(true);
    });
  });

  // ─── POST /api/ota/webhooks ────────────────────────────────────

  describe('POST /api/ota/webhooks', () => {
    it('should reject invalid JSON payload', async () => {
      const token = await (await import('./test-helpers')).getSessionToken();
      const url = buildUrl('/api/ota/webhooks');
      const req = new (await import('next/server')).NextRequest(url, {
        method: 'POST',
        headers: {
          Cookie: `session_token=${token}`,
          'Content-Type': 'text/plain',
        },
        body: 'not json',
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject webhook for unconfigured channel', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ota/webhooks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          event_type: 'reservation_created',
          event_id: `evt_${suffix}`,
          timestamp: new Date().toISOString(),
          data: {
            reservation_id: `res_${suffix}`,
            channel: 'unconfigured_channel',
            guest: {
              first_name: 'Test',
              last_name: 'Guest',
              email: `test_${suffix}@example.com`,
            },
            check_in: new Date(Date.now() + 7 * 86400000).toISOString(),
            check_out: new Date(Date.now() + 10 * 86400000).toISOString(),
            guests: 2,
            total_amount: 5000,
            currency: 'INR',
            status: 'confirmed',
          },
        },
      });
      const res = await POST(req as any);
      // Should fail because channel is not configured
      expect([400, 500]).toContain(res.status);
    });

    it('should reject unknown event type', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/ota/webhooks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          event_type: 'unknown_event',
          event_id: `evt_${suffix}`,
          timestamp: new Date().toISOString(),
          data: {
            reservation_id: `res_${suffix}`,
            channel: 'booking_com',
            guest: {
              first_name: 'Test',
              last_name: 'Guest',
              email: `test_${suffix}@example.com`,
            },
            check_in: new Date(Date.now() + 7 * 86400000).toISOString(),
            check_out: new Date(Date.now() + 10 * 86400000).toISOString(),
            guests: 2,
            total_amount: 5000,
            currency: 'INR',
            status: 'confirmed',
          },
        },
      });
      const res = await POST(req as any);
      // Either channel not configured or unknown event type
      expect([400, 500]).toContain(res.status);
    });
  });
});
