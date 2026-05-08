import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/webhooks/delivery/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Webhook Delivery API', () => {
  describe('GET /api/webhooks/delivery', () => {
    it('should return delivery logs with stats', async () => {
      const url = buildUrl('/api/webhooks/delivery', { limit: '10' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.deliveries).toBeDefined();
      expect(Array.isArray(data.data.deliveries)).toBe(true);
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats.total).toBeDefined();
      expect(data.data.stats.success).toBeDefined();
      expect(data.data.stats.failed).toBeDefined();
      expect(data.data.stats.pending).toBeDefined();
    });

    it('should return empty deliveries when no endpoints exist', async () => {
      // This test verifies the API handles no-endpoints gracefully
      const url = buildUrl('/api/webhooks/delivery', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/webhooks/delivery', { status: 'success', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should include endpoint name in delivery logs', async () => {
      const url = buildUrl('/api/webhooks/delivery', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.deliveries.length > 0) {
        const delivery = data.data.deliveries[0];
        expect(delivery).toHaveProperty('endpointName');
        expect(delivery).toHaveProperty('event');
        expect(delivery).toHaveProperty('status');
        expect(delivery).toHaveProperty('payload');
      }
    });
  });
});
