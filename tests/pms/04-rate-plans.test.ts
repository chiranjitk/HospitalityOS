/**
 * 04 - Rate Plans CRUD Tests
 *
 * Tests rate plan creation, derivation, promotions, price overrides, and bulk rates.
 */

import {
  authenticate,
  runSequentially,
  api,
  cookie,
  loadState,
  saveState,
  addDays,
  formatDate,
  assert,
  assertEqual,
  assertNotNull,
  assertGt,
  assertStatus,
  ApiError,
} from './setup';

async function main() {
  const state = await authenticate();
  const ts = Date.now();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const promoStart = addDays(today, 5);
  const promoEnd = addDays(today, 15);
  const overrideDate1 = addDays(today, 20);
  const overrideDate2 = addDays(today, 21);
  const overrideDate3 = addDays(today, 22);

  await runSequentially('04-RatePlans-CRUD', [
    {
      name: 'Create BAR rate plan with all fields',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/rate-plans',
          {
            roomTypeId: state.roomType1Id,
            name: 'Best Available Rate',
            code: ts + '-BAR',
            description: 'Best available rate for deluxe rooms',
            basePrice: 5000,
            currency: 'INR',
            mealPlan: 'room_only',
            minStay: 1,
            maxStay: 30,
            advanceBookingDays: 90,
            cancellationPolicy: 'free_cancel_24h',
            cancellationHours: 24,
            status: 'active',
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create BAR plan');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        assertEqual(data.data.code, ts + '-BAR');
        assertEqual(data.data.basePrice, 5000);
        assertEqual(data.data.mealPlan, 'room_only');
        assertEqual(data.data.minStay, 1);

        saveState({ ratePlanBarId: data.data.id });
      },
    },
    {
      name: 'Create derived rate plan (percentage from BAR)',
      fn: async () => {
        const st = loadState();
        const { data } = await api.post(
          '/api/rate-plans',
          {
            roomTypeId: state.roomType1Id,
            name: 'Corporate Rate',
            code: ts + '-CORP',
            basePrice: 5000, // Will be auto-calculated
            currency: 'INR',
            mealPlan: 'breakfast',
            derivedFromId: st.ratePlanBarId,
            derivationType: 'percentage',
            derivationValue: -15, // 15% discount
            status: 'active',
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        // 5000 * (1 + (-15/100)) = 5000 * 0.85 = 4250
        assertEqual(data.data.basePrice, 4250, 'Derived price should be 15% off BAR');
        assertNotNull(data.data.derivedFromId, 'Should reference parent plan');
        assertEqual(data.data.derivedFromId, st.ratePlanBarId);

        saveState({ ratePlanCorpId: data.data.id });
      },
    },
    {
      name: 'Create promotional rate plan with promoCode + dates',
      fn: async () => {
        const { data } = await api.post(
          '/api/rate-plans',
          {
            roomTypeId: state.roomType2Id,
            name: 'Summer Promo',
            code: ts + '-SUMMER',
            basePrice: 10000,
            currency: 'INR',
            mealPlan: 'half_board',
            discountPercent: 25,
            promoCode: ts + '-SUMMER2025',
            promoStart: promoStart.toISOString(),
            promoEnd: promoEnd.toISOString(),
            status: 'active',
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        assertEqual(data.data.discountPercent, 25);
        assertEqual(data.data.promoCode, ts + '-SUMMER2025');

        saveState({ ratePlanOtaId: data.data.id });
      },
    },
    {
      name: 'Verify rate plans appear in list with promo status',
      fn: async () => {
        const { data } = await api.get(`/api/rate-plans?roomTypeId=${state.roomType1Id}`, cookie(state));
        assert(data.success, 'List should succeed');
        assertGt(data.data.length, 0, 'Should have rate plans');
        assert(data.stats.totalPlans > 0, 'Stats should show total');
      },
    },
    {
      name: 'Update rate plan',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put('/api/rate-plans', {
          id: st.ratePlanBarId,
          name: 'BAR - Updated',
          basePrice: 5500,
        }, cookie(state));
        assert(data.success, 'Should succeed');
        assertEqual(data.data.name, 'BAR - Updated');
        assertEqual(data.data.basePrice, 5500);
      },
    },
    {
      name: 'Create price overrides for specific dates',
      fn: async () => {
        const ids: string[] = [];

        // Override 1
        const st = loadState();
        const o1 = await api.post(
          '/api/price-overrides',
          {
            ratePlanId: st.ratePlanBarId,
            date: overrideDate1.toISOString().split('T')[0],
            price: 7000,
            reason: 'Peak season',
            closedToArrival: false,
            closedToDeparture: false,
          },
          cookie(state)
        );
        assert(o1.data.success);
        ids.push(o1.data.data.id);

        // Override 2
        const o2 = await api.post(
          '/api/price-overrides',
          {
            ratePlanId: st.ratePlanBarId,
            date: overrideDate2.toISOString().split('T')[0],
            price: 7500,
          },
          cookie(state)
        );
        assert(o2.data.success);
        ids.push(o2.data.data.id);

        // Override 3
        const o3 = await api.post(
          '/api/price-overrides',
          {
            ratePlanId: st.ratePlanBarId,
            date: overrideDate3.toISOString().split('T')[0],
            price: 6000,
            minStay: 2,
          },
          cookie(state)
        );
        assert(o3.data.success);
        ids.push(o3.data.data.id);

        saveState({ priceOverrideIds: ids });
      },
    },
    {
      name: 'Verify bulk rates endpoint returns date-by-date data',
      fn: async () => {
        const st2 = loadState();
        const { data } = await api.get(
          `/api/rate-plans/bulk-rates?roomTypeId=${state.roomType1Id}&startDate=${formatDate(overrideDate1)}&endDate=${formatDate(overrideDate3)}`,
          cookie(state)
        );
        assert(data.success, 'Bulk rates should succeed');
        assertNotNull(data.data.rates, 'Should have rates array');
        assertGt(data.data.rates.length, 0, 'Should have rate entries');

        // Verify override rates are present
        const overrideDate1Entry = data.data.rates.find(
          (r: any) => r.date === formatDate(overrideDate1) && r.overrideRate === 7000
        );
        assertNotNull(overrideDate1Entry, 'Override 1 should be present');
        assertEqual(overrideDate1Entry.overrideRate, 7000);

        const overrideDate3Entry = data.data.rates.find(
          (r: any) => r.date === formatDate(overrideDate3) && r.minStay === 2
        );
        assertNotNull(overrideDate3Entry, 'Override 3 with minStay should be present');
      },
    },
    {
      name: 'Test bulk rate update for date range',
      fn: async () => {
        const st = loadState();
        const newDate1 = addDays(overrideDate3, 1);
        const newDate2 = addDays(overrideDate3, 2);

        const rates: Record<string, number> = {};
        rates[formatDate(newDate1)] = 6200;
        rates[formatDate(newDate2)] = 6300;

        const { data } = await api.post(
          '/api/rate-plans/bulk-rates',
          {
            roomTypeId: state.roomType1Id,
            ratePlanId: st.ratePlanBarId,
            startDate: formatDate(newDate1),
            endDate: formatDate(newDate2),
            rates,
          },
          cookie(state)
        );
        assert(data.success, 'Bulk update should succeed');
        assertGt(data.data.created, 0, 'Should create overrides');
      },
    },
    {
      name: 'Cross-verify: Rate plans reference correct room type',
      fn: async () => {
        const { data } = await api.get(`/api/rate-plans?roomTypeId=${state.roomType1Id}`, cookie(state));
        assert(data.success);
        for (const plan of data.data) {
          assertEqual(plan.roomType.id, state.roomType1Id, 'All plans should reference room type 1');
        }

        const { data: data2 } = await api.get(
          `/api/rate-plans?roomTypeId=${state.roomType2Id}`,
          cookie(state)
        );
        assert(data2.success);
        for (const plan of data2.data) {
          assertEqual(plan.roomType.id, state.roomType2Id, 'All plans should reference room type 2');
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
