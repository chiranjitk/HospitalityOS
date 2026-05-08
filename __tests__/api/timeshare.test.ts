import { describe, it, expect, afterAll } from 'vitest';
import { GET as getTimeshareUnits, POST as postTimeshareUnit } from '@/app/api/resort/timeshare/units/route';
import { GET as getTimeshareOwnerships, POST as postTimeshareOwnership } from '@/app/api/resort/timeshare/ownerships/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, ROOM_TYPE_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let unitId: string;
let ownershipId: string;

describe('Timeshare API', () => {
  // ─── POST /api/resort/timeshare/units ───
  describe('POST /api/resort/timeshare/units', () => {
    it('should create a new timeshare unit', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/resort/timeshare/units');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          unitNumber: `TS-${suffix.slice(-6)}`,
          roomTypeId: ROOM_TYPE_ID,
          seasonType: 'peak',
          weekNumber: 15,
          pointsValue: 2500,
          usageType: 'floating',
          isActive: true,
        },
      });
      const res = await postTimeshareUnit(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.unitNumber).toContain('TS-');
      expect(data.data.seasonType).toBe('peak');
      expect(data.data.weekNumber).toBe(15);
      expect(data.data.pointsValue).toBe(2500);
      expect(data.data.usageType).toBe('floating');
      expect(data.data.isActive).toBe(true);
      unitId = data.data.id;
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl('/api/resort/timeshare/units');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { unitNumber: 'TS-123' },
      });
      const res = await postTimeshareUnit(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });
  });

  // ─── GET /api/resort/timeshare/units ───
  describe('GET /api/resort/timeshare/units', () => {
    it('should return list of timeshare units with stats and pagination', async () => {
      const url = buildUrl('/api/resort/timeshare/units');
      const req = await createAuthRequest(url);
      const res = await getTimeshareUnits(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.totalUnits).toBe('number');
      expect(typeof data.stats.activeUnits).toBe('number');
      expect(typeof data.stats.totalOwnerships).toBe('number');
      expect(typeof data.stats.totalAnnualMF).toBe('number');
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
      expect(data.pagination.pages).toBeDefined();
    });

    it('should filter units by seasonType', async () => {
      const url = buildUrl('/api/resort/timeshare/units', { seasonType: 'peak' });
      const req = await createAuthRequest(url);
      const res = await getTimeshareUnits(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter units by isActive', async () => {
      const url = buildUrl('/api/resort/timeshare/units', { isActive: 'true' });
      const req = await createAuthRequest(url);
      const res = await getTimeshareUnits(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter units by propertyId', async () => {
      const url = buildUrl('/api/resort/timeshare/units', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getTimeshareUnits(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  // ─── POST /api/resort/timeshare/ownerships ───
  describe('POST /api/resort/timeshare/ownerships', () => {
    it('should create a new timeshare ownership', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/resort/timeshare/ownerships');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          unitId,
          ownerName: `Test Owner ${suffix}`,
          ownerEmail: `owner${suffix.slice(-4)}@test.com`,
          ownerPhone: '+919876543210',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          purchasePrice: 500000,
          annualMf: 25000,
          status: 'active',
          notes: 'Test ownership record',
        },
      });
      const res = await postTimeshareOwnership(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.unitId).toBe(unitId);
      expect(data.data.ownerName).toContain('Test Owner');
      expect(data.data.purchasePrice).toBe(500000);
      expect(data.data.annualMf).toBe(25000);
      expect(data.data.status).toBe('active');
      expect(data.data.unit).toBeDefined();
      ownershipId = data.data.id;
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl('/api/resort/timeshare/ownerships');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { ownerName: 'Missing fields owner' },
      });
      const res = await postTimeshareOwnership(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should return 404 when unit does not belong to tenant', async () => {
      const url = buildUrl('/api/resort/timeshare/ownerships');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          unitId: '00000000-0000-0000-0000-000000000000',
          ownerName: 'Invalid Owner',
          startDate: new Date().toISOString(),
          purchasePrice: 100000,
        },
      });
      const res = await postTimeshareOwnership(req as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  // ─── GET /api/resort/timeshare/ownerships ───
  describe('GET /api/resort/timeshare/ownerships', () => {
    it('should return list of timeshare ownerships with stats and pagination', async () => {
      const url = buildUrl('/api/resort/timeshare/ownerships');
      const req = await createAuthRequest(url);
      const res = await getTimeshareOwnerships(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.activeCount).toBe('number');
      expect(typeof data.stats.expiredCount).toBe('number');
      expect(typeof data.stats.totalAnnualMF).toBe('number');
      expect(typeof data.stats.totalPurchaseValue).toBe('number');
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBeDefined();
      expect(data.pagination.pages).toBeDefined();
    });

    it('should filter ownerships by status', async () => {
      const url = buildUrl('/api/resort/timeshare/ownerships', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await getTimeshareOwnerships(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter ownerships by unitId', async () => {
      const url = buildUrl('/api/resort/timeshare/ownerships', { unitId });
      const req = await createAuthRequest(url);
      const res = await getTimeshareOwnerships(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      if (data.data.length > 0) {
        expect(data.data[0].unitId).toBe(unitId);
      }
    });

    it('should search ownerships by owner name', async () => {
      const url = buildUrl('/api/resort/timeshare/ownerships', { search: 'Test Owner' });
      const req = await createAuthRequest(url);
      const res = await getTimeshareOwnerships(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  afterAll(async () => {
    if (ownershipId) {
      await db.timeshareOwnership.deleteMany({ where: { id: ownershipId } });
    }
    if (unitId) {
      await db.timeshareOwnership.deleteMany({ where: { unitId } });
      await db.timeshareUnit.deleteMany({ where: { id: unitId } });
    }
  });
});
