import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/events/route';
import { GET as getEventById, PUT, DELETE } from '@/app/api/events/[id]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdEventId: string;

describe('Events API', () => {
  describe('GET /api/events', () => {
    it('should return list of events', async () => {
      const url = buildUrl('/api/events');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events).toBeDefined();
      expect(Array.isArray(data.events)).toBe(true);
    });

    it('should include stats in response', async () => {
      const url = buildUrl('/api/events');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('upcoming');
      expect(data.stats).toHaveProperty('totalRevenue');
      expect(typeof data.stats.total).toBe('number');
    });

    it('should filter events by propertyId', async () => {
      const url = buildUrl('/api/events', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events).toBeDefined();
    });

    it('should filter events by status', async () => {
      const url = buildUrl('/api/events', { status: 'confirmed' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.events.length > 0) {
        expect(data.events.every((e: any) => e.status === 'confirmed')).toBe(true);
      }
    });

    it('should include property and space info', async () => {
      const url = buildUrl('/api/events', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.events.length > 0) {
        const event = data.events[0];
        // property should be included via the include
        expect(event).toHaveProperty('property');
        expect(event).toHaveProperty('_count');
      }
    });

    it('should filter by multiple statuses', async () => {
      const url = buildUrl('/api/events', { status: 'confirmed', status: 'inquiry' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.events).toBeDefined();
    });
  });

  describe('POST /api/events', () => {
    it('should create a new event successfully', async () => {
      const suffix = uniqueSuffix();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 4);

      const url = buildUrl('/api/events');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Test Event ${suffix.slice(-6)}`,
          type: 'meeting',
          organizerName: `Organizer ${suffix.slice(-4)}`,
          organizerEmail: `org${suffix.slice(-4)}@test.com`,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          expectedAttendance: 25,
          totalAmount: 5000,
          currency: 'INR',
          status: 'inquiry',
          notes: 'API test event',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.name).toContain('Test Event');
      expect(data.organizerName).toBeDefined();
      expect(data.property).toBeDefined();
      createdEventId = data.id;
    });

    it('should reject event with missing required fields', async () => {
      const url = buildUrl('/api/events');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          // missing name, organizerName, startDate, endDate
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('should create event with default values', async () => {
      const suffix = uniqueSuffix();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 60);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 2);

      const url = buildUrl('/api/events');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Minimal Event ${suffix.slice(-6)}`,
          organizerName: 'Test',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.type).toBe('meeting'); // default type
      expect(data.status).toBe('inquiry'); // default status
      // Clean up
      await db.eventResource.deleteMany({ where: { eventId: data.id } });
      await db.event.delete({ where: { id: data.id } });
    });
  });

  describe('GET /api/events/[id]', () => {
    it('should get an event by ID', async () => {
      if (!createdEventId) return;
      const url = buildUrl(`/api/events/${createdEventId}`);
      const req = await createAuthRequest(url);
      const res = await getEventById(req, { params: Promise.resolve({ id: createdEventId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(createdEventId);
      expect(data.name).toContain('Test Event');
      expect(data.property).toBeDefined();
      expect(data.resources).toBeDefined();
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/events/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getEventById(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/events/[id]', () => {
    it('should update an event', async () => {
      if (!createdEventId) return;
      const url = buildUrl(`/api/events/${createdEventId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          expectedAttendance: 50,
          notes: 'Updated attendance via API',
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: createdEventId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.expectedAttendance).toBe(50);
    });

    it('should update event status', async () => {
      if (!createdEventId) return;
      const url = buildUrl(`/api/events/${createdEventId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          status: 'confirmed',
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: createdEventId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('confirmed');
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/events/${fakeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'Ghost' },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/events/[id]', () => {
    it('should delete an event', async () => {
      if (!createdEventId) return;
      const url = buildUrl(`/api/events/${createdEventId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: createdEventId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toContain('deleted');
      createdEventId = ''; // Already deleted
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/events/${fakeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    // Clean up any remaining events
    if (createdEventId) {
      try {
        await db.eventResource.deleteMany({ where: { eventId: createdEventId } });
        await db.event.delete({ where: { id: createdEventId } });
      } catch (e) {
        // Already deleted
      }
    }
  });
});
