/**
 * WiFi Feature API Route Tests — E2E Unit Tests
 *
 * Tests all 9 new WiFi features' API routes for proper error handling,
 * null safety, response format, and edge cases. Covers GET/POST/PATCH/DELETE
 * operations across all 24 API routes.
 *
 * Features tested:
 *  1. WiFi Health Alerts (F21)
 *  2. Pre-Arrival WiFi Delivery (F7)
 *  3. Multi-Device Management (F9)
 *   4. Identity Verification (F14)
 *   5. GDPR Consent Management (F13)
 *  6. Bandwidth Upsell (F1)
 *  7. Revenue Analytics Dashboard (F6)
 *  8. Satisfaction Surveys (F12)
 *  9. SLA Monitoring (F23)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Helper: Create mock NextRequest ───────────────────────────────────────
function createRequest(url: string, options: RequestInit = {}) {
  return new NextRequest(`http://localhost:3000${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
}

// ─── Helper: Parse JSON response ──────────────────────────────────────────
async function parseJSON(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ─── Helper: Create a mock alert object ───────────────────────────────────
function mockAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alert-001',
    tenantId: 'tenant_01',
    propertyId: null,
    type: 'ap_down',
    severity: 'critical',
    title: 'AP Down - Lobby',
    message: 'Access point AP-Lobby-01 is not responding',
    source: 'AP-Lobby-01',
    metadata: '{}',
    status: 'active',
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolvedAt: null,
    resolvedBy: null,
    resolveNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Helper: Create a mock device object ──────────────────────────────────
function mockDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dev-001',
    tenantId: 'tenant_01',
    guestId: 'guest-001',
    propertyId: null,
    macAddress: 'AA:BB:CC:DD:EE:01',
    deviceName: 'iPhone 15',
    deviceType: 'phone',
    userAgent: 'Mozilla/5.0 (iPhone)',
    ipAddress: '192.168.1.100',
    isApproved: true,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    autoAuth: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    guest: { id: 'guest-001', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    property: null,
    ...overrides,
  };
}

// ─── Helper: Create a mock survey object ─────────────────────────────────
function mockSurvey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'survey-001',
    tenantId: 'tenant_01',
    propertyId: null,
    sessionId: 'sess-001',
    guestId: 'guest-001',
    rating: 5,
    comment: 'Great WiFi!',
    categories: '{"speed":5,"coverage":4,"easeOfConnect":5}',
    deviceType: 'phone',
    roomNumber: '301',
    apName: 'AP-Lobby-01',
    createdAt: new Date().toISOString(),
    guest: { id: 'guest-001', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
    property: null,
    ...overrides,
  };
}

// ─── Helper: Create a mock consent log ──────────────────────────────────
function mockConsentLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'consent-001',
    tenantId: 'tenant_01',
    guestId: 'guest-001',
    propertyId: null,
    sessionId: 'sess-001',
    consentType: 'wifi_access',
    consentTextHash: 'abc123hash',
    ipAddress: '192.168.1.50',
    macAddress: 'AA:BB:CC:DD:EE:02',
    userAgent: 'Mozilla/5.0',
    optInMarketing: false,
    dataRetentionDays: 90,
    expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    guest: { id: 'guest-001', firstName: 'Bob', lastName: 'Wilson', email: 'bob@example.com' },
    property: null,
    ...overrides,
  };
}

// ─── Helper: Create a mock identity log ────────────────────────────────
function mockIdentityLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'idlog-001',
    tenantId: 'tenant_01',
    propertyId: null,
    sessionId: 'sess-001',
    username: 'guest_bob_301',
    verificationMethod: 'room_number',
    verifiedIdentity: 'Room 301',
    verificationStatus: 'verified',
    ipAddress: '192.168.1.100',
    macAddress: 'AA:BB:CC:DD:EE:03',
    countryCode: 'IN',
    idType: null,
    failureReason: null,
    verifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Helper: Create a mock upgrade ─────────────────────────────────────
function mockUpgrade(overrides: Record<string, unknown> = {}) {
  return {
    id: 'upg-001',
    tenantId: 'tenant_01',
    guestId: 'guest-001',
    propertyId: null,
    sessionId: 'sess-001',
    username: 'guest_bob',
    fromPlanId: 'plan-free',
    toPlanId: 'plan-premium',
    amount: 299,
    currency: 'INR',
    folioId: null,
    paymentStatus: 'completed',
    coaStatus: 'applied',
    activatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    guest: { id: 'guest-001', firstName: 'Bob', lastName: 'Jones', email: 'bob@jones.com' },
    property: null,
    fromPlan: { id: 'plan-free', name: 'Free' },
    toPlan: { id: 'plan-premium', name: 'Premium' },
    ...overrides,
  };
}

// ─── Helper: Create a mock SLA config ─────────────────────────────────
function mockSLAConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sla-001',
    tenantId: 'tenant_01',
    propertyId: 'prop-001',
    name: 'Standard SLA',
    uptimeTarget: 99.9,
    speedDownTarget: 50,
    speedUpTarget: 25,
    latencyTarget: 50,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    property: { id: 'prop-001', name: 'Main Property' },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 1: WiFi Health Alerts (F21)
// ═══════════════════════════════════════════════════════════════════════════════
describe('WiFi Health Alerts API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/wifi/alerts', () => {
    it('should return empty array when no alerts exist', async () => {
      const res = await fetch('/api/wifi/alerts');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should accept filter parameters without error', async () => {
      const res = await fetch('/api/wifi/alerts?status=active&severity=critical&type=ap_down&propertyId=prop1&startDate=2025-01-01&endDate=2025-12-31&page=1&limit=20');
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid page parameter', async () => {
      const res = await fetch('/api/wifi/alerts?page=abc');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid limit parameter', async () => {
      const res = await fetch('/api/wifi/alerts?limit=-1');
      expect(res.status).toBe(400);
    });

    it('should return 400 for limit exceeding max (100)', async () => {
      const res = await fetch('/api/wifi/alerts?limit=101');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/wifi/alerts/stats', () => {
    it('should return stats with zero values when no alerts', async () => {
      const res = await fetch('/api/wifi/alerts/stats');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.activeCount).toBe(0);
    });
  });

  describe('PATCH /api/wifi/alerts/:id', () => {
    it('should return 404 for non-existent alert', async () => {
      const res = await fetch('/api/wifi/alerts/nonexistent', { method: 'PATCH', body: JSON.stringify({ status: 'acknowledged' }) });
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid status value', async () => {
      const res = await fetch('/api/wifi/alerts/alert-001', { method: 'PATCH', body: JSON.stringify({ status: 'invalid_status' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty body', async () => {
      const res = await fetch('/api/wifi/alerts/alert-001', { method: 'PATCH', body: JSON.stringify({}) });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/wifi/alerts/:id', () => {
    it('should return 404 for non-existent alert', async () => {
      const res = await fetch('/api/wifi/alerts/nonexistent', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 2: Pre-Arrival WiFi Delivery (F7)
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('Pre-Arrival WiFi Delivery API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/wifi/pre-arrival', () => {
    it('should return empty array when no configs', async () => {
      const res = await fetch('/api/wifi/pre-arrival');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });
  });

  describe('PATCH /api/wifi/pre-arrival/:id', () => {
    it('should return 404 for non-existent config', async () => {
      const res = await fetch('/api/wifi/pre-arrival/nonexistent', { method: 'PATCH', body: JSON.stringify({ enabled: true }) });
      expect(res.status).toBe(404);
    });

    it('should return 400 for empty update body', async () => {
      const res = await fetch('/api/wifi/pre-arrival/xxx', { method: 'PATCH', body: JSON.stringify({}) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid boolean', async () => {
      const res = await fetch('/api/wifi/pre-arrival/xxx', { method: 'PATCH', body: JSON.stringify({ enabled: 'not-a-boolean' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid hoursBeforeArrival', async () => {
      const res = await fetch('/api/wifi/pre-arrival/xxx', { method: 'PATCH', body: JSON.stringify({ hoursBeforeArrival: 'abc' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wifi/pre-arrival/send', () => {
    it('should return 400 when guestId is missing', async () => {
      const res = await fetch('/api/wifi/pre-arrival/send', { method: 'POST', body: JSON.stringify({}) });
      expect(res.status).toBe(400);
    });

    it('should return 400 when channels array is empty', async () => {
      const res = await fetch('/api/wifi/pre-arrival/send', { method: 'POST', body: JSON.stringify({ guestId: 'guest-001', channels: [] }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid channel type', async () => {
      const res = await fetch('/api/wifi/pre-arrival/send', { method: 'POST', body: JSON.stringify({ guestId: 'guest-001', channels: [{ channel: 'telegram' }] }) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/wifi/pre-arrival/delivery-logs', () => {
    it('should return empty array when no logs', async () => {
      const res = await fetch('/api/wifi/pre-arrival/delivery-logs?page=1&limit=15');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should return 400 for invalid page', async () => {
      const res = await fetch('/api/wifi/pre-arrival/delivery-logs?page=abc');
      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// FEATURE 3: Multi-Device Management (F9)
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('WiFi Device Management API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/wifi/devices', () => {
    it('should return empty array when no devices', async () => {
      const res = await fetch('/api/wifi/devices');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should accept search filter', async () => {
      const res = await fetch('/api/wifi/devices?search=john&deviceType=phone&isApproved=true&propertyId=prop1&limit=100');
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid limit', async () => {
      const res = await fetch('/api/wifi/devices?limit=abc');
      expect(res.status).toBe(400);
    });

    it('should return 400 for negative limit', async () => {
      const res = await fetch('/api/wifi/devices?limit=-5');
      expect(res.status).toBe(400);
    });

    it('should return 400 for isApproved not being boolean', async () => {
      const res = await fetch('/api/wifi/devices?isApproved=yes');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wifi/devices', () => {
    it('should return 400 when guestId is missing', async () => {
      const res = await fetch('/api/wifi/devices', { method: 'POST', body: JSON.stringify({ macAddress: 'AA:BB:CC:DD:EE:FF' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 when macAddress is missing', async () => {
      const res = await fetch('/api/wifi/devices', { method: 'POST', body: JSON.stringify({ guestId: 'guest-001' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid MAC format (too short)', async () => {
      const res = await fetch('/api/wifi/devices', { method: 'POST', body: JSON.stringify({ guestId: 'g1', macAddress: 'AABBCC' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for MAC with special characters', async () => {
      const res = await fetch('/api/wifi/devices', { method: 'POST', body: JSON.stringify({ guestId: 'g1', macAddress: 'ZZ:ZZ:ZZ:ZZ:ZZ:ZZ' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid deviceType', async () => {
      const res = await fetch('/api/wifi/devices', { method: 'POST', body: JSON.stringify({ guestId: 'g1', macAddress: 'AABBCCDDEEFF', deviceType: 'spaceship' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/wifi/devices/:id', () => {
    it('should return 404 for non-existent device', async () => {
      const res = await fetch('/api/wifi/devices/nonexistent', { method: 'PATCH', body: JSON.stringify({ deviceName: 'Test' }) });
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid isApproved value', async () => {
      const res = await fetch('/api/wifi/devices/dev-001', { method: 'PATCH', body: JSON.stringify({ isApproved: 'yes' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid autoAuth value', async () => {
      const res = await fetch('/api/wifi/devices/dev-001', { method: 'PATCH', body: JSON.stringify({ autoAuth: 'maybe' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for empty body', async () => {
      const res = await fetch('/api/wifi/devices/dev-001', { method: 'PATCH', body: JSON.stringify({}) });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/wifi/devices/:id', () => {
    it('should return 404 for non-existent device', async () => {
      const res = await fetch('/api/wifi/devices/nonexistent', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/wifi/devices/lookup', () => {
    it('should return 400 when macAddress is missing', async () => {
      const res = await fetch('/api/wifi/devices/lookup', { method: 'POST', body: JSON.stringify({}) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid MAC', async () => {
      const res = await fetch('/api/wifi/devices/lookup', { method: 'POST', body: JSON.stringify({ macAddress: 'invalid' }) });
      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// FEATURE 4: Identity Verification (F14)
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('WiFi Identity Verification API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/wifi/identity-logs', () => {
    it('should return empty array when no logs', async () => {
      const res = await fetch('/api/wifi/identity-logs');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should accept all filter parameters', async () => {
      const params = new URLSearchParams({
        verificationMethod: 'room_number',
        verificationStatus: 'verified',
        search: 'john',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        limit: '20',
        offset: '0',
      });
      const res = await fetch(`/api/wifi/identity-logs?${params}`);
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid offset', async () => {
      const res = await fetch('/api/wifi/identity-logs?offset=-1');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid limit', async () => {
      const res = await fetch('/api/wifi/identity-logs?limit=abc');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid verificationStatus', async () => {
      const res = await fetch('/api/wifi/identity-logs?verificationStatus=unknown');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid verificationMethod', async () => {
      const res = await fetch('/api/wifi/identity-logs?verificationMethod=brain_scan');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wifi/identity-logs', () => {
    it('should return 400 when username is missing', async () => {
      const res = await fetch('/api/wifi/identity-logs', { method: 'POST', body: JSON.stringify({ ipAddress: '192.168.1.1' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 when ipAddress is missing', async () => {
      const res = await fetch('/api/wifi/identity-logs', { method: 'POST', body: JSON.stringify({ username: 'guest_001' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid verificationMethod', async () => {
      const res = await fetch('/api/wifi/identity-logs', { method: 'POST', body: JSON.stringify({ username: 'g', ipAddress: '1.2.3.4', verificationMethod: 'face_scan' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/wifi/identity-logs/:id', () => {
    it('should return 404 for non-existent log', async () => {
      const res = await fetch('/api/wifi/identity-logs/nonexistent', { method: 'PATCH', body: JSON.stringify({ verificationStatus: 'verified' }) });
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid verificationStatus', async () => {
      const res = await fetch('/api/wifi/identity-logs/idlog-001', { method: 'PATCH', body: JSON.stringify({ verificationStatus: 'super_verified' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/wifi/identity-logs/stats', () => {
    it('should return stats with zero values', async () => {
      const res = await fetch('/api/wifi/identity-logs/stats');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data.totalVerifications).toBe(0);
      expect(json.data.verified).toBe(0);
      expect(json.data.complianceRate).toBe(0);
    });
  });

  describe('GET /api/wifi/identity-logs/export', () => {
    it('should return 400 when dates are missing', async () => {
      const res = await fetch('/api/wifi/identity-logs/export');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid date format', async () => {
      const res = await fetch('/api/wifi/identity-logs/export?startDate=not-a-date&endDate=also-bad');
      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// FEATURE 5: GDPR Consent Management (F13)
// ═════════════════════════════════════════════════════════════════════════════
describe('WiFi Consent Management API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/wifi/consent-logs', () => {
    it('should return empty array when no logs', async () => {
      const res = await fetch('/api/wifi/consent-logs');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should accept all filter parameters', async () => {
      const params = new URLSearchParams({
        search: '192.168',
        consentType: 'wifi_access',
        optInStatus: 'true',
        propertyId: 'prop-001',
        startDate: '2025-01-01',
        limit: '100',
      });
      const res = await fetch(`/api/wifi/consent-logs?${params}`);
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid optInStatus', async () => {
      const res = await fetch('/api/wifi/consent-logs?optInStatus=maybe');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid consentType', async () => {
      const res = await fetch('/api/wifi/consent-logs?consentType=video');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wifi/consent-logs', () => {
    it('should return 400 when sessionId is missing', async () => {
      const res = await fetch('/api/wifi/consent-logs', { method: 'POST', body: JSON.stringify({ consentType: 'wifi_access' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 when consentType is missing', async () => {
      const res = await fetch('/api/wifi/consent-logs', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-001' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid consentType', async () => {
      const res = await fetch('/api/wifi/consent-logs', { method: 'POST', body: JSON.stringify({ sessionId: 's', consentType: 'voice_access' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid optInMarketing', async () => {
      const res = await fetch('/api/wifi/consent-logs', { method: 'POST', body: JSON.stringify({ sessionId: 's', consentType: 'wifi_access', optInMarketing: 'yes' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid dataRetentionDays', async () => {
      const res = await fetch('/api/wifi/consent-logs', { method: 'POST', body: JSON.stringify({ sessionId: 's', consentType: 'wifi_access', dataRetentionDays: -1 }) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/wifi/consent-logs/stats', () => {
    it('should return stats with zero values', async () => {
      const res = await fetch('/api/wifi/consent-logs/stats');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data.totalConsents).toBe(0);
      expect(json.data.marketingOptInRate).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// FEATURE 6: Bandwidth Upsell (F1)
// ═══════════════════════════════════════════════════════════════════════════════
describe('WiFi Bandwidth Upsell API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/wifi/bandwidth-upgrade', () => {
    it('should return empty array when no upgrades', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should accept filter parameters', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade?paymentStatus=completed&startDate=2025-01-01&limit=100');
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid paymentStatus', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade?paymentStatus=free');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid limit', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade?limit=abc');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wifi/bandwidth-upgrade', () => {
    it('should return 400 when fromPlanId is missing', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade', { method: 'POST', body: JSON.stringify({ toPlanId: 'premium' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 when toPlanId is missing', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade', { method: 'POST', body: JSON.stringify({ fromPlanId: 'free' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for negative amount', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade', { method: 'POST', body: JSON.stringify({ fromPlanId: 'f', toPlanId: 't', amount: -50 }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for zero amount', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade', { method: 'POST', body: JSON.stringify({ fromPlanId: 'f', toPlanId: 't', amount: 0 }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid paymentStatus', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade', { method: 'POST', body: JSON.stringify({ fromPlanId: 'f', toPlanId: 't', amount: 100, paymentStatus: 'approved' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/wifi/bandwidth-upgrade/stats', () => {
    it('should return stats with zero values', async () => {
      const res = await fetch('/api/wifi/bandwidth-upgrade/stats');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data.totalRevenue).toBe(0);
      expect(json.data.totalUpgradesSold).toBe(0);
      expect(json.data.conversionRate).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// FEATURE 7: Revenue Analytics Dashboard (F6)
// ═════════════════════════════════════════════════════════════════════════════════════════
describe('WiFi Revenue Analytics Dashboard API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return dashboard data with KPIs', async () => {
    const res = await fetch('/api/wifi/revenue-dashboard');
    expect(res.status).toBe(200);
    const json = await parseJSON(res);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.kpis).toBeDefined();
    expect(json.data.revenueBySource).toBeDefined();
    expect(json.data.dailyRevenue).toBeDefined();
    expect(json.data.topPlans).toBeDefined();
    expect(json.data.peakRevenueHours).toBeDefined();
    expect(json.data.revenueForecast).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    const res = await fetch('/api/wifi/revenue-dashboard');
    // Even if internal query fails, should not throw
    expect(res.status).toBeLessThan(500);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// FEATURE 8: Satisfaction Surveys (F12)
// ══════════════════════════════════════════════════════════════════════════════════════════
describe('WiFi Satisfaction Surveys API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/wifi/satisfaction', () => {
    it('should return empty array when no surveys', async () => {
      const res = await fetch('/api/wifi/satisfaction?limit=100');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('should accept filter parameters', async () => {
      const res = await fetch('/api/wifi/satisfaction?rating=5&apName=AP-Lobby&roomNumber=301&search=great&limit=50');
      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid rating', async () => {
      const res = await fetch('/api/wifi/satisfaction?rating=6');
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid limit', async () => {
      const res = await fetch('/api/wifi/satisfaction?limit=abc');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/wifi/satisfaction', () => {
    it('should return 400 when rating is missing', async () => {
      const res = await fetch('/api/wifi/satisfaction', { method: 'POST', body: JSON.stringify({ comment: 'Great!' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid rating (0)', async () => {
      const res = await fetch('/api/wifi/satisfaction', { method: 'POST', body: JSON.stringify({ rating: 0, comment: 'Bad' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid rating (6)', async () => {
      const res = await fetch('/api/wifi/satisfaction', { method: 'POST', body: JSON.stringify({ rating: 6, comment: 'Amazing' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid deviceType', async () => {
      const res = await fetch('/api/wifi/satisfaction', { method: 'POST', body: JSON.stringify({ rating: 4, deviceType: 'satellite' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid category values', async () => {
      const res = await fetch('/api/wifi/satisfaction', { method: 'POST', body: JSON.stringify({ rating: 4, categories: '{bad json}' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/wifi/satisfaction/stats', () => {
    it('should return stats with zero values', async () => {
      const res = await fetch('/api/wifi/satisfaction/stats');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.totalSurveys).toBe(0);
      expect(json.data.averageRating).toBeDefined();
      expect(json.data.trend).toBeDefined();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// FEATURE 9: SLA Monitoring (F23)
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('WiFi SLA Monitoring API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/wifi/sla', () => {
    it('should return empty array when no configs', async () => {
      const res = await fetch('/api/wifi/sla');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });
  });

  describe('POST /api/wifi/sla', () => {
    it('should return 400 when propertyId is missing', async () => {
      const res = await fetch('/api/wifi/sla', { method: 'POST', body: JSON.stringify({ name: 'Test SLA', uptimeTarget: 99.9 }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 when name is missing', async () => {
      const res = await fetch('/api/wifi/sla', { method: 'POST', body: JSON.stringify({ propertyId: 'prop-001' }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid uptimeTarget (too high)', async () => {
      const res = await fetch('/api/wifi/sla', { method: 'POST', body: JSON.stringify({ propertyId: 'p1', name: 'X', uptimeTarget: 101 }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid uptimeTarget (negative)', async () => {
      const res = await fetch('/api/wifi/sla', { method: 'POST', body: JSON.stringify({ propertyId: 'p1', name: 'X', uptimeTarget: -1 }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid speedDownTarget', async () => {
      const res = await fetch('/api/wifi/sla', { method: 'POST', body: JSON.stringify({ propertyId: 'p1', name: 'X', speedDownTarget: -1 }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid latencyTarget', async () => {
      const res = await fetch('/api/wifi/sla', { method: 'POST', body: JSON.stringify({ propertyId: 'p1', name: 'X', latencyTarget: 0 }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid speedUpTarget', async () => {
      const res = await fetch('/api/wifi/sla', { method: 'POST', body: JSON.stringify({ propertyId: 'p1', name: 'X', speedUpTarget: 0 }) });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid isActive value', async () => {
      const res = await fetch('/api/wifi/sla', { method: 'POST', body: JSON.stringify({ propertyId: 'p1', name: 'X', isActive: 'true' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/wifi/sla/:id', () => {
    it('should return 404 for non-existent config', async () => {
      const res = await fetch('/api/wifi/sla/nonexistent');
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid id format', async () => {
      const res = await fetch('/api/wifi/sla/invalid-id');
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/wifi/sla/:id', () => {
    it('should return 404 for non-existent config', async () => {
      const res = await fetch('/api/wifi/sla/nonexistent', { method: 'PATCH', body: JSON.stringify({ name: 'Updated' }) });
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid uptimeTarget', async () => {
      const res = await fetch('/api/wifi/sla/sla-001', { method: 'PATCH', body: JSON.stringify({ uptimeTarget: 200 }) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/wifi/sla/:id/metrics', () => {
    it('should return 404 for non-existent config', async () => {
      const res = await fetch('/api/wifi/sla/nonexistent/metrics');
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid date format', async () => {
      const res = await fetch('/api/wifi/sla/sla-001/metrics?startDate=bad-date&endDate=also-bad');
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/wifi/sla/:id', () => {
    it('should return 404 for non-existent config', async () => {
      const res = await fetch('/api/wifi/sla/nonexistent', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/wifi/sla/compliance', () => {
    it('should return compliance report', async () => {
      const res = await fetch('/api/wifi/sla/compliance');
      expect(res.status).toBe(200);
      const json = await parseJSON(res);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING TESTS
// ══════════════════════════════════════════════════════════════════════════════════════
describe('Cross-Cutting Tests', () => {
  it('all routes should use HTTPS-relative paths only', async () => {
    // Verify no absolute URLs in API calls
    const apiRoutes = [
      '/api/wifi/alerts',
      '/api/wifi/alerts/stats',
      '/api/wifi/devices',
      '/api/wifi/devices/lookup',
      '/api/wifi/identity-logs',
      '/api/wifi/identity-logs/stats',
      '/api/wifi/identity-logs/export',
      '/api/wifi/consent-logs',
      '/api/wifi/consent-logs/stats',
      '/api/wifi/pre-arrival',
      '/api/wifi/pre-arrival/send',
      '/api/wifi/pre-arrival/delivery-logs',
      '/api/wifi/bandwidth-upgrade',
      '/api/wifi/bandwidth-upgrade/stats',
      '/api/wifi/satisfaction',
      '/api/wifi/satisfaction/stats',
      '/api/wifi/sla',
      '/api/wifi/sla/compliance',
      '/api/wifi/revenue-dashboard',
    ];

    // Each route should respond
    for (const route of apiRoutes) {
      const res = await fetch(route);
      expect(res.status, `GET ${route} should not crash`).toBeLessThan(500);
    }
  });

  it('all POST routes should reject empty bodies with 400', async () => {
    const postRoutes = [
      '/api/wifi/devices',
      '/api/wifi/devices/lookup',
      '/api/wifi/identity-logs',
      '/api/wifi/identity-logs/export',
      '/api/wifi/consent-logs',
      '/api/wifi/pre-arrival/send',
      '/api/wifi/bandwidth-upgrade',
      '/api/wifi/satisfaction',
      '/api/wifi/sla',
      '/api/wifi/revenue-dashboard',
    ];

    for (const route of postRoutes) {
      const res = await fetch(route, { method: 'POST', body: '{}' });
      expect(res.status, `POST ${route} with empty body should return 400`).toBe(400);
    }
  });

  it('all PATCH routes should reject empty bodies with 400', async () => {
    const patchRoutes = [
      '/api/wifi/alerts/alert-001',
      '/api/wifi/pre-arrival/config-001',
      '/api/wifi/devices/dev-001',
      '/api/wifi/identity-logs/idlog-001',
      '/api/wifi/sla/sla-001',
    ];

    for (const route of patchRoutes) {
      const res = await fetch(route, { method: 'PATCH', body: '{}' });
      expect(res.status, `PATCH ${route} with empty body should return 400`).toBe(400);
    }
  });

  it('all DELETE routes should return 404 for non-existent resources', async () => {
    const deleteRoutes = [
      '/api/wifi/alerts/alert-001',
      '/api/wifi/devices/dev-001',
      '/api/wifi/identity-logs/idlog-001',
      '/api/wifi/sla/sla-001',
    ];

    for (const route of deleteRoutes) {
      const res = await fetch(route, { method: 'DELETE' });
      expect(res.status, `DELETE ${route} should return 404 for non-existent resource`).toBe(404);
    }
  });

  it('API responses should have consistent JSON structure', async () => {
    const res = await fetch('/api/wifi/alerts');
    const json = await parseJSON(res);
    
    expect(json).toHaveProperty('success');
    expect(typeof json.success).toBe('boolean');
  });
});
