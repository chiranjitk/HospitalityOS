import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET as getMinibarItems, POST as postMinibarItem } from '@/app/api/minibar/items/route';
import { GET as getMinibarItem, PUT as putMinibarItem, DELETE as deleteMinibarItem } from '@/app/api/minibar/items/[id]/route';
import { GET as getConsumptions, POST as postConsumption } from '@/app/api/minibar/consumption/route';
import { GET as getConsumptionRecord } from '@/app/api/minibar/consumption/[id]/route';
import { GET as getSetups, POST as postSetup } from '@/app/api/minibar/setup/route';
import { GET as getRoomSetup, PUT as putRoomSetup } from '@/app/api/minibar/setup/[roomId]/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix, createTestFixture } from './test-helpers';
import { db } from '@/lib/db';

let testItemId: string;
let consumptionId: string;
let fixture: Awaited<ReturnType<typeof createTestFixture>>;

beforeAll(async () => {
  fixture = await createTestFixture();
});

describe('Minibar API', () => {
  describe('POST /api/minibar/items', () => {
    it('should create a minibar item', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/minibar/items');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Test Soda ${suffix}`,
          category: 'beverage',
          sku: `SKU-${suffix.slice(-6)}`,
          costPrice: 30,
          sellPrice: 80,
          currency: 'INR',
          isActive: true,
          sortOrder: 1,
        },
      });
      const res = await postMinibarItem(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Soda');
      expect(data.data.status).toBe('active');
      testItemId = data.data.id;
    });
  });

  describe('GET /api/minibar/items', () => {
    it('should return list of minibar items', async () => {
      const url = buildUrl('/api/minibar/items', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getMinibarItems(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.items).toBeDefined();
      expect(data.data.pagination).toBeDefined();
    });
  });

  describe('GET /api/minibar/items/[id]', () => {
    it('should get a single minibar item', async () => {
      const url = buildUrl(`/api/minibar/items/${testItemId}`);
      const req = await createAuthRequest(url);
      const res = await getMinibarItem(req as any, { params: Promise.resolve({ id: testItemId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testItemId);
    });
  });

  describe('PUT /api/minibar/items/[id]', () => {
    it('should update a minibar item', async () => {
      const url = buildUrl(`/api/minibar/items/${testItemId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { sellPrice: 100 },
      });
      const res = await putMinibarItem(req as any, { params: Promise.resolve({ id: testItemId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.sellPrice).toBe(100);
    });
  });

  describe('POST /api/minibar/consumption', () => {
    it('should log minibar consumption', async () => {
      const url = buildUrl('/api/minibar/consumption');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: fixture.booking.propertyId,
          bookingId: fixture.booking.id,
          folioId: fixture.folio.id,
          roomId: fixture.room.id,
          itemId: testItemId,
          itemName: 'Test Soda',
          quantity: 2,
          unitPrice: 100,
          consumedAt: new Date().toISOString(),
        },
      });
      const res = await postConsumption(req as any);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.quantity).toBe(2);
      expect(data.data.totalPrice).toBe(200);
      consumptionId = data.data.id;
    });
  });

  describe('GET /api/minibar/consumption', () => {
    it('should return list of consumptions', async () => {
      const url = buildUrl('/api/minibar/consumption', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getConsumptions(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.consumptions).toBeDefined();
      expect(data.data.totals).toBeDefined();
    });
  });

  describe('GET /api/minibar/consumption/[id]', () => {
    it('should get a single consumption record', async () => {
      const url = buildUrl(`/api/minibar/consumption/${consumptionId}`);
      const req = await createAuthRequest(url);
      const res = await getConsumptionRecord(req as any, { params: Promise.resolve({ id: consumptionId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(consumptionId);
      expect(data.data.booking).toBeDefined();
    });
  });

  describe('POST /api/minibar/setup', () => {
    it('should create or upsert minibar setup', async () => {
      const url = buildUrl('/api/minibar/setup');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: fixture.booking.propertyId,
          roomId: fixture.room.id,
          itemJson: [{ itemId: testItemId, qty: 2 }],
          lastRestockedAt: new Date().toISOString(),
        },
      });
      const res = await postSetup(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
    });
  });

  describe('GET /api/minibar/setup', () => {
    it('should return list of minibar setups', async () => {
      const url = buildUrl('/api/minibar/setup', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getSetups(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.setups).toBeDefined();
    });
  });

  describe('GET /api/minibar/setup/[roomId]', () => {
    it('should get minibar setup for a specific room', async () => {
      const url = buildUrl(`/api/minibar/setup/${fixture.room.id}`);
      const req = await createAuthRequest(url);
      const res = await getRoomSetup(req as any, { params: Promise.resolve({ roomId: fixture.room.id }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.room).toBeDefined();
      expect(data.data.items).toBeDefined();
      expect(Array.isArray(data.data.items)).toBe(true);
    });
  });

  describe('PUT /api/minibar/setup/[roomId]', () => {
    it('should update minibar setup for a room', async () => {
      const url = buildUrl(`/api/minibar/setup/${fixture.room.id}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          itemJson: [{ itemId: testItemId, qty: 3 }],
          lastRestockedAt: new Date().toISOString(),
        },
      });
      const res = await putRoomSetup(req as any, { params: Promise.resolve({ roomId: fixture.room.id }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
    });
  });

  describe('DELETE /api/minibar/items/[id]', () => {
    it('should delete a minibar item', async () => {
      const url = buildUrl(`/api/minibar/items/${testItemId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await deleteMinibarItem(req as any, { params: Promise.resolve({ id: testItemId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  afterAll(async () => {
    // Clean up consumption and setup records
    if (fixture) {
      await db.folioLineItem.deleteMany({ where: { referenceType: 'minibar_consumption', referenceId: consumptionId } });
      await db.minibarConsumption.deleteMany({ where: { bookingId: fixture.booking.id } });
      await db.minibarSetup.deleteMany({ where: { roomId: fixture.room.id } });
      await fixture.cleanup();
    }
  });
});
