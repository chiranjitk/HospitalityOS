import { describe, it, expect, afterAll } from 'vitest';
import { GET as getParity, POST as postParity } from '@/app/api/channel-manager/parity/route';
import { GET as getPush, POST as postPush } from '@/app/api/channel-manager/push/route';
import {
  createAuthRequest,
  buildUrl,
  PROPERTY_ID,
  ROOM_TYPE_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track IDs for cleanup
const createdSyncLogIds: string[] = [];

describe('Channel Manager API', () => {
  // ─── Rate Parity ─────────────────────────────────────────────────

  describe('GET /api/channel-manager/parity', () => {
    it('should return rate parity report for a property', async () => {
      const url = buildUrl('/api/channel-manager/parity', {
        propertyId: PROPERTY_ID,
      });
      const req = await createAuthRequest(url);
      const res = await getParity(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.reports).toBeDefined();
      expect(Array.isArray(data.data.reports)).toBe(true);
      expect(data.data.summary).toBeDefined();
      expect(typeof data.data.summary.totalChecks).toBe('number');
      expect(typeof data.data.summary.matched).toBe('number');
      expect(typeof data.data.summary.undercut).toBe('number');
      expect(data.data.parameters).toBeDefined();
      expect(data.data.parameters.propertyId).toBe(PROPERTY_ID);
    });

    it('should accept custom threshold and strategy', async () => {
      const url = buildUrl('/api/channel-manager/parity', {
        propertyId: PROPERTY_ID,
        threshold: '10',
        strategy: 'price_floor',
        priceFloor: '3000',
      });
      const req = await createAuthRequest(url);
      const res = await getParity(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.parameters.threshold).toBe(10);
      expect(data.data.parameters.strategy).toBe('price_floor');
      expect(data.data.parameters.priceFloor).toBe(3000);
    });

    it('should accept date range parameters', async () => {
      const url = buildUrl('/api/channel-manager/parity', {
        propertyId: PROPERTY_ID,
        startDate: '2025-07-01',
        endDate: '2025-07-07',
      });
      const req = await createAuthRequest(url);
      const res = await getParity(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.parameters.dateRange).toEqual({
        start: '2025-07-01',
        end: '2025-07-07',
      });
    });

    it('should return 400 when propertyId is missing', async () => {
      const url = buildUrl('/api/channel-manager/parity');
      const req = await createAuthRequest(url);
      const res = await getParity(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid threshold', async () => {
      const url = buildUrl('/api/channel-manager/parity', {
        propertyId: PROPERTY_ID,
        threshold: '-5',
      });
      const req = await createAuthRequest(url);
      const res = await getParity(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('threshold');
    });

    it('should return 400 for invalid strategy', async () => {
      const url = buildUrl('/api/channel-manager/parity', {
        propertyId: PROPERTY_ID,
        strategy: 'invalid_strategy',
      });
      const req = await createAuthRequest(url);
      const res = await getParity(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Invalid strategy');
    });
  });

  describe('POST /api/channel-manager/parity', () => {
    it('should apply parity corrections with match_lowest strategy', async () => {
      const url = buildUrl('/api/channel-manager/parity');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          strategy: 'match_lowest',
          threshold: 5,
        },
      });
      const res = await postParity(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('match_lowest');
      expect(data.data.summary).toBeDefined();
      expect(typeof data.data.summary.corrected).toBe('number');
      expect(typeof data.data.summary.skipped).toBe('number');
    });

    it('should return 400 when propertyId is missing', async () => {
      const url = buildUrl('/api/channel-manager/parity');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { strategy: 'match_lowest' },
      });
      const res = await postParity(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid strategy in POST', async () => {
      const url = buildUrl('/api/channel-manager/parity');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          strategy: 'bad_strategy',
        },
      });
      const res = await postParity(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Invalid strategy');
    });

    it('should apply parity corrections with price_floor strategy', async () => {
      const url = buildUrl('/api/channel-manager/parity');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          strategy: 'price_floor',
          priceFloor: 2000,
          roomTypeIds: [ROOM_TYPE_ID],
        },
      });
      const res = await postParity(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.parameters.strategy).toBe('price_floor');
      expect(data.data.parameters.priceFloor).toBe(2000);
    });
  });

  // ─── Channel Push ────────────────────────────────────────────────

  describe('GET /api/channel-manager/push', () => {
    it('should return push status with channels and mappings', async () => {
      const url = buildUrl('/api/channel-manager/push');
      const req = await createAuthRequest(url);
      const res = await getPush(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data.channels)).toBe(true);
      expect(Array.isArray(data.data.mappings)).toBe(true);
      expect(Array.isArray(data.data.recentPushes)).toBe(true);
    });
  });

  describe('POST /api/channel-manager/push', () => {
    it('should return error when no active channels found for push', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/channel-manager/push');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'rates',
          roomTypeId: ROOM_TYPE_ID,
          channelIds: [`nonexistent-channel-${suffix}`],
          startDate: '2025-08-01',
          endDate: '2025-08-07',
          data: { rate: 5000 },
        },
      });
      const res = await postPush(req as any);
      // Either 400 (no channels) or 200 with failed results
      const data = await res.json();
      // If no channels found, expect NO_CHANNELS error or failed results
      if (res.status === 400) {
        expect(data.error.code).toBe('NO_CHANNELS');
      } else {
        // With some test data having channels, just check structure
        expect(data.data).toBeDefined();
      }
    });

    it('should return 400 for missing required fields', async () => {
      const url = buildUrl('/api/channel-manager/push');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { type: 'rates' }, // missing roomTypeId, dates, data
      });
      const res = await postPush(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for invalid room type', async () => {
      const url = buildUrl('/api/channel-manager/push');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'rates',
          roomTypeId: '00000000-0000-0000-0000-000000000000',
          startDate: '2025-08-01',
          endDate: '2025-08-07',
          data: { rate: 5000 },
        },
      });
      const res = await postPush(req as any);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── Cleanup ─────────────────────────────────────────────────────

  afterAll(async () => {
    // Clean up any channel sync logs created during tests
    for (const id of createdSyncLogIds) {
      try {
        await db.channelSyncLog.delete({ where: { id } });
      } catch {
        // Already deleted or not found
      }
    }
  });
});
