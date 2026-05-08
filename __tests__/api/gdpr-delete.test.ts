import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST } from '@/app/api/gdpr/delete/route';
import { createAuthRequest, buildUrl, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let testGuestId: string;

describe('GDPR Delete API', () => {
  beforeAll(async () => {
    // Create a guest with no bookings to delete
    const suffix = uniqueSuffix();
    const guest = await db.guest.create({
      data: {
        tenantId: TENANT_ID,
        firstName: `Del${suffix.slice(-4)}`,
        lastName: 'Guest',
        email: `del${suffix.slice(-4)}@test.com`,
        phone: '+919999990002',
      },
    });
    testGuestId = guest.id;
  });

  afterAll(async () => {
    // Already deleted by test, but just in case
  });

  describe('POST /api/gdpr/delete', () => {
    it('should delete guest data', async () => {
      if (!testGuestId) return;
      const url = buildUrl('/api/gdpr/delete');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: testGuestId,
          hardDelete: false,
          preserveFinancialRecords: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.requestId).toBeDefined();
      expect(data.data.deletedRecords).toBeDefined();
    });

    it('should reject missing guestId', async () => {
      const url = buildUrl('/api/gdpr/delete');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent guest', async () => {
      const url = buildUrl('/api/gdpr/delete');
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
