import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/experience-availability/route';
import { createAuthRequest, buildUrl, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let experienceId: string;
let createdSlotId: string;
let createdRuleId: string;

describe('Experience Availability API', () => {
  beforeAll(async () => {
    // Create a test experience for availability tests
    const suffix = uniqueSuffix();
    const exp = await db.experience.create({
      data: {
        tenantId: TENANT_ID,
        name: `Test Avail Exp ${suffix.slice(-4)}`,
        description: 'Test experience for availability',
        duration: 60,
        maxParticipants: 10,
        basePrice: 500,
        status: 'active',
      },
    });
    experienceId = exp.id;
  });

  afterAll(async () => {
    if (experienceId) {
      try {
        await db.experiencePricing.deleteMany({ where: { experienceId } });
        await db.experience.delete({ where: { id: experienceId } });
      } catch (e) { /* ignore */ }
    }
  });

  describe('GET /api/experience-availability', () => {
    it('should return 400 if experienceId is missing', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent experience', async () => {
      const url = buildUrl('/api/experience-availability', { experienceId: '00000000-0000-0000-0000-000000000000' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(404);
    });

    it('should return time slots and pricing rules for an experience', async () => {
      const url = buildUrl('/api/experience-availability', { experienceId });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.experience).toBeDefined();
      expect(data.data.experience.id).toBe(experienceId);
      expect(Array.isArray(data.data.timeSlots)).toBe(true);
      expect(Array.isArray(data.data.pricingRules)).toBe(true);
    });
  });

  describe('POST /api/experience-availability', () => {
    it('should create a time slot', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'slot',
          experienceId,
          startTime: '09:00',
          endTime: '10:00',
          capacity: 10,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('slot');
      expect(data.data.startTime).toBe('09:00');
      expect(data.data.endTime).toBe('10:00');
      createdSlotId = data.data.id;
    });

    it('should create a pricing rule', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'rule',
          experienceId,
          seasonName: 'Peak Season',
          priceMultiplier: 1.5,
          maxGuests: 8,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('rule');
      expect(data.data.seasonName).toBe('Peak Season');
      createdRuleId = data.data.id;
    });

    it('should reject time slot without required fields', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'slot',
          experienceId,
          // missing startTime and endTime
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid time format', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'slot',
          experienceId,
          startTime: '25:00',
          endTime: '26:00',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject pricing rule without seasonName', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'rule',
          experienceId,
          // missing seasonName
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent experience', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          type: 'slot',
          experienceId: '00000000-0000-0000-0000-000000000000',
          startTime: '09:00',
          endTime: '10:00',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/experience-availability', () => {
    it('should update a time slot', async () => {
      if (!createdSlotId) return;
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdSlotId,
          capacity: 15,
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.capacity).toBe(15);
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { capacity: 10 },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent entry', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/experience-availability', () => {
    it('should delete a time slot', async () => {
      if (!createdSlotId) return;
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: createdSlotId },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: {},
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent entry', async () => {
      const url = buildUrl('/api/experience-availability');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: '00000000-0000-0000-0000-000000000000' },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });
});
