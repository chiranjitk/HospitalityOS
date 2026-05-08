import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/group-bookings/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdGroupId: string;

describe('Group Bookings API', () => {
  describe('GET /api/group-bookings', () => {
    it('should return list of group bookings', async () => {
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should include stats', async () => {
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('inquiry');
      expect(data.stats).toHaveProperty('confirmed');
      expect(data.stats).toHaveProperty('cancelled');
      expect(data.stats).toHaveProperty('totalValue');
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/group-bookings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/group-bookings', { status: 'inquiry' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.every((g: any) => g.status === 'inquiry')).toBe(true);
    });

    it('should support search by name/contact', async () => {
      const url = buildUrl('/api/group-bookings', { search: 'test' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return validation error for invalid status', async () => {
      const url = buildUrl('/api/group-bookings', { status: 'invalid_status' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should include property data for each group', async () => {
      const url = buildUrl('/api/group-bookings', { propertyId: PROPERTY_ID, limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const group = data.data[0];
        expect(group).toHaveProperty('property');
        expect(group).toHaveProperty('bookedRooms');
        expect(group).toHaveProperty('totalAmount');
      }
    });

    it('should support pagination', async () => {
      const url = buildUrl('/api/group-bookings', { limit: '2' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('POST /api/group-bookings', () => {
    it('should create a group booking', async () => {
      const suffix = uniqueSuffix();
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 60);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 5);

      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Group ${suffix.slice(-4)}`,
          description: 'Test group booking',
          contactName: 'Test Coordinator',
          contactEmail: `group${suffix.slice(-4)}@test.com`,
          contactPhone: '+919999999900',
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          totalRooms: 5,
          totalAmount: 50000,
          depositAmount: 10000,
          status: 'inquiry',
          notes: `Group booking test ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Group');
      expect(data.data.totalRooms).toBe(5);
      expect(data.data.status).toBe('inquiry');
      createdGroupId = data.data.id;
    });

    it('should reject missing required fields', async () => {
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          // missing name, checkIn, checkOut
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject check-out before check-in', async () => {
      const suffix = uniqueSuffix();
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 60);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() - 1);

      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `BadDates ${suffix}`,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid email format', async () => {
      const suffix = uniqueSuffix();
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 60);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `BadEmail ${suffix}`,
          contactEmail: 'not-an-email',
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid status', async () => {
      const suffix = uniqueSuffix();
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 60);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `BadStatus ${suffix}`,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          status: 'invalid_status',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-existent property', async () => {
      const suffix = uniqueSuffix();
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 60);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          name: `NoProp ${suffix}`,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/group-bookings', () => {
    it('should update a group booking', async () => {
      if (!createdGroupId) return;
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdGroupId,
          name: 'Updated Group Name',
          totalRooms: 8,
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Group Name');
      expect(data.data.totalRooms).toBe(8);
    });

    it('should update group booking status', async () => {
      if (!createdGroupId) return;
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdGroupId,
          status: 'tentative',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('tentative');
    });

    it('should reject missing id', async () => {
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          name: 'No Id Group',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent group', async () => {
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Ghost Group',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });

    it('should reject invalid status update', async () => {
      if (!createdGroupId) return;
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdGroupId,
          status: 'invalid_status',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/group-bookings', () => {
    it('should delete a group booking without associated bookings', async () => {
      if (!createdGroupId) return;
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: createdGroupId },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should reject missing id', async () => {
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: {},
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent group', async () => {
      const url = buildUrl('/api/group-bookings');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: '00000000-0000-0000-0000-000000000000' },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });
});
