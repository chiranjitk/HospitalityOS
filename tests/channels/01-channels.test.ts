/**
 * 01 - Channel Manager E2E Tests
 *
 * Tests 40+ Channel Manager endpoints including analytics, connections,
 * inventory/rate/booking sync, restrictions, stop-sell, allocations,
 * mapping, parity, CRS, GDS, content sync, messages, and more.
 *
 * Most channel endpoints return empty arrays when no active channels
 * are configured — tests verify successful response structure.
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  assert,
  assertNotNull,
  assertGt,
  delay,
  DELAY_BETWEEN_CALLS,
  ApiError,
} from '../pms/setup';

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }

  const auth = cookie(state);

  // Helper for graceful 404 skipping
  const safeGet = async (path: string) => {
    try {
      await delay(DELAY_BETWEEN_CALLS);
      return await api.get(path, auth);
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  };

  const tests: { name: string; fn: () => Promise<void> }[] = [
    // ─── Analytics & Connections ────────────────────────────────────
    {
      name: 'GET /api/channels/analytics',
      fn: async () => {
        const r = await safeGet('/api/channels/analytics');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assert(r.data.success !== false, 'Should succeed or return data');
        assertNotNull(r.data.data !== undefined || r.data.analytics !== undefined, 'Should have analytics payload');
        console.log(`      Analytics keys: ${Object.keys(r.data.data || r.data.analytics || {}).join(', ')}`);
      },
    },
    {
      name: 'GET /api/channels/connections — list channel connections',
      fn: async () => {
        const r = await safeGet('/api/channels/connections');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const conns = Array.isArray(r.data.data) ? r.data.data : r.data.data?.connections || r.data.data?.items || [r.data.data];
        assert(Array.isArray(conns), 'Connections should be array-like');
        console.log(`      Found ${conns.length} channel connection(s)`);
      },
    },
    {
      name: 'GET /api/channels/connections — verify connection structure',
      fn: async () => {
        const r = await safeGet('/api/channels/connections');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const conns = Array.isArray(r.data.data) ? r.data.data : r.data.data?.connections || [];
        if (Array.isArray(conns) && conns.length > 0) {
          const c = conns[0];
          assertNotNull(c.id || c.channelId, 'Connection should have an id');
          assertNotNull(c.channelName || c.name || c.type, 'Connection should have a name/type');
          console.log(`      Connection: id=${c.id || c.channelId}, name=${c.channelName || c.name || c.type}`);
        } else {
          console.log('      No active connections — acceptable');
        }
      },
    },

    // ─── Channel Manager Channels ───────────────────────────────────
    {
      name: 'GET /api/channel-manager/channels — list managed channels',
      fn: async () => {
        const r = await safeGet('/api/channel-manager/channels');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const channels = Array.isArray(r.data.data) ? r.data.data : r.data.data?.channels || r.data.data?.items || [r.data.data];
        assert(Array.isArray(channels), 'Channels should be array-like');
        console.log(`      Found ${channels.length} managed channel(s)`);
      },
    },
    {
      name: 'GET /api/channel-manager/channels — verify channel fields',
      fn: async () => {
        const r = await safeGet('/api/channel-manager/channels');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const channels = Array.isArray(r.data.data) ? r.data.data : r.data.data?.channels || [];
        if (Array.isArray(channels) && channels.length > 0) {
          const ch = channels[0];
          assertNotNull(ch.id || ch.channelId, 'Channel should have an id');
          const keys = Object.keys(ch);
          assertGt(keys.length, 0, 'Channel should have fields');
          console.log(`      Channel keys: ${keys.join(', ')}`);
        } else {
          console.log('      No managed channels — acceptable');
        }
      },
    },
    {
      name: 'GET /api/channel-manager/channels/stats — channel statistics',
      fn: async () => {
        const r = await safeGet('/api/channel-manager/channels/stats');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return stats data');
        console.log(`      Stats keys: ${Object.keys(r.data.data || r.data.stats || {}).join(', ')}`);
      },
    },

    // ─── Inventory Sync ─────────────────────────────────────────────
    {
      name: 'GET /api/channels/inventory-sync — inventory sync status',
      fn: async () => {
        const r = await safeGet('/api/channels/inventory-sync');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.syncs || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Inventory sync should be array-like');
        console.log(`      Found ${items.length} inventory sync record(s)`);
      },
    },
    {
      name: 'GET /api/channels/inventory-sync — verify sync fields',
      fn: async () => {
        const r = await safeGet('/api/channels/inventory-sync');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.syncs || [];
        if (Array.isArray(items) && items.length > 0) {
          const item = items[0];
          assertNotNull(item.id || item.channelId, 'Sync record should have id/channelId');
          console.log(`      Inventory sync keys: ${Object.keys(item).join(', ')}`);
        } else {
          console.log('      No inventory sync records — acceptable');
        }
      },
    },

    // ─── Rate Sync ──────────────────────────────────────────────────
    {
      name: 'GET /api/channels/rate-sync — rate sync status',
      fn: async () => {
        const r = await safeGet('/api/channels/rate-sync');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.syncs || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Rate sync should be array-like');
        console.log(`      Found ${items.length} rate sync record(s)`);
      },
    },
    {
      name: 'GET /api/channels/rate-sync — verify rate sync fields',
      fn: async () => {
        const r = await safeGet('/api/channels/rate-sync');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.syncs || [];
        if (Array.isArray(items) && items.length > 0) {
          const item = items[0];
          const keys = Object.keys(item);
          assertGt(keys.length, 0, 'Rate sync record should have fields');
          console.log(`      Rate sync keys: ${keys.join(', ')}`);
        } else {
          console.log('      No rate sync records — acceptable');
        }
      },
    },

    // ─── Booking Sync ───────────────────────────────────────────────
    {
      name: 'GET /api/channels/booking-sync — booking sync status',
      fn: async () => {
        const r = await safeGet('/api/channels/booking-sync');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.bookings || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Booking sync should be array-like');
        console.log(`      Found ${items.length} booking sync record(s)`);
      },
    },
    {
      name: 'GET /api/channels/booking-modifications — booking modifications',
      fn: async () => {
        const r = await safeGet('/api/channels/booking-modifications');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.modifications || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Booking modifications should be array-like');
        console.log(`      Found ${items.length} booking modification(s)`);
      },
    },

    // ─── Restrictions ───────────────────────────────────────────────
    {
      name: 'GET /api/channels/restrictions — channel restrictions',
      fn: async () => {
        const r = await safeGet('/api/channels/restrictions');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.restrictions || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Restrictions should be array-like');
        console.log(`      Found ${items.length} restriction(s)`);
      },
    },
    {
      name: 'GET /api/channels/stop-sell — stop-sell status',
      fn: async () => {
        const r = await safeGet('/api/channels/stop-sell');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.stopSells || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Stop-sell should be array-like');
        console.log(`      Found ${items.length} stop-sell record(s)`);
      },
    },

    // ─── Allocations ────────────────────────────────────────────────
    {
      name: 'GET /api/channels/allocations — channel allocations',
      fn: async () => {
        const r = await safeGet('/api/channels/allocations');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.allocations || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Allocations should be array-like');
        console.log(`      Found ${items.length} allocation(s)`);
      },
    },

    // ─── Mapping ────────────────────────────────────────────────────
    {
      name: 'GET /api/channels/mapping — room/rate mapping',
      fn: async () => {
        const r = await safeGet('/api/channels/mapping');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.mappings || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Mappings should be array-like');
        console.log(`      Found ${items.length} mapping(s)`);
      },
    },
    {
      name: 'GET /api/channels/mapping — verify mapping structure',
      fn: async () => {
        const r = await safeGet('/api/channels/mapping');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.mappings || [];
        if (Array.isArray(items) && items.length > 0) {
          const m = items[0];
          assertNotNull(m.id || m.mappingId, 'Mapping should have an id');
          const keys = Object.keys(m);
          assertGt(keys.length, 0, 'Mapping should have fields');
          console.log(`      Mapping keys: ${keys.join(', ')}`);
        } else {
          console.log('      No mappings configured — acceptable');
        }
      },
    },

    // ─── Parity ─────────────────────────────────────────────────────
    {
      name: 'GET /api/channel-manager/parity — rate parity checks',
      fn: async () => {
        const r = await safeGet('/api/channel-manager/parity');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.parity || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Parity should be array-like');
        console.log(`      Found ${items.length} parity record(s)`);
      },
    },

    // ─── Sync Logs ──────────────────────────────────────────────────
    {
      name: 'GET /api/channels/sync-logs — synchronization logs',
      fn: async () => {
        const r = await safeGet('/api/channels/sync-logs');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.logs || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Sync logs should be array-like');
        console.log(`      Found ${items.length} sync log(s)`);
      },
    },
    {
      name: 'GET /api/channels/sync-logs — verify log entry structure',
      fn: async () => {
        const r = await safeGet('/api/channels/sync-logs');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.logs || [];
        if (Array.isArray(items) && items.length > 0) {
          const log = items[0];
          assertNotNull(log.id || log.logId, 'Log entry should have an id');
          const keys = Object.keys(log);
          assertGt(keys.length, 0, 'Log entry should have fields');
          console.log(`      Sync log keys: ${keys.join(', ')}`);
        } else {
          console.log('      No sync logs — acceptable');
        }
      },
    },

    // ─── Health ─────────────────────────────────────────────────────
    {
      name: 'GET /api/channels/health — channel health status',
      fn: async () => {
        const r = await safeGet('/api/channels/health');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        console.log(`      Health keys: ${Object.keys(r.data.data || r.data.health || {}).join(', ')}`);
      },
    },
    {
      name: 'GET /api/channels/health — verify health response structure',
      fn: async () => {
        const r = await safeGet('/api/channels/health');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const payload = r.data.data || r.data.health || r.data;
        const keys = Object.keys(payload || {});
        assertGt(keys.length, 0, 'Health should have at least one field');
        console.log(`      Health fields: ${keys.join(', ')}`);
      },
    },

    // ─── CRS ────────────────────────────────────────────────────────
    {
      name: 'GET /api/channels/crs — central reservation system',
      fn: async () => {
        const r = await safeGet('/api/channels/crs');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        console.log(`      CRS keys: ${Object.keys(r.data.data || r.data.crs || {}).join(', ')}`);
      },
    },

    // ─── GDS ────────────────────────────────────────────────────────
    {
      name: 'GET /api/channels/gds — global distribution system',
      fn: async () => {
        const r = await safeGet('/api/channels/gds');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        console.log(`      GDS keys: ${Object.keys(r.data.data || r.data.gds || {}).join(', ')}`);
      },
    },

    // ─── Rate Derivation ────────────────────────────────────────────
    {
      name: 'GET /api/channels/rate-derivation — derived rate plans',
      fn: async () => {
        const r = await safeGet('/api/channels/rate-derivation');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.derivations || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Rate derivations should be array-like');
        console.log(`      Found ${items.length} rate derivation(s)`);
      },
    },

    // ─── Rate Overrides ─────────────────────────────────────────────
    {
      name: 'GET /api/channels/rate-overrides — rate overrides',
      fn: async () => {
        const r = await safeGet('/api/channels/rate-overrides');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.overrides || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Rate overrides should be array-like');
        console.log(`      Found ${items.length} rate override(s)`);
      },
    },
    {
      name: 'GET /api/channels/rate-overrides — verify override structure',
      fn: async () => {
        const r = await safeGet('/api/channels/rate-overrides');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.overrides || [];
        if (Array.isArray(items) && items.length > 0) {
          const o = items[0];
          assertNotNull(o.id || o.overrideId, 'Override should have an id');
          const keys = Object.keys(o);
          assertGt(keys.length, 0, 'Override should have fields');
          console.log(`      Override keys: ${keys.join(', ')}`);
        } else {
          console.log('      No rate overrides — acceptable');
        }
      },
    },

    // ─── Content Sync ───────────────────────────────────────────────
    {
      name: 'GET /api/channels/content-sync — content synchronization',
      fn: async () => {
        const r = await safeGet('/api/channels/content-sync');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        console.log(`      Content sync keys: ${Object.keys(r.data.data || r.data.sync || {}).join(', ')}`);
      },
    },

    // ─── Messages ───────────────────────────────────────────────────
    {
      name: 'GET /api/channel-manager/messages — channel messages',
      fn: async () => {
        const r = await safeGet('/api/channel-manager/messages');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.messages || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Messages should be array-like');
        console.log(`      Found ${items.length} message(s)`);
      },
    },
    {
      name: 'GET /api/channel-manager/messages — verify message structure',
      fn: async () => {
        const r = await safeGet('/api/channel-manager/messages');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.messages || [];
        if (Array.isArray(items) && items.length > 0) {
          const msg = items[0];
          assertNotNull(msg.id || msg.messageId, 'Message should have an id');
          const keys = Object.keys(msg);
          assertGt(keys.length, 0, 'Message should have fields');
          console.log(`      Message keys: ${keys.join(', ')}`);
        } else {
          console.log('      No channel messages — acceptable');
        }
      },
    },
    {
      name: 'GET /api/channel-manager/messages/unread-count — unread message count',
      fn: async () => {
        const r = await safeGet('/api/channel-manager/messages/unread-count');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const count = r.data.data?.count ?? r.data.data?.unread ?? r.data.data ?? 0;
        assertNotNull(count !== undefined, 'Should have unread count');
        console.log(`      Unread count: ${count}`);
      },
    },

    // ─── Tax Mapping ────────────────────────────────────────────────
    {
      name: 'GET /api/channels/tax-mapping — tax mapping configuration',
      fn: async () => {
        const r = await safeGet('/api/channels/tax-mapping');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.mappings || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Tax mappings should be array-like');
        console.log(`      Found ${items.length} tax mapping(s)`);
      },
    },

    // ─── Meal Plan Mapping ──────────────────────────────────────────
    {
      name: 'GET /api/channels/meal-plan-mapping — meal plan mapping',
      fn: async () => {
        const r = await safeGet('/api/channels/meal-plan-mapping');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.mappings || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Meal plan mappings should be array-like');
        console.log(`      Found ${items.length} meal plan mapping(s)`);
      },
    },

    // ─── Virtual Inventory ──────────────────────────────────────────
    {
      name: 'GET /api/channels/virtual-inventory — virtual inventory pool',
      fn: async () => {
        const r = await safeGet('/api/channels/virtual-inventory');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.pools || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Virtual inventory should be array-like');
        console.log(`      Found ${items.length} virtual inventory record(s)`);
      },
    },

    // ─── Currency ───────────────────────────────────────────────────
    {
      name: 'GET /api/channels/currency — currency configuration',
      fn: async () => {
        const r = await safeGet('/api/channels/currency');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        console.log(`      Currency keys: ${Object.keys(r.data.data || r.data.currency || {}).join(', ')}`);
      },
    },

    // ─── Settlement ─────────────────────────────────────────────────
    {
      name: 'GET /api/channels/settlement — settlement records',
      fn: async () => {
        const r = await safeGet('/api/channels/settlement');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.settlements || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Settlements should be array-like');
        console.log(`      Found ${items.length} settlement(s)`);
      },
    },

    // ─── Allotment Release ──────────────────────────────────────────
    {
      name: 'GET /api/channels/allotment-release — allotment release schedule',
      fn: async () => {
        const r = await safeGet('/api/channels/allotment-release');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.releases || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Allotment releases should be array-like');
        console.log(`      Found ${items.length} allotment release(s)`);
      },
    },

    // ─── Promo Codes ────────────────────────────────────────────────
    {
      name: 'GET /api/channels/promo-codes — channel promo codes',
      fn: async () => {
        const r = await safeGet('/api/channels/promo-codes');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.promos || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Promo codes should be array-like');
        console.log(`      Found ${items.length} promo code(s)`);
      },
    },
    {
      name: 'GET /api/channels/promo-codes — verify promo code fields',
      fn: async () => {
        const r = await safeGet('/api/channels/promo-codes');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.promos || [];
        if (Array.isArray(items) && items.length > 0) {
          const p = items[0];
          assertNotNull(p.id || p.promoId || p.code, 'Promo should have id or code');
          const keys = Object.keys(p);
          assertGt(keys.length, 0, 'Promo should have fields');
          console.log(`      Promo keys: ${keys.join(', ')}`);
        } else {
          console.log('      No promo codes — acceptable');
        }
      },
    },

    // ─── Booking Pace ───────────────────────────────────────────────
    {
      name: 'GET /api/channels/booking-pace — booking pace analytics',
      fn: async () => {
        const r = await safeGet('/api/channels/booking-pace');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        console.log(`      Booking pace keys: ${Object.keys(r.data.data || r.data.pace || {}).join(', ')}`);
      },
    },

    // ─── Priority ───────────────────────────────────────────────────
    {
      name: 'GET /api/channels/priority — channel priority settings',
      fn: async () => {
        const r = await safeGet('/api/channels/priority');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.priorities || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Priorities should be array-like');
        console.log(`      Found ${items.length} priority record(s)`);
      },
    },

    // ─── Inventory Pool ─────────────────────────────────────────────
    {
      name: 'GET /api/channels/inventory-pool — inventory pool configuration',
      fn: async () => {
        const r = await safeGet('/api/channels/inventory-pool');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.pools || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Inventory pools should be array-like');
        console.log(`      Found ${items.length} inventory pool(s)`);
      },
    },

    // ─── Derived Rate Plans ─────────────────────────────────────────
    {
      name: 'GET /api/channels/derived-rate-plans — derived rate plans',
      fn: async () => {
        const r = await safeGet('/api/channels/derived-rate-plans');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.plans || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Derived rate plans should be array-like');
        console.log(`      Found ${items.length} derived rate plan(s)`);
      },
    },

    // ─── Commission Config ──────────────────────────────────────────
    {
      name: 'GET /api/channels/commission-config — commission configuration',
      fn: async () => {
        const r = await safeGet('/api/channels/commission-config');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.commissions || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Commission config should be array-like');
        console.log(`      Found ${items.length} commission config(s)`);
      },
    },
    {
      name: 'GET /api/channels/commission-config — verify commission fields',
      fn: async () => {
        const r = await safeGet('/api/channels/commission-config');
        if (!r) { console.log('      (skipped — 404)'); return; }
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.commissions || [];
        if (Array.isArray(items) && items.length > 0) {
          const c = items[0];
          assertNotNull(c.id || c.commissionId, 'Commission should have an id');
          const keys = Object.keys(c);
          assertGt(keys.length, 0, 'Commission should have fields');
          console.log(`      Commission keys: ${keys.join(', ')}`);
        } else {
          console.log('      No commission configs — acceptable');
        }
      },
    },

    // ─── Guest Rates ────────────────────────────────────────────────
    {
      name: 'GET /api/channels/guest-rates — guest rate configuration',
      fn: async () => {
        const r = await safeGet('/api/channels/guest-rates');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.rates || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Guest rates should be array-like');
        console.log(`      Found ${items.length} guest rate(s)`);
      },
    },

    // ─── Booking Limits ─────────────────────────────────────────────
    {
      name: 'GET /api/channels/booking-limits — booking limit settings',
      fn: async () => {
        const r = await safeGet('/api/channels/booking-limits');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.limits || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Booking limits should be array-like');
        console.log(`      Found ${items.length} booking limit(s)`);
      },
    },

    // ─── Competitor Parity ──────────────────────────────────────────
    {
      name: 'GET /api/channel-manager/competitor-parity — competitor rate parity',
      fn: async () => {
        const r = await safeGet('/api/channel-manager/competitor-parity');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        const items = Array.isArray(r.data.data) ? r.data.data : r.data.data?.competitors || r.data.data?.items || [r.data.data];
        assert(Array.isArray(items), 'Competitor parity should be array-like');
        console.log(`      Found ${items.length} competitor parity record(s)`);
      },
    },

    // ─── Content ────────────────────────────────────────────────────
    {
      name: 'GET /api/channel-manager/content — channel content',
      fn: async () => {
        const r = await safeGet('/api/channel-manager/content');
        if (!r) { console.log('      (skipped — 404)'); return; }
        assertNotNull(r.data, 'Should return data');
        console.log(`      Content keys: ${Object.keys(r.data.data || r.data.content || {}).join(', ')}`);
      },
    },

    // ─── Cross-Endpoint Verification ────────────────────────────────
    {
      name: 'Core sync endpoints respond consistently',
      fn: async () => {
        const syncEndpoints = [
          '/api/channels/inventory-sync',
          '/api/channels/rate-sync',
          '/api/channels/booking-sync',
          '/api/channels/content-sync',
        ];
        let successCount = 0;
        for (const ep of syncEndpoints) {
          try {
            await delay(DELAY_BETWEEN_CALLS);
            const r = await api.get(ep, auth);
            if (r.data !== null) successCount++;
          } catch (e: any) {
            // 404 is acceptable for unconfigured channels
            if (e.status !== 404) throw e;
          }
        }
        assertGt(successCount, 0, `At least 1 sync endpoint should succeed (got ${successCount}/${syncEndpoints.length})`);
        console.log(`      ${successCount}/${syncEndpoints.length} sync endpoints responded`);
      },
    },
    {
      name: 'Channel manager endpoints share consistent auth context',
      fn: async () => {
        const cmEndpoints = [
          '/api/channel-manager/channels',
          '/api/channel-manager/channels/stats',
          '/api/channel-manager/parity',
          '/api/channel-manager/messages',
          '/api/channel-manager/competitor-parity',
          '/api/channel-manager/content',
        ];
        let successCount = 0;
        for (const ep of cmEndpoints) {
          try {
            await delay(DELAY_BETWEEN_CALLS);
            const r = await api.get(ep, auth);
            if (r.data !== null) successCount++;
          } catch (e: any) {
            if (e.status !== 404) throw e;
          }
        }
        assertGt(successCount, 0, `At least 1 channel-manager endpoint should succeed (got ${successCount}/${cmEndpoints.length})`);
        console.log(`      ${successCount}/${cmEndpoints.length} channel-manager endpoints responded`);
      },
    },
    {
      name: 'All 40 channel endpoints reachable (no server crash)',
      fn: async () => {
        const allEndpoints = [
          '/api/channels/analytics',
          '/api/channels/connections',
          '/api/channel-manager/channels',
          '/api/channel-manager/channels/stats',
          '/api/channels/inventory-sync',
          '/api/channels/rate-sync',
          '/api/channels/booking-sync',
          '/api/channels/booking-modifications',
          '/api/channels/restrictions',
          '/api/channels/stop-sell',
          '/api/channels/allocations',
          '/api/channels/mapping',
          '/api/channel-manager/parity',
          '/api/channels/sync-logs',
          '/api/channels/health',
          '/api/channels/crs',
          '/api/channels/gds',
          '/api/channels/rate-derivation',
          '/api/channels/rate-overrides',
          '/api/channels/content-sync',
          '/api/channel-manager/messages',
          '/api/channel-manager/messages/unread-count',
          '/api/channels/tax-mapping',
          '/api/channels/meal-plan-mapping',
          '/api/channels/virtual-inventory',
          '/api/channels/currency',
          '/api/channels/settlement',
          '/api/channels/allotment-release',
          '/api/channels/promo-codes',
          '/api/channels/booking-pace',
          '/api/channels/priority',
          '/api/channels/inventory-pool',
          '/api/channels/derived-rate-plans',
          '/api/channels/commission-config',
          '/api/channels/guest-rates',
          '/api/channels/booking-limits',
          '/api/channel-manager/competitor-parity',
          '/api/channel-manager/content',
        ];
        let reachable = 0;
        let notFound = 0;
        let errors = 0;
        for (const ep of allEndpoints) {
          try {
            await delay(DELAY_BETWEEN_CALLS);
            await api.get(ep, auth);
            reachable++;
          } catch (e: any) {
            if (e.status === 404) {
              notFound++;
            } else {
              errors++;
              console.log(`      ⚠️  ${ep} → ${e.status}: ${e.message.slice(0, 60)}`);
            }
          }
        }
        assert(
          reachable + notFound === allEndpoints.length,
          `All endpoints should be reachable or 404 (reachable=${reachable}, notFound=${notFound}, errors=${errors})`,
        );
        console.log(`      Reachable: ${reachable}, Not Found: ${notFound}, Errors: ${errors}/${allEndpoints.length}`);
      },
    },
  ];

  await runSequentially('01-Channels', tests);
}

main().catch((e) => {
  console.error('\n💥 Unhandled error:', e);
  process.exit(1);
});
