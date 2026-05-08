import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/translations/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Translations API', () => {
  describe('GET /api/translations', () => {
    it('should return English translations by default', async () => {
      const url = buildUrl('/api/translations');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      // English file has top-level keys like "common", "navigation", etc.
      expect(typeof data).toBe('object');
    });

    it('should return translations for a specific locale', async () => {
      const url = buildUrl('/api/translations', { locale: 'hi' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });

    it('should return translations for Spanish locale', async () => {
      const url = buildUrl('/api/translations', { locale: 'es' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('should reject invalid locale', async () => {
      const url = buildUrl('/api/translations', { locale: 'invalid_locale_xyz' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it('should reject path traversal attempt', async () => {
      const url = buildUrl('/api/translations', { locale: '../../etc/passwd' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
    });

    it('should have navigation keys in English translations', async () => {
      const url = buildUrl('/api/translations');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      const data = await res.json();
      expect(data.navigation).toBeDefined();
      expect(typeof data.navigation).toBe('object');
    });
  });
});
