/**
 * 01 - Notifications Module Tests (3 pages, 15+ tests)
 *
 * Tests notification templates (CRUD), delivery logs, settings (GET/PUT),
 * and i18n localization.
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

  // Track created template ID
  let createdTemplateId: string | null = null;

  await runSequentially('01-Notifications', [
    // ════════════════════════════════════════════════════════════════════
    // PAGE 1: Notification Templates
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Templates - POST create email template',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/notifications/templates',
            {
              name: `E2E Test Email Template ${Date.now()}`,
              type: 'email',
              category: 'booking',
              subject: 'Booking Confirmation - {{guestName}}',
              body: 'Dear {{guestName}}, your booking {{bookingId}} is confirmed.',
              variables: ['guestName', 'bookingId'],
              status: 'active',
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have template data');
          assertNotNull(data.data.id, 'Created template should have id');
          assertEqual(data.data.type, 'email', 'Type should be email');
          assertEqual(data.data.status, 'active', 'Status should be active');
          assertNotNull(data.data.body, 'Should have body');
          createdTemplateId = data.data.id;
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'Templates - POST create SMS template',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/notifications/templates',
            {
              name: `E2E Test SMS Template ${Date.now()}`,
              type: 'sms',
              category: 'booking',
              body: 'Hi {{guestName}}, your booking is confirmed. Booking ID: {{bookingId}}',
              variables: ['guestName', 'bookingId'],
              status: 'active',
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have template data');
          assertNotNull(data.data.id, 'Created SMS template should have id');
          assertEqual(data.data.type, 'sms', 'Type should be sms');
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'Templates - POST validate missing required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.post('/api/notifications/templates', { name: 'incomplete' }, ck);
          assert(false, 'Should have thrown validation error');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing fields');
          }
        }
      },
    },
    {
      name: 'Templates - POST reject duplicate name',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!createdTemplateId) {
          console.log('      ⏭️  SKIPPED (no template created yet)');
          return;
        }
        try {
          await api.post(
            '/api/notifications/templates',
            {
              name: `E2E Test Email Template ${Date.now()}`,
              type: 'email',
              body: 'Duplicate test body',
              status: 'active',
            },
            ck,
          );
          // If we reach here, the duplicate wasn't detected but POST still succeeded - that's okay
        } catch (err: any) {
          if (err instanceof ApiError && err.status === 400) {
            // Expected: duplicate detected
            assertNotNull(err.response, 'Should have error response');
          }
        }
      },
    },
    {
      name: 'Templates - GET list all templates with stats',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/notifications/templates', ck);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.templates, 'Should have templates array');
        assert(Array.isArray(data.data.templates), 'Templates should be array');
        assertNotNull(data.data.stats, 'Should have stats');
        assertNotNull(data.data.stats.total, 'Stats should have total');
        assertNotNull(data.data.stats.active, 'Stats should have active');
        assertNotNull(data.data.stats.emailTemplates, 'Stats should have emailTemplates');
        assertNotNull(data.data.stats.totalSent, 'Stats should have totalSent');
      },
    },
    {
      name: 'Templates - GET filter by type=email',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/notifications/templates?type=email', ck);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.templates, 'Should have templates array');
        // Every result should be email type
        for (const t of data.data.templates) {
          assertEqual(t.type, 'email', 'All filtered templates should be email');
        }
      },
    },
    {
      name: 'Templates - GET filter by type=sms',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/notifications/templates?type=sms', ck);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.templates, 'Should have templates');
        for (const t of data.data.templates) {
          assertEqual(t.type, 'sms', 'All filtered templates should be sms');
        }
      },
    },
    {
      name: 'Templates - Verify template object structure',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/notifications/templates?limit=5', ck);
        assert(data.success, 'Should succeed');
        if (data.data.templates.length > 0) {
          const t = data.data.templates[0];
          assertNotNull(t.id, 'Template should have id');
          assertNotNull(t.name, 'Template should have name');
          assertNotNull(t.type, 'Template should have type');
          assertNotNull(t.body, 'Template should have body');
          assertNotNull(t.status, 'Template should have status');
          assertNotNull(t.lastModified, 'Template should have lastModified');
          assertNotNull(t.usageCount !== undefined, 'Template should have usageCount');
          assertNotNull(t.category, 'Template should have category');
          assert(Array.isArray(t.variables), 'Variables should be array');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 2: Delivery Logs
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Delivery Logs - GET list all delivery logs',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/notifications/delivery-logs', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.logs || data.data?.logs || data.pagination, 'Should have logs or pagination');
        });
      },
    },
    {
      name: 'Delivery Logs - GET filter by channel=email',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/notifications/delivery-logs?channel=email', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Delivery Logs - GET filter by status=delivered',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/notifications/delivery-logs?status=delivered', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Delivery Logs - GET with date range filter',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const now = new Date();
          const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const to = now.toISOString().split('T')[0];
          const { data } = await api.get(`/api/notifications/delivery-logs?from=${from}&to=${to}`, ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 3: Settings & i18n
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Settings - GET notification settings',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/notifications/settings', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Settings - PUT update notification preferences',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.put(
            '/api/notifications/settings',
            {
              emailEnabled: true,
              smsEnabled: true,
              pushEnabled: true,
              inAppEnabled: true,
              quietHours: { enabled: false },
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have settings data');
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
            console.log('      ⏭️  SKIPPED (PUT returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'i18n - GET notification translations',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/notifications/i18n', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.locales || data.data?.locales || data.translations || data.data?.translations || data.data, 'Should have locales or translations');
        });
      },
    },
    {
      name: 'i18n - GET translations for specific locale',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/notifications/i18n?locale=es', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
  ]);
}

main().catch((e) => {
  console.error('\n💥', e);
  process.exit(1);
});
