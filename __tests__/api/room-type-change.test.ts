import { describe, it, expect, afterAll } from 'vitest';
import { GET as getRoomTypeChanges, POST as postRoomTypeChange } from '@/app/api/pms/room-type-change/route';
import { GET as getRoomTypeChange, PUT as putRoomTypeChange, DELETE as deleteRoomTypeChange } from '@/app/api/pms/room-type-change/[id]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, ROOM_TYPE_ID, createTestFixture, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let changeId: string;
let fixture: Awaited<ReturnType<typeof createTestFixture>>;
let newRoomTypeId: string;

describe('Room Type Change API', () => {
  beforeAll(async () => {
    fixture = await createTestFixture();
    // Create a second room type to switch to
    const suffix = uniqueSuffix();
    const roomType = await db.roomType.create({
      data: {
        tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
        propertyId: PROPERTY_ID,
        name: `Deluxe Suite ${suffix.slice(-6)}`,
        code: `DLX-${suffix.slice(-4)}`,
        basePrice: 8000,
        maxOccupancy: 2,
        description: 'Test deluxe room type for change testing',
        isActive: true,
      },
    });
    newRoomTypeId = roomType.id;
  });

  // ─── POST /api/pms/room-type-change ───
  describe('POST /api/pms/room-type-change', () => {
    it('should create a room type change request', async () => {
      const url = buildUrl('/api/pms/room-type-change');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          roomId: fixture.room.id,
          oldRoomTypeId: ROOM_TYPE_ID,
          newRoomTypeId,
          reason: 'Guest upgrade request - celebrating anniversary',
          notes: 'Test room type change',
        },
      });
      const res = await postRoomTypeChange(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.roomId).toBe(fixture.room.id);
      expect(data.data.oldRoomTypeId).toBe(ROOM_TYPE_ID);
      expect(data.data.newRoomTypeId).toBe(newRoomTypeId);
      expect(data.data.status).toBe('requested');
      expect(data.data.rateDifference).toBeDefined();
      expect(data.data.room).toBeDefined();
      expect(data.data.room.number).toBe(fixture.room.number);
      expect(data.data.oldRoomType).toBeDefined();
      expect(data.data.newRoomType).toBeDefined();
      changeId = data.data.id;
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl('/api/pms/room-type-change');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { roomId: fixture.room.id },
      });
      const res = await postRoomTypeChange(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should return 400 when old and new room types are the same', async () => {
      const url = buildUrl('/api/pms/room-type-change');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          roomId: fixture.room.id,
          oldRoomTypeId: ROOM_TYPE_ID,
          newRoomTypeId: ROOM_TYPE_ID,
        },
      });
      const res = await postRoomTypeChange(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('different');
    });

    it('should return 404 when room does not exist', async () => {
      const url = buildUrl('/api/pms/room-type-change');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          roomId: '00000000-0000-0000-0000-000000000000',
          oldRoomTypeId: ROOM_TYPE_ID,
          newRoomTypeId,
        },
      });
      const res = await postRoomTypeChange(req as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  // ─── GET /api/pms/room-type-change ───
  describe('GET /api/pms/room-type-change', () => {
    it('should return list of room type changes with pagination and stats', async () => {
      const url = buildUrl('/api/pms/room-type-change');
      const req = await createAuthRequest(url);
      const res = await getRoomTypeChanges(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.stats.statusDistribution).toBeDefined();
      expect(data.meta).toBeDefined();
      expect(data.meta.rooms).toBeDefined();
      expect(data.meta.roomTypes).toBeDefined();
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/pms/room-type-change', { status: 'requested' });
      const req = await createAuthRequest(url);
      const res = await getRoomTypeChanges(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  // ─── GET /api/pms/room-type-change/[id] ───
  describe('GET /api/pms/room-type-change/[id]', () => {
    it('should get a single room type change by id', async () => {
      const url = buildUrl(`/api/pms/room-type-change/${changeId}`);
      const req = await createAuthRequest(url);
      const res = await getRoomTypeChange(req as any, { params: Promise.resolve({ id: changeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(changeId);
      expect(data.data.room).toBeDefined();
      expect(data.data.oldRoomType).toBeDefined();
      expect(data.data.newRoomType).toBeDefined();
    });

    it('should return 404 for non-existent change', async () => {
      const url = buildUrl('/api/pms/room-type-change/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(url);
      const res = await getRoomTypeChange(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ─── PUT /api/pms/room-type-change/[id] ───
  describe('PUT /api/pms/room-type-change/[id]', () => {
    it('should approve a room type change request', async () => {
      const url = buildUrl(`/api/pms/room-type-change/${changeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'approved', notes: 'Approved by management' },
      });
      const res = await putRoomTypeChange(req as any, { params: Promise.resolve({ id: changeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('approved');
      expect(data.data.approvedBy).toBeDefined();
      expect(data.data.approvedAt).toBeDefined();
    });

    it('should complete an approved room type change', async () => {
      const url = buildUrl(`/api/pms/room-type-change/${changeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'completed', chargeApplied: true, chargeAmount: 3000 },
      });
      const res = await putRoomTypeChange(req as any, { params: Promise.resolve({ id: changeId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('completed');
      expect(data.data.completedAt).toBeDefined();
      expect(data.data.chargeApplied).toBe(true);
      expect(data.data.chargeAmount).toBe(3000);
    });

    it('should reject invalid state transitions', async () => {
      // Already completed, so transitioning to 'requested' should fail
      const url = buildUrl(`/api/pms/room-type-change/${changeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'requested' },
      });
      const res = await putRoomTypeChange(req as any, { params: Promise.resolve({ id: changeId }) } as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Cannot transition');
    });

    it('should return 404 for non-existent change', async () => {
      const url = buildUrl('/api/pms/room-type-change/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'approved' },
      });
      const res = await putRoomTypeChange(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ─── DELETE /api/pms/room-type-change/[id] ───
  describe('DELETE /api/pms/room-type-change/[id]', () => {
    it('should return 400 when trying to delete a non-requested change', async () => {
      // The change was already approved/completed, so delete should fail
      const url = buildUrl(`/api/pms/room-type-change/${changeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteRoomTypeChange(req as any, { params: Promise.resolve({ id: changeId }) } as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('pending');
    });

    it('should delete a pending (requested) change', async () => {
      // Create a new pending change to delete
      const suffix = uniqueSuffix();
      const pendingRoom = await db.room.create({
        data: {
          propertyId: PROPERTY_ID,
          roomTypeId: ROOM_TYPE_ID,
          number: `RM-DEL-${suffix.slice(-4)}`,
          floor: 1,
          status: 'available',
        },
      });

      const createRes = await postRoomTypeChange(await createAuthRequest(buildUrl('/api/pms/room-type-change'), {
        method: 'POST',
        body: {
          roomId: pendingRoom.id,
          oldRoomTypeId: ROOM_TYPE_ID,
          newRoomTypeId,
          reason: 'Test deletion',
        },
      }) as any);

      const createData = await createRes.json();
      const pendingId = createData.data.id;

      const url = buildUrl(`/api/pms/room-type-change/${pendingId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteRoomTypeChange(req as any, { params: Promise.resolve({ id: pendingId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('cancelled');

      // Verify it was deleted
      const deleted = await db.roomTypeChange.findFirst({ where: { id: pendingId } });
      expect(deleted).toBeNull();

      // Clean up the pending room
      await db.room.delete({ where: { id: pendingRoom.id } });
    });

    it('should return 404 when deleting non-existent change', async () => {
      const url = buildUrl('/api/pms/room-type-change/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteRoomTypeChange(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  afterAll(async () => {
    if (changeId) {
      await db.roomTypeChange.deleteMany({ where: { id: changeId } });
    }
    if (newRoomTypeId) {
      await db.roomType.deleteMany({ where: { id: newRoomTypeId } });
    }
    if (fixture) {
      // Restore original room type in case it was changed by the test
      await db.room.update({ where: { id: fixture.room.id }, data: { roomTypeId: ROOM_TYPE_ID } });
      await fixture.cleanup();
    }
  });
});
