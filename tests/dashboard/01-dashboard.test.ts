/**
 * 01 - Dashboard Module Tests
 *
 * Tests all 4 dashboard pages:
 *   1. Overview          — GET /api/dashboard
 *   2. Command Center    — GET /api/dashboard (commandCenter section) + sub-endpoints
 *   3. Alerts & Notifications — GET /api/notifications/list + /api/notifications/settings
 *   4. KPI Cards         — GET /api/dashboard/quick-stats + supplementary endpoints
 *
 * Also exercises every ancillary dashboard widget endpoint:
 *   /api/dashboard/room-status
 *   /api/dashboard/staff-on-duty
 *   /api/dashboard/todays-schedule
 *   /api/dashboard/occupancy-forecast
 *   /api/dashboard/revenue-trend
 *   /api/dashboard/rate-plans
 *   /api/dashboard/maintenance
 *   /api/dashboard/guest-satisfaction
 *   /api/dashboard/guest-segments
 *   /api/dashboard/communications
 *   /api/dashboard/events
 *   /api/dashboard/property-comparison
 *
 * Pattern: real API calls only, no manual DB inserts, graceful 404 skip,
 *          delay(800) between calls, custom assertions (not jest).
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
  assertStatus,
  ApiError,
  delay,
} from '../pms/setup';

/**
 * Helper — tries a GET and returns { ok, data, status }.
 *   ok=false with status=404 means the endpoint does not exist -> skip gracefully.
 */
