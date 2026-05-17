/**
 * 10 - Package Plans Tests
 *
 * Tests package plan creation with components, and seasonal rates.
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
} from './setup';

async function main() {
  const state = await authenticate();
  const ts = Date.now();
  const startDate = formatDate(addDays(new Date(), 30));
  const endDate = formatDate(addDays(new Date(), 90));

  await runSequentially('10-Packages', [
    {
      name: 'Create package plan with components',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/packages',
          {
            propertyId: state.propertyId,
            name: 'Honeymoon Special ' + ts,
            description: 'Romantic getaway package',
            baseRoomTypeId: state.roomType2Id,
            roomRateInclusive: true,
            startDate,
            endDate,
            minNights: 3,
            currency: 'INR',
            status: 'active',
            components: [
              {
                componentType: 'service',
                referenceName: 'Spa Treatment',
                includedQty: 2,
                unitCost: 2000,
                isIncluded: true,
                sortOrder: 1,
              },
              {
                componentType: 'dining',
                referenceName: 'Candlelight Dinner',
                includedQty: 1,
                unitCost: 3500,
                isIncluded: true,
                sortOrder: 2,
              },
              {
                componentType: 'experience',
                referenceName: 'Sunset Cruise',
                includedQty: 1,
                unitCost: 1500,
                isIncluded: true,
                sortOrder: 3,
              },
              {
                componentType: 'gift',
                referenceName: 'Welcome Fruit Basket',
                includedQty: 1,
                unitCost: 500,
                isIncluded: true,
                sortOrder: 0,
              },
            ],
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create package');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        assertEqual(data.data.name, 'Honeymoon Special ' + ts);
        assertEqual(data.data.baseRoomTypeId, state.roomType2Id);
        assertNotNull(data.data.components, 'Should have components');
        assertGt(data.data.components.length, 0, 'Should have at least 1 component');
        assertEqual(data.data.components.length, 4, 'Should have 4 components');

        // Verify total base price calculated from components
        const expectedPrice = 500 + 2000 + 3500 + 1500; // all included
        assertEqual(data.data.totalBasePrice, expectedPrice, 'Total should sum included components');

        saveState({ packageId: data.data.id });
      },
    },
    {
      name: 'Verify components stored correctly',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/packages?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'List should succeed');
        const pkg = data.data.packages.find((p: any) => p.id === st.packageId);
        assertNotNull(pkg, 'Package should be in list');
        assertGt(pkg._count?.components || 0, 0, 'Should have component count');

        // Verify each component
        const spaComp = pkg.components?.find((c: any) => c.referenceName === 'Spa Treatment');
        const dinnerComp = pkg.components?.find((c: any) => c.referenceName === 'Candlelight Dinner');
        assertNotNull(spaComp, 'Spa component should exist');
        assertNotNull(dinnerComp, 'Dinner component should exist');
        assertEqual(spaComp.unitCost, 2000);
        assertEqual(spaComp.includedQty, 2);
        assertEqual(spaComp.isIncluded, true);
      },
    },
    {
      name: 'Create package with optional component',
      fn: async () => {
        const { data } = await api.post(
          '/api/packages',
          {
            propertyId: state.propertyId,
            name: 'Weekend Getaway ' + ts,
            baseRoomTypeId: state.roomType1Id,
            roomRateInclusive: true,
            startDate,
            endDate,
            minNights: 2,
            currency: 'INR',
            components: [
              {
                componentType: 'service',
                referenceName: 'Airport Transfer',
                unitCost: 1500,
                isIncluded: true,
                sortOrder: 0,
              },
              {
                componentType: 'dining',
                referenceName: 'Breakfast Buffet',
                unitCost: 800,
                isIncluded: false, // Optional - not included in base price
                sortOrder: 1,
              },
            ],
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        // Total should only count included components
        assertEqual(data.data.totalBasePrice, 1500, 'Only included components should count');
      },
    },
    {
      name: 'Create package rates (seasonal pricing)',
      fn: async () => {
        const st = loadState();
        const { data } = await api.post(
          '/api/packages/rates',
          {
            propertyId: st.propertyId,
            packagePlanId: st.packageId,
            roomTypeId: st.roomType2Id,
            startDate: formatDate(addDays(new Date(), 30)),
            endDate: formatDate(addDays(new Date(), 60)),
            price: 22000,
            currency: 'INR',
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        assertEqual(data.data.price, 22000);
      },
    },
    {
      name: 'Cross-verify: Package references correct room type',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/packages?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success);
        const pkg = data.data.packages.find((p: any) => p.id === st.packageId);
        assertNotNull(pkg);
        assertEqual(pkg.baseRoomTypeId, state.roomType2Id, 'Package should reference Premium Suite room type');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
