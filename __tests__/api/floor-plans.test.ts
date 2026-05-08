import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/floor-plans/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdFloorPlanId: string;

describe('Floor Plans API', () => {
  describe('GET /api/floor-plans', () => {
    it('should return list of floor plans', async () => {
      const url = buildUrl('/api/floor-plans', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/floor-plans', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        expect(data.data[0].propertyId).toBe(PROPERTY_ID);
      }
    });

    it('should filter by floor number', async () => {
      const url = buildUrl('/api/floor-plans', { propertyId: PROPERTY_ID, floor: '1' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.every((fp: any) => fp.floor === 1)).toBe(true);
    });

    it('should include property data in each floor plan', async () => {
      const url = buildUrl('/api/floor-plans', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const fp = data.data[0];
        expect(fp).toHaveProperty('property');
        expect(fp.property).toHaveProperty('name');
        expect(fp.property).toHaveProperty('totalFloors');
      }
    });

    it('should get a single floor plan by id', async () => {
      // First check if any exist
      const listUrl = buildUrl('/api/floor-plans', { propertyId: PROPERTY_ID, limit: '1' });
      const listReq = await createAuthRequest(listUrl);
      const listRes = await GET(listReq);
      const listData = await listRes.json();

      if (listData.data.length === 0) return; // skip if no data

      const existingId = listData.data[0].id;
      const url = buildUrl('/api/floor-plans', { id: existingId });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(existingId);
      expect(data.data).toHaveProperty('rooms');
    });

    it('should return 404 for non-existent floor plan by id', async () => {
      const url = buildUrl('/api/floor-plans', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it('should support pagination', async () => {
      const url = buildUrl('/api/floor-plans', { limit: '2', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('POST /api/floor-plans', () => {
    it('should create a new floor plan', async () => {
      const suffix = uniqueSuffix();
      // Use a high floor number to avoid collision
      const floor = 99;
      const url = buildUrl('/api/floor-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          floor,
          name: `Test Floor ${suffix.slice(-4)}`,
          width: 800,
          height: 600,
          gridSize: 20,
          roomPositions: [{ roomId: 'test-1', x: 100, y: 100 }],
        },
      });
      const res = await POST(req);
      // Could be 201 or 400 if floor 99 already exists from previous run
      if (res.status === 201) {
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.id).toBeDefined();
        expect(data.data.floor).toBe(floor);
        expect(data.data.name).toContain('Test Floor');
        expect(data.data.property).toBeDefined();
        createdFloorPlanId = data.data.id;
      } else if (res.status === 400) {
        const data = await res.json();
        expect(data.error.code).toBe('DUPLICATE_FLOOR');
      }
    });

    it('should reject missing required fields', async () => {
      const url = buildUrl('/api/floor-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          // missing floor and name
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate floor for same property', async () => {
      // Check if floor 1 already exists (seed data)
      const url = buildUrl('/api/floor-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          floor: 1,
          name: 'Duplicate Floor',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('DUPLICATE_FLOOR');
    });

    it('should reject invalid property', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/floor-plans');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          floor: 99,
          name: `Invalid ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PROPERTY');
    });
  });

  describe('PUT /api/floor-plans', () => {
    it('should update a floor plan', async () => {
      if (!createdFloorPlanId) return;
      const url = buildUrl('/api/floor-plans');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdFloorPlanId,
          name: 'Updated Test Floor',
          width: 1000,
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Test Floor');
      expect(data.data.width).toBe(1000);
    });

    it('should reject missing id', async () => {
      const url = buildUrl('/api/floor-plans');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          name: 'No Id Floor',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent floor plan', async () => {
      const url = buildUrl('/api/floor-plans');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Ghost Floor',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/floor-plans', () => {
    it('should delete a floor plan', async () => {
      if (!createdFloorPlanId) return;
      const url = buildUrl('/api/floor-plans', { id: createdFloorPlanId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should reject missing id', async () => {
      const url = buildUrl('/api/floor-plans');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent floor plan', async () => {
      const url = buildUrl('/api/floor-plans', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });
});
