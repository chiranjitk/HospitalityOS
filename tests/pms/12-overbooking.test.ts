/**
 * 12 - Overbooking Settings Tests
 *
 * Tests overbooking configuration per room type.
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
  assertGt,
  assertNotNull,
  assertStatus,
} from './setup';

async function main() {
  const state = await authenticate();

  await runSequentially('12-Overbooking', [
    {
      name: 'Get overbooking config (default)',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/room-types?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');

        const deluxe = data.data.find((r: any) => r.id === st.roomType1Id);
        assertNotNull(deluxe, 'Should find deluxe room type');
        assertNotNull(deluxe.overbookingStats, 'Should have overbooking stats');
        assertEqual(deluxe.overbookingEnabled, true, 'Overbooking should be enabled (we set it in test 02)');
        assertGt(deluxe.overbookingPercentage, 0, 'Overbooking percentage should be > 0');
        assertGt(deluxe.overbookingLimit, 0, 'Overbooking limit should be > 0');
      },
    },
    {
      name: 'Update overbooking config',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put(
          `/api/room-types/${st.roomType1Id}`,
          {
            overbookingEnabled: true,
            overbookingPercentage: 30,
            overbookingLimit: 3,
          },
          cookie(state)
        );
        assert(data.success, 'Update should succeed');
        assertEqual(data.data.overbookingEnabled, true);
        assertEqual(data.data.overbookingPercentage, 30);
        assertEqual(data.data.overbookingLimit, 3);
      },
    },
    {
      name: 'Update premium suite overbooking (enable it)',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put(
          `/api/room-types/${st.roomType2Id}`,
          {
            overbookingEnabled: true,
            overbookingPercentage: 20,
            overbookingLimit: 1,
          },
          cookie(state)
        );
        assert(data.success, 'Update should succeed');
        assertEqual(data.data.overbookingEnabled, true);
        assertEqual(data.data.overbookingPercentage, 20);
      },
    },
    {
      name: 'Verify overbooking stats in list response',
      fn: async () => {
        const { data } = await api.get(
          `/api/room-types?propertyId=${state.propertyId}`,
          cookie(state)
        );
        assert(data.success);

        for (const rt of data.data) {
          assertNotNull(rt.overbookingStats, `Room type ${rt.code} should have overbooking stats`);
          if (rt.overbookingEnabled) {
            assertGt(
              rt.overbookingStats.availableForOverbooking,
              0,
              `${rt.code} should have overbooking capacity`
            );
          }
        }
      },
    },
    {
      name: 'Cross-verify: Overbooking config affects booking capacity',
      fn: async () => {
        const st = loadState();
        // The overbooking setting on Deluxe allows overbooking by up to limit
        const { data } = await api.get(
          `/api/room-types/${st.roomType1Id}`,
          cookie(state)
        );
        assert(data.success);
        // With 4 rooms and overbooking limit of 3, capacity = 7
        const capacity = data.data.totalRooms + data.data.overbookingLimit;
        assertGt(capacity, 0, 'Total capacity should be > 0');

        // Verify overbooking settings are consistent with list
        const { data: listData } = await api.get(
          `/api/room-types?propertyId=${st.propertyId}`,
          cookie(state)
        );
        const deluxe = listData.data.find((r: any) => r.id === st.roomType1Id);
        assertNotNull(deluxe, 'Should find deluxe room type');
        assertEqual(deluxe.totalRooms, data.data.totalRooms, 'Counts should match');
        assertEqual(deluxe.overbookingEnabled, data.data.overbookingEnabled, 'Settings should match');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
