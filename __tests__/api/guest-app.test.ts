import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/guest-app/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Guest App API', () => {
  describe('GET /api/guest-app', () => {
    it('should return 400 when token is missing', async () => {
      const url = buildUrl('/api/guest-app');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for invalid token', async () => {
      const url = buildUrl('/api/guest-app', { token: 'invalid-token-12345' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });
});
