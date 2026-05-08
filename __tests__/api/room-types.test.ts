import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/room-types/route';
import { GET as getRoomTypeById, PUT, DELETE } from '@/app/api/room-types/[id]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdRoomTypeId: string;

describe('Room Types API', () => {
  describe('GET /api/room-types', () => {
    it('should return list of room types with pagination', async () => {
      const url = buildUrl('/api/room-types', { propertyId: PROPERTY_ID, limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
      expect(data.pagination.limit).toBe(5);
    });

    it('should filter room types by propertyId', async () => {
      const url = buildUrl('/api/room-types', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should filter room types by status', async () => {
      const url = buildUrl('/api/room-types', { propertyId: PROPERTY_ID, status: 'active' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.every((rt: any) => rt.status === 'active')).toBe(true);
    });

    it('should include property and room count in each room type', async () => {
      const url = buildUrl('/api/room-types', { propertyId: PROPERTY_ID, limit: '3' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const rt = data.data[0];
        expect(rt).toHaveProperty('property');
        expect(rt).toHaveProperty('totalRooms');
        expect(rt.property).toHaveProperty('name');
      }
    });

    it('should include overbooking stats', async () => {
      const url = buildUrl('/api/room-types', { propertyId: PROPERTY_ID, limit: '1' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const rt = data.data[0];
        expect(rt).toHaveProperty('overbookingStats');
        expect(rt.overbookingStats).toHaveProperty('activeBookings');
        expect(rt.overbookingStats).toHaveProperty('availableForOverbooking');
      }
    });
  });

  describe('POST /api/room-types', () => {
    it('should create a new room type successfully', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/room-types');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Test Suite ${suffix.slice(-4)}`,
          code: `TS-${suffix.slice(-6)}`,
          description: 'Test suite room type',
          maxAdults: 2,
          maxChildren: 1,
          basePrice: 8000,
          currency: 'INR',
          amenities: ['wifi', 'tv', 'minibar'],
          sortOrder: 99,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.code).toMatch(/^TS-/);
      expect(data.data.basePrice).toBe(8000);
      expect(data.data.property).toBeDefined();
      createdRoomTypeId = data.data.id;
    });

    it('should reject room type with missing required fields', async () => {
      const url = buildUrl('/api/room-types');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          // missing name, code, basePrice
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate room type code for same property', async () => {
      if (!createdRoomTypeId) return;
      // Get the code of the room type we just created
      const existing = await db.roomType.findUnique({ where: { id: createdRoomTypeId }, select: { code: true } });
      if (!existing) return;

      const url = buildUrl('/api/room-types');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: 'Duplicate Code Room',
          code: existing.code,
          basePrice: 5000,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('DUPLICATE_CODE');
    });

    it('should reject room type with invalid property', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/room-types');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          name: `Invalid Prop ${suffix}`,
          code: `IP-${suffix.slice(-6)}`,
          basePrice: 3000,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/room-types/[id]', () => {
    it('should get a room type by ID', async () => {
      const url = buildUrl(`/api/room-types/${createdRoomTypeId}`);
      const req = await createAuthRequest(url);
      const res = await getRoomTypeById(req, { params: Promise.resolve({ id: createdRoomTypeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdRoomTypeId);
      expect(data.data.property).toBeDefined();
      expect(data.data.rooms).toBeDefined();
    });

    it('should return 404 for non-existent room type', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/room-types/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getRoomTypeById(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/room-types/[id]', () => {
    it('should update a room type', async () => {
      if (!createdRoomTypeId) return;
      const url = buildUrl(`/api/room-types/${createdRoomTypeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          description: 'Updated test description',
          maxAdults: 3,
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: createdRoomTypeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.description).toBe('Updated test description');
      expect(data.data.maxAdults).toBe(3);
    });

    it('should return 404 for non-existent room type', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/room-types/${fakeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'test' },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/room-types/[id]', () => {
    it('should soft delete a room type without rooms', async () => {
      if (!createdRoomTypeId) return;
      const url = buildUrl(`/api/room-types/${createdRoomTypeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: createdRoomTypeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdRoomTypeId);
    });

    it('should return 404 for non-existent room type', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/room-types/${fakeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    // Clean up any created room types that weren't soft-deleted
    if (createdRoomTypeId) {
      try {
        await db.roomType.deleteMany({ where: { id: createdRoomTypeId } });
      } catch (e) {
        console.error('Cleanup failed for created room type:', e);
      }
    }
  });
});
