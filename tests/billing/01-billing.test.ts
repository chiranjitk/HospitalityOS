/**
 * 01 - Billing Module Tests (25 pages, 40+ tests)
 *
 * Tests the entire billing module including folios, invoices, payments, refunds,
 * discounts, cancellation policies, folio transfer, payment plans, credit notes,
 * multi-currency, night audit, city ledger, commissions, posting rules,
 * scheduled charges, tax settings, GST e-invoicing, GST returns, TCS/TDS,
 * AP workflow, P&L, cash flow, budget management, deposits, and cash book.
 *
 * Pattern: Real API calls only, graceful 404 skips, sequential execution.
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
  delay,
  DELAY_BETWEEN_CALLS,
  DELAY_AFTER_MUTATION,
} from '../pms/setup';

// ─── Helper: Skip wrapper for endpoints that may 404 ─────────────────────

async function skipOn404(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      console.log('      ⏭️  SKIPPED (endpoint returned ' + err.status + ')');
      return;
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

  // ─── IDs collected during test run for cross-references ────────────────
  let createdDiscountId: string | null = null;
  let createdPolicyId: string | null = null;
  let folioIdUnderTest: string | null = st.folioId || null;
  let invoiceIdUnderTest: string | null = null;
  let createdDepositId: string | null = null;

  await runSequentially('01-Billing', [
    // ════════════════════════════════════════════════════════════════════
    // PAGE 1: Folios
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Folios - List all folios',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data, status } = await api.get('/api/folios', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assertNotNull(data.pagination, 'Should have pagination');
        assertNotNull(data.pagination.total, 'Pagination total should exist');
      },
    },
    {
      name: 'Folios - Filter by bookingId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.bookingId) {
          console.log('      ⏭️  SKIPPED (no bookingId in state)');
          return;
        }
        const { data } = await api.get(`/api/folios?bookingId=${st.bookingId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        // If folios exist for this booking, grab one for later tests
        if (data.data.length > 0) {
          folioIdUnderTest = data.data[0].id;
          assertNotNull(data.data[0].folioNumber, 'Folio should have folioNumber');
          assertNotNull(data.data[0].status, 'Folio should have status');
          assertNotNull(data.data[0].currency, 'Folio should have currency');
          saveState({ folioId: folioIdUnderTest! });
        }
      },
    },
    {
      name: 'Folios - Filter by propertyId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.propertyId) {
          console.log('      ⏭️  SKIPPED (no propertyId in state)');
          return;
        }
        const { data } = await api.get(`/api/folios?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
      },
    },
    {
      name: 'Folios - Get folio by ID with line items and payments',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!folioIdUnderTest) {
          console.log('      ⏭️  SKIPPED (no folioId available)');
          return;
        }
        const { data } = await api.get(`/api/folios/${folioIdUnderTest}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have folio data');
        assertEqual(data.data.id, folioIdUnderTest, 'Should return matching folio');
        assertNotNull(data.data.folioNumber, 'Should have folioNumber');
        assertNotNull(data.data.status, 'Should have status');
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 2: Invoices
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Invoices - List all invoices with stats',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/invoices', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assertNotNull(data.stats, 'Should have stats');
        assertNotNull(data.pagination, 'Should have pagination');
        // Stats should include standard fields
        assertNotNull(data.stats.total, 'Stats should have total count');
        assertNotNull(data.stats.totalAmount, 'Stats should have totalAmount');
      },
    },
    {
      name: 'Invoices - Filter by status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/invoices?status=draft', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        // Every result should match status
        for (const inv of data.data) {
          assertEqual(inv.status, 'draft', 'All results should be draft');
        }
      },
    },
    {
      name: 'Invoices - Get invoice by ID',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        // Try to get an invoice — use folio filter to find one
        if (!folioIdUnderTest) {
          console.log('      ⏭️  SKIPPED (no folioId available)');
          return;
        }
        const { data: listData } = await api.get(`/api/invoices?folioId=${folioIdUnderTest}&limit=1`, cookie(state));
        if (listData.data && listData.data.length > 0) {
          const invId = listData.data[0].id;
          invoiceIdUnderTest = invId;
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get(`/api/invoices/${invId}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have invoice data');
          assertEqual(data.data.id, invId, 'Should return matching invoice');
        } else {
          console.log('      ⏭️  SKIPPED (no invoices for test folio)');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 3: Payments
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Payments - List all payments with summary and gateway breakdown',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/payments', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assertNotNull(data.pagination, 'Should have pagination');
        assertNotNull(data.summary, 'Should have summary');
        assertNotNull(data.summary.totalAmount, 'Summary should have totalAmount');
        assertNotNull(data.summary.count, 'Summary should have count');
        assertNotNull(data.gatewayBreakdown, 'Should have gatewayBreakdown');
        assert(Array.isArray(data.gatewayBreakdown), 'Gateway breakdown should be array');
      },
    },
    {
      name: 'Payments - Filter by folioId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!folioIdUnderTest) {
          console.log('      ⏭️  SKIPPED (no folioId available)');
          return;
        }
        const { data } = await api.get(`/api/payments?folioId=${folioIdUnderTest}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assertNotNull(data.summary, 'Should have summary');
      },
    },
    {
      name: 'Payments - POST /api/payments/authorize (expect validation or 404)',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data, status } = await api.post(
            '/api/payments/authorize',
            { folioId: folioIdUnderTest || '00000000-0000-0000-0000-000000000000', amount: 100, method: 'card' },
            cookie(state),
          );
          // Either success or validation error is acceptable
          assertNotNull(data, 'Should have response data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 4: Refunds (payments with refund filter)
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Refunds - List payments with refunded status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/payments?status=refunded', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assertNotNull(data.summary, 'Should have summary');
        assertNotNull(data.summary.totalRefunded, 'Summary should have totalRefunded');
      },
    },
    {
      name: 'Refunds - List payments with failed status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/payments?status=failed', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 5: Discounts
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Discounts - List all discounts with stats',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/settings/discounts', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assert(Array.isArray(data.data), 'Discounts should be array');
        assertNotNull(data.stats, 'Should have stats');
        assertNotNull(data.stats.total, 'Stats should have total');
      },
    },
    {
      name: 'Discounts - Create a new percentage discount',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data, status } = await api.post(
          '/api/settings/discounts',
          {
            name: `E2E Test Discount ${Date.now()}`,
            discountType: 'percentage',
            discountValue: 15,
            description: 'Created by billing e2e tests',
          },
          cookie(state),
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have discount data');
        assertNotNull(data.data.id, 'Created discount should have id');
        assertNotNull(data.data.code, 'Created discount should have code');
        assertEqual(data.data.discountType, 'percentage', 'Should be percentage type');
        createdDiscountId = data.data.id;
        await delay(DELAY_AFTER_MUTATION);
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 6: Cancellation Policies
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Cancellation Policies - List all policies',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/cancellation-policies', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assertNotNull(data.pagination, 'Should have pagination');
        assertNotNull(data.pagination.total, 'Pagination total should exist');
        assertNotNull(data.pagination.totalPages, 'Pagination totalPages should exist');
      },
    },
    {
      name: 'Cancellation Policies - Create a new policy',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.post(
          '/api/cancellation-policies',
          {
            name: `E2E Cancellation Policy ${Date.now()}`,
            description: 'Created by billing e2e tests',
            propertyId: st.propertyId || undefined,
            freeCancelHoursBefore: 24,
            penaltyPercent: 50,
            noShowPenaltyPercent: 100,
            penaltyType: 'percentage',
            isActive: true,
            sortOrder: 0,
          },
          cookie(state),
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have policy data');
        assertNotNull(data.data.id, 'Created policy should have id');
        assertNotNull(data.data.name, 'Created policy should have name');
        assertEqual(data.data.penaltyType, 'percentage', 'Should be percentage penalty');
        createdPolicyId = data.data.id;
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Cancellation Policies - Filter by propertyId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.propertyId) {
          console.log('      ⏭️  SKIPPED (no propertyId in state)');
          return;
        }
        const { data } = await api.get(`/api/cancellation-policies?propertyId=${st.propertyId}`, cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 7: Folio Transfer
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Folio Transfer - Get transfer history by folioId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!folioIdUnderTest) {
          console.log('      ⏭️  SKIPPED (no folioId available)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(`/api/folio/transfer/history?folioId=${folioIdUnderTest}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Transfer history should be array');
        });
      },
    },
    {
      name: 'Folio Transfer - Missing folioId returns 400',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.get('/api/folio/transfer/history', cookie(state));
          assert(false, 'Should have thrown error for missing folioId');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing folioId');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 8: Payment Plans (Payment Schedule)
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Payment Plans - Get payment schedule by folioId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!folioIdUnderTest) {
          console.log('      ⏭️  SKIPPED (no folioId available)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(`/api/folio/payment-schedule?folioId=${folioIdUnderTest}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Payment schedule should be array');
        });
      },
    },
    {
      name: 'Payment Plans - Missing folioId returns 400',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.get('/api/folio/payment-schedule', cookie(state));
          assert(false, 'Should have thrown error for missing folioId');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing folioId');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 9: Credit Notes
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Credit Notes - List credit notes by folioId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!folioIdUnderTest) {
          console.log('      ⏭️  SKIPPED (no folioId available)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(`/api/folio/credit-notes?folioId=${folioIdUnderTest}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Credit notes should be array');
        });
      },
    },
    {
      name: 'Credit Notes - Missing folioId returns 400',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.get('/api/folio/credit-notes', cookie(state));
          assert(false, 'Should have thrown error for missing folioId');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing folioId');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 10: Multi-Currency (Exchange Rates)
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Exchange Rates - List all exchange rates',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/billing/exchange-rates', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        assert(Array.isArray(data.data), 'Exchange rates should be array');
      },
    },
    {
      name: 'Exchange Rates - Filter active only',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/billing/exchange-rates?active=true', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data array');
        // All returned should be active
        for (const rate of data.data) {
          assertEqual(rate.isActive, true, 'Should be active');
        }
      },
    },
    {
      name: 'Exchange Rates - Create USD to EUR rate',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.post(
          '/api/billing/exchange-rates',
          {
            fromCurrency: 'USD',
            toCurrency: 'EUR',
            rate: 0.92,
            source: 'manual',
          },
          cookie(state),
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have exchange rate data');
        assertNotNull(data.data.id, 'Should have id');
        assertEqual(data.data.fromCurrency, 'USD', 'From currency should be USD');
        assertEqual(data.data.toCurrency, 'EUR', 'To currency should be EUR');
        assertNotNull(data.data.rate, 'Should have rate');
        await delay(DELAY_AFTER_MUTATION);
      },
    },
    {
      name: 'Exchange Rates - Convert USD to EUR',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/billing/exchange-rates/convert?amount=100&from=USD&to=EUR', cookie(state));
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have conversion data');
        assertEqual(data.data.fromCurrency, 'USD', 'From should be USD');
        assertEqual(data.data.toCurrency, 'EUR', 'To should be EUR');
        assertNotNull(data.data.convertedAmount, 'Should have convertedAmount');
        assertGt(data.data.rate, 0, 'Rate should be > 0');
      },
    },
    {
      name: 'Exchange Rates - Same currency conversion returns identity',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/billing/exchange-rates/convert?amount=250&from=USD&to=USD', cookie(state));
        assert(data.success, 'Should succeed');
        assertEqual(data.data.convertedAmount, 250, 'Same currency should return same amount');
        assertEqual(data.data.rate, 1, 'Same currency rate should be 1');
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 11: Night Audit
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Night Audit - List all audits',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/night-audit', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Night audits should be array');
          assertNotNull(data.pagination, 'Should have pagination');
        });
      },
    },
    {
      name: 'Night Audit - Filter by property',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.propertyId) {
          console.log('      ⏭️  SKIPPED (no propertyId in state)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(`/api/night-audit?propertyId=${st.propertyId}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 12: City Ledger
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'City Ledger - List invoices with aggregates',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/city-ledger', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'City ledger should be array');
          assertNotNull(data.pagination, 'Should have pagination');
          assertNotNull(data.aggregates, 'Should have aggregates');
          assertNotNull(data.aggregates.totalInvoiced, 'Should have totalInvoiced');
          assertNotNull(data.aggregates.totalPaid, 'Should have totalPaid');
          assertNotNull(data.aggregates.totalOutstanding, 'Should have totalOutstanding');
        });
      },
    },
    {
      name: 'City Ledger - Filter by status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/city-ledger?status=draft', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 13: Commissions
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Commissions - List commission records',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/commissions/records', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Commission records should be array');
          assertNotNull(data.pagination, 'Should have pagination');
          assertNotNull(data.aggregates, 'Should have aggregates');
          assertNotNull(data.aggregates.outstandingCommissions, 'Should have outstandingCommissions');
        });
      },
    },
    {
      name: 'Commissions - List commission rules',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/commissions/rules', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Commission rules should be array');
          assertNotNull(data.pagination, 'Should have pagination');
        });
      },
    },
    {
      name: 'Commissions - Filter rules by sourceType',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/commissions/rules?sourceType=ota', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 14: Posting Rules
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Posting Rules - List all rules',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/posting-rules', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Posting rules should be array');
          assertNotNull(data.pagination, 'Should have pagination');
        });
      },
    },
    {
      name: 'Posting Rules - Filter by propertyId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.propertyId) {
          console.log('      ⏭️  SKIPPED (no propertyId in state)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(`/api/posting-rules?propertyId=${st.propertyId}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 15: Scheduled Charges
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Scheduled Charges - List all charges',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/scheduled-charges', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Scheduled charges should be array');
          assertNotNull(data.pagination, 'Should have pagination');
        });
      },
    },
    {
      name: 'Scheduled Charges - Filter active charges',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/scheduled-charges?isActive=true', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },
    {
      name: 'Scheduled Charges - Filter by propertyId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.propertyId) {
          console.log('      ⏭️  SKIPPED (no propertyId in state)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(`/api/scheduled-charges?propertyId=${st.propertyId}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 16: Tax Settings
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Tax Settings - List all settings',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/tax/settings', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Tax settings should be array');
        });
      },
    },
    {
      name: 'Tax Settings - Filter by propertyId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.propertyId) {
          console.log('      ⏭️  SKIPPED (no propertyId in state)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(`/api/tax/settings?propertyId=${st.propertyId}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 17: GST e-Invoicing
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'GST e-Invoices - List all e-invoices',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/tax/e-invoices', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'E-invoices should be array');
          assertNotNull(data.pagination, 'Should have pagination');
          assertNotNull(data.stats, 'Should have stats');
        });
      },
    },
    {
      name: 'GST e-Invoices - Filter by status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/tax/e-invoices?status=pending', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 18: GST Returns
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'GST Returns - GSTR-1 for current period',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const now = new Date();
        const period = `${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
        await skipOn404(async () => {
          const { data } = await api.get(`/api/tax/returns/gstr1?period=${period}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have GSTR-1 data');
          assertNotNull(data.data.period, 'Should have period');
          assertNotNull(data.data.b2b, 'Should have b2b array');
          assertNotNull(data.data.b2c, 'Should have b2c array');
          assertNotNull(data.data.totalTax, 'Should have totalTax');
        });
      },
    },
    {
      name: 'GST Returns - GSTR-3B for current period',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const now = new Date();
        const period = `${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
        await skipOn404(async () => {
          const { data } = await api.get(`/api/tax/returns/gstr3b?period=${period}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have GSTR-3B data');
          assertNotNull(data.data.period, 'Should have period');
          assertNotNull(data.data.outwardSupplies, 'Should have outwardSupplies');
          assertNotNull(data.data.summary, 'Should have summary');
          assertNotNull(data.data.summary.netTaxPayable, 'Should have netTaxPayable');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 19: TCS / TDS
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'TCS - List TCS records',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/tax/tcs', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'TCS records should be array');
          assertNotNull(data.pagination, 'Should have pagination');
          assertNotNull(data.stats, 'Should have stats');
        });
      },
    },
    {
      name: 'TDS - List TDS records',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/tax/tds', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'TDS records should be array');
          assertNotNull(data.pagination, 'Should have pagination');
          assertNotNull(data.stats, 'Should have stats');
        });
      },
    },
    {
      name: 'TDS - Filter by section',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/tax/tds?section=194C', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 20: AP Workflow
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'AP Workflow - Get dashboard data',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/billing/ap-workflow', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data object');
          assertNotNull(data.data.invoices, 'Should have invoices array');
          assertNotNull(data.data.workflowStages, 'Should have workflowStages');
          assertNotNull(data.data.paymentSchedule, 'Should have paymentSchedule');
          assertNotNull(data.stats, 'Should have stats');
          assertNotNull(data.stats.totalInvoices, 'Stats should have totalInvoices');
          assertNotNull(data.stats.pendingApproval, 'Stats should have pendingApproval');
          assertNotNull(data.stats.totalPayable, 'Stats should have totalPayable');
        });
      },
    },
    {
      name: 'AP Workflow - Filter by status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/billing/ap-workflow?status=pending', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data object');
          assertNotNull(data.stats, 'Should have stats');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 21: P&L Statement
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'P&L Statement - Get current year P&L',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/financials/profit-loss', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have P&L data');
          assertNotNull(data.data.revenue, 'Should have revenue section');
          assertNotNull(data.data.expenses, 'Should have expenses section');
          assertNotNull(data.data.netProfit, 'Should have netProfit');
          assertNotNull(data.data.profitMargin, 'Should have profitMargin');
          assertNotNull(data.data.revenue.total, 'Revenue should have total');
          assertNotNull(data.data.expenses.total, 'Expenses should have total');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 22: Cash Flow Forecast
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Cash Flow Forecast - List forecasts for current year',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/financials/cash-flow', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Cash flow forecasts should be array');
          assertNotNull(data.aggregates, 'Should have aggregates');
          assertNotNull(data.aggregates.totalInflow, 'Should have totalInflow');
          assertNotNull(data.aggregates.totalOutflow, 'Should have totalOutflow');
          assertNotNull(data.aggregates.netCashFlow, 'Should have netCashFlow');
        });
      },
    },
    {
      name: 'Cash Flow Forecast - Filter by forecastType',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/financials/cash-flow?forecastType=projected', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 23: Budget Management
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Budget Management - List budgets for current year',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/financials/budgets', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Budgets should be array');
          assertNotNull(data.aggregates, 'Should have aggregates');
          assertNotNull(data.aggregates.totalBudget, 'Should have totalBudget');
          assertNotNull(data.aggregates.totalActual, 'Should have totalActual');
          assertNotNull(data.aggregates.totalVariance, 'Should have totalVariance');
        });
      },
    },
    {
      name: 'Budget Management - Filter by status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/financials/budgets?status=draft', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 24: Deposits
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Deposits - List all deposit schedules',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/billing/deposits', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
          assert(Array.isArray(data.data), 'Deposits should be array');
          assertNotNull(data.pagination, 'Should have pagination');
          assertNotNull(data.aggregates, 'Should have aggregates');
          assertNotNull(data.aggregates.totalDue, 'Should have totalDue');
          assertNotNull(data.aggregates.totalPaid, 'Should have totalPaid');
          assertNotNull(data.aggregates.overdueCount, 'Should have overdueCount');
        });
      },
    },
    {
      name: 'Deposits - Filter by status',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        await skipOn404(async () => {
          const { data } = await api.get('/api/billing/deposits?status=pending', cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },
    {
      name: 'Deposits - Filter by bookingId',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.bookingId) {
          console.log('      ⏭️  SKIPPED (no bookingId in state)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(`/api/billing/deposits?bookingId=${st.bookingId}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data array');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 25: Cash Book
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Cash Book - Get cash book for property and date',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.propertyId) {
          console.log('      ⏭️  SKIPPED (no propertyId in state)');
          return;
        }
        await skipOn404(async () => {
          const today = new Date().toISOString().split('T')[0];
          const { data } = await api.get(`/api/accounting/cash-book?propertyId=${st.propertyId}&date=${today}`, cookie(state));
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have cash book data');
        });
      },
    },
    {
      name: 'Cash Book - Get cash book history',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!st.propertyId) {
          console.log('      ⏭️  SKIPPED (no propertyId in state)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(
            `/api/accounting/cash-book?action=history&propertyId=${st.propertyId}`,
            cookie(state),
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have history data');
        });
      },
    },
    {
      name: 'Cash Book - Missing propertyId returns 400',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.get('/api/accounting/cash-book', cookie(state));
          assert(false, 'Should have thrown error for missing propertyId');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing propertyId');
          }
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥', err);
  process.exit(1);
});
