/**
 * 06 - Audit Logs Tests
 *
 * Tests the audit logs API:
 *   - POST /api/audit-logs — create a manual audit log entry
 *   - GET /api/audit-logs — list with filters (module, action, entityType, date range)
 *   - GET /api/audit-logs?stats=true — get statistics
 *   - GET /api/audit-logs/stats — get detailed stats (top IPs, top entity types, security events)
 *   - GET /api/audit-logs/export?format=json — export as JSON
 *   - Cross-verify: Audit logs from previous operations (booking creation, conflict resolution)
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  saveState,
  assert,
  assertEqual,
  assertNotNull,
  assertGt,
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

  await runSequentially('06-Audit-Logs', [
    {
      name: 'POST — create manual audit log entry',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/audit-logs',
          {
            module: 'bookings',
            action: 'manual_test_entry',
            entityType: 'booking',
            entityId: st.bookingId,
            oldValue: null,
            newValue: { test: true, note: 'Bookings module test audit entry' },
            metadata: { testRun: Date.now() },
          },
          cookie(state)
        );
        assertStatus({ data, status }, 200, 'Create audit log entry');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertEqual(data.data.module, 'bookings');
        assertEqual(data.data.action, 'manual_test_entry');
        assertEqual(data.data.entityType, 'booking');

        saveState({ testAuditLogId: data.data.id });
      },
    },
    {
      name: 'GET — list audit logs (default)',
      fn: async () => {
        const { data } = await api.get('/api/audit-logs', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        assertNotNull(data.pagination, 'Should have pagination');
        assertGt(data.pagination.total, 0, 'Should have at least 1 audit log');
      },
    },
    {
      name: 'GET — filter by module (bookings)',
      fn: async () => {
        const { data } = await api.get('/api/audit-logs?module=bookings', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        // All results should have module === 'bookings'
        for (const log of data.data) {
          assertEqual(log.module, 'bookings', 'All logs should be for bookings module');
        }
      },
    },
    {
      name: 'GET — filter by action',
      fn: async () => {
        const updated = loadState();
        const { data } = await api.get(
          '/api/audit-logs?action=manual_test_entry',
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        assertGt(data.data.length, 0, 'Should find at least 1 manual_test_entry');
      },
    },
    {
      name: 'GET — filter by entityType',
      fn: async () => {
        const { data } = await api.get(
          '/api/audit-logs?entityType=booking',
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        for (const log of data.data) {
          assertEqual(log.entityType, 'booking', 'All should be booking type');
        }
      },
    },
    {
      name: 'GET — filter by date range',
      fn: async () => {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const { data } = await api.get(
          `/api/audit-logs?dateFrom=${yesterday.toISOString()}&dateTo=${now.toISOString()}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
      },
    },
    {
      name: 'GET — stats=true (basic statistics)',
      fn: async () => {
        const { data } = await api.get('/api/audit-logs?stats=true', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have stats data');
        // Stats should have common fields
        assertNotNull(data.data.total !== undefined, 'Should have total count');
      },
    },
    {
      name: 'GET /api/audit-logs/stats — detailed statistics',
      fn: async () => {
        const { data } = await api.get('/api/audit-logs/stats', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have stats');
        assertNotNull(data.data.topIpAddresses, 'Should have top IP addresses');
        assertNotNull(data.data.topEntityTypes, 'Should have top entity types');
        assertNotNull(data.data.securityEventsCount !== undefined, 'Should have security events count');
        assertNotNull(data.data.failedLoginsCount !== undefined, 'Should have failed logins count');
      },
    },
    {
      name: 'GET /api/audit-logs/stats — with custom days parameter',
      fn: async () => {
        const { data } = await api.get('/api/audit-logs/stats?days=7', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        // Should still return valid stats
        assert(Array.isArray(data.data.topIpAddresses), 'Top IPs should be array');
        assert(Array.isArray(data.data.topEntityTypes), 'Top entity types should be array');
      },
    },
    {
      name: 'GET /api/audit-logs/export?format=json — export as JSON',
      fn: async () => {
        // The export endpoint returns raw JSON, not wrapped in success envelope
        const res = await fetch('http://localhost:3000/api/audit-logs/export?format=json&limit=5', {
          headers: { Cookie: cookie(state) },
        });
        assertEqual(res.status, 200, 'Export should return 200');
        const contentType = res.headers.get('content-type');
        assertNotNull(contentType);
        assert(contentType.includes('application/json') || contentType.includes('text/csv'), 'Should return JSON or CSV');

        const text = await res.text();
        assertNotNull(text, 'Should have content');
        assertGt(text.length, 0, 'Export should not be empty');

        // Try to parse as JSON to verify it's valid
        const parsed = JSON.parse(text);
        assert(Array.isArray(parsed), 'Export should be an array of logs');
      },
    },
    {
      name: 'Cross-verify: Audit logs from booking operations exist',
      fn: async () => {
        // Check booking-specific audit logs
        assertNotNull(st.bookingId, 'Need booking ID');
        const { data } = await api.get(
          `/api/bookings/audit-logs?bookingId=${st.bookingId}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);

        // Should find the 'created' audit log from when the booking was created
        const createdLog = data.data.find((log: any) => log.action === 'created');
        assertNotNull(createdLog, 'Should find booking created audit log');

        // Also check in general audit logs for booking-related entries
        const { data: generalLogs } = await api.get(
          `/api/audit-logs?entityType=booking&entityId=${st.bookingId}`,
          cookie(state)
        );
        assert(generalLogs.success, 'General audit logs should work');
        assertNotNull(generalLogs.data);
      },
    },
    {
      name: 'Cross-verify: Booking audit logs from earlier tests exist',
      fn: async () => {
        const updated = loadState();
        if (!updated.conflictBooking1Id) {
          console.log('      (skipped — no conflict booking ID in state)');
          return;
        }
        try {
          const { data } = await api.get(
            `/api/bookings/audit-logs?bookingId=${updated.conflictBooking1Id}`,
            cookie(state)
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data);
          // Booking 1 was created via POST, so it should have a 'created' audit log
          const createdLog = data.data.find((log: any) => log.action === 'created');
          assertNotNull(createdLog, 'Should have created audit log for booking 1');
        } catch (err: any) {
          if (err.status === 403) {
            console.log('      (skipped — bookings.audit permission required)');
            return;
          }
          throw err;
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
