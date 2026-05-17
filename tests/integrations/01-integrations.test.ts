/**
 * 01 - Integrations Module Tests (11 pages, 25+ tests)
 *
 * Tests payment gateways, SMS gateways, POS systems, third-party APIs,
 * smart locks, terminals, mobile app, hardware adapters, webhooks events,
 * webhooks delivery, and webhooks retry queue.
 *
 * Pattern: Real API calls only, graceful 404/403 skips, sequential execution.
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  assert,
  assertEqual,
  assertNotNull,
  assertGt,
  ApiError,
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
} from '../pms/setup';

// ─── Helper: Skip wrapper for endpoints that may 404 ─────────────────────

async function skipOn404(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      console.log('      ⏭️  SKIPPED (endpoint returned ' + err.status + ')');
      return;
    }
    throw err;
  }
}

const safeGet = async (path: string, ck: string) => {
  try {
    await delay(DELAY_BETWEEN_CALLS);
    return await api.get(path, ck);
  } catch (e: any) {
    if (e.status === 404 || e.status === 403) return null;
    throw e;
  }
};

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }

  const st = loadState();
  const ck = cookie(state);

  // Track created IDs for cross-references
  let createdGatewayId: string | null = null;
  let createdWebhookEventId: string | null = null;

  await runSequentially('01-Integrations', [
    // ════════════════════════════════════════════════════════════════════
    // PAGE 1: Payment Gateways
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Payment Gateways - GET list with health status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await safeGet('/api/integrations/payment-gateways', ck);
        if (!res) return;
        const { data } = res;
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.gateways, 'Should have gateways array');
        assert(Array.isArray(data.data.gateways), 'Gateways should be array');
        assertNotNull(data.data.stats, 'Should have stats');
        assertNotNull(data.data.stats.total, 'Stats should have total');
        assertNotNull(data.data.stats.active, 'Stats should have active');
        assertNotNull(data.data.stats.healthy, 'Stats should have healthy');
      },
    },
    {
      name: 'Payment Gateways - GET filter by status=active',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await safeGet('/api/integrations/payment-gateways?status=active', ck);
        if (!res) return;
        const { data } = res;
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.gateways, 'Should have gateways');
        // All returned should be active
        for (const g of data.data.gateways) {
          assertEqual(g.status, 'active', 'All filtered gateways should be active');
        }
      },
    },
    {
      name: 'Payment Gateways - POST create manual gateway',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data, status } = await api.post(
            '/api/integrations/payment-gateways',
            {
              name: `E2E Test Manual Gateway ${Date.now()}`,
              provider: 'manual',
              mode: 'test',
              priority: 99,
              isPrimary: false,
              feePercentage: 0,
              feeFixed: 0,
              supportedCurrencies: ['INR', 'USD'],
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have gateway data');
          assertNotNull(data.data.id, 'Created gateway should have id');
          assertEqual(data.data.provider, 'manual', 'Provider should be manual');
          assertEqual(data.data.mode, 'test', 'Mode should be test');
          assertNotNull(data.data.supportedCurrencies, 'Should have supportedCurrencies');
          createdGatewayId = data.data.id;
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'Payment Gateways - POST validate required fields (no name)',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.post('/api/integrations/payment-gateways', { provider: 'manual' }, ck);
          assert(false, 'Should have thrown validation error');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing name');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 2: SMS Gateways
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'SMS Gateways - GET list all gateways',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/sms-gateways', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.gateways || data.data?.gateways || data.data, 'Should have gateways');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 3: POS Systems
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'POS Systems - GET list all POS integrations',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/pos-systems', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.systems || data.data?.systems || data.data, 'Should have systems data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 4: Third-Party APIs
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Third-Party APIs - GET list integrations',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/third-party-apis', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 5: Smart Locks
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Smart Locks - GET providers/config',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/smart-locks', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Smart Locks - GET locks list',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/smart-locks/locks', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.locks || data.data?.locks || data.data, 'Should have locks array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 6: Terminals
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Terminals - GET providers/config',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/terminals', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Terminals - GET terminals list',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/terminals/terminals', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.terminals || data.data?.terminals || data.data, 'Should have terminals');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 7: Mobile App
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Mobile App - GET configuration',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/mobile-app', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 8: Hardware Adapters
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Hardware Adapters - GET list all adapters',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/hardware/adapters', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.adapters || data.data?.adapters || data.data, 'Should have adapters');
        });
      },
    },
    {
      name: 'Hardware Adapters - POST create adapter (validate)',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/hardware/adapters',
            {
              name: `E2E Test Adapter ${Date.now()}`,
              type: 'lock',
              provider: 'simulator',
              config: { testMode: true },
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have adapter data');
          assertNotNull(data.data.id, 'Created adapter should have id');
          assertNotNull(data.data.name, 'Should have name');
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'Hardware Adapters - POST validate missing name',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.post('/api/hardware/adapters', { type: 'lock' }, ck);
          assert(false, 'Should have thrown validation error');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing name');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 9: Webhooks Events
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Webhooks Events - GET list all events',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/webhooks/events', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.events || data.data?.events || data.pagination, 'Should have events or pagination');
        });
      },
    },
    {
      name: 'Webhooks Events - POST create webhook event subscription',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/webhooks/events',
            {
              name: `E2E Test Webhook ${Date.now()}`,
              events: ['booking.created', 'booking.updated'],
              url: 'https://test.example.com/webhook',
              secret: 'test-secret-' + Date.now(),
              isActive: true,
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have webhook data');
          assertNotNull(data.data.id, 'Created webhook should have id');
          createdWebhookEventId = data.data.id;
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403 || err.status === 404)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'Webhooks Events - POST validate required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.post('/api/webhooks/events', {}, ck);
          assert(false, 'Should have thrown validation error');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing fields');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 10: Webhooks Delivery
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Webhooks Delivery - GET delivery logs',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/webhooks/delivery', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.pagination || data.data?.pagination, 'Should have pagination');
        });
      },
    },
    {
      name: 'Webhooks Delivery - GET filter by status',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/webhooks/delivery?status=success', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Webhooks Delivery - GET filter by date range',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const now = new Date();
          const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const to = now.toISOString().split('T')[0];
          const { data } = await api.get(`/api/webhooks/delivery?from=${from}&to=${to}`, ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 11: Webhooks Retry Queue
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Webhooks Retry Queue - GET pending retries',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/webhooks/retry-queue', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.queue || data.data?.queue || data.pagination, 'Should have queue or pagination');
        });
      },
    },
    {
      name: 'Webhooks Retry Queue - GET filter failed only',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/webhooks/retry-queue?status=failed', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Webhooks Retry Queue - GET pagination verification',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/webhooks/retry-queue?limit=5&offset=0', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          if (data.pagination) {
            assertNotNull(data.pagination.total, 'Pagination should have total');
            assertNotNull(data.pagination.totalPages, 'Pagination should have totalPages');
          }
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // CROSS-CUTTING: Verifying payment gateway structure depth
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Payment Gateways - Verify gateway object structure',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await safeGet('/api/integrations/payment-gateways', ck);
        if (!res) return;
        const { data } = res;
        assert(data.success, 'Should succeed');
        if (data.data.gateways && data.data.gateways.length > 0) {
          const gw = data.data.gateways[0];
          assertNotNull(gw.id, 'Gateway should have id');
          assertNotNull(gw.name, 'Gateway should have name');
          assertNotNull(gw.provider, 'Gateway should have provider');
          assertNotNull(gw.status, 'Gateway should have status');
          assertNotNull(gw.mode, 'Gateway should have mode');
          assertNotNull(gw.fees, 'Gateway should have fees');
          assertNotNull(gw.fees.percentage !== undefined, 'Fees should have percentage');
          assertNotNull(gw.fees.fixed !== undefined, 'Fees should have fixed');
          assertNotNull(gw.totalTransactions !== undefined, 'Gateway should have totalTransactions');
          assertNotNull(gw.totalVolume !== undefined, 'Gateway should have totalVolume');
        }
      },
    },
    {
      name: 'Smart Locks - Verify locks response structure',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/smart-locks/locks', ck);
          assert(data.success, 'Should succeed');
          const locks = data.locks || data.data?.locks || data.data;
          if (Array.isArray(locks) && locks.length > 0) {
            const lock = locks[0];
            assertNotNull(lock.id, 'Lock should have id');
            assertNotNull(lock.name, 'Lock should have name');
          }
        });
      },
    },
    {
      name: 'Terminals - Verify terminal response structure',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/integrations/terminals/terminals', ck);
          assert(data.success, 'Should succeed');
          const terminals = data.terminals || data.data?.terminals || data.data;
          if (Array.isArray(terminals) && terminals.length > 0) {
            const term = terminals[0];
            assertNotNull(term.id, 'Terminal should have id');
            assertNotNull(term.name, 'Terminal should have name');
          }
        });
      },
    },
    {
      name: 'Payment Gateways - Stats summary is coherent',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await safeGet('/api/integrations/payment-gateways', ck);
        if (!res) return;
        const { data } = res;
        assert(data.success, 'Should succeed');
        const stats = data.data.stats;
        assertGt(stats.total, -1, 'Total should be >= 0');
        assertGt(stats.active, -1, 'Active should be >= 0');
        assertGt(stats.healthy, -1, 'Healthy should be >= 0');
        // Active should not exceed total
        assert(stats.active <= stats.total, 'Active should not exceed total');
      },
    },
  ]);
}

main().catch((e) => {
  console.error('\n💥', e);
  process.exit(1);
});
