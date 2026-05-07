import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET as getItems, POST as postItem } from '@/app/api/laundry/items/route';
import { GET as getItem, PUT as putItem, DELETE as deleteItem } from '@/app/api/laundry/items/[id]/route';
import { GET as getOrders, POST as postOrder } from '@/app/api/laundry/orders/route';
import { GET as getOrder, PATCH as patchOrder } from '@/app/api/laundry/orders/[id]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, createTestFixture } from './test-helpers';
import { db } from '@/lib/db';

let laundryItemId: string;
let orderId: string;
let fixture: Awaited<ReturnType<typeof createTestFixture>>;

beforeAll(async () => {
  fixture = await createTestFixture();
});

describe('Laundry API', () => {
  describe('POST /api/laundry/items', () => {
    it('should create a laundry item', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/laundry/items');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Shirt Wash ${suffix}`,
          category: 'guest',
          serviceType: 'wash',
          unitPrice: 150,
          currency: 'INR',
          turnaroundHours: 24,
          isActive: true,
          sortOrder: 1,
        },
      });
      const res = await postItem(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Shirt Wash');
      expect(data.data.status).toBe('active');
      laundryItemId = data.data.id;
    });
  });

  describe('GET /api/laundry/items', () => {
    it('should return list of laundry items', async () => {
      const url = buildUrl('/api/laundry/items', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.items).toBeDefined();
      expect(data.data.pagination).toBeDefined();
    });
  });

  describe('GET /api/laundry/items/[id]', () => {
    it('should get a single laundry item', async () => {
      const url = buildUrl(`/api/laundry/items/${laundryItemId}`);
      const req = await createAuthRequest(url);
      const res = await getItem(req as any, { params: Promise.resolve({ id: laundryItemId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(laundryItemId);
    });
  });

  describe('PUT /api/laundry/items/[id]', () => {
    it('should update a laundry item', async () => {
      const url = buildUrl(`/api/laundry/items/${laundryItemId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { unitPrice: 200 },
      });
      const res = await putItem(req as any, { params: Promise.resolve({ id: laundryItemId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.unitPrice).toBe(200);
    });
  });

  describe('POST /api/laundry/orders', () => {
    it('should create a laundry order with items', async () => {
      const url = buildUrl('/api/laundry/orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: fixture.booking.propertyId,
          bookingId: fixture.booking.id,
          roomId: fixture.room.id,
          orderType: 'guest',
          items: [
            { itemId: laundryItemId, itemName: 'Shirt Wash', quantity: 3, unitPrice: 200 },
          ],
          specialInstructions: 'Gentle wash please',
        },
      });
      const res = await postOrder(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('received');
      expect(data.data.totalItems).toBe(3);
      expect(data.data.totalPrice).toBe(600);
      expect(data.data.items).toHaveLength(1);
      orderId = data.data.id;
    });
  });

  describe('GET /api/laundry/orders', () => {
    it('should return list of laundry orders', async () => {
      const url = buildUrl('/api/laundry/orders', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getOrders(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.orders).toBeDefined();
      expect(data.data.totals).toBeDefined();
    });
  });

  describe('GET /api/laundry/orders/[id]', () => {
    it('should get a single laundry order', async () => {
      const url = buildUrl(`/api/laundry/orders/${orderId}`);
      const req = await createAuthRequest(url);
      const res = await getOrder(req as any, { params: Promise.resolve({ id: orderId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(orderId);
      expect(data.data.items).toBeDefined();
    });
  });

  describe('PATCH /api/laundry/orders/[id] — status transitions', () => {
    it('should transition to in_progress', async () => {
      const url = buildUrl(`/api/laundry/orders/${orderId}`);
      const req = await createAuthRequest(url, {
        method: 'PATCH',
        body: { status: 'in_progress' },
      });
      const res = await patchOrder(req as any, { params: Promise.resolve({ id: orderId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('in_progress');
    });

    it('should transition to ready', async () => {
      const url = buildUrl(`/api/laundry/orders/${orderId}`);
      const req = await createAuthRequest(url, {
        method: 'PATCH',
        body: { status: 'ready' },
      });
      const res = await patchOrder(req as any, { params: Promise.resolve({ id: orderId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('ready');
      expect(data.data.readyAt).toBeDefined();
    });

    it('should transition to delivered', async () => {
      const url = buildUrl(`/api/laundry/orders/${orderId}`);
      const req = await createAuthRequest(url, {
        method: 'PATCH',
        body: { status: 'delivered' },
      });
      const res = await patchOrder(req as any, { params: Promise.resolve({ id: orderId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('delivered');
      expect(data.data.deliveredAt).toBeDefined();
    });
  });

  describe('DELETE /api/laundry/items/[id]', () => {
    it('should delete a laundry item', async () => {
      const url = buildUrl(`/api/laundry/items/${laundryItemId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteItem(req as any, { params: Promise.resolve({ id: laundryItemId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  afterAll(async () => {
    if (orderId && fixture) {
      try {
        await db.folioLineItem.deleteMany({ where: { referenceType: 'laundry_order', referenceId: orderId } });
        await db.laundryOrderItem.deleteMany({ where: { orderId } });
        await db.laundryOrder.delete({ where: { id: orderId } });
      } catch { /* already cleaned or cascaded */ }
    }
    if (laundryItemId) {
      try { await db.laundryItem.delete({ where: { id: laundryItemId } }); } catch { /* ok */ }
    }
    if (fixture) await fixture.cleanup();
  });
});
