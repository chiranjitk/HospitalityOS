import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import {
  GET as GETOrders,
  POST as POSTOrder,
  PUT as PUTOrder,
  DELETE as DELETEOrder,
} from '@/app/api/orders/route';
import {
  POST as POSTMenuCategory,
} from '@/app/api/menu-categories/route';
import {
  POST as POSTMenuItem,
} from '@/app/api/menu-items/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

const createdOrderIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdMenuItemIds: string[] = [];
let testCategoryId: string | null = null;
let testMenuItemId: string | null = null;

async function ensureTestMenuItem(): Promise<string> {
  if (testMenuItemId) return testMenuItemId;
  if (!testCategoryId) {
    const suffix = uniqueSuffix();
    const catUrl = buildUrl('/api/menu-categories');
    const catReq = await createAuthRequest(catUrl, {
      method: 'POST',
      body: { propertyId: PROPERTY_ID, name: `Order Test Cat ${suffix}`, status: 'active' },
    });
    const catRes = await POSTMenuCategory(catReq as any);
    const catData = await catRes.json();
    testCategoryId = catData.data.id;
    createdCategoryIds.push(testCategoryId);
  }

  const suffix = uniqueSuffix();
  const miUrl = buildUrl('/api/menu-items');
  const miReq = await createAuthRequest(miUrl, {
    method: 'POST',
    body: {
      propertyId: PROPERTY_ID,
      categoryId: testCategoryId,
      name: `Order Test Item ${suffix}`,
      description: 'Item for order tests',
      price: 350,
      currency: 'INR',
      isAvailable: true,
      isVegetarian: true,
      status: 'active',
      sortOrder: 9999,
    },
  });
  const miRes = await POSTMenuItem(miReq as any);
  const miData = await miRes.json();
  testMenuItemId = miData.data.id;
  createdMenuItemIds.push(testMenuItemId);
  return testMenuItemId;
}

