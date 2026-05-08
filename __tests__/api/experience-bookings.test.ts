import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/experience-bookings/route';
import { createAuthRequest, buildUrl, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let experienceId: string;
let createdBookingId: string;

describe('Experience Bookings API', () => {
  beforeAll(async () => {
    // Create a test experience for booking tests
    const suffix = uniqueSuffix();
    const exp = await db.experience.create({
      data: {
        tenantId: TENANT_ID,
        name: `Test Booking Exp ${suffix.slice(-4)}`,
        description: 'Test experience for bookings',
        duration: 60,
        maxParticipants: 20,
        basePrice: 1000,
        status: 'active',
      },
    });
    experienceId = exp.id;
  });

  afterAll(async () => {
    if (experienceId) {
      try {
        await db.experienceBooking.deleteMany({ where: { experienceId } });
        await db.experience.delete({ where: { id: experienceId } });
      } catch (e) { /* ignore */ }
    }
  });

  describe('GET /api/experience-bookings', () => {
    it('should return list of experience bookings with pagination', async () => {
      const url = buildUrl('/api/experience-bookings', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(data.summary.totalBookings).toBeDefined();
      expect(data.summary.revenue).toBeDefined();
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/experience-bookings', { status: 'pending', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by experienceId', async () => {
      const url = buildUrl('/api/experience-bookings', { experienceId, limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should include experience details in booking items', async () => {
      const url = buildUrl('/api/experience-bookings', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        expect(data.data[0].experience).toBeDefined();
        expect(data.data[0].experience.name).toBeDefined();
      }
    });
  });

  describe('POST /api/experience-bookings', () => {
    it('should create a new experience booking', async () => {
      const tomorrow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          experienceId,
          guestName: 'Test Booking Guest',
          guestEmail: 'bookingguest@test.com',
          bookingDate: tomorrow,
          bookingTime: '10:00',
          numberOfGuests: 2,
          specialRequests: 'Window seat please',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('pending');
      expect(data.data.totalPrice).toBe(2000); // basePrice(1000) * guests(2)
      expect(data.data.experience).toBeDefined();
      createdBookingId = data.data.id;
    });

    it('should reject booking with missing required fields', async () => {
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestName: 'Incomplete',
          // missing experienceId, bookingDate, bookingTime
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject booking with too many guests', async () => {
      const tomorrow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          experienceId,
          guestName: 'Big Group',
          bookingDate: tomorrow,
          bookingTime: '14:00',
          numberOfGuests: 25,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject booking for non-existent experience', async () => {
      const tomorrow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          experienceId: '00000000-0000-0000-0000-000000000000',
          guestName: 'Ghost',
          bookingDate: tomorrow,
          bookingTime: '10:00',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/experience-bookings', () => {
    it('should confirm a pending booking', async () => {
      if (!createdBookingId) return;
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: createdBookingId, status: 'confirmed' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('confirmed');
      expect(data.data.confirmedAt).toBeDefined();
    });

    it('should update guest details', async () => {
      if (!createdBookingId) return;
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: createdBookingId, guestPhone: '+919876543210' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.guestPhone).toBe('+919876543210');
    });

    it('should reject invalid status transition', async () => {
      if (!createdBookingId) return;
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: createdBookingId, status: 'completed' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'confirmed' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent booking', async () => {
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', status: 'confirmed' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/experience-bookings', () => {
    it('should cancel then soft-delete a pending booking', async () => {
      if (!createdBookingId) return;
      // First cancel
      const cancelUrl = buildUrl('/api/experience-bookings');
      const cancelReq = await createAuthRequest(cancelUrl, {
        method: 'PUT',
        body: { id: createdBookingId, status: 'cancelled', cancellationReason: 'Test cleanup' },
      });
      const cancelRes = await PUT(cancelReq);
      expect(cancelRes.status).toBe(200);

      // Then soft-delete
      const url = buildUrl('/api/experience-bookings', { id: createdBookingId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/experience-bookings');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent booking', async () => {
      const url = buildUrl('/api/experience-bookings', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });
});
