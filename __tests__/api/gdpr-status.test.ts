import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/gdpr/status/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('GDPR Status API', () => {
  describe('GET /api/gdpr/status', () => {
    it('should return GDPR requests list with stats', async () => {
      const url = buildUrl('/api/gdpr/status');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.requests).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats.total).toBeDefined();
      expect(data.data.stats.pending).toBeDefined();
      expect(data.data.stats.completed).toBeDefined();
      expect(data.data.stats.byType).toBeDefined();
    });

    it('should return 404 for non-existent requestId', async () => {
      const url = buildUrl('/api/gdpr/status', {
        requestId: '00000000-0000-0000-0000-000000000000',
      });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/gdpr/status', { status: 'completed' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.stats).toBeDefined();
    });

    it('should filter by requestType', async () => {
      const url = buildUrl('/api/gdpr/status', { requestType: 'export' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
