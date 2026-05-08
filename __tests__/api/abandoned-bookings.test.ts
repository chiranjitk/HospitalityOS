import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/marketing/abandoned-bookings/route';
import { POST as recover } from '@/app/api/marketing/abandoned-bookings/recover/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, ROOM_TYPE_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let abandonedBookingId: string;

describe('Abandoned Bookings API', () => {
  describe('GET /api/marketing/abandoned-bookings', () => {
    it('should return list of abandoned bookings with stats', async () => {
      const url = buildUrl('/api/marketing/abandoned-bookings');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.bookings).toBeDefined();
      expect(Array.isArray(data.data.bookings)).toBe(true);
      expect(data.data.stats).toBeDefined();
      expect(typeof data.data.stats.total).toBe('number');
      expect(data.data.stats.funnel).toBeDefined();
      expect(data.data.stats.recovery).toBeDefined();
      expect(typeof data.data.stats.recoveryRate).toBe('number');
    });

    it('should filter by recoveryStatus', async () => {
      const url = buildUrl('/api/marketing/abandoned-bookings', { recoveryStatus: 'pending' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.bookings)).toBe(true);
      for (const b of data.data.bookings) {
        expect(b.recoveryStatus).toBe('pending');
      }
    });

    it('should filter by stepAbandoned', async () => {
      const url = buildUrl('/api/marketing/abandoned-bookings', { stepAbandoned: 'payment' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.bookings)).toBe(true);
      for (const b of data.data.bookings) {
        expect(b.stepAbandoned).toBe('payment');
      }
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/marketing/abandoned-bookings', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/marketing/abandoned-bookings', () => {
    it('should create an abandoned booking record', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/marketing/abandoned-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          sessionId: `sess-${suffix}`,
          guestEmail: `abandoned-${suffix.slice(-6)}@test.com`,
          guestPhone: '+919888888888',
          roomTypeId: ROOM_TYPE_ID,
          propertyId: PROPERTY_ID,
          checkIn: '2025-08-15',
          checkOut: '2025-08-18',
          adults: 2,
          children: 1,
          selectedRate: 7500,
          currency: 'INR',
          stepAbandoned: 'payment',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.stepAbandoned).toBe('payment');
      expect(data.data.recoveryStatus).toBe('pending');
      expect(data.data.selectedRate).toBe(7500);
      expect(data.data.currency).toBe('INR');
      expect(data.data.adults).toBe(2);
      expect(data.data.children).toBe(1);
      abandonedBookingId = data.data.id;
    });

    it('should reject creation without stepAbandoned', async () => {
      const url = buildUrl('/api/marketing/abandoned-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestEmail: 'test@test.com',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should create with minimal fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/marketing/abandoned-bookings');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { stepAbandoned: 'search' },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.stepAbandoned).toBe('search');
      expect(data.data.recoveryStatus).toBe('pending');
      expect(data.data.currency).toBe('USD');
      // Clean up
      await db.abandonedBooking.delete({ where: { id: data.data.id } });
    });

    it('should create abandoned booking at each funnel step', async () => {
      const suffix = uniqueSuffix();
      const steps = ['search', 'room_select', 'guest_info', 'payment'];

      for (const step of steps) {
        const url = buildUrl('/api/marketing/abandoned-bookings');
        const req = await createAuthRequest(url, {
          method: 'POST',
          body: {
            stepAbandoned: step,
            guestEmail: `funnel-${step}-${suffix.slice(-6)}@test.com`,
          },
        });
        const res = await POST(req as any);
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.stepAbandoned).toBe(step);
        // Clean up each one
        await db.abandonedBooking.delete({ where: { id: data.data.id } });
      }
    });
  });

  describe('POST /api/marketing/abandoned-bookings/recover', () => {
    it('should send email recovery', async () => {
      const url = buildUrl('/api/marketing/abandoned-bookings/recover');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          id: abandonedBookingId,
          channel: 'email',
          offerPercent: 10,
        },
      });
      const res = await recover(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('email');
      expect(data.data.booking).toBeDefined();
      expect(data.data.booking.recoveryStatus).toBe('emailed');
      expect(data.data.booking.recoveryOffer).toBeDefined();
    });

    it('should send SMS recovery', async () => {
      // Create a fresh abandoned booking for SMS test
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/marketing/abandoned-bookings');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          stepAbandoned: 'guest_info',
          guestEmail: `sms-test-${suffix.slice(-6)}@test.com`,
          guestPhone: '+919777777777',
          selectedRate: 5000,
        },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const smsBookingId = createData.data.id;

      const url = buildUrl('/api/marketing/abandoned-bookings/recover');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          id: smsBookingId,
          channel: 'sms',
          offerPercent: 15,
        },
      });
      const res = await recover(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('sms');
      expect(data.data.booking.recoveryStatus).toBe('sms_sent');

      // Clean up
      await db.abandonedBooking.delete({ where: { id: smsBookingId } });
    });

    it('should reject without id or channel', async () => {
      const url = buildUrl('/api/marketing/abandoned-bookings/recover');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {},
      });
      const res = await recover(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject invalid channel', async () => {
      const url = buildUrl('/api/marketing/abandoned-bookings/recover');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { id: abandonedBookingId, channel: 'whatsapp' },
      });
      const res = await recover(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should return 404 for non-existent booking', async () => {
      const url = buildUrl('/api/marketing/abandoned-bookings/recover');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { id: '00000000-0000-0000-0000-000000000000', channel: 'email' },
      });
      const res = await recover(req as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    if (abandonedBookingId) {
      try {
        await db.abandonedBooking.delete({ where: { id: abandonedBookingId } });
      } catch { /* ok */ }
    }
  });
});
