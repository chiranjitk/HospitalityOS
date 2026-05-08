import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/waitlist/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, ROOM_TYPE_ID, GUEST_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdEntryId: string;

describe('Waitlist API', () => {
  describe('GET /api/waitlist', () => {
    it('should return list of waitlist entries', async () => {
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should include stats', async () => {
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('waiting');
      expect(data.stats).toHaveProperty('notified');
      expect(data.stats).toHaveProperty('converted');
      expect(data.stats).toHaveProperty('expired');
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/waitlist', { status: 'waiting' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.every((e: any) => e.status === 'waiting')).toBe(true);
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/waitlist', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by roomTypeId', async () => {
      const url = buildUrl('/api/waitlist', { roomTypeId: ROOM_TYPE_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return validation error for invalid status', async () => {
      const url = buildUrl('/api/waitlist', { status: 'invalid_status' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should support pagination with limit', async () => {
      const url = buildUrl('/api/waitlist', { limit: '2' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(2);
    });

    it('should include guest and roomType data in entries', async () => {
      // Create a waitlist entry first so we have data
      const suffix = uniqueSuffix();
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 20);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      await db.waitlistEntry.create({
        data: {
          tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
          propertyId: PROPERTY_ID,
          guestId: GUEST_ID,
          roomTypeId: ROOM_TYPE_ID,
          checkIn,
          checkOut,
          status: 'waiting',
        },
      });

      const url = buildUrl('/api/waitlist', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const entry = data.data[0];
        expect(entry).toHaveProperty('guest');
        expect(entry).toHaveProperty('roomType');
        expect(entry).toHaveProperty('property');
      }

      // Cleanup
      await db.waitlistEntry.deleteMany({
        where: {
          tenantId: '444017d5-e022-4c5f-ac07-ea0d51f4609b',
          propertyId: PROPERTY_ID,
          guestId: GUEST_ID,
          status: 'waiting',
        },
      });
    });
  });

  describe('POST /api/waitlist', () => {
    it('should create a waitlist entry', async () => {
      const suffix = uniqueSuffix();
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 30);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestId: GUEST_ID,
          roomTypeId: ROOM_TYPE_ID,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          adults: 2,
          children: 1,
          priority: 5,
          notes: `Waitlist test ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('waiting');
      expect(data.data.guest).toBeDefined();
      createdEntryId = data.data.id;
    });

    it('should reject missing required fields', async () => {
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          // missing guestId, roomTypeId, checkIn, checkOut
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject check-out before check-in', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 30);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() - 1);

      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestId: GUEST_ID,
          roomTypeId: ROOM_TYPE_ID,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-existent property', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 30);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          guestId: GUEST_ID,
          roomTypeId: ROOM_TYPE_ID,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it('should reject non-existent guest', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 30);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestId: '00000000-0000-0000-0000-000000000000',
          roomTypeId: ROOM_TYPE_ID,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/waitlist', () => {
    it('should update a waitlist entry', async () => {
      if (!createdEntryId) return;
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdEntryId,
          priority: 10,
          notes: 'Updated priority',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.priority).toBe(10);
    });

    it('should update status to notified', async () => {
      if (!createdEntryId) return;
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdEntryId,
          status: 'notified',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('notified');
    });

    it('should reject invalid status', async () => {
      if (!createdEntryId) return;
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdEntryId,
          status: 'invalid_status',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent entry', async () => {
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          status: 'notified',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });

    it('should reject missing id', async () => {
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          status: 'notified',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/waitlist', () => {
    it('should delete a waitlist entry', async () => {
      if (!createdEntryId) return;
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: createdEntryId },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: {},
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent entry', async () => {
      const url = buildUrl('/api/waitlist');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: '00000000-0000-0000-0000-000000000000' },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });
});
