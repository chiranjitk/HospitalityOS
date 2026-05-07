import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/packages/route';
import { GET as getPkg, PUT as putPkg, DELETE as deletePkg } from '@/app/api/packages/[id]/route';
import { GET as getComponents, POST as postComponent } from '@/app/api/packages/[id]/components/route';
import { GET as getRates, POST as postRate } from '@/app/api/packages/rates/route';
import { GET as getRate, PUT as putRate, DELETE as deleteRate } from '@/app/api/packages/rates/[id]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, ROOM_TYPE_ID } from './test-helpers';
import { db } from '@/lib/db';

let pkgId: string;
let componentId: string;
let rateId: string;

describe('Packages API', () => {
  describe('POST /api/packages', () => {
    it('should create a package plan', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/packages');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Honeymoon Package ${suffix}`,
          description: 'Romantic getaway package',
          baseRoomTypeId: ROOM_TYPE_ID,
          roomRateInclusive: true,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          minNights: 2,
          totalBasePrice: 15000,
          currency: 'INR',
          components: [
            { componentType: 'meal', referenceName: 'Breakfast & Dinner', unitCost: 3000, isIncluded: true, sortOrder: 1 },
            { componentType: 'spa', referenceName: 'Couples Massage', unitCost: 4000, isIncluded: true, sortOrder: 2 },
            { componentType: 'airport_transfer', referenceName: 'Airport Pickup', unitCost: 2000, isIncluded: false, sortOrder: 3 },
          ],
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Honeymoon Package');
      expect(data.data.components).toHaveLength(3);
      pkgId = data.data.id;
    });
  });

  describe('GET /api/packages', () => {
    it('should return list of packages', async () => {
      const url = buildUrl('/api/packages', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.packages).toBeDefined();
      expect(data.data.pagination).toBeDefined();
    });
  });

  describe('GET /api/packages/[id]', () => {
    it('should get a single package', async () => {
      const url = buildUrl(`/api/packages/${pkgId}`);
      const req = await createAuthRequest(url);
      const res = await getPkg(req as any, { params: Promise.resolve({ id: pkgId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(pkgId);
      expect(data.data.components).toBeDefined();
    });
  });

  describe('GET /api/packages/[id]/components', () => {
    it('should list package components with totals', async () => {
      const url = buildUrl(`/api/packages/${pkgId}/components`);
      const req = await createAuthRequest(url);
      const res = await getComponents(req as any, { params: Promise.resolve({ id: pkgId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.components).toBeDefined();
      expect(data.data.totals).toBeDefined();
      expect(data.data.totals.componentCount).toBe(3);
    });
  });

  describe('POST /api/packages/[id]/components', () => {
    it('should add a component', async () => {
      const url = buildUrl(`/api/packages/${pkgId}/components`);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { componentType: 'late_checkout', referenceName: 'Late Checkout 2PM', unitCost: 1000, isIncluded: true },
      });
      const res = await postComponent(req as any, { params: Promise.resolve({ id: pkgId }) } as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      componentId = data.data.id;
    });
  });

  describe('POST /api/packages/rates', () => {
    it('should create a package rate', async () => {
      const url = buildUrl('/api/packages/rates');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          packagePlanId: pkgId,
          roomTypeId: ROOM_TYPE_ID,
          startDate: '2025-06-01',
          endDate: '2025-09-30',
          price: 18000,
          currency: 'INR',
          minStay: 2,
          status: 'active',
        },
      });
      const res = await postRate(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.price).toBe(18000);
      rateId = data.data.id;
    });
  });

  describe('GET /api/packages/rates', () => {
    it('should return package rates', async () => {
      const url = buildUrl('/api/packages/rates', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getRates(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.rates).toBeDefined();
    });
  });

  describe('GET /api/packages/rates/[id]', () => {
    it('should get a single package rate', async () => {
      const url = buildUrl(`/api/packages/rates/${rateId}`);
      const req = await createAuthRequest(url);
      const res = await getRate(req as any, { params: Promise.resolve({ id: rateId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(rateId);
      expect(data.data.price).toBe(18000);
    });
  });

  describe('PUT /api/packages/rates/[id]', () => {
    it('should update a package rate', async () => {
      const url = buildUrl(`/api/packages/rates/${rateId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { price: 20000 },
      });
      const res = await putRate(req as any, { params: Promise.resolve({ id: rateId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.price).toBe(20000);
    });
  });

  describe('PUT /api/packages/[id]', () => {
    it('should update a package', async () => {
      const url = buildUrl(`/api/packages/${pkgId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { minNights: 3 },
      });
      const res = await putPkg(req as any, { params: Promise.resolve({ id: pkgId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.minNights).toBe(3);
    });
  });

  describe('DELETE /api/packages/[id]', () => {
    it('should delete a package', async () => {
      const url = buildUrl(`/api/packages/${pkgId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deletePkg(req as any, { params: Promise.resolve({ id: pkgId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(pkgId);
    });
  });
});
