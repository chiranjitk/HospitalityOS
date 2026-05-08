import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import {
  GET as GETModifiers,
  POST as POSTModifier,
  PUT as PUTModifier,
  DELETE as DELETEModifier,
} from '@/app/api/menu-modifiers/route';
import {
  GET as GETMenuCategories,
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
    body: { propertyId: PROPERTY_ID, name: `Mod Test Cat ${suffix}`, status: 'active' },
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
      name: `Mod Test Item ${suffix}`,
      price: 300,
      isAvailable: true,
      status: 'active',
    },
  });
  const res = await POSTMenuItem(req as any);
  const data = await res.json();
  createdMenuItemIds.push(data.data.id);
  return data.data.id;
}

describe('Menu Modifiers API', () => {
  let catId: string | null = null;
  let menuItemId: string | null = null;

  beforeAll(async () => {
    catId = await createTestCategory();
    menuItemId = await createTestMenuItem(catId);
  });

  describe('GET /api/menu-modifiers', () => {
    it('should list modifiers for a property', async () => {
      const url = buildUrl('/api/menu-modifiers', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETModifiers(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should reject request without propertyId', async () => {
      const url = buildUrl('/api/menu-modifiers');
      const req = await createAuthRequest(url);
      const res = await GETModifiers(req as any);
      expect(res.status).toBe(400);
    });

    it('should support search by name', async () => {
      const url = buildUrl('/api/menu-modifiers', {
        propertyId: PROPERTY_ID,
        search: 'size',
      });
      const req = await createAuthRequest(url);
      const res = await GETModifiers(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by isAvailable', async () => {
      const url = buildUrl('/api/menu-modifiers', {
        propertyId: PROPERTY_ID,
        isAvailable: 'true',
      });
      const req = await createAuthRequest(url);
      const res = await GETModifiers(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      for (const mod of data.data) {
        expect(mod.isAvailable).toBe(true);
      }
    });

    it('should include options and item counts', async () => {
      const url = buildUrl('/api/menu-modifiers', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GETModifiers(req as any);
      const data = await res.json();
      for (const mod of data.data) {
        expect(Array.isArray(mod.options)).toBe(true);
        expect(mod._count).toBeDefined();
        expect(typeof mod._count.items).toBe('number');
      }
    });
  });

  describe('POST /api/menu-modifiers', () => {
    it('should create a modifier with options', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/menu-modifiers');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Size Options ${suffix}`,
          selectionType: 'required',
          minSelections: 1,
          maxSelections: 1,
          isAvailable: true,
          options: [
            { name: 'Small', priceAdjustment: 0, isDefault: true },
            { name: 'Medium', priceAdjustment: 50, sortOrder: 1 },
            { name: 'Large', priceAdjustment: 100, sortOrder: 2 },
          ],
        },
      });
      const res = await POSTModifier(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe(`Size Options ${suffix}`);
      expect(data.data.selectionType).toBe('required');
      expect(data.data.options.length).toBe(3);
      expect(data.data.options[0].name).toBe('Small');
      expect(data.data.options[0].isDefault).toBe(true);
      createdIds.push(data.data.id);
    });

    it('should create a modifier linked to menu items', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/menu-modifiers');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Linked Mod ${suffix}`,
          selectionType: 'optional',
          itemIds: [menuItemId!],
          options: [
            { name: 'Extra Cheese', priceAdjustment: 30 },
          ],
        },
      });
      const res = await POSTModifier(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.items.length).toBe(1);
      expect(data.data.items[0].id).toBe(menuItemId);
      createdIds.push(data.data.id);
    });

    it('should reject creation without propertyId', async () => {
      const url = buildUrl('/api/menu-modifiers');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'No Property' },
      });
      const res = await POSTModifier(req as any);
      expect(res.status).toBe(400);
    });

    it('should reject creation without name', async () => {
      const url = buildUrl('/api/menu-modifiers');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { propertyId: PROPERTY_ID },
      });
      const res = await POSTModifier(req as any);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/menu-modifiers', () => {
    it('should update a modifier', async () => {
      const suffix = uniqueSuffix();

      // Create
      const createUrl = buildUrl('/api/menu-modifiers');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Update Mod ${suffix}`,
          options: [{ name: 'Option A' }],
        },
      });
      const createRes = await POSTModifier(createReq as any);
      const createData = await createRes.json();
      const modId = createData.data.id;
      createdIds.push(modId);

      // Update
      const url = buildUrl('/api/menu-modifiers');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: modId,
          name: `Updated Mod ${suffix}`,
          selectionType: 'required',
          maxSelections: 2,
          options: [
            { name: 'New Option 1', priceAdjustment: 10 },
            { name: 'New Option 2', priceAdjustment: 20 },
          ],
        },
      });
      const res = await PUTModifier(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.name).toBe(`Updated Mod ${suffix}`);
      expect(data.data.selectionType).toBe('required');
      expect(data.data.maxSelections).toBe(2);
      expect(data.data.options.length).toBe(2);
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/menu-modifiers');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No ID' },
      });
      const res = await PUTModifier(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent modifier', async () => {
      const url = buildUrl('/api/menu-modifiers');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUTModifier(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/menu-modifiers', () => {
    it('should soft-delete a modifier', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/menu-modifiers');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Delete Mod ${suffix}`,
        },
      });
      const createRes = await POSTModifier(createReq as any);
      const createData = await createRes.json();
      const modId = createData.data.id;

      const url = buildUrl('/api/menu-modifiers', { id: modId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEModifier(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(modId);

      // Verify soft-deleted
      const mod = await db.menuModifier.findFirst({ where: { id: modId } });
      expect(mod?.deletedAt).not.toBeNull();
    });

    it('should reject deletion without id', async () => {
      const url = buildUrl('/api/menu-modifiers');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEModifier(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent modifier', async () => {
      const url = buildUrl('/api/menu-modifiers', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETEModifier(req as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await db.menuModifierOption.deleteMany({ where: { modifierGroupId: id } }).catch(() => {});
      await db.menuModifier.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdMenuItemIds) {
      await db.menuItem.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdCategoryIds) {
      await db.orderCategory.delete({ where: { id } }).catch(() => {});
    }
  });
});
