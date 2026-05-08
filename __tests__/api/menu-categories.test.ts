import { describe, it, expect, afterAll } from 'vitest';
import {
  GET as GETMenuCategories,
  POST as POSTMenuCategory,
  PUT as PUTMenuCategory,
  DELETE as DELETEMenuCategory,
} from '@/app/api/menu-categories/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

const createdCategoryIds: string[] = [];

describe('Menu Categories API', () => {
  describe('GET /api/menu-categories', () => {
    it('should list categories for a property', async () => {
      const url = buildUrl('/api/menu-categories', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETMenuCategories(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should reject request without propertyId', async () => {
      const url = buildUrl('/api/menu-categories');
      const req = await createAuthRequest(url);
      const res = await GETMenuCategories(req as any);
      expect(res.status).toBe(400);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/menu-categories', {
        propertyId: PROPERTY_ID,
        status: 'active',
      });
      const req = await createAuthRequest(url);
      const res = await GETMenuCategories(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const cat of data.data) {
        expect(cat.status).toBe('active');
      }
    });

    it('should include menu item counts per category', async () => {
      const url = buildUrl('/api/menu-categories', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETMenuCategories(req as any);
      const data = await res.json();
      for (const cat of data.data) {
        expect(cat._count).toBeDefined();
        expect(typeof cat._count.menuItems).toBe('number');
      }
    });

    it('should order by sortOrder then name', async () => {
      const url = buildUrl('/api/menu-categories', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETMenuCategories(req as any);
      const data = await res.json();
      // Check ordering is present (sortOrder asc, name asc)
      if (data.data.length >= 2) {
        const first = data.data[0];
        const second = data.data[1];
        if (first.sortOrder === second.sortOrder) {
          expect(first.name.localeCompare(second.name)).toBeLessThanOrEqual(0);
        } else {
          expect(first.sortOrder).toBeLessThanOrEqual(second.sortOrder);
        }
      }
    });
  });

  describe('POST /api/menu-categories', () => {
    it('should create a new category', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/menu-categories');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Test Cat ${suffix}`,
          description: 'A test category',
          imageUrl: 'https://example.com/cat.jpg',
          sortOrder: 10,
          status: 'active',
        },
      });
      const res = await POSTMenuCategory(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe(`Test Cat ${suffix}`);
      expect(data.data.description).toBe('A test category');
      createdCategoryIds.push(data.data.id);
    });

    it('should reject duplicate name within same property', async () => {
      const suffix = uniqueSuffix();
      const name = `Dup Name ${suffix}`;
      const url = buildUrl('/api/menu-categories');

      const req1 = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name },
      });
      const res1 = await POSTMenuCategory(req1 as any);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      createdCategoryIds.push(data1.data.id);

      const req2 = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name },
      });
      const res2 = await POSTMenuCategory(req2 as any);
      expect(res2.status).toBe(400);
    });

    it('should reject creation without propertyId', async () => {
      const url = buildUrl('/api/menu-categories');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'No Property' },
      });
      const res = await POSTMenuCategory(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without name', async () => {
      const url = buildUrl('/api/menu-categories');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID },
      });
      const res = await POSTMenuCategory(req as any);
      expect(res.status).toBe(400);
    });

    it('should use default values for optional fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/menu-categories');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: `Defaults ${suffix}` },
      });
      const res = await POSTMenuCategory(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.sortOrder).toBe(0);
      expect(data.data.status).toBe('active');
      createdCategoryIds.push(data.data.id);
    });
  });

  describe('PUT /api/menu-categories', () => {
    it('should update a category', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/menu-categories');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: `Update Cat ${suffix}` },
      });
      const createRes = await POSTMenuCategory(createReq as any);
      const createData = await createRes.json();
      const catId = createData.data.id;
      createdCategoryIds.push(catId);

      const url = buildUrl('/api/menu-categories');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: catId, name: `Renamed Cat ${suffix}`, description: 'Updated desc', sortOrder: 5 },
      });
      const res = await PUTMenuCategory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.name).toBe(`Renamed Cat ${suffix}`);
      expect(data.data.description).toBe('Updated desc');
      expect(data.data.sortOrder).toBe(5);
    });

    it('should reject duplicate name on update', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/menu-categories');

      // Create two categories
      const req1 = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: `Cat A ${suffix}` },
      });
      const res1 = await POSTMenuCategory(req1 as any);
      const data1 = await res1.json();
      createdCategoryIds.push(data1.data.id);

      const req2 = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: `Cat B ${suffix}` },
      });
      const res2 = await POSTMenuCategory(req2 as any);
      const data2 = await res2.json();
      createdCategoryIds.push(data2.data.id);

      // Try to rename B to A
      const req3 = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: data2.data.id, name: `Cat A ${suffix}` },
      });
      const res3 = await PUTMenuCategory(req3 as any);
      expect(res3.status).toBe(400);
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/menu-categories');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No ID' },
      });
      const res = await PUTMenuCategory(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent category', async () => {
      const url = buildUrl('/api/menu-categories');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUTMenuCategory(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/menu-categories', () => {
    it('should delete an empty category', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/menu-categories');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: `To Delete ${suffix}` },
      });
      const createRes = await POSTMenuCategory(createReq as any);
      const createData = await createRes.json();
      const catId = createData.data.id;

      const url = buildUrl('/api/menu-categories', { id: catId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEMenuCategory(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBeDefined();
    });

    it('should reject deletion without id', async () => {
      const url = buildUrl('/api/menu-categories');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEMenuCategory(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent category', async () => {
      const url = buildUrl('/api/menu-categories', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEMenuCategory(req as any);
      expect(res.status).toBe(404);
    });

    it('should reject deletion of category with menu items', async () => {
      // Create a category and a menu item in it
      const suffix = uniqueSuffix();
      const catUrl = buildUrl('/api/menu-categories');
      const catReq = await createAuthRequest(catUrl, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: `Full Cat ${suffix}` },
      });
      const catRes = await POSTMenuCategory(catReq as any);
      const catData = await catRes.json();
      const catId = catData.data.id;

      // Create menu item
      const { POST: POSTMI } = await import('@/app/api/menu-items/route');
      const miUrl = buildUrl('/api/menu-items');
      const miReq = await createAuthRequest(miUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          categoryId: catId,
          name: `Item In Cat ${suffix}`,
          price: 100,
          isAvailable: true,
          status: 'active',
        },
      });
      const miRes = await POSTMI(miReq as any);
      const miData = await miRes.json();

      // Try to delete
      const delUrl = buildUrl('/api/menu-categories', { id: catId });
      const delReq = await createAuthRequest(delUrl, { method: 'DELETE' });
      const delRes = await DELETEMenuCategory(delReq as any);
      expect(delRes.status).toBe(400);

      // Cleanup
      await db.menuItem.delete({ where: { id: miData.data.id } }).catch(() => {});
      await db.orderCategory.delete({ where: { id: catId } }).catch(() => {});
    });
  });

  afterAll(async () => {
    for (const id of createdCategoryIds) {
      await db.orderCategory.delete({ where: { id } }).catch(() => {});
    }
  });
});
