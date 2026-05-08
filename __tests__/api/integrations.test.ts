import { describe, it, expect, afterAll } from 'vitest';
import { GET as getSmartLocks } from '@/app/api/integrations/smart-locks/route';
import { GET as getSmartLocksList, POST as createSmartLock } from '@/app/api/integrations/smart-locks/locks/route';
import { GET as getAccessLogs } from '@/app/api/integrations/smart-locks/access-logs/route';
import { GET as getPaymentGateways, POST as createPaymentGateway } from '@/app/api/integrations/payment-gateways/route';
import { GET as getSmsGateways, POST as createSmsGateway } from '@/app/api/integrations/sms-gateways/route';
import { GET as getWifiGateways, POST as createWifiGateway } from '@/app/api/integrations/wifi-gateways/route';
import { GET as getThirdPartyApis, POST as createThirdPartyApi } from '@/app/api/integrations/third-party-apis/route';
import { GET as getMobileApp } from '@/app/api/integrations/mobile-app/route';
import { createAuthRequest, buildUrl, PROPERTY_ID, uniqueSuffix } from './test-helpers';
import { db } from '@/lib/db';

let createdSmartLockId: string;
let createdSmsGatewayId: string;
let createdThirdPartyApiId: string;

describe('Integrations — Smart Locks Dashboard', () => {
  describe('GET /api/integrations/smart-locks', () => {
    it('should return smart locks dashboard with stats', async () => {
      const url = buildUrl('/api/integrations/smart-locks');
      const req = await createAuthRequest(url);
      const res = await getSmartLocks(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.providers).toBeDefined();
      expect(data.data.roomLocks).toBeDefined();
      expect(data.data.accessLogs).toBeDefined();
      expect(data.data.keyCards).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('totalLocks');
      expect(data.stats).toHaveProperty('onlineLocks');
      expect(data.stats).toHaveProperty('offlineLocks');
      expect(data.stats).toHaveProperty('lowBatteryLocks');
      expect(data.stats).toHaveProperty('totalProviders');
    });

    it('should require authentication', async () => {
      const url = buildUrl('/api/integrations/smart-locks');
      const res = await getSmartLocks(new Request(url, { headers: {} }));
      expect(res.status).toBe(401);
    });
  });
});

describe('Integrations — Smart Locks CRUD', () => {
  describe('GET /api/integrations/smart-locks/locks', () => {
    it('should return list of smart locks', async () => {
      const url = buildUrl('/api/integrations/smart-locks/locks');
      const req = await createAuthRequest(url);
      const res = await getSmartLocksList(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by propertyId', async () => {
      const url = buildUrl('/api/integrations/smart-locks/locks', { propertyId: PROPERTY_ID });
      const req = await createAuthRequest(url);
      const res = await getSmartLocksList(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/integrations/smart-locks/locks', () => {
    it('should create a smart lock', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/integrations/smart-locks/locks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          propertyId: PROPERTY_ID,
          name: `Room ${suffix.slice(-4)} Door Lock`,
          provider: 'assa_abloy',
          lockId: `LOCK-${suffix.slice(-6)}`,
          firmwareVersion: '2.1.0',
          batteryLevel: 85,
          signalStrength: -45,
          doorStatus: 'closed',
          lockStatus: 'locked',
        },
      });
      const res = await createSmartLock(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      expect(data.data.provider).toBe('assa_abloy');
      expect(data.data.batteryLevel).toBe(85);
      createdSmartLockId = data.data.id;
    });

    it('should require propertyId and name', async () => {
      const url = buildUrl('/api/integrations/smart-locks/locks');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Missing Property' },
      });
      const res = await createSmartLock(req);
      expect(res.status).toBe(400);
    });
  });
});

