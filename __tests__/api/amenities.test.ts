import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/amenities/route';
import { createAuthRequest, buildUrl, uniqueSuffix, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let createdAmenityIds: string[] = [];

describe('Amenities API', () => {
  describe('GET /api/amenities', () => {
    it('should return amenities list', async () => {
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('offset');
    });

    it('should filter by category', async () => {
      const url = buildUrl('/api/amenities', { category: 'room' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      // All returned amenities should be in the 'room' category
      if (data.data.length > 0) {
        expect(data.data.every((a: any) => a.category === 'room')).toBe(true);
      }
    });

    it('should filter out inactive amenities by default', async () => {
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((a: any) => a.isActive === true)).toBe(true);
      }
    });

    it('should include inactive amenities when requested', async () => {
      const url = buildUrl('/api/amenities', { includeInactive: 'true' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/amenities');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/amenities', () => {
    it('should create an amenity', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Amenity ${suffix}`,
          icon: 'test-icon',
          category: 'room',
          isActive: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Amenity');
      expect(data.data.category).toBe('room');
      expect(data.data.isActive).toBe(true);
      expect(data.data.sortOrder).toBeDefined();
      createdAmenityIds.push(data.data.id);
    });

    it('should create amenity with default category', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Default Category ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.category).toBe('general');
      createdAmenityIds.push(data.data.id);
    });

    it('should reject without name', async () => {
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          category: 'room',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Name is required');
    });

    it('should reject empty name', async () => {
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: '   ' },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject duplicate name', async () => {
      if (createdAmenityIds.length === 0) return;
      // Create first
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/amenities');
      const req1 = await createAuthRequest(url, {
        method: 'POST',
        body: { name: `Dup Test ${suffix}` },
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(201);
      const dupId = (await res1.json()).data.id;
      createdAmenityIds.push(dupId);

      // Try to create duplicate
      const req2 = await createAuthRequest(url, {
        method: 'POST',
        body: { name: `Dup Test ${suffix}` },
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(400);
      const data = await res2.json();
      expect(data.error.code).toBe('DUPLICATE_NAME');
    });

    it('should reject invalid category', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Category ${suffix}`,
          category: 'invalid-category',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Invalid category');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/amenities');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      }));
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/amenities', () => {
    it('should bulk delete amenities', async () => {
      if (createdAmenityIds.length === 0) return;
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { ids: createdAmenityIds },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Deleted');
    });

    it('should reject without ids array', async () => {
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: {},
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should reject empty ids array', async () => {
      const url = buildUrl('/api/amenities');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { ids: [] },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });

  afterAll(async () => {
    // Hard cleanup any test amenities still lingering
    if (createdAmenityIds.length > 0) {
      try {
        await db.amenity.deleteMany({
          where: { id: { in: createdAmenityIds }, tenantId: TENANT_ID },
        });
      } catch { /* ok */ }
    }
  });
});
