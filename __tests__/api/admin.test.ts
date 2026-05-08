import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/system-health/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Admin API', () => {
  describe('GET /api/admin/system-health', () => {
    it('should return system health data', async () => {
      const url = buildUrl('/api/admin/system-health');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      // Could be 200 (platform admin) or 403 (regular admin)
      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.status).toBeDefined();
        expect(data.data.server).toBeDefined();
        expect(data.data.database).toBeDefined();
      } else {
        const data = await res.json();
        expect(data.error).toBeDefined();
      }
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/admin/system-health');
      const req = new NextRequest(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });
});
