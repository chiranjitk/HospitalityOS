import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, DELETE } from '@/app/api/sessions/route';
import { createAuthRequest, buildUrl, USER_ID, TENANT_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

describe('Sessions API', () => {
  let otherSessionId: string;

  beforeAll(async () => {
    // Create an extra session for the test user so we can test revoking it
    crypto.randomUUID = () => '00000000-0000-0000-0000-000000000001';
    const extraSession = await db.session.create({
      data: {
        userId: USER_ID,
        token: `extra-session-token-${uniqueSuffix()}`,
        refreshToken: `extra-refresh-token-${uniqueSuffix()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        userAgent: 'Test Browser on TestOS',
        ipAddress: '127.0.0.1',
      },
    });
    otherSessionId = extraSession.id;
  });

  describe('GET /api/sessions', () => {
    it('should return list of sessions for current user', async () => {
      const url = buildUrl('/api/sessions');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessions).toBeDefined();
      expect(Array.isArray(data.sessions)).toBe(true);
      expect(data.sessions.length).toBeGreaterThanOrEqual(1);
    });

    it('should include device info for each session', async () => {
      const url = buildUrl('/api/sessions');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessions.length).toBeGreaterThan(0);
      const session = data.sessions[0];
      expect(session).toHaveProperty('device');
      expect(session).toHaveProperty('deviceType');
      expect(session).toHaveProperty('ip');
      expect(session).toHaveProperty('lastActive');
      expect(session).toHaveProperty('expiresAt');
      expect(session).toHaveProperty('current');
    });

    it('should mark the current session', async () => {
      const url = buildUrl('/api/sessions');
      const req = await createAuthRequest(url);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      const currentSession = data.sessions.find((s: any) => s.current === true);
      expect(currentSession).toBeDefined();
    });

    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/sessions');
      const req = new NextRequest(url, { method: 'GET' });
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/sessions', () => {
    it('should return 401 without session cookie', async () => {
      const url = buildUrl('/api/sessions');
      const req = new NextRequest(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'some-id' }),
      });
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it('should return 400 without sessionId in body', async () => {
      const url = buildUrl('/api/sessions');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: {},
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent session', async () => {
      const url = buildUrl('/api/sessions');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { sessionId: '00000000-0000-0000-0000-000000000000' },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });

    it('should revoke another session', async () => {
      const url = buildUrl('/api/sessions');
      const req = await createAuthRequest(url, {
        method: 'DELETE',
        body: { sessionId: otherSessionId },
      });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