describe('Orders API', () => {
  describe('GET /api/orders', () => {
    it('should list orders with pagination', async () => {
      const url = buildUrl('/api/orders', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETOrders(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.total).toBe('number');
    });

    it('should return order stats when stats=true', async () => {
      const url = buildUrl('/api/orders', {
        propertyId: PROPERTY_ID,
        stats: 'true',
      });
      const req = await createAuthRequest(url);
      const res = await GETOrders(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.statusCounts).toBeDefined();
      expect(data.data.kitchenStatusCounts).toBeDefined();
      expect(typeof data.data.totalRevenue).toBe('number');
      expect(typeof data.data.todayOrders).toBe('number');
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/orders', {
        propertyId: PROPERTY_ID,
        status: 'pending',
      });
      const req = await createAuthRequest(url);
      const res = await GETOrders(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const order of data.data) {
        expect(order.status).toBe('pending');
      }
    });

    it('should filter by multiple statuses', async () => {
      const url = buildUrl('/api/orders', {
        propertyId: PROPERTY_ID,
        status: 'pending,confirmed',
      });
      const req = await createAuthRequest(url);
      const res = await GETOrders(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const order of data.data) {
        expect(['pending', 'confirmed']).toContain(order.status);
      }
    });

    it('should filter by kitchenStatus', async () => {
      const url = buildUrl('/api/orders', {
        propertyId: PROPERTY_ID,
        kitchenStatus: 'pending',
      });
      const req = await createAuthRequest(url);
      const res = await GETOrders(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const order of data.data) {
        expect(order.kitchenStatus).toBe('pending');
      }
    });

    it('should filter by orderType', async () => {
      const url = buildUrl('/api/orders', {
        propertyId: PROPERTY_ID,
        orderType: 'dine_in',
      });
      const req = await createAuthRequest(url);
      const res = await GETOrders(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const order of data.data) {
        expect(order.orderType).toBe('dine_in');
      }
    });

    it('should search by order number or guest name', async () => {
      const url = buildUrl('/api/orders', {
        propertyId: PROPERTY_ID,
        search: 'ORD',
      });
      const req = await createAuthRequest(url);
      const res = await GETOrders(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should include table and item details', async () => {
      const url = buildUrl('/api/orders', { propertyId: PROPERTY_ID, limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GETOrders(req as any);
      const data = await res.json();
      for (const order of data.data) {
        expect(order._count).toBeDefined();
        expect(typeof order._count.items).toBe('number');
      }
    });

    it('should respect limit and offset', async () => {
      const url = buildUrl('/api/orders', {
        propertyId: PROPERTY_ID,
        limit: '2',
        offset: '0',
      });
      const req = await createAuthRequest(url);
      const res = await GETOrders(req as any);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(2);
      expect(data.pagination.limit).toBe(2);
    });
  });

  describe('POST /api/orders', () => {
    it('should create a dine-in order with items', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Order Guest ${suffix}`,
          orderType: 'dine_in',
          notes: 'No onions please',
          items: [
            { menuItemId: miId, quantity: 2, notes: 'Extra spicy' },
          ],
        },
      });
      const res = await POSTOrder(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.orderNumber).toMatch(/^ORD-/);
      expect(data.data.status).toBe('pending');
      expect(data.data.kitchenStatus).toBe('pending');
      expect(data.data.items).toBeDefined();
      expect(data.data.items.length).toBe(1);
      expect(data.data.items[0].quantity).toBe(2);
      expect(data.data.subtotal).toBeGreaterThan(0);
      createdOrderIds.push(data.data.id);
    });

    it('should create a takeaway order', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Takeaway ${suffix}`,
          orderType: 'takeaway',
          items: [{ menuItemId: miId, quantity: 1 }],
        },
      });
      const res = await POSTOrder(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.orderType).toBe('takeaway');
      createdOrderIds.push(data.data.id);
    });

    it('should create an order with multiple items', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();

      // Create second menu item
      const miUrl = buildUrl('/api/menu-items');
      const miReq = await createAuthRequest(miUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          categoryId: testCategoryId!,
          name: `Second Order Item ${suffix}`,
          price: 200,
          isAvailable: true,
          status: 'active',
        },
      });
      const miRes = await POSTMenuItem(miReq as any);
      const miData = await miRes.json();
      createdMenuItemIds.push(miData.data.id);

      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Multi Item ${suffix}`,
          orderType: 'dine_in',
          items: [
            { menuItemId: miId, quantity: 2 },
            { menuItemId: miData.data.id, quantity: 1 },
          ],
        },
      });
      const res = await POSTOrder(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.items.length).toBe(2);
      createdOrderIds.push(data.data.id);
    });

    it('should reject order without propertyId', async () => {
      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { items: [{ menuItemId: 'fake-id', quantity: 1 }] },
      });
      const res = await POSTOrder(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject order without items', async () => {
      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, items: [] },
      });
      const res = await POSTOrder(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject order with invalid menu item', async () => {
      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          items: [{ menuItemId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
        },
      });
      const res = await POSTOrder(req as any);
      expect(res.status).toBe(400);
    });

    it('should calculate subtotal, taxes, and totalAmount', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Calc Test ${suffix}`,
          orderType: 'dine_in',
          items: [{ menuItemId: miId, quantity: 3 }],
        },
      });
      const res = await POSTOrder(req as any);
      const data = await res.json();
      expect(data.data.subtotal).toBeGreaterThan(0);
      expect(data.data.totalAmount).toBeGreaterThanOrEqual(data.data.subtotal);
      createdOrderIds.push(data.data.id);
    });
  });

  describe('PUT /api/orders', () => {
    it('should update order status to confirmed', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();

      const createUrl = buildUrl('/api/orders');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Status Test ${suffix}`,
          items: [{ menuItemId: miId, quantity: 1 }],
        },
      });
      const createRes = await POSTOrder(createReq as any);
      const createData = await createRes.json();
      const orderId = createData.data.id;
      createdOrderIds.push(orderId);

      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: orderId, status: 'confirmed' },
      });
      const res = await PUTOrder(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('confirmed');
      expect(data.data.confirmedAt).toBeDefined();
    });

    it('should update kitchenStatus to cooking', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();

      const createUrl = buildUrl('/api/orders');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Kitchen Test ${suffix}`,
          items: [{ menuItemId: miId, quantity: 1 }],
        },
      });
      const createRes = await POSTOrder(createReq as any);
      const createData = await createRes.json();
      const orderId = createData.data.id;
      createdOrderIds.push(orderId);

      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: orderId, kitchenStatus: 'cooking' },
      });
      const res = await PUTOrder(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.kitchenStatus).toBe('cooking');
      expect(data.data.kitchenStartedAt).toBeDefined();
    });

    it('should reject invalid status transition', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();

      const createUrl = buildUrl('/api/orders');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Invalid Transition ${suffix}`,
          items: [{ menuItemId: miId, quantity: 1 }],
        },
      });
      const createRes = await POSTOrder(createReq as any);
      const createData = await createRes.json();
      const orderId = createData.data.id;
      createdOrderIds.push(orderId);

      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: orderId, status: 'served' },
      });
      const res = await PUTOrder(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent order', async () => {
      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', status: 'confirmed' },
      });
      const res = await PUTOrder(req as any);
      expect(res.status).toBe(404);
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'confirmed' },
      });
      const res = await PUTOrder(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/orders', () => {
    it('should cancel a pending order', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();

      const createUrl = buildUrl('/api/orders');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          guestName: `Cancel Test ${suffix}`,
          items: [{ menuItemId: miId, quantity: 1 }],
        },
      });
      const createRes = await POSTOrder(createReq as any);
      const createData = await createRes.json();
      const orderId = createData.data.id;

      const url = buildUrl('/api/orders', { id: orderId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEOrder(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('cancelled');
      expect(data.data.cancelledAt).toBeDefined();
    });

    it('should reject deletion without id', async () => {
      const url = buildUrl('/api/orders');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEOrder(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent order', async () => {
      const url = buildUrl('/api/orders', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEOrder(req as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await db.orderItem.deleteMany({ where: { orderId: id } }).catch(() => {});
      await db.order.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdMenuItemIds) {
      await db.menuItem.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdCategoryIds) {
      await db.orderCategory.delete({ where: { id } }).catch(() => {});
    }
  });
});
