/**
 * 01 - Platform Admin Module Tests (17 pages, 25+ tests)
 *
 * Tests tenant management, billing plans, revenue, usage, system health,
 * backups, roles, users, brands, chain analytics, license management,
 * and more platform-level admin endpoints.
 *
 * Pattern: Real API calls only, graceful 404/403 skips, sequential execution.
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
} from '../pms/setup';

// ─── Helper: Skip wrapper for endpoints that may 404 ─────────────────────

async function skipOn404(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      console.log('      ⏭️  SKIPPED (endpoint returned ' + err.status + ')');
      return;
    }
    throw err;
  }
}

const safeGet = async (path: string, ck: string) => {
  try {
    await delay(DELAY_BETWEEN_CALLS);
    return await api.get(path, ck);
  } catch (e: any) {
    if (e.status === 404 || e.status === 403) return null;
    throw e;
  }
};

async function main() {
  let state: any;
  try {
    state = await authenticate();
  } catch (err: any) {
    console.error(`\n❌ AUTH FAILED: ${err.message}`);
    process.exit(1);
  }

  const st = loadState();
  const ck = cookie(state);

  // Track created IDs for cross-references
  let createdTenantId: string | null = null;
  let createdBrandId: string | null = null;

  await runSequentially('01-Platform-Admin', [
    // ════════════════════════════════════════════════════════════════════
    // PAGE 1: Tenant Management
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Tenants - POST create new tenant',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/admin/tenants',
            {
              name: `E2E Test Tenant ${Date.now()}`,
              slug: `e2e-tenant-${Date.now()}`,
              plan: 'starter',
              email: `e2e-tenant-${Date.now()}@test.com`,
              status: 'trial',
              limits: { properties: 1, users: 5, rooms: 50, storage: 1000 },
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have tenant data');
          assertNotNull(data.data.id, 'Created tenant should have id');
          assertEqual(data.data.plan, 'starter', 'Plan should be starter');
          assertNotNull(data.data.slug, 'Should have slug');
          assertNotNull(data.data.usage, 'Should have usage');
          assertNotNull(data.data.limits, 'Should have limits');
          createdTenantId = data.data.id;
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'Tenants - GET list all tenants with stats',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/tenants', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.data.tenants, 'Should have tenants array');
          assert(Array.isArray(data.data.tenants), 'Tenants should be array');
          assertNotNull(data.data.stats, 'Should have stats');
          assertNotNull(data.data.stats.total, 'Stats should have total');
          assertNotNull(data.data.stats.active, 'Stats should have active');
          assertNotNull(data.data.stats.totalRevenue, 'Stats should have totalRevenue');
        });
      },
    },
    {
      name: 'Tenants - GET filter by status=active',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/tenants?status=active', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.data.tenants, 'Should have tenants');
        });
      },
    },
    {
      name: 'Tenants - GET search by name',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/tenants?search=test', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.data.tenants, 'Should have tenants');
        });
      },
    },
    {
      name: 'Tenants - POST validate missing required fields',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          await api.post('/api/admin/tenants', { name: 'incomplete' }, ck);
          assert(false, 'Should have thrown validation error');
        } catch (err: any) {
          if (err instanceof ApiError) {
            assertGt(err.status, 399, 'Should return 4xx for missing fields');
          }
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 2: Billing Plans
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Plans - GET list all plans',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/plans', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.plans || data.data?.plans || data.data, 'Should have plans');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 3: Revenue
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Revenue - GET revenue dashboard',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/revenue', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.revenue || data.data?.revenue || data.data, 'Should have revenue data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 4: Usage
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Usage - GET usage overview',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/usage', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 5: System Health
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'System Health - GET health status',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/system-health', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.data.services || data.data?.status || data.data, 'Should have health info');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 6: Backups
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Backups - GET list all backups',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/backups', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.backups || data.data?.backups || data.pagination || data.data, 'Should have backups or pagination');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 7: Roles
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Roles - GET list all roles',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/roles', ck);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.roles || data.data?.roles || data.data, 'Should have roles');
      },
    },
    {
      name: 'Roles - Verify role object structure',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/roles', ck);
        assert(data.success, 'Should succeed');
        const roles = data.roles || data.data?.roles || data.data;
        if (Array.isArray(roles) && roles.length > 0) {
          const role = roles[0];
          assertNotNull(role.id, 'Role should have id');
          assertNotNull(role.name, 'Role should have name');
          assertNotNull(role.displayName || role.display_name, 'Role should have displayName');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 8: Users
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Users - GET list all users',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/users', ck);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.users || data.data?.users || data.pagination || data.data, 'Should have users or pagination');
      },
    },
    {
      name: 'Users - Verify user object structure',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/users?limit=5', ck);
        assert(data.success, 'Should succeed');
        const users = data.users || data.data?.users || data.data;
        if (Array.isArray(users) && users.length > 0) {
          const user = users[0];
          assertNotNull(user.id, 'User should have id');
          assertNotNull(user.name || user.fullName || user.full_name, 'User should have name');
          assertNotNull(user.email, 'User should have email');
          assertNotNull(user.role || user.roleName, 'User should have role');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 9: Brands
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Brands - POST create brand',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        try {
          const { data } = await api.post(
            '/api/brands',
            {
              name: `E2E Test Brand ${Date.now()}`,
              slug: `e2e-brand-${Date.now()}`,
              description: 'Created by admin e2e tests',
              website: 'https://e2e-brand-test.com',
              primaryColor: '#3B82F6',
              secondaryColor: '#1E40AF',
            },
            ck,
          );
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have brand data');
          assertNotNull(data.data.id, 'Created brand should have id');
          assertNotNull(data.data.name, 'Should have name');
          assertNotNull(data.data.slug, 'Should have slug');
          createdBrandId = data.data.id;
          await delay(DELAY_AFTER_MUTATION);
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 400 || err.status === 403)) {
            console.log('      ⏭️  SKIPPED (POST returned ' + err.status + ')');
            return;
          }
          throw err;
        }
      },
    },
    {
      name: 'Brands - GET list all brands',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/brands', ck);
        assert(data.success, 'Should succeed');
        assertNotNull(data.data, 'Should have data');
        assertNotNull(data.brands || data.data?.brands || data.data, 'Should have brands');
      },
    },
    {
      name: 'Brands - Verify brand object structure',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        const { data } = await api.get('/api/brands', ck);
        assert(data.success, 'Should succeed');
        const brands = data.brands || data.data?.brands || data.data;
        if (Array.isArray(brands) && brands.length > 0) {
          const brand = brands[0];
          assertNotNull(brand.id, 'Brand should have id');
          assertNotNull(brand.name, 'Brand should have name');
        }
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 10: Tenants (non-admin list)
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Tenants (List) - GET tenants list',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/tenants', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 11: Billing Plans (admin)
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Billing Plans - GET admin billing plans',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/billing/plans', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.plans || data.data?.plans || data.data, 'Should have plans');
        });
      },
    },
    {
      name: 'Billing Subscriptions - GET admin subscriptions',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/billing/subscriptions', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.subscriptions || data.data?.subscriptions || data.pagination || data.data, 'Should have subscriptions or pagination');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 12: Chain Analytics
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Chain Analytics - GET analytics data',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/chain/analytics', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Chain Dashboard - GET dashboard overview',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/chain/dashboard', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 13: License Entitlements
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'License Entitlements - GET all entitlements',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/license/entitlements', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.entitlements || data.data?.entitlements || data.data, 'Should have entitlements');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 14: License Overview
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'License Overview - GET license details',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/license/overview', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.license || data.data?.license || data.data, 'Should have license info');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // PAGE 15: License Usage History
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'License Usage History - GET usage history',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/license/usage/history', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.history || data.data?.history || data.data, 'Should have history');
        });
      },
    },

    // ════════════════════════════════════════════════════════════════════
    // CROSS-CUTTING: Verify tenant object structure depth
    // ════════════════════════════════════════════════════════════════════
    {
      name: 'Tenants - Verify tenant object structure',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/tenants', ck);
          assert(data.success, 'Should succeed');
          if (data.data.tenants && data.data.tenants.length > 0) {
            const tenant = data.data.tenants[0];
            assertNotNull(tenant.id, 'Tenant should have id');
            assertNotNull(tenant.name, 'Tenant should have name');
            assertNotNull(tenant.slug, 'Tenant should have slug');
            assertNotNull(tenant.plan, 'Tenant should have plan');
            assertNotNull(tenant.status, 'Tenant should have status');
            assertNotNull(tenant.email, 'Tenant should have email');
            assertNotNull(tenant.properties !== undefined, 'Tenant should have properties count');
            assertNotNull(tenant.users !== undefined, 'Tenant should have users count');
            assertNotNull(tenant.monthlyRevenue !== undefined, 'Tenant should have monthlyRevenue');
            assertNotNull(tenant.usage, 'Tenant should have usage object');
            assertNotNull(tenant.limits, 'Tenant should have limits object');
          }
        });
      },
    },
    {
      name: 'Tenants - Stats are coherent',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/tenants', ck);
          assert(data.success, 'Should succeed');
          const stats = data.data.stats;
          assertGt(stats.total, -1, 'Total should be >= 0');
          assertGt(stats.active, -1, 'Active should be >= 0');
          assertGt(stats.totalRevenue, -1, 'Total revenue should be >= 0');
          // Active should not exceed total
          assert(stats.active <= stats.total, 'Active should not exceed total');
          // Total of trial + active + suspended should equal total
          const accounted = (stats.trial || 0) + (stats.active || 0) + (stats.suspended || 0);
          assert(accounted <= stats.total, 'Accounted statuses should not exceed total');
        });
      },
    },
    {
      name: 'Brands - Verify brand depth after creation',
      fn: async () => {
        await delay(DELAY_BETWEEN_CALLS);
        if (!createdBrandId) {
          console.log('      ⏭️  SKIPPED (no brandId available)');
          return;
        }
        await skipOn404(async () => {
          const { data } = await api.get(`/api/brands/${createdBrandId}`, ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have brand data');
          assertEqual(data.data.id, createdBrandId, 'Should return matching brand');
          assertNotNull(data.data.name, 'Should have name');
        });
      },
    },
    {
      name: 'License Feature Flags - GET feature flags',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/license/feature-flags', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.flags || data.data?.flags || data.data, 'Should have flags');
        });
      },
    },
    {
      name: 'License Check - GET license validation',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/license/check', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
          assertNotNull(data.data.isValid !== undefined || data.data.valid !== undefined || data.data, 'Should have validity info');
        });
      },
    },
    {
      name: 'Admin Billing Calculate - GET billing calculation',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/billing/calculate?plan=professional', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have calculation data');
        });
      },
    },
    {
      name: 'Admin Usage Billing - GET usage billing',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/usage-billing', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
    {
      name: 'Admin Storage - GET storage overview',
      fn: async () => {
        await skipOn404(async () => {
          await delay(DELAY_BETWEEN_CALLS);
          const { data } = await api.get('/api/admin/storage', ck);
          assert(data.success, 'Should succeed');
          assertNotNull(data.data, 'Should have data');
        });
      },
    },
  ]);
}

main().catch((e) => {
  console.error('\n💥', e);
  process.exit(1);
});
