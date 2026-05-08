import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import {
  GET as GETVariants,
  POST as POSTVariant,
  PUT as PUTVariant,
  DELETE as DELETEVariant,
} from '@/app/api/menu-variants/route';
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

const createdIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdMenuItemIds: string[] = [];

async function createTestCategory(): Promise<string> {
  const suffix = uniqueSuffix();
  const url = buildUrl('/api/menu-categories');
  const req = await createAuthRequest(url, {
    method: 'POST',
    body: { propertyId: PROPERTY_ID, name: `Var Cat ${suffix}`, status: 'active' },
  });
  const res = await POSTMenuCategory(req as any);
  const data = await res.json();
  createdCategoryIds.push(data.data.id);
  return data.data.id;
}

async function createTestMenuItem(categoryId: string): Promise<string> {
  const suffix = uniqueSuffix();
  const url = buildUrl('/api/menu-items');
  const req = await createAuthRequest(url, {
    method: 'POST',
    body: {
      propertyId: PROPERTY_ID,
      categoryId,
      name: `Var Item ${suffix}`,
      price: 400,
      isAvailable: true,
      status: 'active',
    },
  });
  const res = await POSTMenuItem(req as any);
  const data = await res.json();
  createdMenuItemIds.push(data.data.id);
  return data.data.id;
}

describe('Menu Variants API', () => {
  let catId: string | null = null;
  let menuItemId: string | null = null;

  beforeAll(async () => {
    catId = await createTestCategory();
    menuItemId = await createTestMenuItem(catId);
  });

  describe('GET /api/menu-variants', () => {
    it('should list variants for a property', async () => {
      const url = buildUrl('/api/menu-variants', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETVariants(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should reject request without propertyId', async () => {
      const url = buildUrl('/api/menu-variants');
      const req = await createAuthRequest(url);
      const res = await GETVariants(req as any);
      expect(res.status).toBe(400);
    });

    it('should filter by menuItemId', async () => {
      const url = buildUrl('/api/menu-variants', {
        propertyId: PROPERTY_ID,
        menuItemId: menuItemId!,
      });
      const req = await createAuthRequest(url);
      const res = await GETVariants(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const v of data.data) {
        expect(v.menuItemId).toBe(menuItemId);
      }
    });

    it('should include menuItem in response', async () => {
      const url = buildUrl('/api/menu-variants', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETVariants(req as any);
      const data = await res.json();
      for (const v of data.data) {
        expect(v.menuItem).toBeDefined();
        expect(v.menuItem).toHaveProperty('id');
        expect(v.menuItem).toHaveProperty('name');
        expect(v.menuItem).toHaveProperty('price');
      }
    });
  });

  describe('POST /api/menu-variants', () => {
    it('should create a variant', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/menu-variants');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          menuItemId: menuItemId!,
          name: `Regular ${suffix}`,
          price: 400,
          sku: `SKU-${suffix.slice(-6)}`,
          calories: 500,
          isAvailable: true,
          isDefault: false,
          sortOrder: 0,
        },
      });
      const res = await POSTVariant(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe(`Regular ${suffix}`);
      expect(data.data.price).toBe(400);
      expect(data.data.calories).toBe(500);
      expect(data.data.menuItem).toBeDefined();
      createdIds.push(data.data.id);
    });

    it('should set a variant as default and unset others', async () => {
      const suffix = uniqueSuffix();

      // Create first variant (not default)
      const url1 = buildUrl('/api/menu-variants');
      const req1 = await createAuthRequest(url1, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          menuItemId: menuItemId!,
          name: `Non-Default ${suffix}`,
          price: 350,
          isDefault: false,
        },
      });
      const res1 = await POSTVariant(req1 as any);
      const data1 = await res1.json();
      createdIds.push(data1.data.id);

      // Create second variant (default)
      const req2 = await createAuthRequest(url1, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          menuItemId: menuItemId!,
          name: `Default ${suffix}`,
          price: 450,
          isDefault: true,
        },
      });
      const res2 = await POSTVariant(req2 as any);
      expect(res2.status).toBe(201);
      const data2 = await res2.json();
      expect(data2.data.isDefault).toBe(true);
      createdIds.push(data2.data.id);

      // Verify first is no longer default
      const getReq = await createAuthRequest(
        buildUrl('/api/menu-variants', { propertyId: PROPERTY_ID, menuItemId: menuItemId! }),
      );
      const getRes = await GETVariants(getReq as any);
      const getData = await getRes.json();
      const first = getData.data.find((v: { id: string }) => v.id === data1.data.id);
      expect(first?.isDefault).toBe(false);
    });

    it('should reject creation without required fields', async () => {
      const url = buildUrl('/api/menu-variants');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID, name: 'Missing fields' },
      });
      const res = await POSTVariant(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without propertyId', async () => {
      const url = buildUrl('/api/menu-variants');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { menuItemId: menuItemId!, name: 'No Property', price: 100 },
      });
      const res = await POSTVariant(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/menu-variants', () => {
    it('should update a variant', async () => {
      const suffix = uniqueSuffix();

      // Create
      const createUrl = buildUrl('/api/menu-variants');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          menuItemId: menuItemId!,
          name: `Update Var ${suffix}`,
          price: 300,
        },
      });
      const createRes = await POSTVariant(createReq as any);
      const createData = await createRes.json();
      const varId = createData.data.id;
      createdIds.push(varId);

      // Update
      const url = buildUrl('/api/menu-variants');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: varId, name: `Updated Var ${suffix}`, price: 500, calories: 700 },
      });
      const res = await PUTVariant(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.name).toBe(`Updated Var ${suffix}`);
      expect(data.data.price).toBe(500);
      expect(data.data.calories).toBe(700);
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/menu-variants');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No ID' },
      });
      const res = await PUTVariant(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent variant', async () => {
      const url = buildUrl('/api/menu-variants');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUTVariant(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/menu-variants', () => {
    it('should delete a variant', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/menu-variants');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          menuItemId: menuItemId!,
          name: `Delete Var ${suffix}`,
          price: 100,
        },
      });
      const createRes = await POSTVariant(createReq as any);
      const createData = await createRes.json();
      const varId = createData.data.id;

      const url = buildUrl('/api/menu-variants', { id: varId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEVariant(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(varId);
    });

    it('should reject deletion without id', async () => {
      const url = buildUrl('/api/menu-variants');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEVariant(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent variant', async () => {
      const url = buildUrl('/api/menu-variants', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEVariant(req as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await db.menuVariant.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdMenuItemIds) {
      await db.menuItem.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdCategoryIds) {
      await db.orderCategory.delete({ where: { id } }).catch(() => {});
    }
  });
});
