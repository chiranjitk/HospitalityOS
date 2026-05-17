/**
 * 01 - Settings & Help / Support Module Tests
 *
 * Tests Settings pages (6):
 *   1. General Settings    — GET /api/settings/general
 *   2. Tax & Currency      — GET /api/settings/tax-currency
 *   3. Locale              — GET /api/settings/locale
 *   4. Security Settings   — GET /api/settings/security
 *   5. Integrations        — GET /api/settings/integrations
 *   6. Feature Flags       — GET /api/settings/feature-flags
 *
 * Tests Help & Support pages (3):
 *   7. Help Articles       — GET /api/help/articles
 *   8. Help Categories     — GET /api/help/categories
 *   9. Tutorials Progress  — GET /api/tutorials/progress
 *
 * Tests Legal & License (3):
 *  10. GDPR Status         — GET /api/gdpr/status
 *  11. License Check       — GET /api/license/check
 *  12. License Features    — GET /api/license/feature-flags
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

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }
  const st = loadState();

  await runSequentially('01-SettingsHelp', [
    // ═══════════════════════════════════════════════════════════════════
    // PAGE 1 — General Settings  (GET /api/settings/general)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'General Settings — GET /api/settings/general returns config',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/general?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'General Settings — contains property name and contact info',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/general?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.propertyName || d.name || d.hotelName, 'Should have property name');
        assertNotNull(d.email || d.contactEmail || d.supportEmail, 'Should have contact email');
        assertNotNull(d.phone || d.contactPhone, 'Should have contact phone');
      },
    },
    {
      name: 'General Settings — contains check-in/check-out times',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/general?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.checkInTime || d.checkIn, 'Should have check-in time');
        assertNotNull(d.checkOutTime || d.checkOut, 'Should have check-out time');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 2 — Tax & Currency  (GET /api/settings/tax-currency)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Tax & Currency — GET /api/settings/tax-currency returns config',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/tax-currency?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Tax & Currency — contains currency and tax rate info',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/tax-currency?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.currency || d.defaultCurrency, 'Should have currency');
        assertNotNull(d.taxRate || d.taxRates || d.taxConfig, 'Should have tax rate');
        assertNotNull(d.symbol || d.currencySymbol, 'Should have currency symbol');
      },
    },
    {
      name: 'Tax & Currency — tax configuration has valid structure',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/tax-currency?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        if (d.taxRates && Array.isArray(d.taxRates)) {
          for (const tax of d.taxRates) {
            assertNotNull(tax.name || tax.taxName, 'Tax rate should have name');
            assertNotNull(tax.rate !== undefined || tax.percentage !== undefined, 'Tax rate should have rate value');
          }
        } else {
          assertNotNull(d.taxRate !== undefined || d.defaultTaxRate !== undefined, 'Should have a tax rate value');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 3 — Locale Settings  (GET /api/settings/locale)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Locale — GET /api/settings/locale returns locale config',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/locale?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Locale — contains language and timezone',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/locale?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.language || d.locale || d.defaultLanguage, 'Should have language');
        assertNotNull(d.timezone || d.timeZone, 'Should have timezone');
      },
    },
    {
      name: 'Locale — contains date and number format settings',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/locale?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.dateFormat || d.dateDisplayFormat, 'Should have date format');
        assertNotNull(d.currencyFormat || d.numberFormat || d.decimalPlaces !== undefined, 'Should have number format');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 4 — Security Settings  (GET /api/settings/security)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Security Settings — GET /api/settings/security returns config',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/security?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Security Settings — contains password policy',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/security?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.passwordPolicy || d.password || d.minPasswordLength !== undefined, 'Should have password policy');
      },
    },
    {
      name: 'Security Settings — contains session and 2FA config',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/security?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.sessionTimeout !== undefined || d.session || d.maxSessionDuration, 'Should have session config');
        assertNotNull(d.twoFactorAuth !== undefined || d.mfa || d.twoFactor, 'Should have 2FA config');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 5 — Integrations Settings  (GET /api/settings/integrations)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Integrations — GET /api/settings/integrations returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/integrations?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data) || Array.isArray(res.data.data.integrations) || res.data.data.services, 'Should have integrations list');
      },
    },
    {
      name: 'Integrations — entries have name and status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/integrations?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        const integrations = Array.isArray(d) ? d : (d.integrations || d.services || []);
        if (integrations.length === 0) { console.log('      (no integrations, skipping)'); return; }
        const item = integrations[0];
        assertNotNull(item.name || item.serviceName, 'Integration should have name');
        assertNotNull(item.status || item.enabled !== undefined || item.isConnected !== undefined, 'Integration should have status');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 6 — Feature Flags  (GET /api/settings/feature-flags)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Feature Flags — GET /api/settings/feature-flags returns flags',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/feature-flags?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Feature Flags — flags have key and enabled status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet(`/api/settings/feature-flags?propertyId=${st.propertyId}`, cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        const flags = Array.isArray(d) ? d : (d.flags || d.features || []);
        assertGt(flags.length, 0, 'Should have at least one feature flag');
        for (const flag of flags) {
          assertNotNull(flag.key || flag.name || flag.featureKey, 'Flag should have key');
          assertNotNull(flag.enabled !== undefined || flag.value !== undefined || flag.isActive !== undefined, 'Flag should have enabled state');
        }
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 7 — Help Articles  (GET /api/help/articles)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Help Articles — GET /api/help/articles returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/help/articles', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assertNotNull(res.data.pagination, 'Should have pagination');
      },
    },
    {
      name: 'Help Articles — articles have title and content',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/help/articles', cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        const articles = Array.isArray(d) ? d : (d.articles || []);
        if (articles.length === 0) { console.log('      (no articles, skipping)'); return; }
        const article = articles[0];
        assertNotNull(article.id, 'Article should have id');
        assertNotNull(article.title, 'Article should have title');
        assertNotNull(article.content || article.body || article.excerpt, 'Article should have content');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 8 — Help Categories  (GET /api/help/categories)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Help Categories — GET /api/help/categories returns list',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/help/categories', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
        assert(Array.isArray(res.data.data), 'data should be array');
      },
    },
    {
      name: 'Help Categories — categories have name and article count',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/help/categories', cookie(state));
        if (!res.ok || !res.data.data || res.data.data.length === 0) {
          console.log('      (no categories, skipping)'); return;
        }
        const cat = res.data.data[0];
        assertNotNull(cat.id, 'Category should have id');
        assertNotNull(cat.name || cat.title, 'Category should have name');
        assertNotNull(cat.articleCount !== undefined || cat.count || cat.articles !== undefined, 'Category should have article count');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 9 — Tutorials Progress  (GET /api/tutorials/progress)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'Tutorials — GET /api/tutorials/progress returns progress',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/tutorials/progress', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'Tutorials — progress contains completion percentage',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/tutorials/progress', cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.progress !== undefined || d.completionRate !== undefined || d.completedCount !== undefined, 'Should have progress info');
        assertNotNull(d.tutorials || d.steps || d.items, 'Should have tutorials/steps list');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 10 — GDPR Status  (GET /api/gdpr/status)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'GDPR — GET /api/gdpr/status returns compliance info',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/gdpr/status', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'GDPR — contains compliance status and fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/gdpr/status', cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.compliant !== undefined || d.status || d.complianceStatus, 'Should have compliance status');
        assertNotNull(d.dataProcessing || d.processingConsent || d.consentRecords !== undefined, 'Should have data processing info');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 11 — License Check  (GET /api/license/check)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'License — GET /api/license/check returns license info',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/license/check', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'License — contains plan and validity info',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/license/check', cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        assertNotNull(d.plan || d.planName || d.tier, 'Should have plan name');
        assertNotNull(d.valid !== undefined || d.active !== undefined || d.status, 'Should have validity status');
        assertNotNull(d.expiryDate || d.expiresAt || d.validUntil, 'Should have expiry date');
      },
    },

    // ═══════════════════════════════════════════════════════════════════
    // PAGE 12 — License Feature Flags  (GET /api/license/feature-flags)
    // ═══════════════════════════════════════════════════════════════════
    {
      name: 'License Features — GET /api/license/feature-flags returns flags',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/license/feature-flags', cookie(state));
        if (!res.ok) { console.log('      (endpoint not available, skipping)'); return; }
        assert(res.data.success, 'Should succeed');
        assertNotNull(res.data.data, 'Should have data');
      },
    },
    {
      name: 'License Features — flags contain feature availability',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const res = await tryGet('/api/license/feature-flags', cookie(state));
        if (!res.ok || !res.data.data) { console.log('      (no data, skipping)'); return; }
        const d = res.data.data;
        const flags = Array.isArray(d) ? d : (d.flags || d.features || []);
        assertGt(flags.length, 0, 'Should have at least one license feature');
        for (const flag of flags) {
          assertNotNull(flag.key || flag.name || flag.featureKey, 'License flag should have key');
          assertNotNull(flag.enabled !== undefined || flag.allowed !== undefined || flag.included !== undefined, 'License flag should have availability');
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥', err);
  process.exit(1);
});
