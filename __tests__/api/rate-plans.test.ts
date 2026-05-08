import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/rate-plans/route';
import { GET as getRatePlanById, PUT as updateRatePlanById, DELETE as deleteRatePlanById } from '@/app/api/rate-plans/[id]/route';
import {
  createAuthRequest,
  buildUrl,
  ROOM_TYPE_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track created IDs for cleanup
const createdPlanIds: string[] = [];

describe('Rate Plans API', () => {
  // ─── GET /api/rate-plans ───────────────────────────────────────

  describe('GET /api/rate-plans', () => {
    it('should return rate plans with stats and pagination', async () => {
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.totalPlans).toBe('number');
      expect(typeof data.stats.activePlans).toBe('number');
      expect(Array.isArray(data.stats.mealPlanDistribution)).toBe(true);
    });

    it('should filter by roomTypeId', async () => {
      const url = buildUrl('/api/rate-plans', { roomTypeId: ROOM_TYPE_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/rate-plans', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by mealPlan', async () => {
      const url = buildUrl('/api/rate-plans', { mealPlan: 'bed_and_breakfast' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should search by name, code, or description', async () => {
      const url = buildUrl('/api/rate-plans', { search: 'standard' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should respect pagination', async () => {
      const url = buildUrl('/api/rate-plans', { limit: '2', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(2);
    });
  });

  // ─── POST /api/rate-plans ──────────────────────────────────────

  describe('POST /api/rate-plans', () => {
    it('should create a new rate plan', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          roomTypeId: ROOM_TYPE_ID,
          name: `Standard Rate ${suffix}`,
          code: `SR${suffix.slice(-6).toUpperCase()}`,
          basePrice: 5000,
          currency: 'INR',
          mealPlan: 'room_only',
          minStay: 1,
          description: 'Standard room rate plan',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Standard Rate');
      expect(data.data.code).toContain('SR');
      expect(data.data.basePrice).toBe(5000);
      expect(data.data.currency).toBe('INR');
      expect(data.data.mealPlan).toBe('room_only');
      expect(data.data.status).toBe('active');
      createdPlanIds.push(data.data.id);
    });

    it('should create rate plan with promo discount', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          roomTypeId: ROOM_TYPE_ID,
          name: `Promo Rate ${suffix}`,
          code: `PR${suffix.slice(-6).toUpperCase()}`,
          basePrice: 4000,
          currency: 'INR',
          mealPlan: 'bed_and_breakfast',
          discountPercent: 20,
          promoCode: `PROMO${suffix.slice(-4)}`,
          promoStart: new Date().toISOString(),
          promoEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.discountPercent).toBe(20);
      expect(data.data.promoCode).toBeDefined();
      createdPlanIds.push(data.data.id);
    });

    it('should reject creation without roomTypeId', async () => {
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'No Room Type', code: 'NORT', basePrice: 5000 },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without name', async () => {
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { roomTypeId: ROOM_TYPE_ID, code: 'NONAME', basePrice: 5000 },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without code', async () => {
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { roomTypeId: ROOM_TYPE_ID, name: 'No Code', basePrice: 5000 },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation with negative basePrice', async () => {
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { roomTypeId: ROOM_TYPE_ID, name: 'Neg Price', code: 'NEG', basePrice: -100 },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject discountPercent > 100', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          roomTypeId: ROOM_TYPE_ID,
          name: `Bad Discount ${suffix}`,
          code: `BD${suffix.slice(-6).toUpperCase()}`,
          basePrice: 5000,
          discountPercent: 150,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject negative discountAmount', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          roomTypeId: ROOM_TYPE_ID,
          name: `Neg Discount ${suffix}`,
          code: `ND${suffix.slice(-6).toUpperCase()}`,
          basePrice: 5000,
          discountAmount: -100,
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });
  });

  // ─── PUT /api/rate-plans ───────────────────────────────────────

  describe('PUT /api/rate-plans', () => {
    it('should update a rate plan', async () => {
      const suffix = uniqueSuffix();
      // Create first
      const createUrl = buildUrl('/api/rate-plans');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          roomTypeId: ROOM_TYPE_ID,
          name: `To Update ${suffix}`,
          code: `TU${suffix.slice(-6).toUpperCase()}`,
          basePrice: 3000,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const planId = createData.data.id;
      createdPlanIds.push(planId);

      // Update
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: planId, basePrice: 6000, description: 'Updated rate plan' },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.basePrice).toBe(6000);
      expect(data.data.description).toBe('Updated rate plan');
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { basePrice: 5000 },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent rate plan', async () => {
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', basePrice: 5000 },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/rate-plans ────────────────────────────────────

  describe('DELETE /api/rate-plans', () => {
    it('should soft delete rate plans by ids', async () => {
      const suffix = uniqueSuffix();
      // Create first
      const createUrl = buildUrl('/api/rate-plans');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          roomTypeId: ROOM_TYPE_ID,
          name: `To Delete ${suffix}`,
          code: `TD${suffix.slice(-6).toUpperCase()}`,
          basePrice: 2000,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const planId = createData.data.id;

      // Soft delete
      const url = buildUrl('/api/rate-plans', { ids: planId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Deleted');
    });

    it('should return 400 when ids are missing', async () => {
      const url = buildUrl('/api/rate-plans');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/rate-plans/[id] ──────────────────────────────────

  describe('GET /api/rate-plans/[id]', () => {
    it('should return a specific rate plan', async () => {
      const suffix = uniqueSuffix();
      // Create first
      const createUrl = buildUrl('/api/rate-plans');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          roomTypeId: ROOM_TYPE_ID,
          name: `Get By Id ${suffix}`,
          code: `GBI${suffix.slice(-6).toUpperCase()}`,
          basePrice: 4500,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const planId = createData.data.id;
      createdPlanIds.push(planId);

      // Get by ID
      const url = buildUrl(`/api/rate-plans/${planId}`);
      const req = await createAuthRequest(url);
      const res = await getRatePlanById(req as any, { params: Promise.resolve({ id: planId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(planId);
      expect(data.data.name).toContain('Get By Id');
    });

    it('should return 404 for non-existent rate plan', async () => {
      const url = buildUrl('/api/rate-plans/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(url);
      const res = await getRatePlanById(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) });
      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/rate-plans/[id] ──────────────────────────────────

  describe('PUT /api/rate-plans/[id]', () => {
    it('should update rate plan name and basePrice', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/rate-plans');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          roomTypeId: ROOM_TYPE_ID,
          name: `Update By Id ${suffix}`,
          code: `UBI${suffix.slice(-6).toUpperCase()}`,
          basePrice: 3500,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const planId = createData.data.id;
      createdPlanIds.push(planId);

      // Update via [id] route
      const url = buildUrl(`/api/rate-plans/${planId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: `Updated By Id ${suffix}`, basePrice: '7000' },
      });
      const res = await updateRatePlanById(req as any, { params: Promise.resolve({ id: planId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.basePrice).toBe(7000);
    });
  });

  // ─── DELETE /api/rate-plans/[id] ───────────────────────────────

  describe('DELETE /api/rate-plans/[id]', () => {
    it('should soft delete a rate plan by id', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/rate-plans');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          roomTypeId: ROOM_TYPE_ID,
          name: `Soft Delete ${suffix}`,
          code: `SD${suffix.slice(-6).toUpperCase()}`,
          basePrice: 2500,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const planId = createData.data.id;

      const url = buildUrl(`/api/rate-plans/${planId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteRatePlanById(req as any, { params: Promise.resolve({ id: planId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────

  afterAll(async () => {
    for (const id of createdPlanIds) {
      try {
        // Hard delete for cleanup (force remove)
        await db.ratePlan.delete({ where: { id } }).catch(() => {});
      } catch {
        // Already deleted
      }
    }
  });
});
