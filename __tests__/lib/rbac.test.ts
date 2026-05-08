import { describe, it, expect } from 'vitest';
import { hasPermission, requirePermission, getUserContext } from '@/lib/rbac';
import { type TenantContext } from '@/lib/auth/tenant-context';
import { NextRequest } from 'next/server';
import { hasPermission as tcHasPermission, tenantWhere } from '@/lib/auth/tenant-context';

describe('rbac module (backward-compat re-exports)', () => {
  // ─── hasPermission from tenant-context (pure logic) ────────────────────

  describe('hasPermission (tenant-context)', () => {
    it('should return true for platform admin regardless of permission list', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 't1',
        isPlatformAdmin: true,
        role: 'admin',
        permissions: [],
      };
      expect(tcHasPermission(ctx, 'bookings.create')).toBe(true);
    });

    it('should return true for wildcard permission (*)', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
        role: 'manager',
        permissions: ['*'],
      };
      expect(tcHasPermission(ctx, 'anything.here')).toBe(true);
    });

    it('should return true for exact permission match', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
        role: 'staff',
        permissions: ['bookings.create', 'bookings.read'],
      };
      expect(tcHasPermission(ctx, 'bookings.create')).toBe(true);
    });

    it('should return true for wildcard module permission (bookings.*)', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
        role: 'manager',
        permissions: ['bookings.*'],
      };
      expect(tcHasPermission(ctx, 'bookings.create')).toBe(true);
      expect(tcHasPermission(ctx, 'bookings.read')).toBe(true);
      expect(tcHasPermission(ctx, 'bookings.delete')).toBe(true);
    });

    it('should return false when permission is not in list', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
        role: 'staff',
        permissions: ['bookings.read'],
      };
      expect(tcHasPermission(ctx, 'bookings.create')).toBe(false);
      expect(tcHasPermission(ctx, 'users.create')).toBe(false);
    });

    it('should return false for empty permissions list', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
        role: 'staff',
        permissions: [],
      };
      expect(tcHasPermission(ctx, 'bookings.create')).toBe(false);
    });

    it('should not match partial module names', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 't1',
        isPlatformAdmin: false,
        role: 'staff',
        permissions: ['booking.*'],
      };
      // 'booking.*' should NOT match 'bookings.create'
      expect(tcHasPermission(ctx, 'bookings.create')).toBe(false);
    });
  });

  // ─── tenantWhere (pure function) ────────────────────────────────────────

  describe('tenantWhere', () => {
    it('should add tenantId to where clause', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 'tenant-123',
        isPlatformAdmin: false,
        role: 'staff',
        permissions: [],
      };
      const result = tenantWhere(ctx);
      expect(result).toEqual({ tenantId: 'tenant-123' });
    });

    it('should merge additional where clause', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 'tenant-123',
        isPlatformAdmin: false,
        role: 'staff',
        permissions: [],
      };
      const result = tenantWhere(ctx, { status: 'active' });
      expect(result).toEqual({ tenantId: 'tenant-123', status: 'active' });
    });

    it('should merge multiple additional where fields', () => {
      const ctx: TenantContext = {
        userId: 'u1',
        tenantId: 'tenant-123',
        isPlatformAdmin: false,
        role: 'staff',
        permissions: [],
      };
      const result = tenantWhere(ctx, { status: 'active', propertyId: 'prop-1' });
      expect(result).toEqual({
        tenantId: 'tenant-123',
        status: 'active',
        propertyId: 'prop-1',
      });
    });
  });

  // ─── requirePermission (async, needs NextRequest) ───────────────────────
  // These functions require getTenantContext which hits the DB.
  // We test them with a request that has no session cookie → 401 response.

  describe('requirePermission (rbac wrapper)', () => {
    it('should return 401 when no session cookie is present', async () => {
      const req = new NextRequest('http://localhost/api/test');
      const result = await requirePermission(req, 'bookings.create');
      // Result should be a NextResponse (401)
      expect(result).not.toBeNull();
      expect('status' in result && 'json' in result).toBe(true);
      if ('status' in result) {
        expect(result.status).toBe(401);
      }
    });
  });

  describe('getUserContext (rbac wrapper)', () => {
    it('should return null when no session cookie is present', async () => {
      const req = new NextRequest('http://localhost/api/test');
      const result = await getUserContext(req);
      expect(result).toBeNull();
    });
  });
});
