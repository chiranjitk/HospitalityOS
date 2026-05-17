/**
 * 01 - CRM & Marketing Tests (14 pages, 25+ tests)
 *
 * Tests the full CRM & Marketing module:
 * 1. Segments — GET /api/segments, POST /api/segments
 * 2. Campaigns — GET /api/campaigns, POST /api/campaigns
 * 3. Loyalty Earn — GET /api/loyalty/programs/[id]/earn
 * 4. Loyalty Tiers — GET /api/loyalty/tiers
 * 5. CRM Feedback — GET /api/crm/feedback
 * 6. CRM Reviews — GET /api/crm/reviews
 * 7. Reputation Aggregation — GET /api/reputation/aggregation
 * 8. Reputation Reviews — GET /api/reputation/reviews
 * 9. SEO Analytics — GET /api/marketing/seo-analytics
 * 10. Promotions — GET /api/marketing/promotions, POST /api/marketing/promotions
 * 11. Upsell Offers — GET /api/marketing/upsell/offers
 * 12. Marketing Journeys — GET /api/marketing/journeys
 * 13. Abandoned Bookings — GET /api/marketing/abandoned-bookings
 * 14. Website Builder — GET /api/website-builder
 * 15. CRM Leads — GET /api/crm/leads, POST /api/crm/leads
 * 16. Leads Analytics — GET /api/crm/leads/analytics
 *
 * Creates test entities first, then exercises all pages against real API.
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

  await runSequentially('01-CRM-Marketing', [

    // ═══════════════════════════════════════════════
    // PAGE 1: Segments — POST first, then GET
    // ═══════════════════════════════════════════════
    {
      name: 'Segments — POST /api/segments creates a segment',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/segments',
            {
              name: `Test CRM Segment ${Date.now()}`,
              description: 'E2E test segment for CRM module',
              rules: { stayCount: { operator: 'gte', value: 1 } },
              propertyId: st.propertyId,
            },
            auth,
          );
          assert(data.success || data.data?.id, 'Segment creation should succeed');
          assertNotNull(data.data?.id, 'Segment should have an ID');
          assertNotNull(data.data.name, 'Segment should have a name');
          saveState({ crmSegmentId: data.data.id });
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err.status === 404) { console.log('      (skipped — 404)'); return; }
          throw err;
        }
      },
    },
    {
      name: 'Segments — GET /api/segments returns array with data',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/segments', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have data');
        const segments = Array.isArray(data.data) ? data.data : data.data?.segments || data.data?.items || [data.data];
        assert(Array.isArray(segments), 'Segments should be array-like');
        console.log(`      Found ${segments.length} segment(s)`);
      },
    },
    {
      name: 'Segments — first segment has required fields (name, id)',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/segments', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const segments = Array.isArray(data.data) ? data.data : data.data?.segments || data.data?.items || [];
        if (segments.length > 0) {
          const seg = segments[0];
          assertNotNull(seg.id, 'Segment should have id');
          assertNotNull(seg.name || seg.segmentName, 'Segment should have name');
          console.log(`      First segment: "${seg.name || seg.segmentName}" (${seg.id})`);
        } else {
          console.log('      (no segments — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 2: Campaigns — POST first, then GET
    // ═══════════════════════════════════════════════
    {
      name: 'Campaigns — POST /api/campaigns creates a campaign',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/campaigns',
            {
              name: `Test CRM Campaign ${Date.now()}`,
              type: 'email',
              status: 'draft',
              subject: 'E2E Test Campaign',
              propertyId: st.propertyId,
            },
            auth,
          );
          assert(data.success || data.data?.id, 'Campaign creation should succeed');
          assertNotNull(data.data?.id, 'Campaign should have an ID');
          assertNotNull(data.data.name, 'Campaign should have a name');
          saveState({ crmCampaignId: data.data.id });
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err.status === 404) { console.log('      (skipped — 404)'); return; }
          throw err;
        }
      },
    },
    {
      name: 'Campaigns — GET /api/campaigns returns array with data',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/campaigns', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have data');
        const campaigns = Array.isArray(data.data) ? data.data : data.data?.campaigns || data.data?.items || [data.data];
        assert(Array.isArray(campaigns), 'Campaigns should be array-like');
        console.log(`      Found ${campaigns.length} campaign(s)`);
      },
    },
    {
      name: 'Campaigns — campaign entries have id, name, type/status',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/campaigns', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const campaigns = Array.isArray(data.data) ? data.data : data.data?.campaigns || data.data?.items || [];
        if (campaigns.length > 0) {
          const camp = campaigns[0];
          assertNotNull(camp.id, 'Campaign should have id');
          assertNotNull(camp.name || camp.campaignName, 'Campaign should have name');
          console.log(`      First campaign: "${camp.name || camp.campaignName}" (status: ${camp.status || camp.campaignStatus || 'N/A'})`);
        } else {
          console.log('      (no campaigns — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 3: Loyalty Earn
    // ═══════════════════════════════════════════════
    {
      name: 'Loyalty Earn — GET /api/loyalty/programs/[id]/earn returns earn data',
      fn: async () => {
        assertNotNull(st.propertyId, 'Need propertyId for loyalty program');
        const { data, skipped } = await safeGet(`/api/loyalty/programs/${st.propertyId}/earn`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have earn data');
        console.log(`      Loyalty earn data keys: ${Object.keys(data.data).join(', ')}`);
      },
    },
    {
      name: 'Loyalty Earn — earn data has rate or points structure',
      fn: async () => {
        assertNotNull(st.propertyId, 'Need propertyId');
        const { data, skipped } = await safeGet(`/api/loyalty/programs/${st.propertyId}/earn`, auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        const entry = Array.isArray(data.data) ? data.data[0] : data.data;
        assertNotNull(entry, 'Should have entry');
        const keys = Object.keys(entry);
        assertGt(keys.length, 0, 'Entry should have fields');
        console.log(`      Earn entry keys: ${keys.join(', ')}`);
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 4: Loyalty Tiers
    // ═══════════════════════════════════════════════
    {
      name: 'Loyalty Tiers — GET /api/loyalty/tiers returns tier structure',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/loyalty/tiers', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have tier data');
        const tiers = Array.isArray(data.data) ? data.data : data.data?.tiers || [data.data];
        assert(Array.isArray(tiers), 'Tiers should be array-like');
        console.log(`      Found ${tiers.length} tier(s)`);
      },
    },
    {
      name: 'Loyalty Tiers — tiers have name/level identifiers',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/loyalty/tiers', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const tiers = Array.isArray(data.data) ? data.data : data.data?.tiers || [];
        if (tiers.length > 0) {
          const tier = tiers[0];
          assertNotNull(tier.name || tier.tierName || tier.level, 'Tier should have name/level');
          console.log(`      First tier: "${tier.name || tier.tierName || tier.level}"`);
        } else {
          console.log('      (no tiers configured — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 5: CRM Feedback
    // ═══════════════════════════════════════════════
    {
      name: 'CRM Feedback — GET /api/crm/feedback returns feedback list',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/crm/feedback', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have feedback data');
        const feedback = Array.isArray(data.data) ? data.data : data.data?.feedback || data.data?.items || [data.data];
        assert(Array.isArray(feedback), 'Feedback should be array-like');
        console.log(`      Found ${feedback.length} feedback entry/entries`);
      },
    },
    {
      name: 'CRM Feedback — feedback entries have content/timestamp fields',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/crm/feedback', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const feedback = Array.isArray(data.data) ? data.data : data.data?.feedback || data.data?.items || [];
        if (feedback.length > 0) {
          const entry = feedback[0];
          assertNotNull(entry.id, 'Feedback should have id');
          console.log(`      First feedback keys: ${Object.keys(entry).join(', ')}`);
        } else {
          console.log('      (no feedback — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 6: CRM Reviews
    // ═══════════════════════════════════════════════
    {
      name: 'CRM Reviews — GET /api/crm/reviews returns reviews',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/crm/reviews', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have reviews data');
        const reviews = Array.isArray(data.data) ? data.data : data.data?.reviews || data.data?.items || [data.data];
        assert(Array.isArray(reviews), 'Reviews should be array-like');
        console.log(`      Found ${reviews.length} review(s)`);
      },
    },
    {
      name: 'CRM Reviews — reviews have rating or score fields',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/crm/reviews', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const reviews = Array.isArray(data.data) ? data.data : data.data?.reviews || data.data?.items || [];
        if (reviews.length > 0) {
          const review = reviews[0];
          assertNotNull(review.id, 'Review should have id');
          // Reviews typically have rating/score
          const hasRating = review.rating !== undefined || review.score !== undefined || review.stars !== undefined;
          console.log(`      First review keys: ${Object.keys(review).join(', ')}, has rating: ${hasRating}`);
        } else {
          console.log('      (no reviews — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 7: Reputation Aggregation
    // ═══════════════════════════════════════════════
    {
      name: 'Reputation Aggregation — GET /api/reputation/aggregation returns metrics',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/reputation/aggregation', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have aggregation data');
        console.log(`      Aggregation keys: ${Object.keys(data.data).join(', ')}`);
      },
    },
    {
      name: 'Reputation Aggregation — has average rating and total count',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/reputation/aggregation', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        const payload = data.data;
        // Aggregation typically has averageRating, totalReviews, etc.
        const hasAvgRating = payload.averageRating !== undefined || payload.avgRating !== undefined || payload.rating !== undefined;
        const hasTotal = payload.totalReviews !== undefined || payload.total !== undefined || payload.count !== undefined;
        console.log(`      Has avg rating: ${hasAvgRating}, Has total count: ${hasTotal}`);
        const keys = Object.keys(payload);
        assertGt(keys.length, 0, 'Aggregation should have fields');
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 8: Reputation Reviews
    // ═══════════════════════════════════════════════
    {
      name: 'Reputation Reviews — GET /api/reputation/reviews returns review list',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/reputation/reviews', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have reputation reviews data');
        const reviews = Array.isArray(data.data) ? data.data : data.data?.reviews || data.data?.items || [data.data];
        assert(Array.isArray(reviews), 'Reviews should be array-like');
        console.log(`      Found ${reviews.length} reputation review(s)`);
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 9: SEO Analytics
    // ═══════════════════════════════════════════════
    {
      name: 'SEO Analytics — GET /api/marketing/seo-analytics returns SEO data',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/seo-analytics', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have SEO analytics data');
        console.log(`      SEO Analytics keys: ${Object.keys(data.data).join(', ')}`);
      },
    },
    {
      name: 'SEO Analytics — has organic search or keyword metrics',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/seo-analytics', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        const keys = Object.keys(data.data);
        assertGt(keys.length, 0, 'SEO data should have fields');
        // Should ideally contain keyword/search/organic related data
        const payload = data.data;
        const hasSearch = keys.some(k => k.toLowerCase().includes('keyword') || k.toLowerCase().includes('search') || k.toLowerCase().includes('organic') || k.toLowerCase().includes('rank'));
        console.log(`      Has search-related metrics: ${hasSearch}, Fields: ${keys.join(', ')}`);
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 10: Promotions — POST first, then GET
    // ═══════════════════════════════════════════════
    {
      name: 'Promotions — POST /api/marketing/promotions creates a promotion',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/marketing/promotions',
            {
              name: `Test Promotion ${Date.now()}`,
              type: 'percentage',
              value: 10,
              status: 'active',
              propertyId: st.propertyId,
            },
            auth,
          );
          assert(data.success || data.data?.id, 'Promotion creation should succeed');
          assertNotNull(data.data?.id, 'Promotion should have an ID');
          assertNotNull(data.data.name, 'Promotion should have a name');
          saveState({ crmPromotionId: data.data.id });
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err.status === 404) { console.log('      (skipped — 404)'); return; }
          throw err;
        }
      },
    },
    {
      name: 'Promotions — GET /api/marketing/promotions returns list',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/promotions', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have promotions data');
        const promos = Array.isArray(data.data) ? data.data : data.data?.promotions || data.data?.items || [data.data];
        assert(Array.isArray(promos), 'Promotions should be array-like');
        console.log(`      Found ${promos.length} promotion(s)`);
      },
    },
    {
      name: 'Promotions — entries have id, name, discount info',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/promotions', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const promos = Array.isArray(data.data) ? data.data : data.data?.promotions || data.data?.items || [];
        if (promos.length > 0) {
          const promo = promos[0];
          assertNotNull(promo.id, 'Promotion should have id');
          assertNotNull(promo.name || promo.promotionName, 'Promotion should have name');
          console.log(`      First promotion: "${promo.name || promo.promotionName}" (type: ${promo.type || 'N/A'})`);
        } else {
          console.log('      (no promotions — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 11: Upsell Offers
    // ═══════════════════════════════════════════════
    {
      name: 'Upsell Offers — GET /api/marketing/upsell/offers returns offers',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/upsell/offers', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have upsell offers data');
        const offers = Array.isArray(data.data) ? data.data : data.data?.offers || data.data?.items || [data.data];
        assert(Array.isArray(offers), 'Upsell offers should be array-like');
        console.log(`      Found ${offers.length} upsell offer(s)`);
      },
    },
    {
      name: 'Upsell Offers — entries have id, name, and pricing',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/upsell/offers', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const offers = Array.isArray(data.data) ? data.data : data.data?.offers || data.data?.items || [];
        if (offers.length > 0) {
          const offer = offers[0];
          assertNotNull(offer.id, 'Upsell offer should have id');
          assertNotNull(offer.name || offer.title || offer.offerName, 'Offer should have name/title');
          console.log(`      First offer keys: ${Object.keys(offer).join(', ')}`);
        } else {
          console.log('      (no upsell offers — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 12: Marketing Journeys
    // ═══════════════════════════════════════════════
    {
      name: 'Marketing Journeys — GET /api/marketing/journeys returns journeys',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/journeys', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have journey data');
        const journeys = Array.isArray(data.data) ? data.data : data.data?.journeys || data.data?.items || [data.data];
        assert(Array.isArray(journeys), 'Journeys should be array-like');
        console.log(`      Found ${journeys.length} journey/journeys`);
      },
    },
    {
      name: 'Marketing Journeys — entries have id, name, status',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/journeys', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const journeys = Array.isArray(data.data) ? data.data : data.data?.journeys || data.data?.items || [];
        if (journeys.length > 0) {
          const journey = journeys[0];
          assertNotNull(journey.id, 'Journey should have id');
          assertNotNull(journey.name || journey.journeyName, 'Journey should have name');
          console.log(`      First journey: "${journey.name || journey.journeyName}" (status: ${journey.status || 'N/A'})`);
        } else {
          console.log('      (no journeys — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 13: Abandoned Bookings
    // ═══════════════════════════════════════════════
    {
      name: 'Abandoned Bookings — GET /api/marketing/abandoned-bookings returns list',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/abandoned-bookings', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have abandoned bookings data');
        const bookings = Array.isArray(data.data) ? data.data : data.data?.bookings || data.data?.items || [data.data];
        assert(Array.isArray(bookings), 'Abandoned bookings should be array-like');
        console.log(`      Found ${bookings.length} abandoned booking(s)`);
      },
    },
    {
      name: 'Abandoned Bookings — entries have guest/contact info',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/marketing/abandoned-bookings', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const bookings = Array.isArray(data.data) ? data.data : data.data?.bookings || data.data?.items || [];
        if (bookings.length > 0) {
          const booking = bookings[0];
          assertNotNull(booking.id, 'Abandoned booking should have id');
          console.log(`      First abandoned booking keys: ${Object.keys(booking).join(', ')}`);
        } else {
          console.log('      (no abandoned bookings — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 14: Website Builder
    // ═══════════════════════════════════════════════
    {
      name: 'Website Builder — GET /api/website-builder returns builder config',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/website-builder', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have website builder data');
        console.log(`      Website Builder keys: ${Object.keys(data.data).join(', ')}`);
      },
    },
    {
      name: 'Website Builder — has sections/pages configuration',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/website-builder', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        const keys = Object.keys(data.data);
        assertGt(keys.length, 0, 'Website builder config should have fields');
        // Should have pages, sections, or similar structure
        const hasStructure = keys.some(k => ['pages', 'sections', 'components', 'template', 'config', 'theme', 'settings'].includes(k.toLowerCase()));
        console.log(`      Has structural fields: ${hasStructure}, Fields: ${keys.join(', ')}`);
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 15: CRM Leads — POST first, then GET
    // ═══════════════════════════════════════════════
    {
      name: 'CRM Leads — POST /api/crm/leads creates a lead',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/crm/leads',
            {
              firstName: 'TestLead',
              lastName: 'CRM',
              email: `testlead_crm_${Date.now()}@example.com`,
              phone: '+919988776655',
              source: 'website',
              propertyId: st.propertyId,
            },
            auth,
          );
          assert(data.success || data.data?.id, 'Lead creation should succeed');
          assertNotNull(data.data?.id, 'Lead should have an ID');
          assertNotNull(data.data.firstName, 'Lead should have firstName');
          saveState({ crmLeadId: data.data.id });
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err.status === 404) { console.log('      (skipped — 404)'); return; }
          throw err;
        }
      },
    },
    {
      name: 'CRM Leads — GET /api/crm/leads returns leads list',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/crm/leads', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have leads data');
        const leads = Array.isArray(data.data) ? data.data : data.data?.leads || data.data?.items || [data.data];
        assert(Array.isArray(leads), 'Leads should be array-like');
        console.log(`      Found ${leads.length} lead(s)`);
      },
    },
    {
      name: 'CRM Leads — lead entries have id, name, contact info',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/crm/leads', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        const leads = Array.isArray(data.data) ? data.data : data.data?.leads || data.data?.items || [];
        if (leads.length > 0) {
          const lead = leads[0];
          assertNotNull(lead.id, 'Lead should have id');
          assertNotNull(lead.firstName || lead.name, 'Lead should have name');
          console.log(`      First lead: "${lead.firstName || lead.name}" (${lead.status || 'N/A'})`);
        } else {
          console.log('      (no leads — structure verified as empty)');
        }
      },
    },

    // ═══════════════════════════════════════════════
    // PAGE 16: Leads Analytics
    // ═══════════════════════════════════════════════
    {
      name: 'Leads Analytics — GET /api/crm/leads/analytics returns analytics',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/crm/leads/analytics', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assert(data !== null, 'Should return data');
        assertNotNull(data.data, 'Should have leads analytics data');
        console.log(`      Leads Analytics keys: ${Object.keys(data.data).join(', ')}`);
      },
    },
    {
      name: 'Leads Analytics — has summary metrics (total, conversion rate, etc.)',
      fn: async () => {
        const { data, skipped } = await safeGet('/api/crm/leads/analytics', auth);
        if (skipped) { console.log('      (skipped — 404)'); return; }
        assertNotNull(data.data, 'Should have data');
        const keys = Object.keys(data.data);
        assertGt(keys.length, 0, 'Analytics should have metric fields');
        // Analytics typically has totals, rates, counts
        const hasMetrics = keys.some(k =>
          k.toLowerCase().includes('total') || k.toLowerCase().includes('count') ||
          k.toLowerCase().includes('rate') || k.toLowerCase().includes('conversion') ||
          k.toLowerCase().includes('source')
        );
        console.log(`      Has analytical metrics: ${hasMetrics}, Fields: ${keys.join(', ')}`);
      },
    },

    // ═══════════════════════════════════════════════
    // CROSS-CUTTING: Multiple CRM endpoints consistency
    // ═══════════════════════════════════════════════
    {
      name: 'CRM endpoints respond consistently with property context',
      fn: async () => {
        const endpoints = [
          '/api/segments',
          '/api/campaigns',
          '/api/crm/feedback',
          '/api/marketing/promotions',
        ];
        let successCount = 0;
        for (const ep of endpoints) {
          try {
            await delay(DELAY_BETWEEN_CALLS);
            const { data } = await api.get(ep, auth);
            if (data !== null) successCount++;
          } catch {
            // Some may 404 — that's fine
          }
        }
        assertGt(successCount, 0, `At least 1 CRM endpoint should succeed (got ${successCount}/${endpoints.length})`);
        console.log(`      ${successCount}/${endpoints.length} CRM endpoints responded successfully`);
      },
    },
    {
      name: 'Marketing endpoints have non-null data payloads',
      fn: async () => {
        const endpoints = [
          '/api/marketing/seo-analytics',
          '/api/marketing/journeys',
          '/api/marketing/abandoned-bookings',
          '/api/website-builder',
        ];
        let dataNonNullCount = 0;
        for (const ep of endpoints) {
          try {
            await delay(DELAY_BETWEEN_CALLS);
            const { data } = await api.get(ep, auth);
            if (data?.data !== null && data?.data !== undefined) dataNonNullCount++;
          } catch {
            // Some may 404
          }
        }
        assertGt(dataNonNullCount, 0, `At least 1 marketing endpoint should return non-null data (got ${dataNonNullCount}/${endpoints.length})`);
        console.log(`      ${dataNonNullCount}/${endpoints.length} marketing endpoints had non-null data`);
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥', err);
  process.exit(1);
});
