import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST } from '@/app/api/gdpr/anonymize/route';
import { createAuthRequest, buildUrl, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let testGuestId: string;

describe('GDPR Anonymize API', () => {
  beforeAll(async () => {
    // Create a guest with no bookings to anonymize
    const suffix = uniqueSuffix();
    const guest = await db.guest.create({
      data: {
        tenantId: TENANT_ID,
        firstName: `Anon${suffix.slice(-4)}`,
        lastName: 'Guest',
        email: `anon${suffix.slice(-4)}@test.com`,
        phone: '+919999990001',
        nationality: 'Indian',
      },
    });
    testGuestId = guest.id;
  });

  afterAll(async () => {
    if (testGuestId) {
      try { await db.guest.delete({ where: { id: testGuestId } }); } catch (e) { /* ignore */ }
    }
  });

  describe('POST /api/gdpr/anonymize', () => {
    it('should anonymize guest data', async () => {
      if (!testGuestId) return;
      const url = buildUrl('/api/gdpr/anonymize');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: testGuestId,
          preserveAnalytics: true,
          preserveFinancialRecords: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.requestId).toBeDefined();
      expect(data.data.anonymizedFields).toBeDefined();
      expect(data.data.message).toContain('anonymized');
    });

    it('should reject missing guestId', async () => {
      const url = buildUrl('/api/gdpr/anonymize');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent guest', async () => {
      const url = buildUrl('/api/gdpr/anonymize');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: '00000000-0000-0000-0000-000000000000',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });
});
