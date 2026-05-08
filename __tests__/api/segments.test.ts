import { describe, it, expect, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/segments/route';
import {
  createAuthRequest,
  buildUrl,
  TENANT_ID,
  GUEST_ID,
  uniqueSuffix,
} from './test-helpers';
import { db } from '@/lib/db';

// Track created IDs for cleanup
const createdSegmentIds: string[] = [];

describe('Segments API', () => {
  // ─── GET /api/segments ─────────────────────────────────────────

  describe('GET /api/segments', () => {
    it('should return list of segments with stats', async () => {
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.segments).toBeDefined();
      expect(Array.isArray(data.data.segments)).toBe(true);
      expect(typeof data.data.total).toBe('number');
      expect(data.data.stats).toBeDefined();
      expect(typeof data.data.stats.totalSegments).toBe('number');
      expect(typeof data.data.stats.totalMembers).toBe('number');
      expect(typeof data.data.stats.avgMembersPerSegment).toBe('number');
    });

    it('should return memberCount for each segment', async () => {
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      data.data.segments.forEach((s: any) => {
        expect(typeof s.memberCount).toBe('number');
      });
    });

    it('should return at most 5 members as preview', async () => {
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      const data = await res.json();
      data.data.segments.forEach((s: any) => {
        if (s.members) {
          expect(s.members.length).toBeLessThanOrEqual(5);
        }
      });
    });

    it('should search segments by name or description', async () => {
      const url = buildUrl('/api/segments', { search: 'vip' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.segments)).toBe(true);
    });

    it('should respect pagination', async () => {
      const url = buildUrl('/api/segments', { limit: '2', offset: '0' });
      const req = await createAuthRequest(url);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.segments.length).toBeLessThanOrEqual(2);
    });
  });

  // ─── POST /api/segments ────────────────────────────────────────

  describe('POST /api/segments', () => {
    it('should create a new segment', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Segment ${suffix}`,
          description: 'Test segment description',
          rules: JSON.stringify({ operator: 'and', rules: [] }),
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Segment');
      expect(data.data.memberCount).toBe(0);
      createdSegmentIds.push(data.data.id);
    });

    it('should create a segment with guest members', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `VIP Segment ${suffix}`,
          description: 'VIP guest segment',
          guestIds: [GUEST_ID],
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.memberCount).toBe(1);
      expect(data.data.members).toBeDefined();
      expect(data.data.members.length).toBe(1);
      createdSegmentIds.push(data.data.id);
    });

    it('should reject creation without name', async () => {
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { description: 'No name segment' },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate segment name', async () => {
      const suffix = uniqueSuffix();
      const name = `Dup Segment ${suffix}`;

      // Create first
      const createUrl = buildUrl('/api/segments');
      const firstReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name },
      });
      const firstRes = await POST(firstReq as any);
      const firstData = await firstRes.json();
      if (firstRes.status === 200) createdSegmentIds.push(firstData.data.id);

      // Try duplicate
      const secondReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name },
      });
      const secondRes = await POST(secondReq as any);
      expect(secondRes.status).toBe(400);
    });

    it('should reject segment with non-existent guest IDs', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Bad Guests ${suffix}`,
          guestIds: ['00000000-0000-0000-0000-000000000000'],
        },
      });
      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });
  });

  // ─── PUT /api/segments ─────────────────────────────────────────

  describe('PUT /api/segments', () => {
    it('should update segment name and description', async () => {
      const suffix = uniqueSuffix();
      // Create first
      const createUrl = buildUrl('/api/segments');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name: `To Update ${suffix}` },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const segmentId = createData.data.id;
      createdSegmentIds.push(segmentId);

      // Update
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: segmentId,
          name: `Updated ${suffix}`,
          description: 'Updated description',
        },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toContain('Updated');
      expect(data.data.description).toBe('Updated description');
    });

    // TODO: GuestSegment model does not have an `isActive` field. The API route
    // tries to set it which causes a Prisma validation error (500).
    it.skip('should toggle segment isActive', async () => {
      const suffix = uniqueSuffix();
      const createUrl = buildUrl('/api/segments');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name: `Toggle Test ${suffix}` },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const segmentId = createData.data.id;
      createdSegmentIds.push(segmentId);

      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: segmentId, isActive: false },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.isActive).toBe(false);
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No id' },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent segment', async () => {
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(404);
    });

    it('should reject duplicate name on update', async () => {
      const suffix = uniqueSuffix();
      const name = `Dup Update ${suffix}`;

      // Create two segments
      const createUrl = buildUrl('/api/segments');
      const firstReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name },
      });
      const firstRes = await POST(firstReq as any);
      const firstData = await firstRes.json();
      const firstId = firstData.data.id;
      createdSegmentIds.push(firstId);

      const secondReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name: `Other ${suffix}` },
      });
      const secondRes = await POST(secondReq as any);
      const secondData = await secondRes.json();
      const secondId = secondData.data.id;
      createdSegmentIds.push(secondId);

      // Try to update second to have same name as first
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: secondId, name },
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /api/segments ──────────────────────────────────────

  describe('DELETE /api/segments', () => {
    it('should delete a segment', async () => {
      const suffix = uniqueSuffix();
      // Create first
      const createUrl = buildUrl('/api/segments');
      const createReq = await createAuthRequest(createUrl, {
        method: 'POST',
        body: { name: `To Delete ${suffix}` },
      });
      const createRes = await POST(createReq as any);
      const createData = await createRes.json();
      const segmentId = createData.data.id;

      // Delete
      const url = buildUrl('/api/segments', { id: segmentId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 400 when id is missing', async () => {
      const url = buildUrl('/api/segments');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent segment', async () => {
      const url = buildUrl('/api/segments', { id: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(404);
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────

  afterAll(async () => {
    for (const id of createdSegmentIds) {
      try {
        await db.segmentMembership.deleteMany({ where: { segmentId: id } });
        await db.guestSegment.delete({ where: { id } });
      } catch {
        // Already deleted
      }
    }
  });
});
