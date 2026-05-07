import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST } from '@/app/api/lost-found/route';
import { GET as getItem, PATCH as patchItem } from '@/app/api/lost-found/[id]/route';
import { POST as notify } from '@/app/api/lost-found/[id]/notify/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, GUEST_ID, TENANT_ID } from './test-helpers';
import { db } from '@/lib/db';

let itemId: string;

describe('Lost & Found API', () => {
  describe('GET /api/lost-found', () => {
    it('should return list of lost & found items', async () => {
      const url = buildUrl('/api/lost-found', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });
  });

  describe('POST /api/lost-found', () => {
    it('should create a lost & found item', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/lost-found');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          itemType: 'found',
          category: 'electronics',
          description: `iPhone charger found in lobby ${suffix}`,
          locationFound: 'Main Lobby',
          foundBy: 'Staff Member',
          foundAt: new Date().toISOString(),
          guestId: GUEST_ID,
          storageLocation: 'Lost & Found Cabinet A3',
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.status).toBe('reported');
      expect(data.data.category).toBe('electronics');
      itemId = data.data.id;
    });
  });

  describe('GET /api/lost-found/[id]', () => {
    it('should get a single lost & found item', async () => {
      const url = buildUrl(`/api/lost-found/${itemId}`);
      const req = await createAuthRequest(url);
      const res = await getItem(req as any, { params: Promise.resolve({ id: itemId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(itemId);
      expect(data.data.guest).toBeDefined();
    });
  });

  describe('PATCH /api/lost-found/[id]', () => {
    it('should update item status to matched', async () => {
      const url = buildUrl(`/api/lost-found/${itemId}`);
      const req = await createAuthRequest(url, {
        method: 'PATCH',
        body: { status: 'matched' },
      });
      const res = await patchItem(req as any, { params: Promise.resolve({ id: itemId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('matched');
      expect(data.data.matchedAt).toBeDefined();
    });
  });

  describe('POST /api/lost-found/[id]/notify', () => {
    it('should send notification to guest', async () => {
      const url = buildUrl(`/api/lost-found/${itemId}/notify`);
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { channel: 'email', includeDescription: true },
      });
      const res = await notify(req as any, { params: Promise.resolve({ id: itemId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.sentVia).toBeDefined();
      expect(data.data.guestName).toBeDefined();
    });
  });

  afterAll(async () => {
    if (itemId) {
      // Cleanup notifications (no referenceId field — clean up by type + tenant)
      try {
        await db.notification.deleteMany({ where: { type: 'lost_found' } });
      } catch { /* ok */ }
      await db.auditLog.deleteMany({ where: { entityId: itemId } });
      await db.lostFoundItem.delete({ where: { id: itemId } });
    }
  });
});
