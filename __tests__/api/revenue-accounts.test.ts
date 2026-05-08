import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/revenue-accounts/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdAccountId: string;

describe('Revenue Accounts API', () => {
  describe('GET /api/revenue-accounts', () => {
    it('should return list of revenue accounts', async () => {
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('offset');
    });

    it('should include property relation', async () => {
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const account = data.data[0];
        expect(account).toHaveProperty('property');
      }
    });

    it('should include postingRules relation', async () => {
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const account = data.data[0];
        expect(account).toHaveProperty('postingRules');
        expect(account).toHaveProperty('_count');
        expect(account._count).toHaveProperty('postingRules');
      }
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/revenue-accounts', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeInstanceOf(Array);
    });

    it('should filter by accountType', async () => {
      const url = buildUrl('/api/revenue-accounts', { accountType: 'revenue' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((a: any) => a.accountType === 'revenue')).toBe(true);
      }
    });

    it('should filter by category', async () => {
      const url = buildUrl('/api/revenue-accounts', { category: 'room' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((a: any) => a.category === 'room')).toBe(true);
      }
    });

    it('should filter by isActive', async () => {
      const url = buildUrl('/api/revenue-accounts', { isActive: 'true' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((a: any) => a.isActive === true)).toBe(true);
      }
    });

    it('should filter inactive accounts', async () => {
      const url = buildUrl('/api/revenue-accounts', { isActive: 'false' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((a: any) => a.isActive === false)).toBe(true);
      }
    });

    it('should search by code', async () => {
      const url = buildUrl('/api/revenue-accounts', { search: 'ROOM', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should search by name', async () => {
      const url = buildUrl('/api/revenue-accounts', { search: 'revenue', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should support pagination limit and offset', async () => {
      const url = buildUrl('/api/revenue-accounts', { limit: '2', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(2);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.offset).toBe(0);
    });

    it('should order by sortOrder then code', async () => {
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 1) {
        // Check sortOrder is non-decreasing
        for (let i = 1; i < data.data.length; i++) {
          const prev = data.data[i - 1];
          const curr = data.data[i];
          if (prev.sortOrder === curr.sortOrder) {
            expect(prev.code.localeCompare(curr.code)).toBeLessThanOrEqual(0);
          } else {
            expect(prev.sortOrder).toBeLessThanOrEqual(curr.sortOrder);
          }
        }
      }
    });
  });

  describe('POST /api/revenue-accounts', () => {
    it('should create a revenue account with valid data', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code: `TST-${suffix.slice(-6)}`,
          name: `Test Revenue Account ${suffix.slice(-4)}`,
          accountType: 'revenue',
          category: 'room',
          description: 'Test account created by API test',
          isActive: true,
          sortOrder: 0,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.code).toContain('TST-');
      expect(data.data.name).toContain('Test Revenue Account');
      expect(data.data.accountType).toBe('revenue');
      expect(data.data.category).toBe('room');
      expect(data.data.isActive).toBe(true);
      expect(data.data.property).toBeDefined();
      expect(data.data.property.id).toBe(PROPERTY_ID);
      createdAccountId = data.data.id;
    });

    it('should create account with expense type', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code: `EXP-${suffix.slice(-6)}`,
          name: `Expense Account ${suffix.slice(-4)}`,
          accountType: 'expense',
          category: 'telecom',
          description: 'Test expense account',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.accountType).toBe('expense');
      expect(data.data.category).toBe('telecom');
      // Clean up
      await db.revenueAccount.delete({ where: { id: data.data.id } });
    });

    it('should create account with all account types', async () => {
      const types = ['revenue', 'liability', 'asset', 'expense', 'equity'];
      for (const type of types) {
        const suffix = uniqueSuffix();
        const url = buildUrl('/api/revenue-accounts');
        const req = await createAuthRequest(url, {
          method: 'POST',
          body: {
            propertyId: PROPERTY_ID,
            code: `${type.toUpperCase().slice(0, 3)}-${suffix.slice(-6)}`,
            name: `${type} Account ${suffix.slice(-4)}`,
            accountType: type,
            category: 'other',
          },
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.data.accountType).toBe(type);
        // Clean up
        await db.revenueAccount.delete({ where: { id: data.data.id } });
      }
    });

    it('should create account with all categories', async () => {
      const categories = ['room', 'food_beverage', 'minibar', 'laundry', 'spa', 'parking', 'other', 'miscellaneous', 'telecom', 'event', 'rental', 'service_charge', 'tax'];
      for (const category of categories) {
        const suffix = uniqueSuffix();
        const url = buildUrl('/api/revenue-accounts');
        const req = await createAuthRequest(url, {
          method: 'POST',
          body: {
            propertyId: PROPERTY_ID,
            code: `CAT-${suffix.slice(-6)}`,
            name: `Cat ${category} ${suffix.slice(-4)}`,
            category,
          },
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.data.category).toBe(category);
        // Clean up
        await db.revenueAccount.delete({ where: { id: data.data.id } });
      }
    });

    it('should default accountType to revenue', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code: `DEF-${suffix.slice(-6)}`,
          name: `Default Type ${suffix.slice(-4)}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.accountType).toBe('revenue');
      expect(data.data.category).toBe('miscellaneous');
      expect(data.data.isActive).toBe(true);
      expect(data.data.sortOrder).toBe(0);
      // Clean up
      await db.revenueAccount.delete({ where: { id: data.data.id } });
    });

    it('should reject missing required fields', async () => {
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          // missing propertyId, code, name
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid UUID for propertyId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: 'not-a-uuid',
          code: `BAD-${suffix.slice(-6)}`,
          name: 'Bad Property ID',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty code', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code: '',
          name: `Empty Code ${suffix.slice(-4)}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty name', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code: `NONAME-${suffix.slice(-6)}`,
          name: '',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid accountType', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code: `INV-${suffix.slice(-6)}`,
          name: `Invalid Type ${suffix.slice(-4)}`,
          accountType: 'not_a_type',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid category', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code: `INVC-${suffix.slice(-6)}`,
          name: `Invalid Category ${suffix.slice(-4)}`,
          category: 'not_a_category',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate code within tenant', async () => {
      const suffix = uniqueSuffix();
      const code = `DUP-${suffix.slice(-6)}`;
      const url = buildUrl('/api/revenue-accounts');

      // Create first account
      const req1 = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code,
          name: `First Account ${suffix.slice(-4)}`,
        },
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(201);

      // Try to create duplicate
      const req2 = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code,
          name: `Duplicate Account ${suffix.slice(-4)}`,
        },
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(409);
      const data = await res2.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('DUPLICATE');
      expect(data.error.message).toContain(code);
    });

    it('should return 404 for non-existent property', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: fakeId,
          code: `NOPROP-${suffix.slice(-6)}`,
          name: 'No Property Account',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should create audit log entry', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/revenue-accounts');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          code: `AUD-${suffix.slice(-6)}`,
          name: `Audit Test ${suffix.slice(-4)}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      const accountId = data.data.id;

      // Verify audit log was created
      const auditLog = await db.auditLog.findFirst({
        where: {
          entityType: 'RevenueAccount',
          entityId: accountId,
          action: 'create',
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.module).toBe('revenue-accounts');

      // Clean up
      await db.revenueAccount.delete({ where: { id: accountId } });
      if (auditLog) await db.auditLog.delete({ where: { id: auditLog.id } });
    });
  });

  afterAll(async () => {
    if (createdAccountId) {
      try {
        await db.revenueAccount.delete({ where: { id: createdAccountId } });
      } catch (e) {
        console.error('Cleanup failed for revenue account:', e);
      }
    }
  });
});
