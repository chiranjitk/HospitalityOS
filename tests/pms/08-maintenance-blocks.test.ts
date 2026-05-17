/**
 * 08 - Maintenance Blocks Tests
 *
 * Tests room out-of-order workflow: create, complete, cancel.
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
  assertNotNull,
  assertStatus,
  ApiError,
} from './setup';

async function main() {
  const state = await authenticate();
  const startDate = new Date().toISOString().split('T')[0]; // today

  await runSequentially('08-Maintenance-Blocks', [
    {
      name: 'Create maintenance block with reason=maintenance',
      fn: async () => {
        // Use a future date range so the room won't be immediately blocked
        const futureStart = addDays(new Date(), 60);
        const futureEnd = addDays(futureStart, 3);

        const { data, status } = await api.post(
          '/api/rooms/maintenance-blocks',
          {
            roomId: state.room2Id,
            reason: 'maintenance',
            description: 'Deep cleaning and HVAC filter replacement',
            startDate: formatDate(futureStart),
            endDate: formatDate(futureEnd),
            priority: 'normal',
            estimatedCost: 5000,
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create maintenance block');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        assertEqual(data.data.reason, 'maintenance');
        // Since it's in the future, status should be 'scheduled'
        assertEqual(data.data.status, 'scheduled');

        // Room should be out_of_order since block is scheduled
        const { data: roomData } = await api.get(`/api/rooms/${state.room2Id}`, cookie(state));
        assertEqual(roomData.data.status, 'out_of_order', 'Room should be out_of_order');

        saveState({ maintenanceBlockId: data.data.id });
      },
    },
    {
      name: 'Verify available rooms excludes this room',
      fn: async () => {
        const futureStart = addDays(new Date(), 60);
        const futureEnd = addDays(futureStart, 2);
        const { data } = await api.get(
          `/api/rooms/available?propertyId=${state.propertyId}&checkIn=${formatDate(futureStart)}&checkOut=${formatDate(futureEnd)}`,
          cookie(state)
        );
        assert(data.success);
        const blockedRoom = data.data.find((r: any) => r.id === state.room2Id);
        assert(blockedRoom === undefined, 'Maintained room should not be available');
      },
    },
    {
      name: 'Complete maintenance block',
      fn: async () => {
        const st = loadState();
        const { data } = await api.post(
          `/api/rooms/maintenance-blocks/${st.maintenanceBlockId}/complete`,
          { actualCost: 4500 },
          cookie(state)
        );
        assert(data.success, 'Complete should succeed');
        assertEqual(data.data.status, 'completed');
        assertEqual(data.data.actualCost, 4500);

        // Room should be dirty after completion
        const { data: roomData } = await api.get(`/api/rooms/${state.room2Id}`, cookie(state));
        assertEqual(roomData.data.status, 'dirty', 'Room should be dirty after maintenance complete');
      },
    },
    {
      name: 'Create another maintenance block and cancel it',
      fn: async () => {
        const futureStart = addDays(new Date(), 90);
        const futureEnd = addDays(futureStart, 2);

        const { data: createData } = await api.post(
          '/api/rooms/maintenance-blocks',
          {
            roomId: state.room3Id,
            reason: 'inspection',
            description: 'Fire safety inspection',
            startDate: formatDate(futureStart),
            endDate: formatDate(futureEnd),
            priority: 'high',
          },
          cookie(state)
        );
        assert(createData.success);
        assertNotNull(createData.data?.id);

        // Room should be out_of_order
        const { data: roomBefore } = await api.get(`/api/rooms/${state.room3Id}`, cookie(state));
        assertEqual(roomBefore.data.status, 'out_of_order', 'Room should be out_of_order');

        // Cancel the block
        const { data: cancelData } = await api.post(
          `/api/rooms/maintenance-blocks/${createData.data.id}/cancel`,
          {},
          cookie(state)
        );
        assert(cancelData.success, 'Cancel should succeed');
        assertEqual(cancelData.data.status, 'cancelled');

        // Room should be available again
        const { data: roomAfter } = await api.get(`/api/rooms/${state.room3Id}`, cookie(state));
        assertEqual(roomAfter.data.status, 'available', 'Room should be available after cancel');
      },
    },
    {
      name: 'List maintenance blocks with filters',
      fn: async () => {
        const { data } = await api.get(
          `/api/rooms/maintenance-blocks?propertyId=${state.propertyId}&status=all`,
          cookie(state)
        );
        assert(data.success, 'List should succeed');
        assertNotNull(data.data);
        assertGt(data.data.length, 0, 'Should have blocks');
        // Verify pagination
        assertNotNull(data.pagination);
      },
    },
    {
      name: 'Cross-verify: Availability and booking endpoints respect out-of-order',
      fn: async () => {
        const st = loadState();
        const futureStart = addDays(new Date(), 90);
        const futureEnd = addDays(futureStart, 2);

        // Room 3 is available (maintenance was cancelled)
        const { data: availData } = await api.get(
          `/api/rooms/available?propertyId=${state.propertyId}&checkIn=${formatDate(futureStart)}&checkOut=${formatDate(futureEnd)}`,
          cookie(state)
        );
        assert(availData.success);
        const room3 = availData.data.find((r: any) => r.id === state.room3Id);
        assertNotNull(room3, 'Room 3 should be available (maintenance cancelled)');

        // Verify in availability API
        const { data: checkData } = await api.get(
          `/api/availability?propertyId=${state.propertyId}&startDate=${formatDate(futureStart)}&endDate=${formatDate(futureEnd)}`,
          cookie(state)
        );
        assert(checkData.success);
        const deluxe = checkData.data.availabilityByRoomType.find(
          (rt: any) => rt.roomTypeId === st.roomType1Id
        );
        assertNotNull(deluxe, 'Should have deluxe breakdown');
        // Room 3 is part of deluxe, should be available
        const dayEntry = deluxe.dailyAvailability.find(
          (d: any) => d.date === formatDate(futureStart)
        );
        if (dayEntry) {
          // dirty rooms shouldn't be counted as locked since the block was cancelled
          assertEqual(dayEntry.locked, 0, 'No locked rooms after cancel');
        }
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
