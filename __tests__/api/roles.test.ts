import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '@/app/api/roles/route';
import { createAuthRequest, buildUrl, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdRoleId: string;

describe('Roles API', () => {
  describe('GET /api/roles', () => {
    it('should return list of roles', async () => {
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.roles).toBeDefined();
      expect(Array.isArray(data.roles)).toBe(true);
      expect(data.roles.length).toBeGreaterThanOrEqual(1);
    });

    it('should include user count for each role', async () => {
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.roles.length > 0) {
        const role = data.roles[0];
        expect(role).toHaveProperty('_count');
        expect(role._count).toHaveProperty('users');
        expect(typeof role._count.users).toBe('number');
      }
    });

    it('should include tenantId in response', async () => {
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tenantId).toBeDefined();
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/roles');
      const req = new NextRequest(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/roles', () => {
    it('should create a new role successfully', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `test_role_${suffix.slice(-6)}`,
          displayName: `Test Role ${suffix.slice(-4)}`,
          description: 'A test role created by API tests',
          permissions: ['bookings.view', 'bookings.create'],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.role).toBeDefined();
      expect(data.role.id).toBeDefined();
      expect(data.role.name).toContain('test_role_');
      createdRoleId = data.role.id;
    });

    it('should reject role with missing required fields', async () => {
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'incomplete_role',
          // missing displayName
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject role with invalid name format', async () => {
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Invalid Role Name!',
          displayName: 'Invalid Name',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject role with uppercase name', async () => {
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'TestRoleUpper',
          displayName: 'Test',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject duplicate role name', async () => {
      if (!createdRoleId) return;
      // Try to create a role with admin name (which already exists)
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'admin',
          displayName: 'Duplicate Admin',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/roles', () => {
    it('should update a role', async () => {
      if (!createdRoleId) return;
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          id: createdRoleId,
          displayName: 'Updated Test Role',
          description: 'Updated description',
          permissions: ['bookings.view', 'bookings.create', 'bookings.edit'],
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.role.displayName).toBe('Updated Test Role');
    });

    it('should reject update without role ID', async () => {
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          displayName: 'No ID',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent role', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: fakeId, displayName: 'Ghost Role' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(404);
    });

    it('should reject modification of admin role', async () => {
      // Find the admin role
      const adminRole = await db.role.findFirst({
        where: { tenantId: TENANT_ID, name: 'admin', isSystem: true },
      });
      if (!adminRole) return;

      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { id: adminRole.id, displayName: 'Hacked Admin' },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Cannot modify the admin role');
    });
  });

  describe('DELETE /api/roles', () => {
    it('should reject delete without role ID', async () => {
      const url = buildUrl('/api/roles');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent role', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl('/api/roles', { id: fakeId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });

    it('should reject deletion of system roles', async () => {
      const adminRole = await db.role.findFirst({
        where: { tenantId: TENANT_ID, name: 'admin', isSystem: true },
      });
      if (!adminRole) return;

      const url = buildUrl('/api/roles', { id: adminRole.id });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should delete a custom role with no assigned users', async () => {
      if (!createdRoleId) return;
      const url = buildUrl('/api/roles', { id: createdRoleId });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      createdRoleId = ''; // Mark as deleted
    });
  });

  afterAll(async () => {
    // Cleanup: delete test role if not already deleted
    if (createdRoleId) {
      try {
        await db.role.deleteMany({ where: { id: createdRoleId } });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });
});
