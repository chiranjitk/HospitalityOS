import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/login/route';
import { GET as getSession, POST as refreshSession } from '@/app/api/auth/session/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { createAuthRequest, buildUrl, USER_ID, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let tempSessionId: string;

beforeAll(async () => {
  // Create a temporary session for logout test (so we don't destroy the shared test session)
  tempSessionId = `temp-logout-${uniqueSuffix()}`;
  await db.session.create({
    data: {
      userId: USER_ID,
      token: tempSessionId,
      refreshToken: `temp-logout-refresh-${uniqueSuffix()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      userAgent: 'Test Browser',
      ipAddress: '127.0.0.1',
    },
  });
});

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('should reject login with missing email and password', async () => {
      const url = buildUrl('/api/auth/login');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject login with missing password only', async () => {
      const url = buildUrl('/api/auth/login');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { email: 'test@test.com' },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject login with invalid credentials', async () => {
      const url = buildUrl('/api/auth/login');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { email: 'nonexistent@test.com', password: 'wrongpassword' },
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject login with wrong password for existing user', async () => {
      const url = buildUrl('/api/auth/login');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { email: 'admin@royalstay.in', password: 'wrongpassword123' },
      });
      const res = await POST(req);
      expect([401, 403]).toContain(res.status);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('should reject 2FA verification with invalid temp token', async () => {
      const url = buildUrl('/api/auth/login');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { twoFactorCode: '123456', tempToken: 'invalid-token-here' },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/auth/session', () => {
    it('should return current session for authenticated user', async () => {
      const url = buildUrl('/api/auth/session');
      const req = await createAuthRequest(url);
      const res = await getSession(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBeDefined();
      expect(data.user.email).toBeDefined();
      expect(data.user.firstName).toBeDefined();
      expect(data.user.tenantId).toBeDefined();
    });

    it('should return user permissions in session', async () => {
      const url = buildUrl('/api/auth/session');
      const req = await createAuthRequest(url);
      const res = await getSession(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.permissions).toBeDefined();
      expect(Array.isArray(data.user.permissions)).toBe(true);
    });

    it('should return user tenant info in session', async () => {
      const url = buildUrl('/api/auth/session');
      const req = await createAuthRequest(url);
      const res = await getSession(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.tenant).toBeDefined();
      expect(data.user.tenant.id).toBeDefined();
      expect(data.user.tenant.name).toBeDefined();
    });

    it('should return unauthenticated for request without session cookie', async () => {
      const url = buildUrl('/api/auth/session');
      const req = new NextRequest(url, { method: 'GET' });
      const res = await getSession(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.user).toBeNull();
    });
  });

  describe('POST /api/auth/session (refresh)', () => {
    it('should refresh session token', async () => {
      const url = buildUrl('/api/auth/session');
      const req = await createAuthRequest(url, { method: 'POST' });
      const res = await refreshSession(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.refreshed).toBe(true);
      expect(data.user).toBeDefined();
    });

    it('should reject refresh without session cookie', async () => {
      const url = buildUrl('/api/auth/session');
      const req = new NextRequest(url, { method: 'POST' });
      const res = await refreshSession(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      // Use a temporary session instead of the shared test session
      const url = buildUrl('/api/auth/logout');
      const req = new NextRequest(url, {
        method: 'POST',
        headers: { Cookie: `session_token=${tempSessionId}` },
      });
      const res = await logout(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should logout even without session cookie', async () => {
      const url = buildUrl('/api/auth/logout');
      const req = new NextRequest(url, { method: 'POST' });
      const res = await logout(req);
      // Logout should still succeed even without a session
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  afterAll(async () => {
    // Cleanup temp session if still exists
    try {
      await db.session.deleteMany({ where: { token: tempSessionId } });
    } catch {
      // Already deleted by logout
    }
    // Restore a valid session for the shared test user token
    // (the refresh test above may have rotated the token)
    try {
      const existingSession = await db.session.findFirst({
        where: { userId: USER_ID },
        select: { token: true },
      });
      if (existingSession) {
        // Ensure the cached token still works by creating it if needed
        const { getSessionToken } = await import('./test-helpers');
        const cachedToken = await getSessionToken();
        const sessionWithCachedToken = await db.session.findUnique({
          where: { token: cachedToken },
        });
        if (!sessionWithCachedToken) {
          // The refresh test changed the token — recreate with the original token
          await db.session.create({
            data: {
              userId: USER_ID,
              token: cachedToken,
              refreshToken: `restore-${Date.now()}`,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              userAgent: 'Test Restore',
              ipAddress: '127.0.0.1',
            },
          });
        }
      }
    } catch {
      // Ignore
    }
  });
});
