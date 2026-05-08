import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/inventory/stock/route';
import { GET as getPurchaseOrders, POST as createPurchaseOrder } from '@/app/api/inventory/purchase-orders/route';
import { GET as getVendors, POST as createVendor } from '@/app/api/inventory/vendors/route';
import { createAuthRequest, buildUrl, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdStockItemId: string;
let createdVendorId: string;
let createdPurchaseOrderId: string;

describe('Inventory API', () => {
  describe('GET /api/inventory/stock', () => {
    it('should return list of stock items with pagination', async () => {
      const url = buildUrl('/api/inventory/stock', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.stats).toBeDefined();
    });

    it('should include low stock status for each item', async () => {
      const url = buildUrl('/api/inventory/stock', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        expect(data.data[0]).toHaveProperty('isLowStock');
        expect(typeof data.data[0].isLowStock).toBe('boolean');
      }
    });

    it('should filter stock items by category', async () => {
      const url = buildUrl('/api/inventory/stock', { category: 'amenities' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should search stock items by name', async () => {
      const url = buildUrl('/api/inventory/stock', { search: 'soap', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/inventory/stock', () => {
    it('should create a new stock item', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inventory/stock');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Item ${suffix.slice(-6)}`,
          sku: `SKU-${suffix.slice(-8)}`,
          category: 'amenities',
          unit: 'piece',
          unitCost: 50,
          quantity: 100,
          minQuantity: 20,
          maxQuantity: 500,
          status: 'active',
          lowStockAlert: false,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Item');
      expect(data.data.sku).toMatch(/^SKU-/);
      expect(data.data.isLowStock).toBe(false);
      createdStockItemId = data.data.id;
    });

    it('should reject stock item with missing name', async () => {
      const url = buildUrl('/api/inventory/stock');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          sku: 'SKU-EMPTY',
          category: 'amenities',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate SKU', async () => {
      if (!createdStockItemId) return;
      // Get the SKU of the created item
      const item = await db.stockItem.findUnique({ where: { id: createdStockItemId } });
      if (!item || !item.sku) return;

      const url = buildUrl('/api/inventory/stock');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Duplicate SKU Item',
          sku: item.sku,
          category: 'amenities',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('DUPLICATE_SKU');
    });
  });

  describe('GET /api/inventory/vendors', () => {
    it('should return list of vendors with stats', async () => {
      const url = buildUrl('/api/inventory/vendors', { limit: '10' });
      const req = await createAuthRequest(url);
      const res = await getVendors(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('totalVendors');
    });

    it('should include purchase order stats per vendor', async () => {
      const url = buildUrl('/api/inventory/vendors', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await getVendors(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        expect(data.data[0]).toHaveProperty('totalOrders');
        expect(data.data[0]).toHaveProperty('totalSpent');
        expect(typeof data.data[0].totalOrders).toBe('number');
      }
    });

    it('should filter vendors by type', async () => {
      const url = buildUrl('/api/inventory/vendors', { type: 'supplier' });
      const req = await createAuthRequest(url);
      const res = await getVendors(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/inventory/vendors', () => {
    it('should create a new vendor', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inventory/vendors');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Vendor ${suffix.slice(-6)}`,
          contactPerson: 'Test Contact',
          email: `vendor${suffix.slice(-4)}@test.com`,
          phone: '+919999999999',
          type: 'supplier',
          paymentTerms: 'NET-30',
          status: 'active',
        },
      });
      const res = await createVendor(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Vendor');
      expect(data.data.type).toBe('supplier');
      createdVendorId = data.data.id;
    });

    it('should reject vendor with missing name', async () => {
      const url = buildUrl('/api/inventory/vendors');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'supplier',
        },
      });
      const res = await createVendor(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject vendor with missing type', async () => {
      const url = buildUrl('/api/inventory/vendors');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'No Type Vendor',
        },
      });
      const res = await createVendor(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject vendor with invalid type', async () => {
      const url = buildUrl('/api/inventory/vendors');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Invalid Type',
          type: 'not_a_valid_type',
        },
      });
      const res = await createVendor(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject vendor with invalid email', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/inventory/vendors');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Email ${suffix.slice(-4)}`,
          email: 'not-an-email',
          type: 'supplier',
        },
      });
      const res = await createVendor(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/inventory/purchase-orders', () => {
    it('should return list of purchase orders with stats', async () => {
      const url = buildUrl('/api/inventory/purchase-orders', { limit: '10' });
      const req = await createAuthRequest(url);
      const res = await getPurchaseOrders(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.stats).toBeDefined();
    });

    it('should include vendor info and items for each PO', async () => {
      const url = buildUrl('/api/inventory/purchase-orders', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await getPurchaseOrders(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.data.length > 0) {
        const po = data.data[0];
        expect(po).toHaveProperty('vendor');
        expect(po).toHaveProperty('items');
        expect(po).toHaveProperty('itemCount');
      }
    });

    it('should filter purchase orders by status', async () => {
      const url = buildUrl('/api/inventory/purchase-orders', { status: 'draft' });
      const req = await createAuthRequest(url);
      const res = await getPurchaseOrders(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      if (data.data.length > 0) {
        expect(data.data.every((po: any) => po.status === 'draft')).toBe(true);
      }
    });
  });

  describe('POST /api/inventory/purchase-orders', () => {
    it('should create a new purchase order', async () => {
      if (!createdVendorId || !createdStockItemId) return;
      const url = buildUrl('/api/inventory/purchase-orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          vendorId: createdVendorId,
          orderDate: new Date().toISOString(),
          expectedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'API test purchase order',
          taxRate: 0.1,
          items: [
            {
              stockItemId: createdStockItemId,
              quantity: 50,
              unitPrice: 45,
            },
          ],
        },
      });
      const res = await createPurchaseOrder(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.orderNumber).toMatch(/^PO-/);
      expect(data.data.status).toBe('draft');
      expect(data.data.items.length).toBe(1);
      createdPurchaseOrderId = data.data.id;
    });

    it('should reject PO with missing vendor', async () => {
      const url = buildUrl('/api/inventory/purchase-orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          items: [{ stockItemId: createdStockItemId, quantity: 10, unitPrice: 20 }],
        },
      });
      const res = await createPurchaseOrder(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject PO with no items', async () => {
      if (!createdVendorId) return;
      const url = buildUrl('/api/inventory/purchase-orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          vendorId: createdVendorId,
          items: [],
        },
      });
      const res = await createPurchaseOrder(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject PO with non-existent vendor', async () => {
      const url = buildUrl('/api/inventory/purchase-orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          vendorId: '00000000-0000-0000-0000-000000000000',
          items: [{ stockItemId: createdStockItemId, quantity: 5, unitPrice: 10 }],
        },
      });
      const res = await createPurchaseOrder(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_VENDOR');
    });
  });

  afterAll(async () => {
    // Clean up purchase order
    if (createdPurchaseOrderId) {
      try {
        await db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: createdPurchaseOrderId } });
        await db.purchaseOrder.delete({ where: { id: createdPurchaseOrderId } });
      } catch (e) {
        console.error('Cleanup failed for PO:', e);
      }
    }
    // Clean up stock item
    if (createdStockItemId) {
      try {
        await db.stockConsumption.deleteMany({ where: { stockItemId: createdStockItemId } });
        await db.stockItem.delete({ where: { id: createdStockItemId } });
      } catch (e) {
        console.error('Cleanup failed for stock item:', e);
      }
    }
    // Clean up vendor
    if (createdVendorId) {
      try {
        await db.vendor.delete({ where: { id: createdVendorId } });
      } catch (e) {
        console.error('Cleanup failed for vendor:', e);
      }
    }
  });
});