describe('Integrations — Smart Lock Access Logs', () => {
  describe('GET /api/integrations/smart-locks/access-logs', () => {
    it('should return access logs', async () => {
      const url = buildUrl('/api/integrations/smart-locks/access-logs');
      const req = await createAuthRequest(url);
      const res = await getAccessLogs(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by lockId', async () => {
      const url = buildUrl('/api/integrations/smart-locks/access-logs', { lockId: createdSmartLockId || 'nonexistent' });
      const req = await createAuthRequest(url);
      const res = await getAccessLogs(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});

describe('Integrations — Payment Gateways', () => {
  describe('GET /api/integrations/payment-gateways', () => {
    it('should return payment gateways with health status', async () => {
      const url = buildUrl('/api/integrations/payment-gateways');
      const req = await createAuthRequest(url);
      const res = await getPaymentGateways(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.gateways).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('total');
      expect(data.data.stats).toHaveProperty('active');
      expect(data.data.stats).toHaveProperty('healthy');
      expect(data.data.stats).toHaveProperty('totalTransactions');
      expect(data.data.stats).toHaveProperty('totalVolume');
    });

    it('should mask sensitive fields', async () => {
      const url = buildUrl('/api/integrations/payment-gateways');
      const req = await createAuthRequest(url);
      const res = await getPaymentGateways(req);
      const data = await res.json();
      if (data.data.gateways.length > 0) {
        const gw = data.data.gateways[0];
        if (gw.apiKey) expect(gw.apiKey).toBe('****');
        if (gw.webhookSecret) expect(gw.webhookSecret).toBe('****');
      }
    });
  });

  describe('POST /api/integrations/payment-gateways', () => {
    it('should create a payment gateway', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/integrations/payment-gateways');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Gateway ${suffix}`,
          provider: 'stripe',
          apiKey: `sk_test_${suffix}`,
          mode: 'test',
          priority: 1,
          isPrimary: false,
          feePercentage: 2.9,
          feeFixed: 0.30,
          supportedCurrencies: ['USD', 'INR'],
        },
      });
      const res = await createPaymentGateway(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.provider).toBe('stripe');
      expect(data.data.mode).toBe('test');
      expect(data.data.fees).toBeDefined();
      expect(data.data.fees.percentage).toBe(2.9);
      // Clean up
      if (data.data.id) {
        await db.paymentGateway.delete({ where: { id: data.data.id } }).catch(() => {});
      }
    });

    it('should require name and provider', async () => {
      const url = buildUrl('/api/integrations/payment-gateways');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Missing Provider' },
      });
      const res = await createPaymentGateway(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid provider', async () => {
      const url = buildUrl('/api/integrations/payment-gateways');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Bad Provider', provider: 'invalid_provider' },
      });
      const res = await createPaymentGateway(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Invalid provider');
    });
  });
});

describe('Integrations — SMS Gateways', () => {
  describe('GET /api/integrations/sms-gateways', () => {
    it('should return list of SMS gateways with stats', async () => {
      const url = buildUrl('/api/integrations/sms-gateways');
      const req = await createAuthRequest(url);
      const res = await getSmsGateways(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.gateways).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('configured');
      expect(data.data.stats).toHaveProperty('active');
      expect(data.data.stats).toHaveProperty('defaultProvider');
    });

    it('should mask sensitive config fields', async () => {
      const url = buildUrl('/api/integrations/sms-gateways');
      const req = await createAuthRequest(url);
      const res = await getSmsGateways(req);
      const data = await res.json();
      if (data.data.gateways.length > 0) {
        const gw = data.data.gateways[0];
        expect(gw.config).toBeDefined();
        // Sensitive fields should be masked
        const configStr = JSON.stringify(gw.config);
        if (configStr.includes('authToken') || configStr.includes('apiKey')) {
          expect(configStr).toContain('••••••••');
        }
      }
    });
  });

  describe('POST /api/integrations/sms-gateways', () => {
    it('should create an SMS gateway with mock provider', async () => {
      const url = buildUrl('/api/integrations/sms-gateways');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          provider: 'mock',
          config: { senderId: 'STAYSUITE' },
        },
      });
      const res = await createSmsGateway(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.id).toBeDefined();
      createdSmsGatewayId = data.data.id;
    });

    it('should reject invalid provider', async () => {
      const url = buildUrl('/api/integrations/sms-gateways');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { provider: 'invalid_sms_provider' },
      });
      const res = await createSmsGateway(req);
      expect(res.status).toBe(400);
    });

    it('should send test SMS with mock provider', async () => {
      const url = buildUrl('/api/integrations/sms-gateways');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          test: true,
          provider: 'mock',
          to: '+919999999999',
          config: {},
        },
      });
      const res = await createSmsGateway(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('messageId');
      expect(data.data.status).toBe('delivered');
    });
  });
});

describe('Integrations — WiFi Gateways', () => {
  describe('GET /api/integrations/wifi-gateways', () => {
    it('should return list of WiFi gateways with stats', async () => {
      const url = buildUrl('/api/integrations/wifi-gateways');
      const req = await createAuthRequest(url);
      const res = await getWifiGateways(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.gateways).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('total');
      expect(data.data.stats).toHaveProperty('connected');
      expect(data.data.stats).toHaveProperty('totalAPs');
      expect(data.data.stats).toHaveProperty('activeSessions');
    });
  });

  describe('POST /api/integrations/wifi-gateways', () => {
    it('should reject private IP addresses', async () => {
      const url = buildUrl('/api/integrations/wifi-gateways');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: 'Private IP Gateway',
          type: 'cisco',
          ipAddress: '192.168.1.1',
        },
      });
      const res = await createWifiGateway(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Internal/private');
    });

    it('should require name, type, and ipAddress', async () => {
      const url = buildUrl('/api/integrations/wifi-gateways');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Missing Fields' },
      });
      const res = await createWifiGateway(req);
      expect(res.status).toBe(400);
    });
  });
});

