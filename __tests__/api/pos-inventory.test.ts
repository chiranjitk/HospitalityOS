import { describe, it, expect, afterAll } from 'vitest';
import {
  GET as GETInventory,
  POST as POSTInventory,
  PUT as PUTInventory,
  DELETE as DELETEInventory,
} from '@/app/api/pos-inventory/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

const createdIds: string[] = [];

describe('POS Inventory API', () => {
  describe('GET /api/pos-inventory', () => {
    it('should list inventory items for a property', async () => {
      const url = buildUrl('/api/pos-inventory', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETInventory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta).toBeDefined();
      expect(typeof data.meta.lowStockCount).toBe('number');
      expect(typeof data.meta.outOfStockCount).toBe('number');
    });

    it('should reject request without propertyId', async () => {
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url);
      const res = await GETInventory(req as any);
      expect(res.status).toBe(400);
    });

    it('should filter by category', async () => {
      const url = buildUrl('/api/pos-inventory', {
        propertyId: PROPERTY_ID,
        category: 'produce',
      });
      const req = await createAuthRequest(url);
      const res = await GETInventory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const item of data.data) {
        expect(item.category).toBe('produce');
      }
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/pos-inventory', {
        propertyId: PROPERTY_ID,
        status: 'in_stock',
      });
      const req = await createAuthRequest(url);
      const res = await GETInventory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const item of data.data) {
        expect(item.status).toBe('in_stock');
      }
    });

    it('should support search by name', async () => {
      const url = buildUrl('/api/pos-inventory', {
        propertyId: PROPERTY_ID,
        search: 'rice',
      });
      const req = await createAuthRequest(url);
      const res = await GETInventory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should include movement counts', async () => {
      const url = buildUrl('/api/pos-inventory', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETInventory(req as any);
      const data = await res.json();
      for (const item of data.data) {
        expect(item._count).toBeDefined();
        expect(typeof item._count.movements).toBe('number');
      }
    });
  });

  describe('POST /api/pos-inventory', () => {
    it('should create an inventory item', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Basmati Rice ${suffix}`,
          category: 'produce',
          currentStock: 50,
          unit: 'kg',
          unitCost: 120,
          lowStockThreshold: 10,
          reorderLevel: 5,
          supplierName: 'Test Supplier',
          supplierContact: '+919999999999',
        },
      });
      const res = await POSTInventory(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe(`Basmati Rice ${suffix}`);
      expect(data.data.currentStock).toBe(50);
      expect(data.data.unit).toBe('kg');
      expect(data.data.status).toBe('in_stock');
      expect(data.data.lastRestocked).toBeDefined();
      createdIds.push(data.data.id);
    });

    it('should auto-set status to low_stock when currentStock <= lowStockThreshold', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Low Stock Item ${suffix}`,
          currentStock: 3,
          lowStockThreshold: 10,
        },
      });
      const res = await POSTInventory(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.status).toBe('low_stock');
      createdIds.push(data.data.id);
    });

    it('should auto-set status to out_of_stock when currentStock is 0', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Out Of Stock ${suffix}`,
          currentStock: 0,
        },
      });
      const res = await POSTInventory(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.status).toBe('out_of_stock');
      expect(data.data.lastRestocked).toBeNull();
      createdIds.push(data.data.id);
    });

    it('should reject creation without propertyId', async () => {
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'No Property' },
      });
      const res = await POSTInventory(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without name', async () => {
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID },
      });
      const res = await POSTInventory(req as any);
      expect(res.status).toBe(400);
    });

    it('should use default values for optional fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Defaults Item ${suffix}`,
          currentStock: 100,
        },
      });
      const res = await POSTInventory(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.unit).toBe('pcs');
      expect(data.data.unitCost).toBe(0);
      expect(data.data.lowStockThreshold).toBe(10);
      expect(data.data.reorderLevel).toBe(5);
      createdIds.push(data.data.id);
    });
  });

  describe('PUT /api/pos-inventory', () => {
    it('should update an inventory item', async () => {
      // Create first
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/pos-inventory');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: `Update Me ${suffix}`, currentStock: 20 },
      });
      const createRes = await POSTInventory(createReq as any);
      const createData = await createRes.json();
      const itemId = createData.data.id;
      createdIds.push(itemId);

      // Now update
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: itemId, name: `Updated ${suffix}`, category: 'beverages', unitCost: 250 },
      });
      const res = await PUTInventory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.name).toBe(`Updated ${suffix}`);
      expect(data.data.category).toBe('beverages');
      expect(data.data.unitCost).toBe(250);
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No ID' },
      });
      const res = await PUTInventory(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent item', async () => {
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUTInventory(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/pos-inventory', () => {
    it('should soft-delete an inventory item', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/pos-inventory');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: `Delete Me ${suffix}`, currentStock: 10 },
      });
      const createRes = await POSTInventory(createReq as any);
      const createData = await createRes.json();
      const itemId = createData.data.id;

      const url = buildUrl('/api/pos-inventory', { id: itemId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEInventory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(itemId);

      // Verify soft-deleted (deletedAt set)
      const item = await db.inventoryItem.findFirst({ where: { id: itemId } });
      expect(item?.deletedAt).not.toBeNull();
    });

    it('should reject deletion without id', async () => {
      const url = buildUrl('/api/pos-inventory');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEInventory(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent item', async () => {
      const url = buildUrl('/api/pos-inventory', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEInventory(req as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await db.inventoryMovement.deleteMany({ where: { inventoryItemId: id } }).catch(() => {});
      await db.inventoryItem.delete({ where: { id } }).catch(() => {});
    }
  });
});