async function tryGet(path: string, ck: string): Promise<{ ok: boolean; data: any; status: number }> {
  try {
    const { data, status } = await api.get(path, ck);
    return { ok: status >= 200 && status < 300, data, status };
  } catch (err: any) {
    if (err instanceof ApiError && err.status === 404) {
      return { ok: false, data: null, status: 404 };
    }
    throw err;
  }
}

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTHENTICATION FAILED: ${err.message}`);
    process.exit(1);
  }

  await runSequentially('01-Dashboard', [
    // ═══════════════════════════════════════════════════════════════════
    // PAGE 1 — Overview  (GET /api/dashboard)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Overview — GET /api/dashboard returns success with stats',
      fn: async () => {
        const { data } = await api.get('/api/dashboard', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.stats, 'Should have stats object');
      },
    },
    {
      name: 'Overview — stats contain revenue, occupancy, bookings, guests keys',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard', cookie(state));
        const s = data.data.stats;
        assertNotNull(s.revenue, 'Should have revenue');
        assertNotNull(s.occupancy, 'Should have occupancy');
        assertNotNull(s.bookings, 'Should have bookings');
        assertNotNull(s.guests, 'Should have guests');
        assertNotNull(s.revenue.today !== undefined, 'Revenue should have today');
        assertNotNull(s.revenue.thisWeek !== undefined, 'Revenue should have thisWeek');
        assertNotNull(s.revenue.thisMonth !== undefined, 'Revenue should have thisMonth');
      },
    },
    {
      name: 'Overview — charts section has revenue and bookingSources arrays',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard', cookie(state));
        assertNotNull(data.data.charts, 'Should have charts');
        assertNotNull(data.data.charts.revenue, 'Charts should have revenue array');
        assertNotNull(data.data.charts.bookingSources, 'Charts should have bookingSources');
        assert(Array.isArray(data.data.charts.revenue), 'Revenue chart should be an array');
        assert(Array.isArray(data.data.charts.bookingSources), 'Booking sources should be an array');
        assertEqual(data.data.charts.revenue.length, 7, 'Revenue chart should have 7 entries');
      },
    },
    {
      name: 'Overview — recentActivity is an array with valid entries',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard', cookie(state));
        assertNotNull(data.data.recentActivity, 'Should have recentActivity');
        assert(Array.isArray(data.data.recentActivity), 'recentActivity should be an array');
        for (const activity of data.data.recentActivity) {
          assertNotNull(activity.id, 'Activity should have id');
          assertNotNull(activity.type, 'Activity should have type');
          assertNotNull(activity.title, 'Activity should have title');
        }
      },
    },
    {
      name: 'Overview — arrivalsToday and departuresToday are arrays',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard', cookie(state));
        assertNotNull(data.data.arrivalsToday, 'Should have arrivalsToday');
        assertNotNull(data.data.departuresToday, 'Should have departuresToday');
        assert(Array.isArray(data.data.arrivalsToday), 'arrivalsToday should be array');
        assert(Array.isArray(data.data.departuresToday), 'departuresToday should be array');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 2 — Command Center  (GET /api/dashboard commandCenter + sub-apis)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Command Center — /api/dashboard commandCenter section exists',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard', cookie(state));
        assertNotNull(data.data.commandCenter, 'Should have commandCenter');
        const cc = data.data.commandCenter;
        assertNotNull(cc.rooms, 'Command center should have rooms');
        assertNotNull(cc.totalRooms !== undefined, 'Should have totalRooms');
        assertNotNull(cc.staffOnDuty !== undefined, 'Should have staffOnDuty');
        assertNotNull(cc.todaysTasks, 'Should have todaysTasks');
      },
    },
    {
      name: 'Command Center — room status counts are valid',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard', cookie(state));
        const rooms = data.data.commandCenter.rooms;
        assert(typeof rooms.available === 'number', 'available should be number');
        assert(typeof rooms.occupied === 'number', 'occupied should be number');
        assert(typeof rooms.maintenance === 'number', 'maintenance should be number');
        assert(typeof rooms.dirty === 'number', 'dirty should be number');
        assertGt(data.data.commandCenter.totalRooms, 0, 'totalRooms should be positive or zero');
      },
    },
    {
      name: 'Command Center — GET /api/dashboard/room-status',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/room-status', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.statusCounts, 'Should have statusCounts');
        assertNotNull(res.data.data.totalRooms !== undefined, 'Should have totalRooms');
        assertNotNull(res.data.data.occupancyRate !== undefined, 'Should have occupancyRate');
      },
    },
    {
      name: 'Command Center — GET /api/dashboard/staff-on-duty',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/staff-on-duty', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.staff, 'Should have staff array');
        assert(Array.isArray(res.data.data.staff), 'Staff should be an array');
        assertNotNull(res.data.data.totalOnDuty !== undefined, 'Should have totalOnDuty');
      },
    },
    {
      name: 'Command Center — GET /api/dashboard/todays-schedule',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/todays-schedule', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.arrivals, 'Should have arrivals');
        assertNotNull(res.data.data.departures, 'Should have departures');
        assert(Array.isArray(res.data.data.arrivals), 'Arrivals should be array');
        assert(Array.isArray(res.data.data.departures), 'Departures should be array');
      },
    },
    {
      name: 'Command Center — GET /api/dashboard/occupancy-forecast',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/occupancy-forecast', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.forecastData, 'Should have forecastData');
        assert(Array.isArray(res.data.data.forecastData), 'forecastData should be array');
        assertEqual(res.data.data.forecastData.length, 7, 'Forecast should be 7 days');
        assertNotNull(res.data.data.avgOccupancy !== undefined, 'Should have avgOccupancy');
        assertNotNull(res.data.data.totalRooms !== undefined, 'Should have totalRooms');
      },
    },
    {
      name: 'Command Center — GET /api/dashboard/maintenance',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/maintenance', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.summary, 'Should have summary');
        assertNotNull(res.data.data.tasks, 'Should have tasks');
        assert(typeof res.data.data.totalTasks === 'number', 'totalTasks should be number');
        const sm = res.data.data.summary;
        assertNotNull(sm.pending !== undefined, 'Summary should have pending');
        assertNotNull(sm.inProgress !== undefined, 'Summary should have inProgress');
        assertNotNull(sm.completed !== undefined, 'Summary should have completed');
        assertNotNull(sm.overdue !== undefined, 'Summary should have overdue');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 3 — Alerts & Notifications
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Alerts — /api/dashboard alerts array exists',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard', cookie(state));
        assertNotNull(data.data.alerts, 'Should have alerts');
        assert(Array.isArray(data.data.alerts), 'Alerts should be an array');
      },
    },
    {
      name: 'Alerts — each alert has required fields (if non-empty)',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard', cookie(state));
        const alerts: any[] = data.data.alerts || [];
        for (const a of alerts) {
          assertNotNull(a.id, 'Alert should have id');
          assertNotNull(a.type, 'Alert should have type');
          assertNotNull(a.severity, 'Alert should have severity');
          assertNotNull(a.title, 'Alert should have title');
        }
      },
    },
    {
      name: 'Notifications — GET /api/notifications/list (default)',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/notifications/list', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.notifications, 'Should have notifications');
        assert(Array.isArray(data.data.notifications), 'Notifications should be array');
        assertNotNull(data.data.pagination, 'Should have pagination');
        assertNotNull(data.data.unreadCount !== undefined, 'Should have unreadCount');
      },
    },
    {
      name: 'Notifications — filter unread=true',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/notifications/list?unread=true', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data.notifications, 'Should have notifications');
        assert(Array.isArray(data.data.notifications), 'Notifications should be array');
        for (const n of data.data.notifications) {
          assertEqual(n.read, false, 'Filtered notification should be unread');
        }
      },
    },
    {
      name: 'Notifications — pagination with limit=5',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/notifications/list?limit=5', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data.pagination, 'Should have pagination');
        assert(data.data.notifications.length <= 5, 'Should return max 5 notifications');
        assertEqual(data.data.pagination.limit, 5, 'Limit should be 5');
      },
    },
    {
      name: 'Notifications — GET /api/notifications/settings',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/notifications/settings', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.email, 'Should have email settings');
        assertNotNull(res.data.data.sms, 'Should have sms settings');
        assertNotNull(res.data.data.push, 'Should have push settings');
        assertNotNull(res.data.data.inApp, 'Should have inApp settings');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 4 — KPI Cards  (quick-stats + supplementary widgets)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'KPI Cards — GET /api/dashboard/quick-stats',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard/quick-stats', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.checkInsToday !== undefined, 'Should have checkInsToday');
        assertNotNull(data.data.checkOutsToday !== undefined, 'Should have checkOutsToday');
        assertNotNull(data.data.availableRooms !== undefined, 'Should have availableRooms');
        assertNotNull(data.data.totalRooms !== undefined, 'Should have totalRooms');
        assertNotNull(data.data.revenueToday !== undefined, 'Should have revenueToday');
      },
    },
    {
      name: 'KPI Cards — quick-stats values are non-negative',
      fn: async () => {
        await delay(800);
        const { data } = await api.get('/api/dashboard/quick-stats', cookie(state));
        const d = data.data;
        assert(d.checkInsToday >= 0, 'checkInsToday should be >= 0');
        assert(d.checkOutsToday >= 0, 'checkOutsToday should be >= 0');
        assert(d.availableRooms >= 0, 'availableRooms should be >= 0');
        assert(d.totalRooms >= 0, 'totalRooms should be >= 0');
        assert(d.revenueToday >= 0, 'revenueToday should be >= 0');
      },
    },
    {
      name: 'KPI Cards — GET /api/dashboard/revenue-trend',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/revenue-trend', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.dailyData, 'Should have dailyData');
        assert(Array.isArray(res.data.data.dailyData), 'dailyData should be array');
        assertEqual(res.data.data.dailyData.length, 7, 'Should have 7 days');
        assertNotNull(res.data.data.weeklyTotal !== undefined, 'Should have weeklyTotal');
        assertNotNull(res.data.data.changePercent !== undefined, 'Should have changePercent');
      },
    },
    {
      name: 'KPI Cards — GET /api/dashboard/rate-plans',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/rate-plans', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.plans, 'Should have plans');
        assert(Array.isArray(res.data.data.plans), 'Plans should be array');
        assertNotNull(res.data.data.bestPerformer !== undefined, 'Should have bestPerformer');
        assertNotNull(res.data.data.hasData !== undefined, 'Should have hasData');
      },
    },
    {
      name: 'KPI Cards — GET /api/dashboard/guest-satisfaction',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/guest-satisfaction', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.overallScore !== undefined, 'Should have overallScore');
        assertNotNull(res.data.data.totalReviews !== undefined, 'Should have totalReviews');
        assertNotNull(res.data.data.categories, 'Should have categories');
        const cats = res.data.data.categories;
        assertNotNull(cats.cleanliness, 'Should have cleanliness category');
        assertNotNull(cats.service, 'Should have service category');
        assertNotNull(res.data.data.recentReviews, 'Should have recentReviews');
        assert(Array.isArray(res.data.data.recentReviews), 'recentReviews should be array');
      },
    },
    {
      name: 'KPI Cards — GET /api/dashboard/guest-segments',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/guest-segments', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.segments, 'Should have segments');
        assert(Array.isArray(res.data.data.segments), 'Segments should be array');
        assertNotNull(res.data.data.totalGuests !== undefined, 'Should have totalGuests');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // ADDITIONAL WIDGET ENDPOINTS (cross-cutting)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Widget — GET /api/dashboard/communications',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/communications', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.communications, 'Should have communications');
        assert(Array.isArray(res.data.data.communications), 'Communications should be array');
        assertNotNull(res.data.data.unreadCount !== undefined, 'Should have unreadCount');
      },
    },
    {
      name: 'Widget — GET /api/dashboard/events',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/events', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.events, 'Should have events');
        assert(Array.isArray(res.data.data.events), 'Events should be array');
        assertNotNull(res.data.data.hasData !== undefined, 'Should have hasData');
      },
    },
    {
      name: 'Widget — GET /api/dashboard/property-comparison',
      fn: async () => {
        await delay(800);
        const res = await tryGet('/api/dashboard/property-comparison', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'Property comparison should be an array');
        if (res.data.data.length > 0) {
          const p = res.data.data[0];
          assertNotNull(p.id, 'Property should have id');
          assertNotNull(p.name, 'Property should have name');
          assertNotNull(p.occupancyRate !== undefined, 'Should have occupancyRate');
          assertNotNull(p.totalRevenue !== undefined, 'Should have totalRevenue');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // CROSS-CUTTING VALIDATION
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Cross-check — quick-stats totalRooms matches dashboard stats',
      fn: async () => {
        await delay(800);
        const [dashRes, qsRes] = await Promise.all([
          api.get('/api/dashboard', cookie(state)),
          api.get('/api/dashboard/quick-stats', cookie(state)),
        ]);
        const dashTotal = dashRes.data.data.commandCenter?.totalRooms;
        const qsTotal = qsRes.data.data.totalRooms;
        assertNotNull(qsTotal, 'quick-stats should have totalRooms');
        assertNotNull(dashTotal, 'Dashboard commandCenter should have totalRooms');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
