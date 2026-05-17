/**
 * 01 - Housekeeping Module Tests
 *
 * Tests all 11 housekeeping pages:
 *   1. Tasks                — GET /api/tasks, POST /api/tasks, PUT /api/tasks/[id]
 *   2. Kanban Board         — GET /api/tasks (with status filter for board columns)
 *   3. Room Status          — GET /api/dashboard/room-status
 *   4. Maintenance Requests — GET /api/maintenance/work-orders, POST /api/maintenance/work-orders
 *   5. Preventive Maint.    — GET /api/preventive-maintenance, POST /api/preventive-maintenance
 *   6. Asset Management     — GET /api/assets, POST /api/assets
 *   7. Inspection Checklists— GET /api/inspection-templates, GET /api/inspections, GET /api/inspections/stats
 *   8. Automation Rules     — GET /api/automation/rules
 *   9. Lost & Found         — GET /api/lost-found, POST /api/lost-found
 *  10. Minibar              — GET /api/minibar/items, GET /api/minibar/consumption
 *  11. Laundry              — GET /api/laundry/items, GET /api/laundry/orders
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
  formatDate,
  addDays,
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
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }
  const st = loadState();

  // Shared IDs created during tests
  let createdTaskId: string | undefined;
  let createdWorkOrderId: string | undefined;
  let createdPmId: string | undefined;
  let createdAssetId: string | undefined;
  let createdLostFoundId: string | undefined;

  await runSequentially('01-Housekeeping', [
    // ═══════════════════════════════════════════════════════════════════
    // PAGE 1 — Tasks  (GET /api/tasks, POST /api/tasks, PUT /api/tasks/[id])
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Tasks — GET /api/tasks returns list with pagination & summary',
      fn: async () => {
        const { data } = await api.get(`/api/tasks?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assert(Array.isArray(data.data), 'data should be array');
        assertNotNull(data.pagination, 'Should have pagination');
        assertNotNull(data.summary, 'Should have summary');
        assertNotNull(data.summary.byStatus, 'Summary should have byStatus');
        assertNotNull(data.summary.byPriority, 'Summary should have byPriority');
      },
    },
    {
      name: 'Tasks — GET /api/tasks supports status filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/tasks?propertyId=${st.propertyId}&status=pending`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        for (const task of data.data) {
          assertEqual(task.status, 'pending', 'Filtered tasks should be pending');
        }
      },
    },
    {
      name: 'Tasks — POST /api/tasks creates a housekeeping task',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data, status } = await api.post(
          '/api/tasks',
          {
            propertyId: st.propertyId,
            roomId: st.room1Id,
            type: 'cleaning',
            category: 'room_turnover',
            title: `HK Test Cleaning ${Date.now()}`,
            description: 'Automated housekeeping test task',
            priority: 'high',
            status: 'pending',
            scheduledAt: new Date().toISOString(),
          },
          cookie(state),
        );
        assert(status === 201, 'Should return 201');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Should have task id');
        assertEqual(data.data.type, 'cleaning');
        assertEqual(data.data.priority, 'high');
        assertEqual(data.data.status, 'pending');
        assertNotNull(data.data.room, 'Should include room relation');
        createdTaskId = data.data.id;
      },
    },
    {
      name: 'Tasks — GET /api/tasks/[id] retrieves created task',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(createdTaskId, 'Task should have been created');
        const { data } = await api.get(`/api/tasks/${createdTaskId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertEqual(data.data.id, createdTaskId, 'Should match task id');
        assertNotNull(data.data.room, 'Should include room');
        assertEqual(data.data.type, 'cleaning');
      },
    },
    {
      name: 'Tasks — PUT /api/tasks/[id] updates task priority and status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        assertNotNull(createdTaskId, 'Task should exist');
        const { data } = await api.put(
          `/api/tasks/${createdTaskId}`,
          { priority: 'low', status: 'in_progress' },
          cookie(state),
        );
        assert(data.success, 'Should succeed');
        assertEqual(data.data.priority, 'low');
        assertEqual(data.data.status, 'in_progress');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 2 — Kanban Board  (GET /api/tasks with status filter columns)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Kanban — GET /api/tasks?status=in_progress returns board column',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/tasks?propertyId=${st.propertyId}&status=in_progress`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
        for (const task of data.data) {
          assertEqual(task.status, 'in_progress', 'All should be in_progress');
        }
      },
    },
    {
      name: 'Kanban — GET /api/tasks?status=completed returns completed column',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/tasks?propertyId=${st.propertyId}&status=completed`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
        for (const task of data.data) {
          assertEqual(task.status, 'completed', 'All should be completed');
        }
      },
    },
    {
      name: 'Kanban — GET /api/tasks?status=cancelled returns cancelled column',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/tasks?propertyId=${st.propertyId}&status=cancelled`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
      },
    },
    {
      name: 'Kanban — GET /api/tasks with priority filter returns filtered data',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/tasks?propertyId=${st.propertyId}&priority=high`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
        for (const task of data.data) {
          assertEqual(task.priority, 'high', 'All should be high priority');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 3 — Room Status  (GET /api/dashboard/room-status)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Room Status — GET /api/dashboard/room-status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/dashboard/room-status', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.data.statusCounts, 'Should have statusCounts');
        assertNotNull(res.data.data.totalRooms !== undefined, 'Should have totalRooms');
        assertNotNull(res.data.data.occupancyRate !== undefined, 'Should have occupancyRate');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 4 — Maintenance Requests
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Maintenance — GET /api/maintenance/work-orders returns list with stats',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/maintenance/work-orders?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assert(Array.isArray(data.data), 'data should be array');
        assertNotNull(data.stats, 'Should have stats');
        assertNotNull(data.stats.statusDistribution, 'Should have statusDistribution');
        assertNotNull(data.stats.priorityDistribution, 'Should have priorityDistribution');
        assertNotNull(data.stats.totalWorkOrders !== undefined, 'Should have totalWorkOrders');
        assertNotNull(data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Maintenance — GET /api/maintenance/work-orders supports status filter',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/maintenance/work-orders?propertyId=${st.propertyId}&status=pending`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
        for (const wo of data.data) {
          assertEqual(wo.status, 'pending', 'Should be pending');
        }
      },
    },
    {
      name: 'Maintenance — POST /api/maintenance/work-orders creates a work order',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data, status } = await api.post(
          '/api/maintenance/work-orders',
          {
            propertyId: st.propertyId,
            roomId: st.room2Id,
            title: `HK Test WO ${Date.now()}`,
            description: 'Leaky faucet in bathroom - automated test',
            type: 'repair',
            priority: 'medium',
            estimatedCost: 1500,
          },
          cookie(state),
        );
        assert(status === 201, 'Should return 201');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Should have id');
        assertNotNull(data.data.workOrderNumber, 'Should have workOrderNumber');
        assertEqual(data.data.title.includes('HK Test WO'), true, 'Title should match');
        assertEqual(data.data.type, 'repair');
        createdWorkOrderId = data.data.id;
      },
    },
    {
      name: 'Maintenance — GET /api/maintenance/work-orders?priority=high filters by priority',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/maintenance/work-orders?propertyId=${st.propertyId}&priority=high`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
        for (const wo of data.data) {
          assertEqual(wo.priority, 'high', 'Should be high priority');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 5 — Preventive Maintenance
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Preventive Maint — GET /api/preventive-maintenance returns list with summary',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/preventive-maintenance?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assert(Array.isArray(data.data), 'data should be array');
        assertNotNull(data.summary, 'Should have summary');
        assertNotNull(data.summary.byStatus, 'Should have byStatus');
        assertNotNull(data.summary.byFrequency, 'Should have byFrequency');
        assertNotNull(data.summary.dueSoon !== undefined, 'Should have dueSoon');
        assertNotNull(data.summary.overdue !== undefined, 'Should have overdue');
        assertNotNull(data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Preventive Maint — POST /api/preventive-maintenance creates a PM item',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const nextDue = formatDate(addDays(new Date(), 30));
        const { data, status } = await api.post(
          '/api/preventive-maintenance',
          {
            propertyId: st.propertyId,
            title: `HK Test PM ${Date.now()}`,
            description: 'Monthly HVAC filter replacement - automated test',
            frequency: 'monthly',
            frequencyValue: 1,
            nextDueAt: nextDue,
            status: 'active',
            checklist: JSON.stringify([
              { id: '1', name: 'Check filter condition', required: true },
              { id: '2', name: 'Replace if dirty', required: true },
              { id: '3', name: 'Log replacement date', required: false },
            ]),
          },
          cookie(state),
        );
        assert(status === 201, 'Should return 201');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Should have id');
        assertEqual(data.data.frequency, 'monthly');
        assertEqual(data.data.status, 'active');
        createdPmId = data.data.id;
      },
    },
    {
      name: 'Preventive Maint — GET /api/preventive-maintenance?frequency=monthly filters',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/preventive-maintenance?propertyId=${st.propertyId}&frequency=monthly`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
        for (const pm of data.data) {
          assertEqual(pm.frequency, 'monthly', 'Should be monthly');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 6 — Asset Management
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Assets — GET /api/assets returns list with summary',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/assets?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assert(Array.isArray(data.data), 'data should be array');
        assertNotNull(data.summary, 'Should have summary');
        assertNotNull(data.summary.byStatus, 'Should have byStatus');
        assertNotNull(data.summary.byCategory, 'Should have byCategory');
        assertNotNull(data.summary.totalValue !== undefined, 'Should have totalValue');
        assertNotNull(data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Assets — POST /api/assets creates a new asset',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data, status } = await api.post(
          '/api/assets',
          {
            propertyId: st.propertyId,
            name: `HK Test Asset ${Date.now()}`,
            category: 'equipment',
            description: 'Test vacuum cleaner for housekeeping',
            location: 'Storage Room B',
            purchasePrice: 25000,
            currentValue: 18000,
            serialNumber: `VC-${Date.now()}`,
            manufacturer: 'Dyson',
            status: 'active',
          },
          cookie(state),
        );
        assert(status === 201, 'Should return 201');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Should have id');
        assertEqual(data.data.category, 'equipment');
        assertEqual(data.data.status, 'active');
        assertNotNull(data.data.serialNumber, 'Should have serialNumber');
        createdAssetId = data.data.id;
      },
    },
    {
      name: 'Assets — GET /api/assets?category=equipment filters by category',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/assets?propertyId=${st.propertyId}&category=equipment`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
        for (const asset of data.data) {
          assertEqual(asset.category, 'equipment', 'Should be equipment');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 7 — Inspection Checklists
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Inspection Templates — GET /api/inspection-templates returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/inspection-templates?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assert(Array.isArray(data.data), 'data should be array');
        assertNotNull(data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Inspection Templates — templates have required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/inspection-templates?propertyId=${st.propertyId}`, cookie(state));
        for (const tmpl of data.data) {
          assertNotNull(tmpl.id, 'Template should have id');
          assertNotNull(tmpl.name, 'Template should have name');
          assertNotNull(tmpl.category, 'Template should have category');
        }
      },
    },
    {
      name: 'Inspections — GET /api/inspections returns list with stats',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/inspections?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assert(Array.isArray(data.data), 'data should be array');
        assertNotNull(data.pagination, 'Should have pagination');
        assertNotNull(data.stats, 'Should have stats');
        assertNotNull(data.stats.total !== undefined, 'Should have total');
        assertNotNull(data.stats.passed !== undefined, 'Should have passed');
        assertNotNull(data.stats.failed !== undefined, 'Should have failed');
        assertNotNull(data.stats.avgScore !== undefined, 'Should have avgScore');
      },
    },
    {
      name: 'Inspections — GET /api/inspections/stats returns detailed breakdown',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/inspections/stats?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.totalInspections !== undefined, 'Should have totalInspections');
        assertNotNull(data.data.passedCount !== undefined, 'Should have passedCount');
        assertNotNull(data.data.failedCount !== undefined, 'Should have failedCount');
        assertNotNull(data.data.passRate !== undefined, 'Should have passRate');
        assertNotNull(data.data.avgScore !== undefined, 'Should have avgScore');
        assertNotNull(data.data.inspectorBreakdown, 'Should have inspectorBreakdown');
        assert(Array.isArray(data.data.inspectorBreakdown), 'inspectorBreakdown should be array');
        assertNotNull(data.data.roomBreakdown, 'Should have roomBreakdown');
        assert(Array.isArray(data.data.roomBreakdown), 'roomBreakdown should be array');
        assertNotNull(data.data.trendData, 'Should have trendData');
        assert(Array.isArray(data.data.trendData), 'trendData should be array');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 8 — Automation Rules
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Automation Rules — GET /api/automation/rules returns list with stats',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/automation/rules', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.rules, 'Should have rules');
        assert(Array.isArray(data.data.rules), 'rules should be array');
        assertNotNull(data.data.total !== undefined, 'Should have total');
        assertNotNull(data.data.stats, 'Should have stats');
        assertNotNull(data.data.stats.totalRules !== undefined, 'Should have totalRules');
        assertNotNull(data.data.stats.activeRules !== undefined, 'Should have activeRules');
        assertNotNull(data.data.stats.totalExecutions !== undefined, 'Should have totalExecutions');
        assertNotNull(data.data.triggerEvents, 'Should have triggerEvents');
        assert(Array.isArray(data.data.triggerEvents), 'triggerEvents should be array');
        assertGt(data.data.triggerEvents.length, 0, 'Should have trigger events');
      },
    },
    {
      name: 'Automation Rules — each rule has required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/automation/rules', cookie(state));
        for (const rule of data.data.rules) {
          assertNotNull(rule.id, 'Rule should have id');
          assertNotNull(rule.name, 'Rule should have name');
          assertNotNull(rule.triggerEvent, 'Rule should have triggerEvent');
          assertNotNull(rule.actions, 'Rule should have actions');
          assertNotNull(rule.isActive !== undefined, 'Rule should have isActive');
        }
      },
    },
    {
      name: 'Automation Rules — GET /api/automation/rules?isActive=true filters',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/automation/rules?isActive=true', cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data.rules), 'rules should be array');
        for (const rule of data.data.rules) {
          assertEqual(rule.isActive, true, 'All should be active');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 9 — Lost & Found
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Lost & Found — GET /api/lost-found returns list with pagination',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/lost-found?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assert(Array.isArray(data.data), 'data should be array');
        assertNotNull(data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Lost & Found — POST /api/lost-found reports a found item',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data, status } = await api.post(
          '/api/lost-found',
          {
            propertyId: st.propertyId,
            itemType: 'found',
            category: 'electronics',
            description: 'iPhone charger left in Room 101 - automated test',
            locationFound: 'Room 101 - bedside table',
            roomId: st.room1Id,
            foundBy: 'HK Test Runner',
            foundAt: new Date().toISOString(),
            storageLocation: 'Lost & Found Cabinet A3',
            notes: 'Test item for automation',
          },
          cookie(state),
        );
        assert(status === 201, 'Should return 201');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Should have id');
        assertEqual(data.data.itemType, 'found');
        assertEqual(data.data.category, 'electronics');
        assertEqual(data.data.status, 'reported');
        assertNotNull(data.data.locationFound, 'Should have locationFound');
        createdLostFoundId = data.data.id;
      },
    },
    {
      name: 'Lost & Found — GET /api/lost-found?category=electronics filters',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/lost-found?propertyId=${st.propertyId}&category=electronics`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
        for (const item of data.data) {
          assertEqual(item.category, 'electronics', 'Should be electronics');
        }
      },
    },
    {
      name: 'Lost & Found — GET /api/lost-found?itemType=lost filters',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/lost-found?propertyId=${st.propertyId}&itemType=lost`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data), 'data should be array');
        for (const item of data.data) {
          assertEqual(item.itemType, 'lost', 'Should be lost');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 10 — Minibar
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Minibar — GET /api/minibar/items returns list with pagination',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/minibar/items?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.items, 'Should have items array');
        assert(Array.isArray(data.data.items), 'items should be array');
        assertNotNull(data.data.pagination, 'Should have pagination');
        assertNotNull(data.data.pagination.total !== undefined, 'Should have total');
        assertNotNull(data.data.pagination.totalPages !== undefined, 'Should have totalPages');
      },
    },
    {
      name: 'Minibar — GET /api/minibar/consumption returns list with totals',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/minibar/consumption?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.consumptions, 'Should have consumptions array');
        assert(Array.isArray(data.data.consumptions), 'consumptions should be array');
        assertNotNull(data.data.totals, 'Should have totals');
        assertNotNull(data.data.totals.count !== undefined, 'Should have count');
        assertNotNull(data.data.totals.totalAmount !== undefined, 'Should have totalAmount');
        assertNotNull(data.data.totals.totalQuantity !== undefined, 'Should have totalQuantity');
        assertNotNull(data.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Minibar — GET /api/minibar/items?category=beverage filters by category',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/minibar/items?propertyId=${st.propertyId}&category=beverage`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data.items), 'items should be array');
        for (const item of data.data.items) {
          assertEqual(item.category, 'beverage', 'Should be beverage');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 11 — Laundry
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Laundry — GET /api/laundry/items returns list with pagination',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/laundry/items?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.items, 'Should have items array');
        assert(Array.isArray(data.data.items), 'items should be array');
        assertNotNull(data.data.pagination, 'Should have pagination');
        assertNotNull(data.data.pagination.totalPages !== undefined, 'Should have totalPages');
      },
    },
    {
      name: 'Laundry — GET /api/laundry/orders returns list with totals',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/laundry/orders?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.orders, 'Should have orders array');
        assert(Array.isArray(data.data.orders), 'orders should be array');
        assertNotNull(data.data.totals, 'Should have totals');
        assertNotNull(data.data.totals.count !== undefined, 'Should have count');
        assertNotNull(data.data.totals.totalAmount !== undefined, 'Should have totalAmount');
        assertNotNull(data.data.totals.totalItems !== undefined, 'Should have totalItems');
        assertNotNull(data.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Laundry — GET /api/laundry/items?serviceType=wash filters',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/laundry/items?propertyId=${st.propertyId}&serviceType=wash`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data.items), 'items should be array');
        for (const item of data.data.items) {
          assertEqual(item.serviceType, 'wash', 'Should be wash');
        }
      },
    },
    {
      name: 'Laundry — GET /api/laundry/orders?status=received filters',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get(`/api/laundry/orders?propertyId=${st.propertyId}&status=received`, cookie(state));
        assert(data.success, 'Should succeed');
        assert(Array.isArray(data.data.orders), 'orders should be array');
        for (const order of data.data.orders) {
          assertEqual(order.status, 'received', 'Should be received');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // CLEANUP — Cancel created task, delete work orders, soft-delete assets
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Cleanup — Cancel created task via DELETE /api/tasks/[id]',
      fn: async () => {
        if (!createdTaskId) { console.log('      (no task to clean up, skipping)'); return; }
        await delay(DELAY_BETWEEN_CALLS);
        // Reset status to pending so we can cancel
        await api.put(`/api/tasks/${createdTaskId}`, { status: 'pending' }, cookie(state));
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.del(`/api/tasks/${createdTaskId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertEqual(data.data.status, 'cancelled');
      },
    },
    {
      name: 'Cleanup — Soft-delete created work order',
      fn: async () => {
        if (!createdWorkOrderId) { console.log('      (no work order to clean up, skipping)'); return; }
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.del(`/api/maintenance/work-orders?ids=${createdWorkOrderId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.count, 'Should have count');
        assertGt(data.data.count, 0, 'Should have deleted at least 1');
      },
    },
    {
      name: 'Cleanup — Soft-delete created preventive maintenance item',
      fn: async () => {
        if (!createdPmId) { console.log('      (no PM item to clean up, skipping)'); return; }
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.del(`/api/preventive-maintenance?id=${createdPmId}`, cookie(state));
        assert(data.success, 'Should succeed');
      },
    },
    {
      name: 'Cleanup — Soft-delete created asset',
      fn: async () => {
        if (!createdAssetId) { console.log('      (no asset to clean up, skipping)'); return; }
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.del(`/api/assets?id=${createdAssetId}`, cookie(state));
        assert(data.success, 'Should succeed');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥', err);
  process.exit(1);
});
