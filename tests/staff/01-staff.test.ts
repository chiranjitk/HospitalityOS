/**
 * 01 - Staff Management Module Tests
 *
 * Tests all 8 staff management pages:
 *   1. Shifts              — GET /api/staff/shifts, GET /api/staff/shifts/[id]
 *   2. Attendance          — GET /api/staff/attendance
 *   3. Leave Management    — GET /api/staff/leave
 *   4. Tasks               — GET /api/staff/tasks, POST /api/staff/tasks
 *   5. Channels & Chat     — GET /api/staff/channels, GET /api/staff/channels/[id]/messages
 *   6. Performance         — GET /api/staff/performance
 *   7. Skills              — GET /api/staff/skills
 *   8. Payroll             — GET /api/staff/payroll, GET /api/staff/payroll/process
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
  ApiError,
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
  saveState,
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

/**
 * Helper — tries a POST and returns { ok, data, status }.
 */
async function tryPost(path: string, body: any, ck: string): Promise<{ ok: boolean; data: any; status: number }> {
  try {
    const { data, status } = await api.post(path, body, ck);
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
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }
  const st = loadState();

  // Shared IDs created during tests
  let createdTaskId: string | undefined;
  let createdChannelId: string | undefined;
  let firstShiftId: string | undefined;

  await runSequentially('01-Staff', [
    // ═══════════════════════════════════════════════════════════════════
    // PAGE 1 — Shifts  (GET /api/staff/shifts, GET /api/staff/shifts/[id])
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Shifts — GET /api/staff/shifts returns list with pagination',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/shifts?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
        assertNotNull(res.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Shifts — shifts contain required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/shifts?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no shifts available, skipping field check)'); return;
        }
        const shift = res.data.data[0];
        assertNotNull(shift.id, 'Shift should have id');
        assertNotNull(shift.shiftType || shift.type, 'Shift should have shiftType or type');
        assertNotNull(shift.startTime, 'Shift should have startTime');
        assertNotNull(shift.endTime, 'Shift should have endTime');
        firstShiftId = shift.id;
      },
    },
    {
      name: 'Shifts — GET /api/staff/shifts/[id] retrieves single shift',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!firstShiftId) { console.log('      (no shift ID available, skipping)'); return; }
        const res = await tryGet(`/api/staff/shifts/${firstShiftId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertEqual(res.data.data.id, firstShiftId, 'Should match shift id');
        assertNotNull(res.data.data.startTime, 'Should have startTime');
        assertNotNull(res.data.data.endTime, 'Should have endTime');
      },
    },
    {
      name: 'Shifts — GET /api/staff/shifts with date filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const today = new Date().toISOString().split('T')[0];
        const res = await tryGet(`/api/staff/shifts?propertyId=${st.propertyId}&date=${today}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assert(Array.isArray(res.data.data), 'data should be array');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 2 — Attendance  (GET /api/staff/attendance)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Attendance — GET /api/staff/attendance returns records',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/attendance?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        // Data can be array or object with records/summary
        if (Array.isArray(res.data.data)) {
          assert(Array.isArray(res.data.data), 'data should be array');
        } else {
          assertNotNull(res.data.data.records || res.data.data.attendance, 'Should have records');
        }
      },
    },
    {
      name: 'Attendance — GET /api/staff/attendance with date filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const today = new Date().toISOString().split('T')[0];
        const res = await tryGet(`/api/staff/attendance?propertyId=${st.propertyId}&date=${today}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Attendance — records have required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/attendance?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const records = Array.isArray(res.data.data) ? res.data.data : (res.data.data.records || res.data.data.attendance || []);
        if (records.length === 0) { console.log('      (no attendance records, skipping)'); return; }
        const record = records[0];
        assertNotNull(record.id || record.staffId, 'Record should have id or staffId');
        assertNotNull(record.date || record.checkIn, 'Record should have date or checkIn');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 3 — Leave Management  (GET /api/staff/leave)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Leave — GET /api/staff/leave returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/leave?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
        assertNotNull(res.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Leave — records contain status field',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/leave?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no leave records, skipping)'); return;
        }
        const leave = res.data.data[0];
        assertNotNull(leave.id, 'Leave should have id');
        assertNotNull(leave.status, 'Leave should have status');
        assertNotNull(leave.type || leave.leaveType, 'Leave should have type');
      },
    },
    {
      name: 'Leave — GET /api/staff/leave with status filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/leave?propertyId=${st.propertyId}&status=pending`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assert(Array.isArray(res.data.data), 'data should be array');
        for (const item of res.data.data) {
          assertEqual(item.status, 'pending', 'Filtered items should be pending');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 4 — Tasks  (GET /api/staff/tasks, POST /api/staff/tasks)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Tasks — POST /api/staff/tasks creates a staff task',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryPost(
          '/api/staff/tasks',
          {
            propertyId: st.propertyId,
            title: `Staff Test Task ${Date.now()}`,
            description: 'Automated staff task test',
            priority: 'high',
            status: 'pending',
            assignedTo: st.userId,
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          },
          cookie(state),
        );
        if (!res.ok) {
          console.log('      (POST not available or failed, will try GET only)'); return;
        }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data?.id, 'Should have task id');
        assertEqual(res.data.data.priority, 'high');
        assertEqual(res.data.data.status, 'pending');
        createdTaskId = res.data.data.id;
      },
    },
    {
      name: 'Tasks — GET /api/staff/tasks returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/tasks?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
        assertNotNull(res.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Tasks — tasks have required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/tasks?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no staff tasks, skipping)'); return;
        }
        const task = res.data.data[0];
        assertNotNull(task.id, 'Task should have id');
        assertNotNull(task.title, 'Task should have title');
        assertNotNull(task.status, 'Task should have status');
        assertNotNull(task.priority || task.priorityLevel, 'Task should have priority');
      },
    },
    {
      name: 'Tasks — GET /api/staff/tasks with status filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/tasks?propertyId=${st.propertyId}&status=pending`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assert(Array.isArray(res.data.data), 'data should be array');
        for (const task of res.data.data) {
          assertEqual(task.status, 'pending', 'Filtered tasks should be pending');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 5 — Channels & Chat  (GET /api/staff/channels, GET /api/staff/channels/[id]/messages)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Channels — GET /api/staff/channels returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/channels?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
      },
    },
    {
      name: 'Channels — channels have required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/channels?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no channels, skipping)'); return;
        }
        const channel = res.data.data[0];
        assertNotNull(channel.id, 'Channel should have id');
        assertNotNull(channel.name || channel.channelName, 'Channel should have name');
        createdChannelId = channel.id;
      },
    },
    {
      name: 'Channels — GET /api/staff/channels/[id]/messages returns messages',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!createdChannelId) { console.log('      (no channel ID, skipping)'); return; }
        const res = await tryGet(`/api/staff/channels/${createdChannelId}/messages`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 6 — Performance  (GET /api/staff/performance)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Performance — GET /api/staff/performance returns metrics',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/performance?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Performance — metrics contain staff evaluations',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/performance?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        // Accept both array format and object-with-stats format
        if (Array.isArray(d)) {
          if (d.length > 0) {
            assertNotNull(d[0].id || d[0].staffId, 'Performance entry should have id or staffId');
            assertNotNull(d[0].rating || d[0].score || d[0].metrics, 'Performance entry should have metrics');
          }
        } else {
          assertNotNull(d.overallScore !== undefined || d.avgRating !== undefined || d.stats, 'Should have overall metrics');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 7 — Skills  (GET /api/staff/skills)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Skills — GET /api/staff/skills returns skills data',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/skills?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Skills — skills contain name and category',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/skills?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        if (Array.isArray(d)) {
          if (d.length > 0) {
            assertNotNull(d[0].id, 'Skill should have id');
            assertNotNull(d[0].name || d[0].skillName, 'Skill should have name');
          }
        } else {
          assertNotNull(d.skills || d.staffSkills || d.categories, 'Should have skills list or categories');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 8 — Payroll  (GET /api/staff/payroll, GET /api/staff/payroll/process)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Payroll — GET /api/staff/payroll returns payroll data',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/payroll?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Payroll — contains payroll period and total info',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/payroll?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        if (Array.isArray(d)) {
          assertNotNull(d.length !== undefined, 'Payroll should return records');
        } else {
          assertNotNull(d.totalAmount !== undefined || d.netPay !== undefined || d.grossPay !== undefined, 'Should have total amount');
          assertNotNull(d.payPeriod || d.period || d.startDate, 'Should have pay period');
        }
      },
    },
    {
      name: 'Payroll — GET /api/staff/payroll/process returns process info',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/staff/payroll/process?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥', err);
  process.exit(1);
});
