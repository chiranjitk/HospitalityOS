import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/assets/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let createdAssetId: string;

describe('Assets API', () => {
  describe('GET /api/assets', () => {
    it('should return assets list', async () => {
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
    });

    it('should include summary statistics', async () => {
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toBeDefined();
      expect(data.summary).toHaveProperty('byStatus');
      expect(data.summary).toHaveProperty('byCategory');
      expect(data.summary).toHaveProperty('totalValue');
      expect(data.summary).toHaveProperty('totalPurchaseValue');
      expect(typeof data.summary.totalValue).toBe('number');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/assets', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by category', async () => {
      const url = buildUrl('/api/assets', { category: 'hvac' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/assets', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((a: any) => a.status === 'active')).toBe(true);
      }
    });

    it('should support search', async () => {
      const url = buildUrl('/api/assets', { search: 'air' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/assets');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/assets', () => {
    it('should create an asset', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Test AC Unit ${suffix}`,
          category: 'hvac',
          description: 'Central air conditioning unit for lobby',
          location: 'Main Lobby',
          purchasePrice: 50000,
          currentValue: 35000,
          serialNumber: `AC-${suffix.slice(-6)}`,
          modelNumber: 'XC500',
          manufacturer: 'CoolAir Corp',
          maintenanceIntervalDays: 90,
          status: 'active',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test AC Unit');
      expect(data.data.category).toBe('hvac');
      expect(data.data.status).toBe('active');
      createdAssetId = data.data.id;
    });

    it('should create asset with minimal fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Minimal Asset ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.id).toBeDefined();
      expect(data.data.category).toBe('other');
      // Cleanup
      await db.asset.delete({ where: { id: data.data.id } });
    });

    it('should reject without name', async () => {
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          category: 'hvac',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('name');
    });

    it('should reject negative purchase price', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Negative Price ${suffix}`,
          purchasePrice: -100,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('negative');
    });

    it('should reject negative current value', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Negative Value ${suffix}`,
          currentValue: -50,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid propertyId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          name: `Bad Property ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PROPERTY');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/assets');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      }));
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/assets', () => {
    it('should update an asset', async () => {
      if (!createdAssetId) return;
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdAssetId,
          name: 'Updated AC Unit',
          status: 'under_maintenance',
          currentValue: 30000,
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated AC Unit');
      expect(data.data.status).toBe('under_maintenance');
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No ID' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should reject update for non-existent asset', async () => {
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Non-existent',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/assets', () => {
    it('should soft delete an asset', async () => {
      if (!createdAssetId) return;
      const url = buildUrl('/api/assets', { id: createdAssetId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should reject delete without id', async () => {
      const url = buildUrl('/api/assets');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent asset', async () => {
      const url = buildUrl('/api/assets', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    if (createdAssetId) {
      try {
        await db.asset.deleteMany({
          where: { id: createdAssetId, tenantId: TENANT_ID },
        });
      } catch { /* ok */ }
    }
  });
});
