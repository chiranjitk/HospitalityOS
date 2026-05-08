import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GET, POST, PUT, DELETE } from '@/app/api/experiences/route';
import { createAuthRequest, buildUrl, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdExperienceId: string;

describe('Experiences API', () => {
  describe('GET /api/experiences', () => {
    it('should return list of experiences with pagination and stats', async () => {
      const url = buildUrl('/api/experiences', { limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBeDefined();
      expect(data.pagination.limit).toBeDefined();
      expect(data.pagination.total).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.stats.total).toBeDefined();
      expect(data.stats.active).toBeDefined();
    });

    it('should filter by category', async () => {
      const url = buildUrl('/api/experiences', { category: 'adventure', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const url = buildUrl('/api/experiences', { status: 'active', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should search by name or description', async () => {
      const url = buildUrl('/api/experiences', { search: 'test', limit: '5' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/experiences', () => {
    it('should create a new experience with all fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Experience ${suffix.slice(-4)}`,
          description: 'A wonderful test experience',
          category: 'adventure',
          duration: 90,
          maxParticipants: 15,
          basePrice: 2500,
          status: 'draft',
          tags: ['outdoor', 'nature'],
          highlights: ['Scenic views', 'Expert guide'],
          whatToBring: ['Sunscreen', 'Water bottle'],
          cancellationPolicy: 'Free cancellation 24h before',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toContain('Test Experience');
      expect(data.data.duration).toBe(90);
      expect(data.data.maxParticipants).toBe(15);
      expect(data.data.basePrice).toBe(2500);
      expect(data.data.status).toBe('draft');
      createdExperienceId = data.data.id;
    });

    it('should create experience with minimal fields', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Minimal Exp ${suffix.slice(-4)}`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.duration).toBe(60); // default
      expect(data.data.maxParticipants).toBe(10); // default
      expect(data.data.status).toBe('active'); // default
      // Cleanup
      await db.experience.delete({ where: { id: data.data.id } });
    });

    it('should process tags as comma-separated string', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Tagged Exp ${suffix.slice(-4)}`,
          tags: 'outdoor, nature, guided',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.tags).toBeDefined();
      // Cleanup
      await db.experience.delete({ where: { id: data.data.id } });
    });

    it('should reject empty name', async () => {
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: '   ' },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject negative duration', async () => {
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Bad Duration', duration: -5 },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject negative basePrice', async () => {
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Bad Price', basePrice: -100 },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/experiences', () => {
    it('should update an experience', async () => {
      if (!createdExperienceId) return;
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdExperienceId,
          name: 'Updated Experience Name',
          basePrice: 3000,
          status: 'active',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Updated Experience Name');
      expect(data.data.basePrice).toBe(3000);
      expect(data.data.status).toBe('active');
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { name: 'No ID' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent experience', async () => {
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: '00000000-0000-0000-0000-000000000000', name: 'Ghost' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });

    it('should reject empty name on update', async () => {
      if (!createdExperienceId) return;
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: createdExperienceId, name: '' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/experiences', () => {
    it('should soft-delete an experience', async () => {
      if (!createdExperienceId) return;
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: createdExperienceId },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('archived');
      expect(data.data.deletedAt).toBeDefined();
    });

    it('should return 400 if id is missing', async () => {
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: {},
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent experience', async () => {
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: '00000000-0000-0000-0000-000000000000' },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });

    it('should not double-delete already archived experience', async () => {
      if (!createdExperienceId) return;
      const url = buildUrl('/api/experiences');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { id: createdExperienceId },
      });
      const res = await DELETE(req);
      // Already deleted, so 404
      expect(res.status).toBe(404);
    });
  });
});
