import { describe, it, expect } from 'vitest';
import { GET, POST } from '@/app/api/gdpr/export/route';
import { createAuthRequest, buildUrl, GUEST_ID } from './test-helpers';

describe('GDPR Export API', () => {
  describe('POST /api/gdpr/export', () => {
    it('should export guest data in JSON format', async () => {
      const url = buildUrl('/api/gdpr/export');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          format: 'json',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.requestId).toBeDefined();
    });

    it('should export guest data in CSV format', async () => {
      const url = buildUrl('/api/gdpr/export');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          format: 'csv',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.format).toBe('csv');
    });

    it('should reject missing guestId', async () => {
      const url = buildUrl('/api/gdpr/export');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { format: 'json' },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('MISSING_FIELDS');
    });

    it('should return 404 for non-existent guest', async () => {
      const url = buildUrl('/api/gdpr/export');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: '00000000-0000-0000-0000-000000000000',
          format: 'json',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/gdpr/export', () => {
    it('should get guest export data', async () => {
      const url = buildUrl('/api/gdpr/export', { guestId: GUEST_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should reject missing guestId', async () => {
      const url = buildUrl('/api/gdpr/export');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent guest', async () => {
      const url = buildUrl('/api/gdpr/export', {
        guestId: '00000000-0000-0000-0000-000000000000',
      });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
    });
  });
});
