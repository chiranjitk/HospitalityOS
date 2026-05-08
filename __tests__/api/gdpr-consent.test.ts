import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/gdpr/consent/route';
import { createAuthRequest, buildUrl, TENANT_ID, GUEST_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

describe('GDPR Consent API', () => {
  describe('GET /api/gdpr/consent', () => {
    it('should return consent records', async () => {
      const url = buildUrl('/api/gdpr/consent');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.records).toBeDefined();
    });

    it('should filter by guestId', async () => {
      const url = buildUrl('/api/gdpr/consent', { guestId: GUEST_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent guest', async () => {
      const url = buildUrl('/api/gdpr/consent', {
        guestId: '00000000-0000-0000-0000-000000000000',
      });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it('should filter by consentType', async () => {
      const url = buildUrl('/api/gdpr/consent', { consentType: 'marketing' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should include stats when requested', async () => {
      const url = buildUrl('/api/gdpr/consent', { includeStats: 'true' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.stats).toBeDefined();
    });
  });

  describe('POST /api/gdpr/consent', () => {
    let createdConsentId: string;

    it('should record consent for a guest', async () => {
      const url = buildUrl('/api/gdpr/consent');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          consentType: 'marketing',
          granted: true,
          grantedVia: 'api',
          consentVersion: 'v1.0',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      createdConsentId = data.data.id;
    });

    it('should reject missing consentType', async () => {
      const url = buildUrl('/api/gdpr/consent');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          granted: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid consentType', async () => {
      const url = buildUrl('/api/gdpr/consent');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: GUEST_ID,
          consentType: 'invalid_type',
          granted: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject missing both guestId and userId', async () => {
      const url = buildUrl('/api/gdpr/consent');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          consentType: 'analytics',
          granted: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent guest', async () => {
      const url = buildUrl('/api/gdpr/consent');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestId: '00000000-0000-0000-0000-000000000000',
          consentType: 'marketing',
          granted: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    afterAll(async () => {
      if (createdConsentId) {
        try { await db.consentRecord.delete({ where: { id: createdConsentId } }); } catch (e) { /* ignore */ }
      }
    });
  });

  describe('DELETE /api/gdpr/consent', () => {
    it('should return 400 if consentId is missing', async () => {
      const url = buildUrl('/api/gdpr/consent');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });
});
