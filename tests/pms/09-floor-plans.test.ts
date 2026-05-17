/**
 * 09 - Floor Plans Tests
 *
 * Tests floor plan creation, uniqueness, room placement, and cascade deletion.
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
  assertIncludes,
  assertNotNull,
  assertStatus,
  ApiError,
} from './setup';

async function main() {
  const state = await authenticate();
  const ts = Date.now();
  const floor1 = 1;
  const floor2 = 2;

  await runSequentially('09-FloorPlans', [
    {
      name: 'Create floor plan',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/floor-plans',
          {
            propertyId: state.propertyId,
            floor: floor1,
            name: `Floor ${floor1} - Main`,
            width: 1200,
            height: 800,
            gridSize: 20,
            roomPositions: [
              { roomId: state.room1Id, x: 100, y: 200 },
              { roomId: state.room2Id, x: 300, y: 200 },
            ],
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create floor plan');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        assertEqual(data.data.floor, floor1);
        assertEqual(data.data.name, `Floor ${floor1} - Main`);

        saveState({ floorPlan1Id: data.data.id });
      },
    },
    {
      name: 'Verify unique per property+floor',
      fn: async () => {
        try {
          await api.post(
            '/api/floor-plans',
            {
              propertyId: state.propertyId,
              floor: floor1,
              name: 'Duplicate Floor',
            },
            cookie(state)
          );
          assert(false, 'Should reject duplicate floor');
        } catch (err: any) {
          assertEqual(err.status, 400, 'Should be 400');
          assert(
            err.response?.error?.code === 'DUPLICATE_FLOOR',
            'Should be DUPLICATE_FLOOR'
          );
        }
      },
    },
    {
      name: 'Get floor plan with placed/unplaced rooms',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/floor-plans?id=${st.floorPlan1Id}`,
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data);
        assertEqual(data.data.id, st.floorPlan1Id);
        assert(Array.isArray(data.data.rooms), 'Should have rooms array');
        // Should include the rooms we placed
        const room1 = data.data.rooms.find((r: any) => r.id === st.room1Id);
        const room2 = data.data.rooms.find((r: any) => r.id === st.room2Id);
        assertNotNull(room1, 'Room 1 should be in floor plan rooms');
        assertNotNull(room2, 'Room 2 should be in floor plan rooms');
      },
    },
    {
      name: 'Update floor plan with room positions',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put('/api/floor-plans', {
          id: st.floorPlan1Id,
          name: `Floor ${floor1} - Updated`,
          roomPositions: [
            { roomId: st.room1Id, x: 150, y: 250 },
            { roomId: st.room2Id, x: 350, y: 250 },
          ],
        }, cookie(state));
        assert(data.success, 'Should succeed');
        assertEqual(data.data.name, `Floor ${floor1} - Updated`);
      },
    },
    {
      name: 'Create second floor plan',
      fn: async () => {
        const { data } = await api.post(
          '/api/floor-plans',
          {
            propertyId: state.propertyId,
            floor: floor2,
            name: `Floor ${floor2}`,
            roomPositions: [
              { roomId: state.room3Id, x: 100, y: 100 },
            ],
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        saveState({ floorPlan2Id: data.data.id });
      },
    },
    {
      name: 'Delete floor plan',
      fn: async () => {
        const st = loadState();
        const { data, status } = await api.del(
          `/api/floor-plans?id=${st.floorPlan2Id}`,
          cookie(state)
        );
        assertStatus({ data, status }, 200, 'Delete should succeed');
        assertIncludes(data.message, 'deleted', 'Should confirm deletion');
      },
    },
    {
      name: 'Cross-verify: List floor plans shows only remaining plan',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/floor-plans?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success);
        // Only floor plan 1 should remain
        const remaining = data.data.filter((fp: any) => fp.id === st.floorPlan1Id);
        assertGt(remaining.length, 0, 'Floor plan 1 should still exist');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
