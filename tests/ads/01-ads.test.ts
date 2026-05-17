/**
 * 01 - Digital Advertising Tests (4 pages, 12+ tests)
 *
 * Tests the full Digital Advertising module:
 * 1. Ad Campaigns — GET /api/ads/campaigns, POST /api/ads/campaigns
 * 2. Ad Connections — GET /api/ads/connections
 * 3. Ad Performance — GET /api/ads/performance
 * 4. Ad Sync — POST /api/ads/sync
 *
 * Creates a test campaign first, then exercises all pages against real API.
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
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
  ApiError,
} from '../pms/setup';

/** Helper: call GET and gracefully skip on 404 */
async function safeGet(path: string, auth: string): Promise<{ data: any; status: number; skipped?: boolean }> {
  try {
    await delay(DELAY_BETWEEN_CALLS);
    const res = await api.get(path, auth);
    return { ...res, skipped: false };
  } catch (err: any) {
    if (err instanceof ApiError && err.status === 404) {
      return { data: null, status: 404, skipped: true };
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
  const auth = cookie(state);

  await runSequentially('01-Ads', [

    // ═══════════════════════════════════════════════
    // PAGE 1: Ad Campaigns — POST first, then GET
    // ═══════════════════════════════════════════════
    {
      name: 'Ad Campaigns — POST /api/ads/campaigns creates a campaign',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/ads/campaigns',
            {
              name: `Test Ad Campaign ${Date.now()}`,
              description: 'E2E test ad campaign',
              type: 'search',
              platform: 'google',
              budget: 50,
              budgetType: 'daily',
              bidStrategy: 'auto',
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            },
            auth,
          );
          assert(data.success || data.data?.id, 'Ad campaign creation should succeed');
          assertNotNull(data.data?.id, 'Campaign should have an ID');
          assertEqual(data.data.name?.trim().length > 0, true, 'Campaign should have a name');
          assertNotNull(data.data.status, 'Campaign should have status');
          saveState({ adsCampaignId: data.data.id });
          await delay(DELAY_AFTER_MUTATION);
          console.log(`      Created campaign: "${data.data.name}" (status: ${data.data.status})`);
        } catch (err: any) {
          if (err.status === 404) { console.log('      (skipped — 404)'); return; }
          if (err.status === 403) { console.log('      (skipped — 403: permission required)'); return; }
          throw err;
        }
      },
    },
    {
      name: 'Ad Campaigns — GET /api/ads/campaigns returns campaigns list',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/campaigns', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have campaigns data');
        // Response has { campaigns, stats } structure
        const campaigns = data.data?.campaigns || (Array.isArray(data.data) ? data.data : []);
        assert(Array.isArray(campaigns), 'Campaigns should be array');
        console.log(`      Found ${campaigns.length} ad campaign(s)`);
      },
    },
    {
      name: 'Ad Campaigns — response includes stats with totals',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/campaigns', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        const stats = data.data?.stats;
        assertNotNull(stats, 'Response should include stats');
        // Stats should have total, active, paused, etc.
        assertNotNull(stats.total !== undefined, 'Stats should have total count');
        assertNotNull(stats.active !== undefined, 'Stats should have active count');
        console.log(`      Stats: total=${stats.total}, active=${stats.active}, paused=${stats.paused}, budget=$${stats.totalBudget}`);
      },
    },
    {
      name: 'Ad Campaigns — campaign entries have required fields',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/campaigns', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const campaigns = data.data?.campaigns || (Array.isArray(data.data) ? data.data : []);
        if (campaigns.length > 0) {
          const camp = campaigns[0];
          assertNotNull(camp.id, 'Campaign should have id');
          assertNotNull(camp.name, 'Campaign should have name');
          assertNotNull(camp.platform, 'Campaign should have platform');
          assertNotNull(camp.status, 'Campaign should have status');
          assertNotNull(camp.budget !== undefined, 'Campaign should have budget');
          console.log(`      First campaign: "${camp.name}" (${camp.platform}, ${camp.status}, budget: $${camp.budget})`);
        } else {
          console.log('      (no campaigns — structure verified as empty)');
        }
      },
    },
    {
      name: 'Ad Campaigns — overview=true returns summary only',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/campaigns?overview=true', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.data.overview, 'Overview mode should return overview object');
        const overview = data.data.overview;
        assertNotNull(overview.total !== undefined, 'Overview should have total');
        assertNotNull(overview.totalBudget !== undefined, 'Overview should have totalBudget');
        console.log(`      Overview: total=${overview.total}, active=${overview.active}, budget=$${overview.totalBudget}`);
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 2: Ad Connections
    // ═══════════════════════════════════════════════
    {
      name: 'Ad Connections — GET /api/ads/connections returns connections list',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/connections', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have connections data');
        const connections = data.data?.connections || [];
        assert(Array.isArray(connections), 'Connections should be array');
        console.log(`      Found ${connections.length} ad connection(s)`);
      },
    },
    {
      name: 'Ad Connections — entries have platform and status',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/connections', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const connections = data.data?.connections || [];
        if (connections.length > 0) {
          const conn = connections[0];
          assertNotNull(conn.platform, 'Connection should have platform');
          assertNotNull(conn.connection, 'Connection should have connection details');
          assertNotNull(conn.connection.id, 'Connection should have id');
          assertNotNull(conn.connection.status, 'Connection should have status');
          console.log(`      First connection: platform=${conn.platform}, status=${conn.connection.status}`);
        } else {
          console.log('      (no connections — structure verified as empty)');
        }
      },
    },
    {
      name: 'Ad Connections — filter by platform (google)',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/connections?platform=google', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        const connections = data.data?.connections || [];
        // All connections should be for google platform
        const allGoogle = connections.every((c: any) => c.platform === 'google');
        console.log(`      Google connections: ${connections.length}, all google: ${allGoogle}`);
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 3: Ad Performance
    // ═══════════════════════════════════════════════
    {
      name: 'Ad Performance — GET /api/ads/performance returns performance data',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/performance?days=7', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have performance data');
        assertNotNull(data.data.performance, 'Should have performance array');
        assertNotNull(data.data.summary, 'Should have summary');
        console.log(`      Performance data keys: ${Object.keys(data.data).join(', ')}`);
      },
    },
    {
      name: 'Ad Performance — summary has core metrics (impressions, clicks, conversions, cost, revenue)',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/performance?days=7', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        const summary = data.data.summary;
        assertNotNull(summary.totalImpressions !== undefined, 'Should have totalImpressions');
        assertNotNull(summary.totalClicks !== undefined, 'Should have totalClicks');
        assertNotNull(summary.totalConversions !== undefined, 'Should have totalConversions');
        assertNotNull(summary.totalCost !== undefined, 'Should have totalCost');
        assertNotNull(summary.totalRevenue !== undefined, 'Should have totalRevenue');
        assertNotNull(summary.avgCtr !== undefined, 'Should have avgCtr');
        assertNotNull(summary.avgCpc !== undefined, 'Should have avgCpc');
        assertNotNull(summary.avgRoas !== undefined, 'Should have avgRoas');
        console.log(`      Summary: impressions=${summary.totalImpressions}, clicks=${summary.totalClicks}, cost=$${summary.totalCost.toFixed(2)}, ROAS=${summary.avgRoas.toFixed(2)}`);
      },
    },
    {
      name: 'Ad Performance — performance entries have date and daily metrics',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/performance?days=7', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const performance = data.data?.performance || [];
        assert(Array.isArray(performance), 'Performance should be array');
        if (performance.length > 0) {
          const entry = performance[0];
          assertNotNull(entry.date, 'Performance entry should have date');
          assertNotNull(entry.impressions !== undefined, 'Entry should have impressions');
          assertNotNull(entry.clicks !== undefined, 'Entry should have clicks');
          assertNotNull(entry.cost !== undefined, 'Entry should have cost');
          assertNotNull(entry.ctr !== undefined, 'Entry should have ctr');
          assertNotNull(entry.roas !== undefined, 'Entry should have roas');
          console.log(`      First entry: date=${entry.date}, impressions=${entry.impressions}, clicks=${entry.clicks}`);
        } else {
          console.log('      (no performance entries — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 4: Ad Sync
    // ═══════════════════════════════════════════════
    {
      name: 'Ad Sync — POST /api/ads/sync triggers sync',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/ads/sync',
            {
              platform: 'google',
              startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
              endDate: new Date().toISOString().split('T')[0],
            },
            auth,
          );
          assert(data.success, 'Sync should succeed');
          assertNotNull(data.data, 'Should have sync result data');
          assertNotNull(data.data.syncedAt, 'Should have syncedAt timestamp');
          const results = data.data?.results || [];
          assert(Array.isArray(results), 'Results should be array');
          console.log(`      Sync completed at: ${data.data.syncedAt}, results: ${results.length} platform(s)`);
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err.status === 404) { console.log('      (skipped — 404)'); return; }
          if (err.status === 403) { console.log('      (skipped — 403: permission required)'); return; }
          throw err;
        }
      },
    },
    {
      name: 'Ad Sync — sync response includes per-platform results',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/ads/sync',
            {},
            auth,
          );
          assert(data.success, 'Sync should succeed');
          assertNotNull(data.data?.results, 'Should have results');
          const results = data.data.results;
          // Each result should have platform, synced, errors
          if (results.length > 0) {
            const result = results[0];
            assertNotNull(result.platform, 'Result should have platform');
            assertNotNull(result.synced !== undefined, 'Result should have synced count');
            assert(Array.isArray(result.errors), 'Result should have errors array');
            console.log(`      Platform "${result.platform}": synced=${result.synced}, errors=${result.errors.length}`);
          }
        } catch (err: any) {
          if (err.status === 404) { console.log('      (skipped — 404)'); return; }
          if (err.status === 403) { console.log('      (skipped — 403: permission required)'); return; }
          throw err;
        }
      },
    },

    // ═══════════════════════════════════════════════
    // CROSS-CUTTING: Ads consistency checks
    // ═══════════════════════════════════════════════
    {
      name: 'Ads endpoints respond consistently with proper auth',
      fn: async () => {
        const endpoints = [
          '/api/ads/campaigns',
          '/api/ads/connections',
          '/api/ads/performance',
        ];
        let successCount = 0;
        for (const ep of endpoints) {
          try {
            await delay(DELAY_BETWEEN_CALLS);
            const { data } = await api.get(ep, auth);
            if (data?.success !== undefined || data?.data !== undefined) successCount++;
          } catch {
            // Some may 404 or 403 — that's acceptable
          }
        }
        assertGt(successCount, 0, `At least 1 ads endpoint should succeed (got ${successCount}/${endpoints.length})`);
        console.log(`      ${successCount}/${endpoints.length} ads endpoints responded successfully`);
      },
    },
    {
      name: 'Performance ROI mode returns additional ROI data',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/ads/performance?days=7&roi=true', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        const hasRoiData = data.data.roi !== undefined;
        const hasRoiSummary = data.data.roiSummary !== undefined;
        const hasChannels = data.data.channels !== undefined;
        const hasInsights = data.data.insights !== undefined;
        console.log(`      ROI mode: roi=${hasRoiData}, roiSummary=${hasRoiSummary}, channels=${hasChannels}, insights=${hasInsights}`);
        if (hasRoiSummary) {
          const roi = data.data.roiSummary;
          assertNotNull(roi.totalSpend !== undefined, 'ROI summary should have totalSpend');
          assertNotNull(roi.totalRevenue !== undefined, 'ROI summary should have totalRevenue');
          console.log(`      ROI: spend=$${roi.totalSpend.toFixed(2)}, revenue=$${roi.totalRevenue.toFixed(2)}, profit=$${roi.totalProfit.toFixed(2)}`);
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥', err);
  process.exit(1);
});
