import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import {
  GET as GETRecipes,
  POST as POSTRecipe,
  PUT as PUTRecipe,
  DELETE as DELETERecipe,
} from '@/app/api/recipes/route';
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

const createdRecipeIds: string[] = [];
const createdCategoryIds: string[] = [];
const createdMenuItemIds: string[] = [];

// Recipe model has a unique constraint on menuItemId — each recipe needs its own menu item.
async function createTestMenuItem(): Promise<string> {
  const suffix = uniqueSuffix();
  const catUrl = buildUrl('/api/menu-categories');
  const catReq = await createAuthRequest(catUrl, {
    method: 'POST',
    body: { propertyId: PROPERTY_ID, name: `Recipe Cat ${suffix}`, status: 'active' },
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
      name: `Recipe Item ${suffix}`,
      price: 400,
      isAvailable: true,
      status: 'active',
    },
  });
  const miRes = await POSTMenuItem(miReq as any);
  const miData = await miRes.json();
  createdMenuItemIds.push(miData.data.id);
  return miData.data.id;
}

describe('Recipes API', () => {
  describe('GET /api/recipes', () => {
    it('should list recipes', async () => {
      // NOTE: Recipe model has no propertyId field; passing it causes Prisma error
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url);
      const res = await GETRecipes(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by categoryId (client-side)', async () => {
      const url = buildUrl('/api/recipes', {
        categoryId: 'nonexistent-id',
      });
      const req = await createAuthRequest(url);
      const res = await GETRecipes(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(0);
    });

    it('should include menuItem and ingredients', async () => {
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url);
      const res = await GETRecipes(req as any);
      const data = await res.json();
      if (data.data.length > 0) {
        for (const recipe of data.data) {
          expect(recipe.menuItem).toBeDefined();
          expect(recipe.menuItem).toHaveProperty('id');
          expect(recipe.menuItem).toHaveProperty('name');
          expect(Array.isArray(recipe.ingredients)).toBe(true);
        }
      }
    });
  });

  describe('POST /api/recipes', () => {
    it('should create a recipe with ingredients', async () => {
      const menuItemId = await createTestMenuItem();
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          menuItemId,
          instructions: 'Marinate chicken for 2 hours. Grill on high heat for 8 minutes each side.',
          prepTime: 30,
          cookTime: 20,
          yield: 4,
          ingredients: [
            { name: 'Chicken Breast', quantity: 500, unit: 'g', costPerUnit: 0.003, sortOrder: 0 },
            { name: 'Yogurt', quantity: 200, unit: 'ml', costPerUnit: 0.005, sortOrder: 1 },
            { name: 'Spice Mix', quantity: 30, unit: 'g', costPerUnit: 0.02, sortOrder: 2 },
          ],
        },
      });
      const res = await POSTRecipe(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.menuItemId).toBe(menuItemId);
      expect(data.data.prepTime).toBe(30);
      expect(data.data.cookTime).toBe(20);
      expect(data.data.yield).toBe(4);
      expect(data.data.costPerServing).toBeGreaterThan(0);
      expect(data.data.ingredients.length).toBe(3);
      expect(data.data.ingredients[0].name).toBe('Chicken Breast');
      createdRecipeIds.push(data.data.id);
    });

    it('should calculate costPerServing correctly', async () => {
      const menuItemId = await createTestMenuItem();
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          menuItemId,
          instructions: 'Cook the rice',
          yield: 2,
          ingredients: [
            { name: 'Rice', quantity: 200, unit: 'g', costPerUnit: 0.01 },
          ],
        },
      });
      const res = await POSTRecipe(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      // 200g * 0.01 = 2.0 total cost, / 2 servings = 1.0 per serving
      expect(data.data.costPerServing).toBe(1.0);
      createdRecipeIds.push(data.data.id);
    });

    it('should reject creation without menuItemId', async () => {
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { instructions: 'No menu item' },
      });
      const res = await POSTRecipe(req as any);
      expect(res.status).toBe(400);
    });

    it('should create recipe with empty ingredients', async () => {
      const menuItemId = await createTestMenuItem();
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          menuItemId,
          instructions: 'Simple recipe',
          ingredients: [],
        },
      });
      const res = await POSTRecipe(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.ingredients.length).toBe(0);
      createdRecipeIds.push(data.data.id);
    });
  });

  describe('PUT /api/recipes', () => {
    it('should update a recipe', async () => {
      const menuItemId = await createTestMenuItem();

      // Create
      const createUrl = buildUrl('/api/recipes');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          menuItemId,
          instructions: 'Original instructions',
          prepTime: 10,
        },
      });
      const createRes = await POSTRecipe(createReq as any);
      const createData = await createRes.json();
      const recipeId = createData.data.id;
      createdRecipeIds.push(recipeId);

      // Update
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: recipeId,
          instructions: 'Updated instructions for the recipe',
          prepTime: 15,
          cookTime: 30,
          yield: 6,
          ingredients: [
            { name: 'Flour', quantity: 300, unit: 'g', costPerUnit: 0.002, sortOrder: 0 },
            { name: 'Sugar', quantity: 100, unit: 'g', costPerUnit: 0.003, sortOrder: 1 },
          ],
        },
      });
      const res = await PUTRecipe(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.instructions).toBe('Updated instructions for the recipe');
      expect(data.data.prepTime).toBe(15);
      expect(data.data.cookTime).toBe(30);
      expect(data.data.yield).toBe(6);
      expect(data.data.ingredients.length).toBe(2);
    });

    it('should reject update without id', async () => {
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { instructions: 'No ID' },
      });
      const res = await PUTRecipe(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent recipe', async () => {
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', instructions: 'Ghost' },
      });
      const res = await PUTRecipe(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/recipes', () => {
    it('should soft-delete a recipe', async () => {
      const menuItemId = await createTestMenuItem();
      const createUrl = buildUrl('/api/recipes');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: {
          menuItemId,
          instructions: 'Delete this recipe',
        },
      });
      const createRes = await POSTRecipe(createReq as any);
      const createData = await createRes.json();
      const recipeId = createData.data.id;

      const url = buildUrl('/api/recipes', { id: recipeId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETERecipe(req as any);
      expect(res.status).toBe(200);
      expect(res.json()).resolves.toHaveProperty('success', true);

      // Verify soft-deleted
      const recipe = await db.recipe.findFirst({ where: { id: recipeId } });
      expect(recipe?.deletedAt).not.toBeNull();
    });

    it('should reject deletion without id', async () => {
      const url = buildUrl('/api/recipes');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETERecipe(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent recipe', async () => {
      const url = buildUrl('/api/recipes', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETERecipe(req as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    for (const id of createdRecipeIds) {
      await db.recipeIngredient.deleteMany({ where: { recipeId: id } }).catch(() => {});
      await db.recipe.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdMenuItemIds) {
      await db.menuItem.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdCategoryIds) {
      await db.orderCategory.delete({ where: { id } }).catch(() => {});
    }
  });
});
