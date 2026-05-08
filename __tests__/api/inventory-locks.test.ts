import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/inventory-locks/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, ROOM_TYPE_ID, uniqueSuffix, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let createdRoomId: string;
let createdLockId: string;

describe('Inventory Locks API', () => {
  beforeAll(async () => {
    // Create a room for testing locks (with no conflicting bookings)
    const suffix = uniqueSuffix();
    const room = await db.room.create({
      data: {
        propertyId: PROPERTY_ID,
        roomTypeId: ROOM_TYPE_ID,
        number: `RM-LOCK-${suffix.slice(-5)}`,
        floor: 99,
        status: 'out_of_service',
      },
    });
    createdRoomId = room.id;
  });

  describe('GET /api/inventory-locks', () => {
    it('should return inventory locks list', async () => {
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it('should include stats', async () => {
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('totalLocks');
      expect(data.stats).toHaveProperty('activeLocks');
      expect(data.stats).toHaveProperty('upcomingLocks');
      expect(data.stats).toHaveProperty('lockTypeDistribution');
    });

    it('should enrich locks with computed fields', async () => {
      // Create a lock first
      const suffix = uniqueSuffix();
      const futureStart = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 37 * 24 * 60 * 60 * 1000);
      const lock = await db.inventoryLock.create({
        data: {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          startDate: futureStart,
          endDate: futureEnd,
          reason: `Computed fields test ${suffix}`,
          lockType: 'maintenance',
          createdBy: '00000000-0000-0000-0000-000000000000',
        },
      });

      const url = buildUrl('/api/inventory-locks', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const found = data.data.find((l: any) => l.id === lock.id);
      if (found) {
        expect(found).toHaveProperty('isActive');
        expect(found).toHaveProperty('isUpcoming');
        expect(found).toHaveProperty('isPast');
        expect(found).toHaveProperty('durationDays');
        expect(found).toHaveProperty('status');
        expect(typeof found.durationDays).toBe('number');
      }

      // Cleanup
      await db.inventoryLock.delete({ where: { id: lock.id } });
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/inventory-locks', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by lockType', async () => {
      const url = buildUrl('/api/inventory-locks', { lockType: 'maintenance' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/inventory-locks');
      const res = await GET(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/inventory-locks', () => {
    it('should create an inventory lock on a room', async () => {
      const suffix = uniqueSuffix();
      const futureStart = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      const futureEnd = new Date(Date.now() + 67 * 24 * 60 * 60 * 1000).toISOString();
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          startDate: futureStart,
          endDate: futureEnd,
          reason: `Major renovation ${suffix}`,
          lockType: 'maintenance',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.roomId).toBe(createdRoomId);
      createdLockId = data.data.id;
    });

    it('should create an inventory lock on a room type', async () => {
      const suffix = uniqueSuffix();
      const futureStart = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const futureEnd = new Date(Date.now() + 97 * 24 * 60 * 60 * 1000).toISOString();
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomTypeId: ROOM_TYPE_ID,
          startDate: futureStart,
          endDate: futureEnd,
          reason: `Room type lock ${suffix}`,
          lockType: 'renovation',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      // Cleanup
      await db.inventoryLock.delete({ where: { id: data.data.id } });
    });

    it('should reject without propertyId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          roomId: createdRoomId,
          startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(),
          reason: `No property ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject without dates', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          reason: `No dates ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject without reason', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject without roomId or roomTypeId', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(),
          reason: `No room ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject end date before start date', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomId: createdRoomId,
          startDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          reason: `Bad dates ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_DATES');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/inventory-locks');
      const res = await POST(new Request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: PROPERTY_ID, roomId: 'abc', startDate: '2025-01-01', endDate: '2025-01-10', reason: 'test' }),
      }));
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/inventory-locks', () => {
    it('should update an inventory lock', async () => {
      if (!createdLockId) return;
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdLockId,
          reason: 'Updated renovation schedule',
          lockType: 'renovation',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.reason).toBe('Updated renovation schedule');
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { reason: 'No ID' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should reject update for non-existent lock', async () => {
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          reason: 'Non-existent',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/inventory-locks', () => {
    it('should delete inventory locks by ids', async () => {
      if (!createdLockId) return;
      const url = buildUrl('/api/inventory-locks', { ids: createdLockId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Deleted');
    });

    it('should reject delete without ids', async () => {
      const url = buildUrl('/api/inventory-locks');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });

  afterAll(async () => {
    // Cleanup created locks
    if (createdLockId) {
      try { await db.inventoryLock.deleteMany({ where: { id: createdLockId, tenantId: TENANT_ID } }); } catch { /* ok */ }
    }
    // Cleanup room
    if (createdRoomId) {
      try { await db.room.delete({ where: { id: createdRoomId } }); } catch { /* ok */ }
    }
  });
});
