import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import {
  GET as GETRoomService,
  POST as POSTRoomService,
  PUT as PUTRoomService,
} from '@/app/api/room-service/route';
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
let testMenuItemId: string | null = null;

async function ensureTestMenuItem(): Promise<string> {
  if (testMenuItemId) return testMenuItemId;

  const suffix = uniqueSuffix();
  const catUrl = buildUrl('/api/menu-categories');
  const catReq = await createAuthRequest(catUrl, {
    method: 'POST',
    body: { propertyId: PROPERTY_ID, name: `RS Cat ${suffix}`, status: 'active' },
  });
  const catRes = await POSTMenuCategory(catReq as any);
  const catData = await catRes.json();
  createdCategoryIds.push(catData.data.id);

  const miUrl = buildUrl('/api/menu-items');
  const miReq = await createAuthRequest(miUrl, {
    method: 'POST',
    body: {
      propertyId: PROPERTY_ID,
      categoryId: catData.data.id,
      name: `RS Item ${suffix}`,
      price: 500,
      isAvailable: true,
      status: 'active',
    },
  });
  const miRes = await POSTMenuItem(miReq as any);
  const miData = await miRes.json();
  testMenuItemId = miData.data.id;
  createdMenuItemIds.push(testMenuItemId);
  return testMenuItemId;
}

describe('Room Service API', () => {
  describe('GET /api/room-service', () => {
    it('should list room service orders', async () => {
      const url = buildUrl('/api/room-service', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETRoomService(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should return orders with expected shape', async () => {
      const url = buildUrl('/api/room-service', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETRoomService(req as any);
      const data = await res.json();
      for (const order of data.data) {
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('orderNumber');
        expect(order).toHaveProperty('roomNumber');
        expect(order).toHaveProperty('guestName');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('priority');
        expect(order).toHaveProperty('totalAmount');
        expect(order).toHaveProperty('estimatedDelivery');
        expect(order).toHaveProperty('createdAt');
      }
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/room-service', {
        propertyId: PROPERTY_ID,
        status: 'pending',
      });
      const req = await createAuthRequest(url);
      const res = await GETRoomService(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const order of data.data) {
        expect(order.status).toBe('pending');
      }
    });

    it('should filter by multiple statuses', async () => {
      const url = buildUrl('/api/room-service', {
        propertyId: PROPERTY_ID,
        status: 'pending,preparing',
      });
      const req = await createAuthRequest(url);
      const res = await GETRoomService(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const order of data.data) {
        expect(['pending', 'preparing']).toContain(order.status);
      }
    });

    it('should filter by room number', async () => {
      const url = buildUrl('/api/room-service', {
        propertyId: PROPERTY_ID,
        room: '101',
      });
      const req = await createAuthRequest(url);
      const res = await GETRoomService(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should reject invalid propertyId', async () => {
      const url = buildUrl('/api/room-service', {
        propertyId: '00000000-0000-0000-0000-000000000000',
      });
      const req = await createAuthRequest(url);
      const res = await GETRoomService(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/room-service', () => {
    it('should create a room service order', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomNumber: '101',
          guestName: `RS Guest ${suffix}`,
          orderCategory: 'breakfast',
          priority: 'normal',
          specialInstructions: 'Knock before entering',
          items: [
            { menuItemId: miId, quantity: 2 },
          ],
        },
      });
      const res = await POSTRoomService(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.orderNumber).toMatch(/^RS-/);
      expect(data.data.orderType).toBe('room_service');
      expect(data.data.roomNumber).toBe('101');
      expect(data.data.status).toBe('pending');
      expect(data.data.estimatedDelivery).toBe(25); // normal priority = 25 min
      createdOrderIds.push(data.data.id);
    });

    it('should create a rush order with shorter delivery estimate', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomNumber: '202',
          guestName: `Rush Guest ${suffix}`,
          priority: 'rush',
          items: [{ menuItemId: miId, quantity: 1 }],
        },
      });
      const res = await POSTRoomService(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.estimatedDelivery).toBe(15); // rush = 15 min
      createdOrderIds.push(data.data.id);
    });

    it('should calculate totals correctly', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomNumber: '303',
          guestName: `Calc Guest ${suffix}`,
          items: [{ menuItemId: miId, quantity: 3 }],
        },
      });
      const res = await POSTRoomService(req as any);
      const data = await res.json();
      expect(data.data.subtotal).toBeGreaterThan(0);
      expect(data.data.totalAmount).toBeGreaterThanOrEqual(data.data.subtotal);
      createdOrderIds.push(data.data.id);
    });

    it('should reject without propertyId', async () => {
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { items: [{ menuItemId: 'fake', quantity: 1 }] },
      });
      const res = await POSTRoomService(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject without items', async () => {
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, items: [] },
      });
      const res = await POSTRoomService(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject with invalid menu items', async () => {
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          items: [{ menuItemId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
        },
      });
      const res = await POSTRoomService(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject invalid propertyId', async () => {
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: '00000000-0000-0000-0000-000000000000',
          items: [{ menuItemId: 'fake', quantity: 1 }],
        },
      });
      const res = await POSTRoomService(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/room-service', () => {
    it('should update order status to preparing', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();

      // Create
      const createUrl = buildUrl('/api/room-service');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomNumber: '404',
          guestName: `Prep Guest ${suffix}`,
          items: [{ menuItemId: miId, quantity: 1 }],
        },
      });
      const createRes = await POSTRoomService(createReq as any);
      const createData = await createRes.json();
      const orderId = createData.data.id;
      createdOrderIds.push(orderId);

      // Update
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: orderId, status: 'preparing' },
      });
      const res = await PUTRoomService(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('preparing');
      expect(data.data.confirmedAt).toBeDefined();
    });

    it('should update status to delivered and set kitchenStatus to ready', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();

      const createUrl = buildUrl('/api/room-service');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomNumber: '505',
          guestName: `Deliver Guest ${suffix}`,
          items: [{ menuItemId: miId, quantity: 1 }],
        },
      });
      const createRes = await POSTRoomService(createReq as any);
      const createData = await createRes.json();
      const orderId = createData.data.id;
      createdOrderIds.push(orderId);

      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: orderId, status: 'delivered' },
      });
      const res = await PUTRoomService(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('delivered');
      expect(data.data.completedAt).toBeDefined();
      expect(data.data.kitchenStatus).toBe('ready');
    });

    it('should update status to cancelled', async () => {
      const miId = await ensureTestMenuItem();
      const suffix = uniqueSuffix();

      const createUrl = buildUrl('/api/room-service');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          roomNumber: '606',
          guestName: `Cancel Guest ${suffix}`,
          items: [{ menuItemId: miId, quantity: 1 }],
        },
      });
      const createRes = await POSTRoomService(createReq as any);
      const createData = await createRes.json();
      const orderId = createData.data.id;
      createdOrderIds.push(orderId);

      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: orderId, status: 'cancelled' },
      });
      const res = await PUTRoomService(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('cancelled');
      expect(data.data.cancelledAt).toBeDefined();
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { status: 'preparing' },
      });
      const res = await PUTRoomService(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent order', async () => {
      const url = buildUrl('/api/room-service');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', status: 'preparing' },
      });
      const res = await PUTRoomService(req as any);
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
