import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/captive-redirect/metrics/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Captive Redirect — Metrics', () => {
  describe('GET /api/captive-redirect/metrics', () => {
    it('should return 503 when captive redirect service is offline', async () => {
      const url = buildUrl('/api/captive-redirect/metrics');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      // The captive-redirect service runs on port 8888
      // In sandbox/test environment it won't be running
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.message).toMatch(/offline|reachable|service/i);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/captive-redirect/metrics');
      const res = await GET(new NextRequest(url, { headers: {} }));
      expect(res.status).toBe(401);
    });

    it('should return JSON content type', async () => {
      const url = buildUrl('/api/captive-redirect/metrics');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.headers.get('content-type')).toContain('application/json');
    });
  });
});
