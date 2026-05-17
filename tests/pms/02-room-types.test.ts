/**
 * 02 - Room Types CRUD Tests
 *
 * Tests room type creation, listing, uniqueness, and cross-verification with property.
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
  ApiError,
} from './setup';

async function main() {
  const state = await authenticate();
  const ts = Date.now();

  await runSequentially('02-RoomTypes-CRUD', [
    {
      name: 'Create room type with all fields',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/room-types',
          {
            propertyId: state.propertyId,
            name: 'Deluxe Double',
            code: 'DLX-' + ts,
            description: 'Deluxe double room with sea view',
            maxAdults: 2,
            maxChildren: 1,
            maxOccupancy: 3,
            sizeSqMeters: 35,
            sizeSqFeet: 377,
            amenities: ['WiFi', 'TV', 'Mini Bar', 'Air Conditioning', 'Safe'],
            basePrice: 5000,
            currency: 'INR',
            images: [],
            sortOrder: 0,
            status: 'active',
            overbookingEnabled: false,
            overbookingPercentage: 10,
            overbookingLimit: 1,
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create room type');
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id, 'Should have ID');
        assertEqual(data.data.code, 'DLX-' + ts);
        assertEqual(data.data.name, 'Deluxe Double');
        assertEqual(data.data.maxAdults, 2);
        assertEqual(data.data.basePrice, 5000);

        saveState({ roomType1Id: data.data.id });
      },
    },
    {
      name: 'Verify room type appears in list',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(
          `/api/room-types?propertyId=${st.propertyId}`,
          cookie(state)
        );
        assert(data.success, 'List should succeed');
        const rt = data.data.find((r: any) => r.id === st.roomType1Id);
        assertNotNull(rt, 'Created room type should be in list');
        assertEqual(rt.name, 'Deluxe Double');
      },
    },
    {
      name: 'Get single room type',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(`/api/room-types/${st.roomType1Id}`, cookie(state));
        assert(data.success, 'Get room type should succeed');
        assertEqual(data.data.id, st.roomType1Id);
        assertEqual(data.data.code, 'DLX-' + ts);
      },
    },
    {
      name: 'Update room type (change basePrice, amenities)',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put(
          `/api/room-types/${st.roomType1Id}`,
          {
            name: 'Deluxe Double - Renovated',
            basePrice: 5500,
            amenities: ['WiFi', 'TV', 'Mini Bar', 'Air Conditioning', 'Safe', 'Bathtub'],
          },
          cookie(state)
        );
        assert(data.success, 'Update should succeed');
        assertEqual(data.data.name, 'Deluxe Double - Renovated');
        assertEqual(data.data.basePrice, 5500);
      },
    },
    {
      name: 'Reject duplicate code per property',
      fn: async () => {
        try {
          await api.post(
            '/api/room-types',
            {
              propertyId: state.propertyId,
              name: 'Another Deluxe',
              code: 'DLX-' + ts,
              basePrice: 4000,
            },
            cookie(state)
          );
          assert(false, 'Should reject duplicate code');
        } catch (err: any) {
          assertEqual(err.status, 400, 'Should be 400');
          assert(err.response?.error?.code === 'DUPLICATE_CODE', 'Should be DUPLICATE_CODE');
        }
      },
    },
    {
      name: 'Create second room type',
      fn: async () => {
        const { data } = await api.post(
          '/api/room-types',
          {
            propertyId: state.propertyId,
            name: 'Premium Suite',
            code: 'PRM-' + ts,
            description: 'Premium suite with living area',
            maxAdults: 3,
            maxChildren: 2,
            maxOccupancy: 5,
            sizeSqMeters: 55,
            amenities: ['WiFi', 'TV', 'Mini Bar', 'Jacuzzi', 'Balcony'],
            basePrice: 12000,
            currency: 'INR',
            status: 'active',
            overbookingEnabled: false,
            overbookingPercentage: 0,
            overbookingLimit: 0,
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertNotNull(data.data?.id);
        saveState({ roomType2Id: data.data.id });
      },
    },
    {
      name: 'Verify overbooking settings validation',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put(
          `/api/room-types/${st.roomType1Id}`,
          {
            overbookingEnabled: true,
            overbookingPercentage: 20,
            overbookingLimit: 2,
          },
          cookie(state)
        );
        assert(data.success, 'Should succeed');
        assertEqual(data.data.overbookingEnabled, true);
        assertEqual(data.data.overbookingPercentage, 20);
        assertEqual(data.data.overbookingLimit, 2);
      },
    },
    {
      name: 'Delete room type with no rooms (should succeed)',
      fn: async () => {
        // Create temp room type and delete it
        const { data: createData } = await api.post(
          '/api/room-types',
          {
            propertyId: state.propertyId,
            name: 'Temp Type',
            code: `TMP-${Date.now()}`,
            basePrice: 1000,
          },
          cookie(state)
        );
        assertNotNull(createData.data?.id);

        const { data: delData, status: delStatus } = await api.del(
          `/api/room-types/${createData.data.id}`,
          cookie(state)
        );
        assertStatus({ data: delData, status: delStatus }, 200, 'Delete should succeed');
      },
    },
    {
      name: 'Cross-verify: Property roomType count = 2',
      fn: async () => {
        const { data } = await api.get(`/api/properties?limit=100`, cookie(state));
        assert(data.success, 'List should succeed');
        const prop = data.data.find((p: any) => p.id === state.propertyId);
        assertNotNull(prop);
        assertGt(prop.totalRoomTypes, 1, 'Property should have at least 2 room types');
      },
    },
  ]);
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
