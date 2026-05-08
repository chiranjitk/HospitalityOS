import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/tax/settings/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdSettingsId: string;

describe('Tax Settings API', () => {
  describe('GET /api/tax/settings', () => {
    it('should return list of tax settings', async () => {
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should include property relation when present', async () => {
      const url = buildUrl('/api/tax/settings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should return settings ordered by createdAt desc', async () => {
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 1) {
        const dates = data.data.map((s: any) => new Date(s.createdAt).getTime());
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
        }
      }
    });
  });

  describe('POST /api/tax/settings', () => {
    it('should create tax settings with valid data', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          gstin: '19AABCU9603R1ZM',
          legalName: `Test Legal Entity ${suffix.slice(-4)}`,
          tradeName: 'Test Trade Name',
          stateCode: '19',
          stateName: 'West Bengal',
          address: '123 Test Street',
          city: 'Kolkata',
          pincode: '700001',
          registrationType: 'regular',
          scheme: 'regular',
          gstEntityType: 'pvt_ltd',
          fssaiLicenseNo: `123456789${suffix.slice(-5)}`,
          tcsRate: 0.01,
          tcsThreshold: 100000,
          panNumber: 'ABCDE1234F',
          isActive: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.gstin).toBe('19AABCU9603R1ZM');
      expect(data.data.legalName).toContain('Test Legal Entity');
      expect(data.data.tradeName).toBe('Test Trade Name');
      expect(data.data.stateCode).toBe('19');
      expect(data.data.registrationType).toBe('regular');
      expect(data.data.scheme).toBe('regular');
      expect(data.data.gstEntityType).toBe('pvt_ltd');
      expect(data.data.isActive).toBe(true);
      expect(data.data.property).toBeDefined();
      createdSettingsId = data.data.id;
    });

    it('should create tax settings with minimal data using defaults', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.registrationType).toBe('regular');
      expect(data.data.scheme).toBe('regular');
      expect(data.data.gstEntityType).toBe('proprietary');
      expect(data.data.tcsRate).toBe(0.01);
      expect(data.data.tcsThreshold).toBe(100000);
      expect(data.data.isActive).toBe(true);
      // Clean up
      await db.gstSettings.delete({ where: { id: data.data.id } });
    });

    it('should create with composition scheme', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          scheme: 'composition',
          registrationType: 'composition',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.scheme).toBe('composition');
      expect(data.data.registrationType).toBe('composition');
      // Clean up
      await db.gstSettings.delete({ where: { id: data.data.id } });
    });

    it('should create with all GST entity types', async () => {
      const entityTypes = ['proprietary', 'partnership', 'llp', 'pvt_ltd', 'ltd', 'trust', 'society'];
      for (const entityType of entityTypes) {
        const url = buildUrl('/api/tax/settings');
        const req = await createAuthRequest(url, {
          method: 'POST',
          body: { gstEntityType: entityType },
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.data.gstEntityType).toBe(entityType);
        // Clean up
        await db.gstSettings.delete({ where: { id: data.data.id } });
      }
    });

    it('should reject invalid GST entity type', async () => {
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          gstEntityType: 'invalid_type',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid registration type', async () => {
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          registrationType: 'invalid',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject GSTIN that is not 15 characters', async () => {
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          gstin: '12345',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject pincode longer than 6 characters', async () => {
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          pincode: '1234567',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject pan number longer than 10 characters', async () => {
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          panNumber: 'ABCDE1234FG',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject tcsRate above 1', async () => {
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          tcsRate: 1.5,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative tcsThreshold', async () => {
      const url = buildUrl('/api/tax/settings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          tcsThreshold: -100,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  afterAll(async () => {
    if (createdSettingsId) {
      try {
        await db.gstSettings.delete({ where: { id: createdSettingsId } });
      } catch (e) {
        console.error('Cleanup failed for tax settings:', e);
      }
    }
  });
});
