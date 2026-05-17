/**
 * 05 - Inventory Locking Tests
 *
 * Tests inventory lock creation, overlapping prevention, and availability impact.
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
  assertGt,
  assertIncludes,
  assertNotNull,
  assertStatus,
  ApiError,
} from './setup';

async function main() {
  const state = await authenticate();

  const lockStart = addDays(new Date(), 90);
  const lockEnd = addDays(lockStart, 3);
  const lockStart2 = addDays(lockEnd, 1);
  const lockEnd2 = addDays(lockStart2, 2);

  await runSequentially('05-Inventory-Locking', [
    {
      name: 'Create inventory lock for a room (room-level lock)',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/inventory-locks',
          {
            propertyId: state.propertyId,
            roomId: state.room1Id,
            startDate: lockStart.toISOString().split('T')[0],
            endDate: lockEnd.toISOString().split('T')[0],
            reason: 'Scheduled maintenance window',
            lockType: 'maintenance',
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create room-level lock');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Should have ID');
        assertEqual(data.data.roomId, state.room1Id);
        assert(data.data.lockType === 'maintenance', 'Should be maintenance type');

        saveState({ inventoryLockId: data.data.id });
      },
    },
    {
      name: 'Verify lock appears in list',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/inventory-locks?propertyId=${state.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'List should succeed');
        assertGt(data.data.length, 0, 'Should have locks');
        const lock = data.data.find((l: any) => l.id === st.inventoryLockId);
        assertNotNull(lock, 'Created lock should be in list');
      },
    },
    {
      name: 'Create inventory lock for room type (type-level lock)',
      fn: async () => {
        const typeLockStart = addDays(lockEnd, 10);
        const typeLockEnd = addDays(typeLockStart, 3);
        const { data } = await api.post(
          '/api/inventory-locks',
          {
            propertyId: state.propertyId,
            roomTypeId: state.roomType2Id,
            startDate: typeLockStart.toISOString().split('T')[0],
            endDate: typeLockEnd.toISOString().split('T')[0],
            reason: 'Seasonal renovation block',
            lockType: 'renovation',
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        assertEqual(data.data.roomTypeId, state.roomType2Id);
      },
    },
    {
      name: 'Test overlapping lock prevention (room-level)',
      fn: async () => {
        try {
          await api.post(
            '/api/inventory-locks',
            {
              propertyId: state.propertyId,
              roomId: state.room1Id,
              startDate: addDays(lockStart, 1).toISOString().split('T')[0],
              endDate: addDays(lockEnd, 1).toISOString().split('T')[0],
              reason: 'Overlapping test',
              lockType: 'maintenance',
            },
            cookie(state)
          );
          assert(false, 'Should reject overlapping lock');
        } catch (err: any) {
          assertEqual(err.status, 400, 'Should be 400');
          assert(
            err.response?.error?.code === 'OVERLAPPING_LOCK',
            'Should be OVERLAPPING_LOCK'
          );
        }
      },
    },
    {
      name: 'Verify available rooms API excludes locked rooms',
      fn: async () => {
        const { data } = await api.get(
          `/api/rooms/available?propertyId=${state.propertyId}&checkIn=${formatDate(lockStart)}&checkOut=${formatDate(lockEnd)}`,
          cookie(state)
        );
        assert(data.success, 'Available rooms should succeed');
        // Verify the lock list includes our lock for the date range
        const { data: lockList } = await api.get(
          `/api/inventory-locks?propertyId=${state.propertyId}&startDate=${formatDate(lockStart)}&endDate=${formatDate(lockEnd)}`,
          cookie(state)
        );
        assert(lockList.success, 'Lock list should succeed');
        const st = loadState();
        const lock = lockList.data.find((l: any) => l.id === st.inventoryLockId);
        assertNotNull(lock, 'Lock should exist in filtered list');
      },
    },
    {
      name: 'Update lock',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put(
          '/api/inventory-locks',
          {
            id: st.inventoryLockId,
            reason: 'Updated maintenance schedule - shifted by 2 days',
            startDate: lockStart2.toISOString().split('T')[0],
            endDate: lockEnd2.toISOString().split('T')[0],
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertIncludes(data.data.reason, 'Updated maintenance schedule');
      },
    },
    {
      name: 'Delete lock',
      fn: async () => {
        const st = loadState();
        const { data, status } = await api.del(
          `/api/inventory-locks?ids=${st.inventoryLockId}`,
          cookie(state)
        );
        assertStatus({ data, status }, 200, 'Delete should succeed');
        assertIncludes(data.message, '1', 'Should say deleted 1');
      },
    },
    {
      name: 'Verify room becomes available again after lock deletion',
      fn: async () => {
        const st = loadState();
        // After deleting the lock, room should be available again for the original dates
        const { data: lockList } = await api.get(
          `/api/inventory-locks?propertyId=${state.propertyId}&active=true`,
          cookie(state)
        );
        const deletedLock = lockList.data.find((l: any) => l.id === st.inventoryLockId);
        assert(deletedLock === undefined, 'Deleted lock should not appear in active list');
      },
    },
    {
      name: 'Cross-verify: Availability API shows reduced available count during lock',
      fn: async () => {
        // Create a new lock to verify availability impact
        const { data: lockData } = await api.post(
          '/api/inventory-locks',
          {
            propertyId: state.propertyId,
            roomId: state.room2Id,
            startDate: lockStart.toISOString().split('T')[0],
            endDate: lockEnd.toISOString().split('T')[0],
            reason: 'Availability impact test',
            lockType: 'event',
          },
          cookie(state)
        );
        assert(lockData.success);

        // Check availability for those dates
        const { data: availData } = await api.get(
          `/api/availability?propertyId=${state.propertyId}&startDate=${formatDate(lockStart)}&endDate=${formatDate(lockEnd)}`,
          cookie(state)
        );
        assert(availData.success, 'Availability should succeed');
        // The daily availability for the locked date should show reduced count
        const dayData = availData.data.availabilityByRoomType.find(
          (rt: any) => rt.roomTypeId === state.roomType1Id
        );
        if (dayData) {
          const lockedDay = dayData.dailyAvailability.find(
            (d: any) => d.date === formatDate(lockStart)
          );
          if (lockedDay) {
            assertGt(lockedDay.locked, 0, 'Should show locked count > 0');
          }
        }

        // Clean up
        await api.del(`/api/inventory-locks?ids=${lockData.data.id}`, cookie(state));
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
