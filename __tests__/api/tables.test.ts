import { describe, it, expect, afterAll } from 'vitest';
import {
  GET as GETTables,
  POST as POSTTable,
  PUT as PUTTable,
  DELETE as DELETETable,
} from '@/app/api/tables/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

const createdTableIds: string[] = [];

describe('Tables API', () => {
  describe('GET /api/tables', () => {
    it('should list tables with pagination', async () => {
      const url = buildUrl('/api/tables', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.total).toBe('number');
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/tables', {
        propertyId: PROPERTY_ID,
        status: 'available',
      });
      const req = await createAuthRequest(url);
      const res = await GETTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const table of data.data) {
        expect(table.status).toBe('available');
      }
    });

    it('should filter by area', async () => {
      const url = buildUrl('/api/tables', {
        propertyId: PROPERTY_ID,
        area: 'Main Hall',
      });
      const req = await createAuthRequest(url);
      const res = await GETTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const table of data.data) {
        expect(table.area).toBe('Main Hall');
      }
    });

    it('should filter by floor', async () => {
      const url = buildUrl('/api/tables', {
        propertyId: PROPERTY_ID,
        floor: '1',
      });
      const req = await createAuthRequest(url);
      const res = await GETTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const table of data.data) {
        expect(table.floor).toBe(1);
      }
    });

    it('should search by number or name', async () => {
      const url = buildUrl('/api/tables', {
        propertyId: PROPERTY_ID,
        search: 'T1',
      });
      const req = await createAuthRequest(url);
      const res = await GETTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return stats when stats=true', async () => {
      const url = buildUrl('/api/tables', {
        propertyId: PROPERTY_ID,
        stats: 'true',
      });
      const req = await createAuthRequest(url);
      const res = await GETTables(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.statusCounts).toBeDefined();
      expect(data.data.areaCounts).toBeDefined();
      expect(typeof data.data.totalCapacity).toBe('number');
      expect(typeof data.data.totalTables).toBe('number');
    });

    it('should include active orders count', async () => {
      const url = buildUrl('/api/tables', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETTables(req as any);
      const data = await res.json();
      for (const table of data.data) {
        expect(table._count).toBeDefined();
        expect(typeof table._count.orders).toBe('number');
      }
    });

    it('should respect limit and offset', async () => {
      const url = buildUrl('/api/tables', {
        propertyId: PROPERTY_ID,
        limit: '2',
        offset: '0',
      });
      const req = await createAuthRequest(url);
      const res = await GETTables(req as any);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(2);
      expect(data.pagination.limit).toBe(2);
    });
  });

  describe('POST /api/tables', () => {
    it('should create a table', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          number: `TBL-${suffix.slice(-4)}`,
          name: `Test Table ${suffix.slice(-4)}`,
          capacity: 4,
          area: 'Terrace',
          floor: 2,
          status: 'available',
        },
      });
      const res = await POSTTable(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.number).toBe(`TBL-${suffix.slice(-4)}`);
      expect(data.data.capacity).toBe(4);
      expect(data.data.area).toBe('Terrace');
      expect(data.data.floor).toBe(2);
      createdTableIds.push(data.data.id);
    });

    it('should create a table with position coordinates', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          number: `POS-${suffix.slice(-4)}`,
          capacity: 2,
          posX: 100,
          posY: 200,
          width: 80,
          height: 80,
        },
      });
      const res = await POSTTable(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.posX).toBe(100);
      expect(data.data.posY).toBe(200);
      expect(data.data.width).toBe(80);
      expect(data.data.height).toBe(80);
      createdTableIds.push(data.data.id);
    });

    it('should reject duplicate table number for same property', async () => {
      const suffix = uniqueSuffix();
      const number = `DUP-${suffix.slice(-4)}`;
      const url = buildUrl('/api/tables');

      const req1 = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, number },
      });
      const res1 = await POSTTable(req1 as any);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      createdTableIds.push(data1.data.id);

      const req2 = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, number },
      });
      const res2 = await POSTTable(req2 as any);
      expect(res2.status).toBe(400);
    });

    it('should reject creation without propertyId', async () => {
      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { number: 'No Property' },
      });
      const res = await POSTTable(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without number', async () => {
      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID },
      });
      const res = await POSTTable(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject capacity outside 1-100 range', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, number: `CAP-${suffix.slice(-4)}`, capacity: 0 },
      });
      const res = await POSTTable(req as any);
      expect(res.status).toBe(400);
    });

    it('should use default values for optional fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, number: `DEF-${suffix.slice(-4)}` },
      });
      const res = await POSTTable(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.capacity).toBe(4);
      expect(data.data.floor).toBe(1);
      expect(data.data.status).toBe('available');
      createdTableIds.push(data.data.id);
    });
  });

  describe('PUT /api/tables', () => {
    it('should update a table', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/tables');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, number: `UPD-${suffix.slice(-4)}`, capacity: 2 },
      });
      const createRes = await POSTTable(createReq as any);
      const createData = await createRes.json();
      const tableId = createData.data.id;
      createdTableIds.push(tableId);

      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: tableId, name: `Renamed Table ${suffix.slice(-4)}`, capacity: 6, area: 'Garden' },
      });
      const res = await PUTTable(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.name).toBe(`Renamed Table ${suffix.slice(-4)}`);
      expect(data.data.capacity).toBe(6);
      expect(data.data.area).toBe('Garden');
    });

    it('should reject duplicate number on update', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/tables');

      const req1 = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, number: `EX1-${suffix.slice(-4)}` },
      });
      const res1 = await POSTTable(req1 as any);
      const data1 = await res1.json();
      createdTableIds.push(data1.data.id);

      const req2 = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, number: `EX2-${suffix.slice(-4)}` },
      });
      const res2 = await POSTTable(req2 as any);
      const data2 = await res2.json();
      createdTableIds.push(data2.data.id);

      // Try to rename EX2 to EX1
      const req3 = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: data2.data.id, number: `EX1-${suffix.slice(-4)}` },
      });
      const res3 = await PUTTable(req3 as any);
      expect(res3.status).toBe(400);
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No ID' },
      });
      const res = await PUTTable(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent table', async () => {
      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUTTable(req as any);
      expect(res.status).toBe(404);
    });

    it('should reject invalid capacity on update', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/tables');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, number: `CAPUPD-${suffix.slice(-4)}` },
      });
      const createRes = await POSTTable(createReq as any);
      const createData = await createRes.json();
      createdTableIds.push(createData.data.id);

      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: createData.data.id, capacity: 200 },
      });
      const res = await PUTTable(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/tables', () => {
    it('should delete a table without active orders', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/tables');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, number: `DEL-${suffix.slice(-4)}` },
      });
      const createRes = await POSTTable(createReq as any);
      const createData = await createRes.json();
      const tableId = createData.data.id;

      const url = buildUrl('/api/tables', { id: tableId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETETable(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(tableId);

      // Verify deleted
      const table = await db.restaurantTable.findFirst({ where: { id: tableId } });
      expect(table).toBeNull();
    });

    it('should reject deletion without id', async () => {
      const url = buildUrl('/api/tables');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETETable(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent table', async () => {
      const url = buildUrl('/api/tables', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETETable(req as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    for (const id of createdTableIds) {
      await db.restaurantTable.delete({ where: { id } }).catch(() => {});
    }
  });
});
