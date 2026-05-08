import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import {
  GET as GETMenuItems,
  POST as POSTMenuItem,
  PUT as PUTMenuItem,
  DELETE as DELETEMenuItem,
} from '@/app/api/menu-items/route';
import {
  GET as GETMenuCategories,
  POST as POSTMenuCategory,
} from '@/app/api/menu-categories/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

const createdCategoryIds: string[] = [];
const createdMenuItemIds: string[] = [];
let testCategoryId: string | null = null;

async function ensureTestCategory(): Promise<string> {
  if (testCategoryId) return testCategoryId;
  const suffix = uniqueSuffix();
  const url = buildUrl('/api/menu-categories');
  const req = await createAuthRequest(url, {
    method: 'POST',
    body: {
      propertyId: PROPERTY_ID,
      name: `MI Test Category ${suffix}`,
      description: 'Category for menu-items tests',
      sortOrder: 9999,
      status: 'active',
    },
  });
  const res = await POSTMenuCategory(req as any);
  const data = await res.json();
  testCategoryId = data.data.id;
  createdCategoryIds.push(testCategoryId);
  return testCategoryId;
}

describe('Menu Items API', () => {
  describe('GET /api/menu-items', () => {
    it('should list menu items with pagination', async () => {
      const url = buildUrl('/api/menu-items', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.total).toBe('number');
    });

    it('should filter by categoryId', async () => {
      const catId = await ensureTestCategory();
      const url = buildUrl('/api/menu-items', {
        propertyId: PROPERTY_ID,
        categoryId: catId,
      });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const item of data.data) {
        expect(item.categoryId).toBe(catId);
      }
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/menu-items', {
        propertyId: PROPERTY_ID,
        status: 'active',
      });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const item of data.data) {
        expect(item.status).toBe('active');
      }
    });

    it('should filter by isAvailable', async () => {
      const url = buildUrl('/api/menu-items', {
        propertyId: PROPERTY_ID,
        isAvailable: 'true',
      });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const item of data.data) {
        expect(item.isAvailable).toBe(true);
      }
    });

    it('should filter by isVegan', async () => {
      const url = buildUrl('/api/menu-items', {
        propertyId: PROPERTY_ID,
        isVegan: 'true',
      });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const item of data.data) {
        expect(item.isVegan).toBe(true);
      }
    });

    it('should filter by isGlutenFree', async () => {
      const url = buildUrl('/api/menu-items', {
        propertyId: PROPERTY_ID,
        isGlutenFree: 'true',
      });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const item of data.data) {
        expect(item.isGlutenFree).toBe(true);
      }
    });

    it('should support search by name or description', async () => {
      const url = buildUrl('/api/menu-items', {
        propertyId: PROPERTY_ID,
        search: 'chicken',
      });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should respect limit and offset', async () => {
      const url = buildUrl('/api/menu-items', {
        propertyId: PROPERTY_ID,
        limit: '2',
        offset: '0',
      });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.length).toBeLessThanOrEqual(2);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.offset).toBe(0);
    });

    it('should return stats when stats=true', async () => {
      const url = buildUrl('/api/menu-items', {
        propertyId: PROPERTY_ID,
        stats: 'true',
      });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.statusCounts).toBeDefined();
      expect(data.data.categoryCounts).toBeDefined();
      expect(typeof data.data.totalItems).toBe('number');
      expect(typeof data.data.availableItems).toBe('number');
      expect(typeof data.data.avgPrice).toBe('number');
    });

    it('should include category in response', async () => {
      const url = buildUrl('/api/menu-items', { propertyId: PROPERTY_ID, limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GETMenuItems(req as any);
      const data = await res.json();
      for (const item of data.data) {
        expect(item.category).toBeDefined();
        expect(item.category).toHaveProperty('id');
        expect(item.category).toHaveProperty('name');
      }
    });
  });

  describe('POST /api/menu-items', () => {
    it('should create a menu item', async () => {
      const categoryId = await ensureTestCategory();
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          categoryId,
          name: `Butter Chicken ${suffix}`,
          description: 'Creamy tomato chicken curry',
          price: 550,
          currency: 'INR',
          isVegetarian: false,
          isVegan: false,
          isGlutenFree: true,
          allergens: ['dairy'],
          isAvailable: true,
          preparationTime: 25,
          kitchenStation: 'tandoor',
          status: 'active',
          sortOrder: 1,
        },
      });
      const res = await POSTMenuItem(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe(`Butter Chicken ${suffix}`);
      expect(data.data.price).toBe(550);
      expect(data.data.isVegetarian).toBe(false);
      expect(data.data.category).toBeDefined();
      expect(data.data.category.id).toBe(categoryId);
      createdMenuItemIds.push(data.data.id);
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: 'Missing fields' },
      });
      const res = await POSTMenuItem(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject negative price', async () => {
      const categoryId = await ensureTestCategory();
      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          categoryId,
          name: 'Negative Price',
          price: -100,
        },
      });
      const res = await POSTMenuItem(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject invalid categoryId', async () => {
      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          categoryId: '00000000-0000-0000-0000-000000000000',
          name: 'Bad Category',
          price: 100,
        },
      });
      const res = await POSTMenuItem(req as any);
      expect(res.status).toBe(400);
    });

    it('should use defaults for optional fields', async () => {
      const categoryId = await ensureTestCategory();
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          categoryId,
          name: `Default Fields ${suffix}`,
          price: 200,
        },
      });
      const res = await POSTMenuItem(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.currency).toBe('USD');
      expect(data.data.isAvailable).toBe(true);
      expect(data.data.sortOrder).toBe(0);
      expect(data.data.status).toBe('active');
      createdMenuItemIds.push(data.data.id);
    });
  });

  describe('PUT /api/menu-items', () => {
    it('should update a menu item', async () => {
      const categoryId = await ensureTestCategory();
      const suffix = uniqueSuffix();

      // Create item
      const createUrl = buildUrl('/api/menu-items');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          categoryId,
          name: `Update Me ${suffix}`,
          price: 300,
          isAvailable: true,
          status: 'active',
        },
      });
      const createRes = await POSTMenuItem(createReq as any);
      const createData = await createRes.json();
      const itemId = createData.data.id;
      createdMenuItemIds.push(itemId);

      // Update
      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: itemId,
          name: `Updated ${suffix}`,
          price: 450,
          isVegetarian: true,
          kitchenStation: 'grill',
        },
      });
      const res = await PUTMenuItem(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.name).toBe(`Updated ${suffix}`);
      expect(data.data.price).toBe(450);
      expect(data.data.isVegetarian).toBe(true);
      expect(data.data.kitchenStation).toBe('grill');
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No ID' },
      });
      const res = await PUTMenuItem(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent item', async () => {
      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUTMenuItem(req as any);
      expect(res.status).toBe(404);
    });

    it('should reject negative price on update', async () => {
      const categoryId = await ensureTestCategory();
      const suffix = uniqueSuffix();

      const createUrl = buildUrl('/api/menu-items');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          categoryId,
          name: `Price Check ${suffix}`,
          price: 100,
          isAvailable: true,
          status: 'active',
        },
      });
      const createRes = await POSTMenuItem(createReq as any);
      const createData = await createRes.json();
      createdMenuItemIds.push(createData.data.id);

      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: createData.data.id, price: -50 },
      });
      const res = await PUTMenuItem(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/menu-items', () => {
    it('should soft-delete a menu item', async () => {
      const categoryId = await ensureTestCategory();
      const suffix = uniqueSuffix();

      // Create
      const createUrl = buildUrl('/api/menu-items');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          categoryId,
          name: `Delete Me ${suffix}`,
          price: 100,
          isAvailable: true,
          status: 'active',
        },
      });
      const createRes = await POSTMenuItem(createReq as any);
      const createData = await createRes.json();
      const itemId = createData.data.id;

      // Delete
      const url = buildUrl('/api/menu-items', { id: itemId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEMenuItem(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.status).toBe('inactive');
      expect(data.data.deletedAt).toBeDefined();

      // Verify soft-deleted
      const item = await db.menuItem.findFirst({ where: { id: itemId } });
      expect(item?.deletedAt).not.toBeNull();
    });

    it('should reject deletion without id', async () => {
      const url = buildUrl('/api/menu-items');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEMenuItem(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent item', async () => {
      const url = buildUrl('/api/menu-items', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEMenuItem(req as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    for (const id of createdMenuItemIds) {
      await db.menuItem.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdCategoryIds) {
      await db.orderCategory.delete({ where: { id } }).catch(() => {});
    }
  });
});
