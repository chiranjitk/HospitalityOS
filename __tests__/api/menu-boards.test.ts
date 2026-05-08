import { describe, it, expect, afterAll } from 'vitest';
import { GET as getMenuBoards, POST as postMenuBoard } from '@/app/api/pos/menu-boards/route';
import { GET as getMenuBoard, PUT as putMenuBoard, DELETE as deleteMenuBoard } from '@/app/api/pos/menu-boards/[id]/route';
import { GET as getBoardItems, POST as postBoardItem } from '@/app/api/pos/menu-boards/[id]/items/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let boardId: string;

describe('Menu Boards API', () => {
  // ─── POST /api/pos/menu-boards ───
  describe('POST /api/pos/menu-boards', () => {
    it('should create a new menu board', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/pos/menu-boards');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Restaurant Board ${suffix}`,
          description: 'A test menu board for the restaurant',
          location: 'main_dining',
          orientation: 'landscape',
          resolution: '1920x1080',
          theme: 'dark',
          propertyId: PROPERTY_ID,
        },
      });
      const res = await postMenuBoard(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Restaurant Board');
      expect(data.data.location).toBe('main_dining');
      expect(data.data.orientation).toBe('landscape');
      boardId = data.data.id;
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl('/api/pos/menu-boards');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { description: 'Board without name' },
      });
      const res = await postMenuBoard(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });
  });

  // ─── GET /api/pos/menu-boards ───
  describe('GET /api/pos/menu-boards', () => {
    it('should return list of menu boards with items count', async () => {
      const url = buildUrl('/api/pos/menu-boards');
      const req = await createAuthRequest(url);
      const res = await getMenuBoards(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter menu boards by propertyId', async () => {
      const url = buildUrl('/api/pos/menu-boards', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getMenuBoards(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  // ─── GET /api/pos/menu-boards/[id] ───
  describe('GET /api/pos/menu-boards/[id]', () => {
    it('should get a single menu board by id', async () => {
      const url = buildUrl(`/api/pos/menu-boards/${boardId}`);
      const req = await createAuthRequest(url);
      const res = await getMenuBoard(req as any, { params: Promise.resolve({ id: boardId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(boardId);
      expect(data.data.items).toBeDefined();
      expect(Array.isArray(data.data.items)).toBe(true);
    });

    it('should return 404 for non-existent menu board', async () => {
      const url = buildUrl('/api/pos/menu-boards/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(url);
      const res = await getMenuBoard(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ─── PUT /api/pos/menu-boards/[id] ───
  describe('PUT /api/pos/menu-boards/[id]', () => {
    it('should update a menu board', async () => {
      const url = buildUrl(`/api/pos/menu-boards/${boardId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'Updated Board Name', theme: 'light', isActive: true },
      });
      const res = await putMenuBoard(req as any, { params: Promise.resolve({ id: boardId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Board Name');
      expect(data.data.theme).toBe('light');
    });

    it('should return 404 when updating non-existent board', async () => {
      const url = buildUrl('/api/pos/menu-boards/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'Non-existent' },
      });
      const res = await putMenuBoard(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ─── POST /api/pos/menu-boards/[id]/items ───
  describe('POST /api/pos/menu-boards/[id]/items', () => {
    it('should create a new menu board item', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl(`/api/pos/menu-boards/${boardId}/items`);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Butter Chicken ${suffix}`,
          description: 'Creamy tomato-based chicken curry',
          price: 450,
          currency: 'INR',
          category: 'main_course',
          isAvailable: true,
          isFeatured: true,
          sortOrder: 1,
        },
      });
      const res = await postBoardItem(req as any, { params: Promise.resolve({ id: boardId }) } as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Butter Chicken');
      expect(data.data.category).toBe('main_course');
      expect(data.data.price).toBe(450);
      expect(data.data.isFeatured).toBe(true);
    });

    it('should return 400 when required fields are missing', async () => {
      const url = buildUrl(`/api/pos/menu-boards/${boardId}/items`);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { price: 200 },
      });
      const res = await postBoardItem(req as any, { params: Promise.resolve({ id: boardId }) } as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 404 for non-existent board', async () => {
      const url = buildUrl('/api/pos/menu-boards/00000000-0000-0000-0000-000000000000/items');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Item', category: 'appetizer', price: 100 },
      });
      const res = await postBoardItem(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ─── GET /api/pos/menu-boards/[id]/items ───
  describe('GET /api/pos/menu-boards/[id]/items', () => {
    it('should return items for a menu board', async () => {
      const url = buildUrl(`/api/pos/menu-boards/${boardId}/items`);
      const req = await createAuthRequest(url);
      const res = await getBoardItems(req as any, { params: Promise.resolve({ id: boardId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter items by category', async () => {
      const url = buildUrl(`/api/pos/menu-boards/${boardId}/items`, { category: 'main_course' });
      const req = await createAuthRequest(url);
      const res = await getBoardItems(req as any, { params: Promise.resolve({ id: boardId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  // ─── DELETE /api/pos/menu-boards/[id] ───
  describe('DELETE /api/pos/menu-boards/[id]', () => {
    it('should delete a menu board', async () => {
      const url = buildUrl(`/api/pos/menu-boards/${boardId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteMenuBoard(req as any, { params: Promise.resolve({ id: boardId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(boardId);
    });

    it('should return 404 when deleting non-existent board', async () => {
      const url = buildUrl('/api/pos/menu-boards/00000000-0000-0000-0000-000000000000');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteMenuBoard(req as any, { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) } as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  afterAll(async () => {
    if (boardId) {
      await db.menuBoardItem.deleteMany({ where: { boardId } });
      await db.menuBoard.deleteMany({ where: { id: boardId } });
    }
  });
});
