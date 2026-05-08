import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/reservations/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdReservationId: string;
let createdTableId: string;

beforeAll(async () => {
  // Create a restaurant table for the property if none exists
  const existingTable = await db.restaurantTable.findFirst({
    where: { propertyId: PROPERTY_ID, status: 'available' },
  });
  if (existingTable) {
    createdTableId = existingTable.id;
  } else {
    const suffix = uniqueSuffix();
    const table = await db.restaurantTable.create({
      data: {
        propertyId: PROPERTY_ID,
        number: `TB-${suffix.slice(-4)}`,
        name: `Test Table ${suffix.slice(-4)}`,
        capacity: 4,
        area: 'Main Hall',
        status: 'available',
      },
    });
    createdTableId = table.id;
  }
});

describe('Reservations API (Restaurant)', () => {
  describe('GET /api/reservations', () => {
    it('should return list of reservations with pagination', async () => {
      const url = buildUrl('/api/reservations', { propertyId: PROPERTY_ID, limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it('should return reservations without propertyId (all tenant properties)', async () => {
      const url = buildUrl('/api/reservations', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter reservations by status', async () => {
      const url = buildUrl('/api/reservations', { propertyId: PROPERTY_ID, status: 'confirmed' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.every((r: any) => r.status === 'confirmed')).toBe(true);
    });

    it('should return validation error for invalid date', async () => {
      const url = buildUrl('/api/reservations', { propertyId: PROPERTY_ID, date: 'not-a-date' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return stats when stats=true', async () => {
      const url = buildUrl('/api/reservations', { propertyId: PROPERTY_ID, stats: 'true' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('statusCounts');
      expect(data.data).toHaveProperty('todayTotal');
      expect(data.data).toHaveProperty('todayConfirmed');
    });

    it('should return 400 for invalid property', async () => {
      const url = buildUrl('/api/reservations', { propertyId: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PROPERTY');
    });
  });

  describe('POST /api/reservations', () => {
    it('should create a new reservation successfully', async () => {
      const suffix = uniqueSuffix();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `TestGuest${suffix.slice(-4)}`,
          guestPhone: '+919999999901',
          guestEmail: `tguest${suffix.slice(-4)}@test.com`,
          partySize: 2,
          date: dateStr,
          time: '19:00',
          duration: 90,
          specialRequests: 'Window seat please',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.guestName).toContain('TestGuest');
      expect(data.data.partySize).toBe(2);
      expect(data.data.status).toBe('pending');
      createdReservationId = data.data.id;
    });

    it('should create a reservation with a table', async () => {
      const suffix = uniqueSuffix();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          tableId: createdTableId,
          guestName: `TableGuest${suffix.slice(-4)}`,
          guestPhone: '+919999999902',
          partySize: 3,
          date: dateStr,
          time: '20:00',
          status: 'confirmed',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.tableId).toBe(createdTableId);
      expect(data.data.status).toBe('confirmed');
      // Clean up
      await db.reservation.delete({ where: { id: data.data.id } });
    });

    it('should reject reservation with missing required fields', async () => {
      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          // missing guestName, guestPhone, partySize, date, time
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject reservation with invalid party size', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: 'BadParty',
          guestPhone: '+919999999903',
          partySize: 100,
          date: dateStr,
          time: '18:00',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject reservation with invalid property', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 4);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          guestName: 'BadProp',
          guestPhone: '+919999999904',
          partySize: 2,
          date: dateStr,
          time: '18:00',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_PROPERTY');
    });
  });

  describe('PUT /api/reservations', () => {
    it('should update a reservation', async () => {
      if (!createdReservationId) return;
      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdReservationId,
          partySize: 4,
          specialRequests: 'Updated request',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.partySize).toBe(4);
    });

    it('should update reservation status with valid transition', async () => {
      if (!createdReservationId) return;
      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdReservationId,
          status: 'confirmed',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('confirmed');
    });

    it('should reject invalid status transition', async () => {
      if (!createdReservationId) return;
      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdReservationId,
          status: 'completed', // confirmed -> completed is not valid (must go through seated)
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('should return 404 for non-existent reservation', async () => {
      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          partySize: 2,
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/reservations', () => {
    it('should cancel a pending/confirmed reservation', async () => {
      // Create a pending reservation first
      const suffix = uniqueSuffix();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const createReq = await createAuthRequest(buildUrl('/api/reservations'), {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `CancelGuest${suffix.slice(-4)}`,
          guestPhone: '+919999999905',
          partySize: 2,
          date: dateStr,
          time: '19:00',
          status: 'pending',
        },
      });
      const createRes = await POST(createReq);
      const createData = await createRes.json();
      expect(createRes.status).toBe(201);
      const cancelId = createData.data.id;

      const url = buildUrl('/api/reservations', { id: cancelId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('cancelled');
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/reservations');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent reservation', async () => {
      const url = buildUrl('/api/reservations', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    // Clean up created reservations
    if (createdReservationId) {
      try {
        await db.reservation.deleteMany({ where: { id: createdReservationId } });
      } catch (e) {
        // Might be already deleted, ignore
      }
    }
    // Clean up created table if we made one
    if (createdTableId) {
      try {
        // Only delete if name starts with "Test Table"
        const table = await db.restaurantTable.findUnique({ where: { id: createdTableId } });
        if (table && table.name?.startsWith('Test Table')) {
          await db.restaurantTable.delete({ where: { id: createdTableId } });
        }
      } catch (e) {
        console.error('Cleanup failed for restaurant table:', e);
      }
    }
  });
});
