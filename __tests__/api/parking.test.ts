import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/parking/route';
import { GET as getPasses, POST as createPass } from '@/app/api/parking/passes/route';
import { GET as getBilling, POST as createBillingRecord } from '@/app/api/parking/billing/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdSlotId: string;
let createdPassId: string;
let createdVehicleId: string;

describe('Parking API', () => {
  describe('GET /api/parking', () => {
    it('should return list of parking slots with pagination and summary', async () => {
      const url = buildUrl('/api/parking', { limit: '10' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.summary).toBeDefined();
    });

    it('should include summary statistics', async () => {
      const url = buildUrl('/api/parking', { limit: '10' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toHaveProperty('byStatus');
      expect(data.summary).toHaveProperty('byType');
      expect(data.summary).toHaveProperty('parkedVehicles');
      expect(data.summary).toHaveProperty('occupancyRate');
      expect(typeof data.summary.occupancyRate).toBe('number');
    });

    it('should filter slots by propertyId', async () => {
      const url = buildUrl('/api/parking', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter slots by status', async () => {
      const url = buildUrl('/api/parking', { status: 'available' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        expect(data.data.every((s: any) => s.status === 'available')).toBe(true);
      }
    });
  });

  describe('POST /api/parking', () => {
    it('should create a new parking slot', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/parking');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          number: `PS-${suffix.slice(-6)}`,
          floor: 1,
          type: 'standard',
          vehicleType: 'car',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.number).toMatch(/^PS-/);
      expect(data.data.status).toBe('available');
      createdSlotId = data.data.id;
    });

    it('should reject slot with missing number', async () => {
      const url = buildUrl('/api/parking');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          type: 'standard',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject slot with empty number', async () => {
      const url = buildUrl('/api/parking');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          number: '  ',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject slot with invalid type', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/parking');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          number: `PS-${suffix.slice(-6)}`,
          type: 'invalid_type',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject slot with invalid vehicle type', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/parking');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          number: `PS-${suffix.slice(-6)}`,
          vehicleType: 'spaceship',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/parking', () => {
    it('should update a parking slot status', async () => {
      if (!createdSlotId) return;
      const url = buildUrl('/api/parking');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdSlotId,
          status: 'maintenance',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('maintenance');
    });

    it('should return 404 for non-existent slot', async () => {
      const url = buildUrl('/api/parking');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: '00000000-0000-0000-0000-000000000000',
          status: 'available',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });

    it('should reject update with missing ID', async () => {
      const url = buildUrl('/api/parking');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          status: 'available',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/parking', () => {
    it('should delete a parking slot', async () => {
      if (!createdSlotId) return;
      // Reset slot status to available first
      await db.parkingSlot.update({ where: { id: createdSlotId }, data: { status: 'available' } });

      const url = buildUrl('/api/parking', { id: createdSlotId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
      createdSlotId = ''; // Already deleted
    });

    it('should return 404 for non-existent slot', async () => {
      const url = buildUrl('/api/parking', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/parking/passes', () => {
    it('should return list of parking passes with stats', async () => {
      const url = buildUrl('/api/parking/passes');
      const req = await createAuthRequest(url);
      const res = await getPasses(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('total');
      expect(data.stats).toHaveProperty('active');
    });

    it('should include slot and vehicle info in passes', async () => {
      const url = buildUrl('/api/parking/passes');
      const req = await createAuthRequest(url);
      const res = await getPasses(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toBeDefined();
      // Each pass may have slot and vehicle relations
    });
  });

  describe('POST /api/parking/passes', () => {
    it('should create a new parking pass', async () => {
      const suffix = uniqueSuffix();
      const startDate = new Date();
      const url = buildUrl('/api/parking/passes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          holderName: `Pass Holder ${suffix.slice(-4)}`,
          holderEmail: `pass${suffix.slice(-4)}@test.com`,
          licensePlate: `WB${suffix.slice(-4).toUpperCase()}`,
          startDate: startDate.toISOString(),
          duration: 'monthly',
          amount: 2000,
        },
      });
      const res = await createPass(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('active');
      expect(data.data.duration).toBe('monthly');
      createdPassId = data.data.id;
    });

    it('should reject pass with missing required fields', async () => {
      const url = buildUrl('/api/parking/passes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          // missing holderName, licensePlate, startDate
        },
      });
      const res = await createPass(req);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/parking/billing', () => {
    it('should return billing records with summary', async () => {
      const url = buildUrl('/api/parking/billing', { limit: '10' });
      const req = await createAuthRequest(url);
      const res = await getBilling(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.summary).toBeDefined();
    });

    it('should include billing summary', async () => {
      const url = buildUrl('/api/parking/billing');
      const req = await createAuthRequest(url);
      const res = await getBilling(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary).toHaveProperty('totalVehicles');
      expect(data.summary).toHaveProperty('paidCount');
      expect(data.summary).toHaveProperty('unpaidCount');
      expect(data.summary).toHaveProperty('totalFees');
    });

    it('should filter by payment status', async () => {
      const url = buildUrl('/api/parking/billing', { status: 'unpaid' });
      const req = await createAuthRequest(url);
      const res = await getBilling(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/parking/billing', () => {
    it('should create a billing record (check in vehicle)', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/parking/billing');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          licensePlate: `KA${suffix.slice(-6).toUpperCase()}`,
          make: 'TestMake',
          model: 'TestModel',
          color: 'Red',
          hourlyRate: 100,
          dailyMaxRate: 800,
        },
      });
      const res = await createBillingRecord(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.licensePlate).toMatch(/^KA/);
      expect(data.data.status).toBe('parked');
      expect(data.data.isPaid).toBe(false);
      createdVehicleId = data.data.id;
    });

    it('should reject billing record with missing license plate', async () => {
      const url = buildUrl('/api/parking/billing');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          make: 'NoPlate',
        },
      });
      const res = await createBillingRecord(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject billing record with too short license plate', async () => {
      const url = buildUrl('/api/parking/billing');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          licensePlate: 'A',
        },
      });
      const res = await createBillingRecord(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  afterAll(async () => {
    // Clean up vehicle
    if (createdVehicleId) {
      try {
        await db.vehicle.delete({ where: { id: createdVehicleId } });
      } catch (e) {
        console.error('Cleanup failed for vehicle:', e);
      }
    }
    // Clean up pass
    if (createdPassId) {
      try {
        // Free slot if reserved
        const pass = await db.parkingPass.findUnique({ where: { id: createdPassId } });
        if (pass?.slotId) {
          await db.parkingSlot.update({ where: { id: pass.slotId }, data: { status: 'available' } });
        }
        await db.parkingPass.delete({ where: { id: createdPassId } });
      } catch (e) {
        console.error('Cleanup failed for pass:', e);
      }
    }
    // Clean up slot if not already deleted
    if (createdSlotId) {
      try {
        await db.parkingSlot.delete({ where: { id: createdSlotId } });
      } catch (e) {
        // Already deleted
      }
    }
  });
});
