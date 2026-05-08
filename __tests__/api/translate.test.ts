import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/translate/route';

describe('Translate API', () => {
  describe('GET /api/translate', () => {
    it('should return translation status for all supported locales', async () => {
      const res = await GET(new Request('http://localhost:3000/api/translate'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data).toBe('object');
      // Should have statuses for supported locales (ar, bn, de, es, fr, etc.)
      const locales = Object.keys(data);
      expect(locales.length).toBeGreaterThan(0);
      // Check structure of each locale status
      const firstLocale = data[locales[0]];
      expect(firstLocale).toHaveProperty('total');
      expect(firstLocale).toHaveProperty('translated');
      expect(firstLocale).toHaveProperty('pct');
    });
  });

  describe('POST /api/translate', () => {
    it('should reject invalid locale', async () => {
      const res = await POST(
        new Request('http://localhost:3000/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: 'invalid_locale', namespace: 'common' }),
        })
      );
      expect(res.status).toBe(400);
    });

    it('should reject empty locale', async () => {
      const res = await POST(
        new Request('http://localhost:3000/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ namespace: 'common' }),
        })
      );
      expect(res.status).toBe(400);
    });
  });
});

// Import POST separately since it's used in the describe above
import { POST } from '@/app/api/translate/route';