describe('Integrations — Third-Party APIs', () => {
  describe('GET /api/integrations/third-party-apis', () => {
    it('should return list of third-party APIs with stats', async () => {
      const url = buildUrl('/api/integrations/third-party-apis');
      const req = await createAuthRequest(url);
      const res = await getThirdPartyApis(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.apis).toBeDefined();
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats).toHaveProperty('total');
      expect(data.data.stats).toHaveProperty('active');
      expect(data.data.stats).toHaveProperty('totalRequests');
    });

    it('should mask API keys', async () => {
      const url = buildUrl('/api/integrations/third-party-apis');
      const req = await createAuthRequest(url);
      const res = await getThirdPartyApis(req);
      const data = await res.json();
      if (data.data.apis.length > 0) {
        const api = data.data.apis[0];
        if (api.apiKey) expect(api.apiKey).toBe('****');
      }
    });
  });

  describe('POST /api/integrations/third-party-apis', () => {
    it('should create a third-party API integration', async () => {
      const suffix = uniqueSuffix();
      const url = buildUrl('/api/integrations/third-party-apis');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {
          name: `Test Maps API ${suffix}`,
          category: 'maps',
          apiKey: `map-key-${suffix}`,
          endpoint: 'https://maps.example.com/v1',
        },
      });
      const res = await createThirdPartyApi(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.category).toBe('maps');
      expect(data.data.apiKey).toBe('****');
      expect(data.data.endpoint).toBe('https://maps.example.com/v1');
      createdThirdPartyApiId = data.data.id;
    });

    it('should require name', async () => {
      const url = buildUrl('/api/integrations/third-party-apis');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { category: 'maps' },
      });
      const res = await createThirdPartyApi(req);
      expect(res.status).toBe(400);
    });

    it('should reject invalid category', async () => {
      const url = buildUrl('/api/integrations/third-party-apis');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: { name: 'Bad Category', category: 'invalid' },
      });
      const res = await createThirdPartyApi(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain('Invalid category');
    });
  });
});

describe('Integrations — Mobile App', () => {
  describe('GET /api/integrations/mobile-app', () => {
    it('should return mobile app data with stats', async () => {
      const url = buildUrl('/api/integrations/mobile-app');
      const req = await createAuthRequest(url);
      const res = await getMobileApp(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.stats).toHaveProperty('totalDownloads');
      expect(data.stats).toHaveProperty('monthlyActiveUsers');
      expect(data.stats).toHaveProperty('dailyActiveUsers');
      expect(data.stats).toHaveProperty('avgRating');
    });

    it('should include app features list', async () => {
      const url = buildUrl('/api/integrations/mobile-app');
      const req = await createAuthRequest(url);
      const res = await getMobileApp(req);
      const data = await res.json();
      expect(data.data.features).toBeDefined();
      expect(Array.isArray(data.data.features)).toBe(true);
      expect(data.data.features.length).toBeGreaterThan(0);
      // Each feature should have required fields
      const feature = data.data.features[0];
      expect(feature).toHaveProperty('id');
      expect(feature).toHaveProperty('name');
      expect(feature).toHaveProperty('platform');
      expect(feature).toHaveProperty('status');
    });

    it('should include download stats', async () => {
      const url = buildUrl('/api/integrations/mobile-app');
      const req = await createAuthRequest(url);
      const res = await getMobileApp(req);
      const data = await res.json();
      expect(data.data.stats.downloads).toBeDefined();
      expect(data.data.stats.downloads).toHaveProperty('total');
      expect(data.data.stats.downloads).toHaveProperty('ios');
      expect(data.data.stats.downloads).toHaveProperty('android');
      expect(data.data.stats.downloads).toHaveProperty('growthRate');
    });

    it('should include daily trend data', async () => {
      const url = buildUrl('/api/integrations/mobile-app');
      const req = await createAuthRequest(url);
      const res = await getMobileApp(req);
      const data = await res.json();
      expect(data.data.stats.dailyTrend).toBeDefined();
      expect(Array.isArray(data.data.stats.dailyTrend)).toBe(true);
      expect(data.data.stats.dailyTrend.length).toBe(30);
    });
  });
});

afterAll(async () => {
  if (createdSmartLockId) {
    await db.smartLock.delete({ where: { id: createdSmartLockId } }).catch(() => {});
  }
  if (createdSmsGatewayId) {
    await db.integration.delete({ where: { id: createdSmsGatewayId } }).catch(() => {});
  }
  if (createdThirdPartyApiId) {
    await db.integration.delete({ where: { id: createdThirdPartyApiId } }).catch(() => {});
  }
});
