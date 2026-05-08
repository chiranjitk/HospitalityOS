import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/profile/route';
import { createAuthRequest, buildUrl, USER_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

describe('Profile API', () => {
  let originalFirstName: string;
  let originalLastName: string;

  describe('GET /api/profile', () => {
    it('should return current user profile', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.id).toBeDefined();
      expect(data.user.email).toBeDefined();
      expect(data.user.firstName).toBeDefined();
      expect(data.user.lastName).toBeDefined();
    });

    it('should include role info in profile', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.role).toBeDefined();
      expect(data.user.role.name).toBeDefined();
    });

    it('should include tenant info in profile', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.tenant).toBeDefined();
      expect(data.user.tenant.id).toBeDefined();
      expect(data.user.tenant.name).toBeDefined();
    });

    it('should include 2FA status', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toHaveProperty('twoFactorEnabled');
    });

    it('should include preferences', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toHaveProperty('preferences');
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/profile');
      const req = new NextRequest(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/profile', () => {
    beforeAll(async () => {
      // Save original values for cleanup
      const user = await db.user.findUnique({
        where: { id: USER_ID },
        select: { firstName: true, lastName: true },
      });
      originalFirstName = user?.firstName || 'Admin';
      originalLastName = user?.lastName || 'User';
    });

    it('should update profile name', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          firstName: `Test${suffix.slice(-4)}`,
          lastName: 'Profile',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.firstName).toContain('Test');
      expect(data.user.lastName).toBe('Profile');
    });

    it('should update profile phone', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          phone: '+919876543210',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.phone).toBe('+919876543210');
    });

    it('should update profile job title and department', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          jobTitle: 'Test Engineer',
          department: 'Quality Assurance',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.jobTitle).toBe('Test Engineer');
      expect(data.user.department).toBe('Quality Assurance');
    });

    it('should reject duplicate email', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          email: 'admin@royalstay.in', // same email, should still work (no change)
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(200);
    });

    it('should reject password change without current password', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          newPassword: 'NewPassword123',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Current password is required');
    });

    it('should reject password change with wrong current password', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          currentPassword: 'WrongPassword123',
          newPassword: 'NewPassword123',
          confirmPassword: 'NewPassword123',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Current password is incorrect');
    });

    it('should reject password change with short new password', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          currentPassword: 'admin123',
          newPassword: '123',
          confirmPassword: '123',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it('should reject password change with mismatched confirmation', async () => {
      const url = buildUrl('/api/profile');
      const req = await createAuthRequest(url, {
        method: 'PUT',
        body: {
          currentPassword: 'admin123',
          newPassword: 'NewPassword123',
          confirmPassword: 'DifferentPassword456',
        },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Passwords do not match');
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/profile');
      const req = new NextRequest(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Ghost' }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(401);
    });

    afterAll(async () => {
      // Restore original name
      try {
        await db.user.update({
          where: { id: USER_ID },
          data: {
            firstName: originalFirstName,
            lastName: originalLastName,
            jobTitle: 'Administrator',
            department: 'Administration',
            phone: null,
          },
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  });
});
