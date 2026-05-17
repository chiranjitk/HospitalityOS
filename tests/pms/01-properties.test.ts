/**
 * 01 - Properties CRUD Tests
 *
 * Tests the full CRUD lifecycle for properties:
 * Create, List, Get, Update, Slug uniqueness, Tax settings, Delete
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
  assertIncludes,
  assertMatch,
  assertNotNull,
  assertStatus,
  ApiError,
  clearState,
} from './setup';

const PROP_SLUG = `test-property-${Date.now()}`;

async function main() {
  // Authenticate first
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTHENTICATION FAILED: ${err.message}`);
    console.error('   Make sure the dev server is running on port 3000 and a user exists.');
    process.exit(1);
  }

  clearState({ sessionCookie: state.sessionCookie, tenantId: state.tenantId, userId: state.userId, createdAt: state.createdAt }); // Clear previous test data, keep fresh auth

  await runSequentially('01-Properties-CRUD', [
    {
      name: 'Create property with all fields',
      fn: async () => {
        const { data, status } = await api.post(
          '/api/properties',
          {
            name: 'Test Hotel PMS Suite',
            slug: PROP_SLUG,
            description: 'A test property for PMS integration tests',
            type: 'hotel',
            address: '123 Test Street',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            postalCode: '400001',
            email: 'test@hotel.com',
            phone: '+911234567890',
            website: 'https://test-hotel.com',
            checkInTime: '14:00',
            checkOutTime: '11:00',
            timezone: 'Asia/Kolkata',
            currency: 'INR',
            taxType: 'gst',
            defaultTaxRate: 18,
            taxComponents: [
              { name: 'CGST', rate: 9 },
              { name: 'SGST', rate: 9 },
            ],
            serviceChargePercent: 0,
            includeTaxInPrice: false,
            totalFloors: 3,
            status: 'active',
          },
          cookie(state)
        );
        assertStatus({ data, status }, 201, 'Create property');
        assert(data.success, 'Response should be successful');
        assertNotNull(data.data?.id, 'Property should have an ID');
        assertEqual(data.data.slug, PROP_SLUG, 'Slug should match');
        assertEqual(data.data.type, 'hotel', 'Type should be hotel');
        assertEqual(data.data.city, 'Mumbai', 'City should be Mumbai');
        assertEqual(data.data.currency, 'INR', 'Currency should be INR');
        assertEqual(data.data.totalFloors, 3, 'Total floors should be 3');
        assertEqual(data.data.status, 'active', 'Status should be active');

        saveState({ propertyId: data.data.id, propertySlug: data.data.slug });
      },
    },
    {
      name: 'Verify property appears in list',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(`/api/properties?limit=100`, cookie(state));
        assert(data.success, 'List should succeed');
        const prop = data.data.find((p: any) => p.id === st.propertyId);
        assertNotNull(prop, 'Created property should appear in list');
        assertEqual(prop.name, 'Test Hotel PMS Suite');
        assertEqual(prop.slug, PROP_SLUG);
      },
    },
    {
      name: 'Get single property',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(`/api/properties/${st.propertyId}`, cookie(state));
        assert(data.success, 'Get property should succeed');
        assertNotNull(data.data);
        assertEqual(data.data.id, st.propertyId);
        assertEqual(data.data.name, 'Test Hotel PMS Suite');
        assertEqual(data.data.totalFloors, 3);
      },
    },
    {
      name: 'Update property fields',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put(
          `/api/properties/${st.propertyId}`,
          {
            name: 'Test Hotel PMS Suite - Updated',
            description: 'Updated description for testing',
            totalFloors: 5,
          },
          cookie(state)
        );
        assert(data.success, 'Update should succeed');
        assertEqual(data.data.name, 'Test Hotel PMS Suite - Updated');
        assertEqual(data.data.totalFloors, 5);
      },
    },
    {
      name: 'Reject duplicate slug',
      fn: async () => {
        try {
          await api.post(
            '/api/properties',
            {
              name: 'Duplicate Hotel',
              slug: PROP_SLUG,
              address: '456 Dup Street',
              city: 'Delhi',
              country: 'India',
            },
            cookie(state)
          );
          assert(false, 'Should have thrown on duplicate slug');
        } catch (err: any) {
          assertEqual(err.status, 400, 'Should be 400 for duplicate slug');
          assertNotNull(err.response?.error?.code);
          assertIncludes(err.response.error.code, 'DUPLICATE', 'Should indicate duplicate');
        }
      },
    },
    {
      name: 'Get tax settings',
      fn: async () => {
        const st = loadState();
        const { data } = await api.get(`/api/properties/${st.propertyId}/tax-settings`, cookie(state));
        assert(data.success, 'Tax settings GET should succeed');
        assertNotNull(data.data);
        // Verify tax components are returned
        const taxComponents = typeof data.data.taxComponents === 'string'
          ? JSON.parse(data.data.taxComponents)
          : data.data.taxComponents;
        assertNotNull(taxComponents, 'Tax components should be present');
        assert(Array.isArray(taxComponents), 'Tax components should be array');
      },
    },
    {
      name: 'Update tax settings',
      fn: async () => {
        const st = loadState();
        const { data } = await api.put(
          `/api/properties/${st.propertyId}/tax-settings`,
          {
            defaultTaxRate: 12,
            taxComponents: [
              { name: 'CGST', rate: 6 },
              { name: 'SGST', rate: 6 },
            ],
            serviceChargePercent: 5,
          },
          cookie(state)
        );
        assert(data.success, 'Tax settings PUT should succeed');
        assertEqual(data.data.defaultTaxRate, 12);
        assertEqual(data.data.serviceChargePercent, 5);
      },
    },
    {
      name: 'Property count reflected in response',
      fn: async () => {
        const { data } = await api.get('/api/properties?limit=100', cookie(state));
        assert(data.success, 'List should succeed');
        assertGt(data.pagination?.total || data.data?.length || 0, 0, 'Should have at least 1 property');
      },
    },
    {
      name: 'Delete property (no rooms → should succeed)',
      fn: async () => {
        // Create a separate temp property to delete
        const { data: createData } = await api.post(
          '/api/properties',
          {
            name: 'Temp Delete Hotel',
            slug: `temp-delete-${Date.now()}`,
            address: '789 Temp Street',
            city: 'Bangalore',
            country: 'India',
          },
          cookie(state)
        );
        assertNotNull(createData.data?.id);

        // Delete it
        const { data: delData, status: delStatus } = await api.del(
          `/api/properties/${createData.data.id}`,
          cookie(state)
        );
        assertStatus({ data: delData, status: delStatus }, 200, 'Delete should succeed');

        // Verify it's gone
        try {
          await api.get(`/api/properties/${createData.data.id}`, cookie(state));
          assert(false, 'Should 404 after deletion');
        } catch (err: any) {
          assertEqual(err.status, 404, 'Should be 404');
        }
      },
    },
  ]);
}

// Helper needed by assertGt in this scope
function assertGt(actual: number, threshold: number, label?: string) {
  if (actual <= threshold) {
    throw new Error(`${label || ''}Expected ${actual} > ${threshold}`);
  }
}

main().catch((err) => {
  console.error('\n💥 Unhandled error:', err);
  process.exit(1);
});
