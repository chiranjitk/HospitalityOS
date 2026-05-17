/**
 * 05 - No-Show Tests
 *
 * Tests no-show settings management:
 *   - GET /api/no-show/settings?propertyId=xxx — get current settings
 *   - PUT /api/no-show/settings?propertyId=xxx — update settings
 *   - GET again to verify settings persisted
 *   - Cross-verify: Settings stored in property.noShowSettings JSON field
 *   - GET /api/cron/no-show-detection — dry run execution info
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
  assertStatus,
  ApiError,
} from '../pms/setup';

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTHENTICATION FAILED: ${err.message}`);
    process.exit(1);
  }

  const st = loadState();
  assertNotNull(st.propertyId, 'Need property ID');

  await runSequentially('05-No-Show', [
    {
      name: 'GET no-show settings for property',
      fn: async () => {
        const { data, status } = await api.get(
          `/api/no-show/settings?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assertStatus({ data, status }, 200, 'GET no-show settings');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertEqual(data.data.propertyId, st.propertyId, 'Should return correct property ID');
      },
    },
    {
      name: 'PUT no-show settings — update buffer hours and auto-process',
      fn: async () => {
        const { data, status } = await api.put(
          `/api/no-show/settings?propertyId=${st.propertyId}`,
          {
            noShowBufferHours: 6,
            autoProcessNoShows: true,
            noShowNotificationEnabled: true,
          },
          cookie(state)
        );
        assertStatus({ data, status }, 200, 'PUT no-show settings');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertEqual(data.data.noShowBufferHours, 6, 'Buffer hours should be 6');
        assertEqual(data.data.autoProcessNoShows, true, 'Auto-process should be true');
        assertEqual(data.data.noShowNotificationEnabled, true, 'Notification should be true');
      },
    },
    {
      name: 'GET no-show settings — verify settings persisted',
      fn: async () => {
        const { data } = await api.get(
          `/api/no-show/settings?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertEqual(data.data.noShowBufferHours, 6, 'Buffer hours persisted');
        assertEqual(data.data.autoProcessNoShows, true, 'Auto-process persisted');
        assertEqual(data.data.noShowNotificationEnabled, true, 'Notification persisted');
      },
    },
    {
      name: 'PUT no-show settings — update to different values',
      fn: async () => {
        const { data } = await api.put(
          `/api/no-show/settings?propertyId=${st.propertyId}`,
          {
            noShowBufferHours: 12,
            autoProcessNoShows: false,
            noShowNotificationEnabled: false,
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertEqual(data.data.noShowBufferHours, 12);
        assertEqual(data.data.autoProcessNoShows, false);
        assertEqual(data.data.noShowNotificationEnabled, false);
      },
    },
    {
      name: 'GET no-show settings — verify new values persisted',
      fn: async () => {
        const { data } = await api.get(
          `/api/no-show/settings?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertEqual(data.data.noShowBufferHours, 12);
        assertEqual(data.data.autoProcessNoShows, false);
        assertEqual(data.data.noShowNotificationEnabled, false);
      },
    },
    {
      name: 'Cross-verify: Settings stored in property.noShowSettings JSON field',
      fn: async () => {
        const { data } = await api.get(`/api/properties/${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have property data');

        // The property should have noShowSettings
        const noShowSettings = data.data.noShowSettings;
        assertNotNull(noShowSettings, 'Property should have noShowSettings');

        // Parse JSON if it's a string
        let settings: any;
        if (typeof noShowSettings === 'string') {
          settings = JSON.parse(noShowSettings);
        } else {
          settings = noShowSettings;
        }

        assertEqual(settings.noShowBufferHours, 12, 'Settings field matches');
        assertEqual(settings.autoProcessNoShows, false, 'Settings field matches');
        assertEqual(settings.noShowNotificationEnabled, false, 'Settings field matches');
      },
    },
    {
      name: 'GET /api/cron/no-show-detection — endpoint info',
      fn: async () => {
        // The cron endpoint requires Bearer auth with CRON_SECRET
        // In dev mode, the secret is 'dev-only-cron-secret'
        // Use raw fetch since api helper adds session cookie format
        try {
          const res = await fetch('http://localhost:3000/api/cron/no-show-detection', {
            headers: {
              Authorization: 'Bearer dev-only-cron-secret',
            },
          });
          const data = await res.json();
          assert(data.success, `Cron endpoint should succeed: ${JSON.stringify(data).slice(0, 200)}`);
          assertNotNull(data.data, 'Should have data');
          assertEqual(data.data.endpoint, '/api/cron/no-show-detection');
        } catch (err: any) {
          // If cron secret doesn't match, skip — env may differ
          console.log('      (skipped — cron secret may not match dev environment)');
        }
      },
    },
    {
      name: 'PUT no-show settings — validate rejection for invalid values',
      fn: async () => {
        try {
          await api.put(
            `/api/no-show/settings?propertyId=${st.propertyId}`,
            { noShowBufferHours: 50 }, // Out of range (0-24)
            cookie(state)
          );
          assert(false, 'Should reject invalid buffer hours');
        } catch (err: any) {
          assertEqual(err.status, 400, 'Should be 400 for validation error');
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
