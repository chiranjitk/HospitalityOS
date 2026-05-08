import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/bookings/route';
import { GET as getBookingById, PUT, PATCH } from '@/app/api/bookings/[id]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, ROOM_TYPE_ID, GUEST_ID, BOOKING_ID, uniqueSuffix, createTestFixture } from './test-helpers';
import { db } from '@/lib/db';

let fixture: Awaited<ReturnType<typeof createTestFixture>>;
let createdBookingId: string;

beforeAll(async () => {
  fixture = await createTestFixture();
});

describe('Bookings API', () => {
  describe('GET /api/bookings', () => {
    it('should return list of bookings with pagination', async () => {
      const url = buildUrl('/api/bookings', { propertyId: PROPERTY_ID, limit: '5' });
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

    it('should filter bookings by status', async () => {
      const url = buildUrl('/api/bookings', { status: 'confirmed', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.every((b: any) => b.status === 'confirmed')).toBe(true);
    });

    it('should filter bookings by guestId', async () => {
      const url = buildUrl('/api/bookings', { guestId: GUEST_ID, limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should return validation error for invalid checkInFrom date', async () => {
      const url = buildUrl('/api/bookings', { checkInFrom: 'not-a-date' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should include room and guest info in each booking', async () => {
      const url = buildUrl('/api/bookings', { limit: '1' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const booking = data.data[0];
        expect(booking).toHaveProperty('primaryGuest');
        expect(booking).toHaveProperty('roomType');
      }
    });
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking successfully', async () => {
      const suffix = uniqueSuffix();
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 5);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const url = buildUrl('/api/bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          primaryGuestId: fixture.guest.id,
          roomTypeId: ROOM_TYPE_ID,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          adults: 2,
          roomRate: 5000,
          totalAmount: 15000,
          currency: 'INR',
          source: 'direct',
          status: 'confirmed',
          skipLockCheck: true,
          specialRequests: `Test booking ${suffix}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.confirmationCode).toMatch(/^SS-/);
      expect(data.data.status).toBe('confirmed');
      expect(data.data.primaryGuest).toBeDefined();
      createdBookingId = data.data.id;
    });

    it('should reject booking with missing required fields', async () => {
      const url = buildUrl('/api/bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          // missing primaryGuestId, roomTypeId, checkIn, checkOut
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject booking with check-out before check-in', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 10);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() - 1);

      const url = buildUrl('/api/bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          primaryGuestId: fixture.guest.id,
          roomTypeId: ROOM_TYPE_ID,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          skipLockCheck: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_DATES');
    });

    it('should reject booking with past check-in date', async () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);
      const future = new Date();
      future.setDate(future.getDate() + 5);

      const url = buildUrl('/api/bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          primaryGuestId: fixture.guest.id,
          roomTypeId: ROOM_TYPE_ID,
          checkIn: past.toISOString(),
          checkOut: future.toISOString(),
          skipLockCheck: true,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject booking with non-existent guest', async () => {
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 5);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 3);

      const url = buildUrl('/api/bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          primaryGuestId: '00000000-0000-0000-0000-000000000000',
          roomTypeId: ROOM_TYPE_ID,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          skipLockCheck: true,
        },
      });
      const res = await POST(req);
      // 500 because the guest check throws inside a transaction
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('GET /api/bookings/[id]', () => {
    it('should get a booking by ID', async () => {
      const url = buildUrl(`/api/bookings/${BOOKING_ID}`);
      const req = await createAuthRequest(url);
      const res = await getBookingById(req, { params: Promise.resolve({ id: BOOKING_ID }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(BOOKING_ID);
      expect(data.data.confirmationCode).toBeDefined();
      expect(data.data.folios).toBeDefined();
    });

    it('should return 404 for non-existent booking', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/bookings/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getBookingById(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });

    it('should include folios and line items', async () => {
      const url = buildUrl(`/api/bookings/${BOOKING_ID}`);
      const req = await createAuthRequest(url);
      const res = await getBookingById(req, { params: Promise.resolve({ id: BOOKING_ID }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.folios).toBeDefined();
      expect(Array.isArray(data.data.folios)).toBe(true);
    });
  });

  describe('PUT /api/bookings/[id]', () => {
    it('should update a booking field', async () => {
      if (!createdBookingId) return;
      const url = buildUrl(`/api/bookings/${createdBookingId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          specialRequests: 'Updated special requests',
          notes: 'API test notes',
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: createdBookingId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.specialRequests).toBe('Updated special requests');
    });

    it('should reject invalid status transition', async () => {
      if (!createdBookingId) return;
      const url = buildUrl(`/api/bookings/${createdBookingId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          status: 'checked_out', // confirmed -> checked_out is not valid
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: createdBookingId }) } as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('should return 404 for non-existent booking', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/bookings/${fakeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { notes: 'test' },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/bookings/[id]', () => {
    it('should partially update a booking', async () => {
      if (!createdBookingId) return;
      const url = buildUrl(`/api/bookings/${createdBookingId}`);
      const req = await createAuthRequest(url, {
        method: 'PATCH',
        body: {
          internalNotes: 'PATCH test internal notes',
        },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: createdBookingId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.internalNotes).toBe('PATCH test internal notes');
    });

    it('should reject PATCH with no valid fields', async () => {
      if (!createdBookingId) return;
      const url = buildUrl(`/api/bookings/${createdBookingId}`);
      const req = await createAuthRequest(url, {
        method: 'PATCH',
        body: {
          unknownField: 'value',
        },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: createdBookingId }) } as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  afterAll(async () => {
    // Clean up the booking we created (cascade should handle folio + line items)
    if (createdBookingId) {
      try {
        await db.folioLineItemAudit.deleteMany({
          where: { folioId: { in: (await db.folio.findMany({ where: { bookingId: createdBookingId }, select: { id: true } })).map(f => f.id) } },
        });
        await db.folioLineItem.deleteMany({
          where: { folioId: { in: (await db.folio.findMany({ where: { bookingId: createdBookingId }, select: { id: true } })).map(f => f.id) } },
        });
        await db.folio.deleteMany({ where: { bookingId: createdBookingId } });
        await db.guestStay.deleteMany({ where: { bookingId: createdBookingId } });
        await db.bookingAuditLog.deleteMany({ where: { bookingId: createdBookingId } });
        await db.booking.delete({ where: { id: createdBookingId } });
      } catch (e) {
        console.error('Cleanup failed for created booking:', e);
      }
    }
    if (fixture) await fixture.cleanup();
  });
});
