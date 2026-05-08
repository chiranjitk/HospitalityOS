import { describe, it, expect, afterAll } from 'vitest';
import {
  GET as GETReservations,
  POST as POSTReservation,
  PUT as PUTReservation,
  DELETE as DELETEReservation,
} from '@/app/api/pos-reservations/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

const createdReservationIds: string[] = [];

describe('POS Reservations API', () => {
  describe('GET /api/pos-reservations', () => {
    it('should list reservations for a property', async () => {
      const url = buildUrl('/api/pos-reservations', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETReservations(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should reject request without propertyId', async () => {
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url);
      const res = await GETReservations(req as any);
      expect(res.status).toBe(400);
    });

    it('should filter by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      const url = buildUrl('/api/pos-reservations', {
        propertyId: PROPERTY_ID,
        date: today,
      });
      const req = await createAuthRequest(url);
      const res = await GETReservations(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/pos-reservations', {
        propertyId: PROPERTY_ID,
        status: 'pending',
      });
      const req = await createAuthRequest(url);
      const res = await GETReservations(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const r of data.data) {
        expect(r.status).toBe('pending');
      }
    });

    it('should filter by guestName', async () => {
      const url = buildUrl('/api/pos-reservations', {
        propertyId: PROPERTY_ID,
        guestName: 'test',
      });
      const req = await createAuthRequest(url);
      const res = await GETReservations(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should include table details', async () => {
      const url = buildUrl('/api/pos-reservations', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETReservations(req as any);
      const data = await res.json();
      for (const r of data.data) {
        expect(r).toHaveProperty('table');
      }
    });

    it('should reject invalid propertyId', async () => {
      const url = buildUrl('/api/pos-reservations', {
        propertyId: '00000000-0000-0000-0000-000000000000',
      });
      const req = await createAuthRequest(url);
      const res = await GETReservations(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/pos-reservations', () => {
    it('should create a reservation', async () => {
      const suffix = uniqueSuffix();
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Reserve Guest ${suffix}`,
          guestPhone: '+919876543210',
          date: futureDate.toISOString().split('T')[0],
          time: '19:00',
          partySize: 4,
          duration: 90,
          specialRequests: 'Window table preferred',
          occasion: 'birthday',
          source: 'walk-in',
        },
      });
      const res = await POSTReservation(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.guestName).toBe(`Reserve Guest ${suffix}`);
      expect(data.data.partySize).toBe(4);
      expect(data.data.status).toBe('pending');
      expect(data.data.source).toBe('walk-in');
      expect(data.data.table).toBeDefined();
      createdReservationIds.push(data.data.id);
    });

    it('should create reservation with default values', async () => {
      const suffix = uniqueSuffix();
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Default Guest ${suffix}`,
          guestPhone: '+919999999999',
          date: futureDate.toISOString().split('T')[0],
          time: '20:00',
          partySize: 2,
        },
      });
      const res = await POSTReservation(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.duration).toBe(90);
      expect(data.data.source).toBe('manual');
      expect(data.data.status).toBe('pending');
      createdReservationIds.push(data.data.id);
    });

    it('should reject without required fields', async () => {
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID },
      });
      const res = await POSTReservation(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject without propertyId', async () => {
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          guestName: 'No Property',
          date: '2025-01-01',
          time: '18:00',
          partySize: 2,
        },
      });
      const res = await POSTReservation(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject with invalid tableId', async () => {
      const suffix = uniqueSuffix();
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Bad Table ${suffix}`,
          date: futureDate.toISOString().split('T')[0],
          time: '18:00',
          partySize: 2,
          tableId: '00000000-0000-0000-0000-000000000000',
        },
      });
      const res = await POSTReservation(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/pos-reservations', () => {
    it('should update reservation status to seated', async () => {
      const suffix = uniqueSuffix();
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

      // Create
      const createUrl = buildUrl('/api/pos-reservations');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Seat Guest ${suffix}`,
          guestPhone: '+919876543210',
          date: futureDate.toISOString().split('T')[0],
          time: '20:00',
          partySize: 2,
        },
      });
      const createRes = await POSTReservation(createReq as any);
      const createData = await createRes.json();
      const resId = createData.data.id;
      createdReservationIds.push(resId);

      // Update
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: resId, status: 'seated', seatedAt: new Date().toISOString() },
      });
      const res = await PUTReservation(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('seated');
      expect(data.data.seatedAt).toBeDefined();
    });

    it('should update reservation details', async () => {
      const suffix = uniqueSuffix();
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const createUrl = buildUrl('/api/pos-reservations');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Update Guest ${suffix}`,
          guestPhone: '+919876543210',
          date: futureDate.toISOString().split('T')[0],
          time: '18:00',
          partySize: 2,
        },
      });
      const createRes = await POSTReservation(createReq as any);
      const createData = await createRes.json();
      const resId = createData.data.id;
      createdReservationIds.push(resId);

      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: resId, partySize: 6, specialRequests: 'Highchair needed', occasion: 'anniversary' },
      });
      const res = await PUTReservation(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.partySize).toBe(6);
      expect(data.data.specialRequests).toBe('Highchair needed');
      expect(data.data.occasion).toBe('anniversary');
    });

    it('should return 404 for non-existent reservation', async () => {
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', status: 'seated' },
      });
      const res = await PUTReservation(req as any);
      expect(res.status).toBe(404);
    });

    it('should reject without id', async () => {
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'seated' },
      });
      const res = await PUTReservation(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/pos-reservations', () => {
    it('should cancel a reservation', async () => {
      const suffix = uniqueSuffix();
      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      const createUrl = buildUrl('/api/pos-reservations');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Cancel Reserve ${suffix}`,
          guestPhone: '+919876543210',
          date: futureDate.toISOString().split('T')[0],
          time: '18:00',
          partySize: 6,
        },
      });
      const createRes = await POSTReservation(createReq as any);
      const createData = await createRes.json();
      const resId = createData.data.id;

      const url = buildUrl('/api/pos-reservations', { id: resId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEReservation(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(resId);

      // Verify status is cancelled
      const reservation = await db.reservation.findFirst({ where: { id: resId } });
      expect(reservation?.status).toBe('cancelled');
      expect(reservation?.cancelledAt).toBeDefined();
    });

    it('should reject deletion without id', async () => {
      const url = buildUrl('/api/pos-reservations');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEReservation(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent reservation', async () => {
      const url = buildUrl('/api/pos-reservations', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEReservation(req as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    for (const id of createdReservationIds) {
      await db.reservation.delete({ where: { id } }).catch(() => {});
    }
  });
});
