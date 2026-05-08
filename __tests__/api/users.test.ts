import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/users/route';
import { GET as getUserById, PUT, DELETE } from '@/app/api/users/[id]/route';
import { createAuthRequest, buildUrl, TENANT_ID, USER_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdUserId: string;

describe('Users API', () => {
  describe('GET /api/users', () => {
    it('should return list of users', async () => {
      const url = buildUrl('/api/users');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.users.length).toBeGreaterThanOrEqual(1);
    });

    it('should include role info for each user', async () => {
      const url = buildUrl('/api/users');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      if (data.users.length > 0) {
        const user = data.users[0];
        expect(user).toHaveProperty('role');
      }
    });

    it('should filter users by role', async () => {
      const url = buildUrl('/api/users', { role: 'admin' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.users).toBeDefined();
      // All returned users should have the admin role
      if (data.users.length > 0) {
        expect(data.users[0].role.name).toBe('admin');
      }
    });

    it('should filter users by status', async () => {
      const url = buildUrl('/api/users', { status: 'active' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should filter users by department', async () => {
      const url = buildUrl('/api/users', { department: 'Administration' });
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/users');
      const req = new NextRequest(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user successfully', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/users');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          email: `testuser${suffix.slice(-4)}@test.com`,
          firstName: `Test${suffix.slice(-4)}`,
          lastName: 'UserAPI',
          password: 'TestPass123!@#',
          jobTitle: 'Test Staff',
          department: 'Testing',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.id).toBeDefined();
      expect(data.user.email).toContain('testuser');
      createdUserId = data.user.id;
    });

    it('should reject user with missing required fields', async () => {
      const url = buildUrl('/api/users');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          email: 'incomplete@test.com',
          // missing firstName, lastName, password
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject user with invalid email format', async () => {
      const url = buildUrl('/api/users');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          email: 'not-an-email',
          firstName: 'Test',
          lastName: 'User',
          password: 'TestPass123!@#',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject user with weak password', async () => {
      const url = buildUrl('/api/users');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          email: 'weakpass@test.com',
          firstName: 'Test',
          lastName: 'User',
          password: '123', // too short
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should reject duplicate email', async () => {
      const url = buildUrl('/api/users');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          email: 'admin@royalstay.in', // already exists
          firstName: 'Duplicate',
          lastName: 'Email',
          password: 'TestPass123!@#',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/users');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'noauth@test.com',
          firstName: 'No',
          lastName: 'Auth',
          password: 'TestPass123!@#',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/users/[id]', () => {
    it('should get user by ID', async () => {
      const url = buildUrl(`/api/users/${USER_ID}`);
      const req = await createAuthRequest(url);
      const res = await getUserById(req, { params: Promise.resolve({ id: USER_ID }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(USER_ID);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/users/${fakeId}`);
      const req = await createAuthRequest(url);
      const res = await getUserById(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });

    it('should include role with permissions', async () => {
      const url = buildUrl(`/api/users/${USER_ID}`);
      const req = await createAuthRequest(url);
      const res = await getUserById(req, { params: Promise.resolve({ id: USER_ID }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.role).toBeDefined();
      expect(data.user.role.permissions).toBeDefined();
    });
  });

  describe('PUT /api/users/[id]', () => {
    it('should update user fields', async () => {
      if (!createdUserId) return;
      const url = buildUrl(`/api/users/${createdUserId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          firstName: 'Updated',
          lastName: 'Name',
          jobTitle: 'Updated Title',
        },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: createdUserId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.firstName).toBe('Updated');
      expect(data.user.jobTitle).toBe('Updated Title');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/users/${fakeId}`);
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: { firstName: 'Ghost' },
      });
      const res = await PUT(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/users/[id]', () => {
    it('should return 400 for self-deletion', async () => {
      const url = buildUrl(`/api/users/${USER_ID}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: USER_ID }) } as any);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Cannot delete your own account');
    });

    it('should soft-delete a user', async () => {
      if (!createdUserId) return;
      const url = buildUrl(`/api/users/${createdUserId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: createdUserId }) } as any);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const url = buildUrl(`/api/users/${fakeId}`);
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: fakeId }) } as any);
      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    // Cleanup: hard delete test user created during tests
    if (createdUserId) {
      try {
        await db.user.deleteMany({ where: { id: createdUserId } });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });
});
