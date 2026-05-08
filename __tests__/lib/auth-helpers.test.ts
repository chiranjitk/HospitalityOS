import { describe, it, expect } from 'vitest';
import { hasPermission, hasAnyPermission, type TenantContext } from '@/lib/auth-helpers';

describe('hasPermission', () => {
  it('should return true for platform admin with any permission', () => {
    const user = {
      permissions: [] as string[],
      roleName: 'admin',
      isPlatformAdmin: true,
    };
    expect(hasPermission(user, 'bookings.create')).toBe(true);
    expect(hasPermission(user, 'nonexistent.permission')).toBe(true);
  });

  it('should return true when user has wildcard (*) permission', () => {
    const user = {
      permissions: ['*'],
      roleName: 'manager',
      isPlatformAdmin: false,
    };
    expect(hasPermission(user, 'anything')).toBe(true);
    expect(hasPermission(user, 'bookings.create')).toBe(true);
  });

  it('should return true when user has exact permission', () => {
    const user = {
      permissions: ['bookings.create', 'bookings.read'],
      roleName: 'staff',
      isPlatformAdmin: false,
    };
    expect(hasPermission(user, 'bookings.create')).toBe(true);
    expect(hasPermission(user, 'bookings.read')).toBe(true);
  });

  it('should return false when user lacks the permission', () => {
    const user = {
      permissions: ['bookings.read'],
      roleName: 'staff',
      isPlatformAdmin: false,
    };
    expect(hasPermission(user, 'bookings.create')).toBe(false);
    expect(hasPermission(user, 'users.create')).toBe(false);
  });

  it('should return false for empty permissions', () => {
    const user = {
      permissions: [] as string[],
      roleName: 'staff',
      isPlatformAdmin: false,
    };
    expect(hasPermission(user, 'bookings.create')).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('should return true for platform admin with any permissions list', () => {
    const user = {
      permissions: [] as string[],
      roleName: 'admin',
      isPlatformAdmin: true,
    };
    expect(hasAnyPermission(user, ['nonexistent.perm'])).toBe(true);
  });

  it('should return true for admin roleName regardless of permissions', () => {
    const user = {
      permissions: [] as string[],
      roleName: 'admin',
      isPlatformAdmin: false,
    };
    expect(hasAnyPermission(user, ['bookings.create', 'users.create'])).toBe(true);
  });

  it('should return true when user has wildcard (*) permission', () => {
    const user = {
      permissions: ['*'],
      roleName: 'staff',
      isPlatformAdmin: false,
    };
    expect(hasAnyPermission(user, ['bookings.create'])).toBe(true);
  });

  it('should return true when user has at least one of the permissions', () => {
    const user = {
      permissions: ['bookings.read'],
      roleName: 'staff',
      isPlatformAdmin: false,
    };
    expect(hasAnyPermission(user, ['bookings.create', 'bookings.read'])).toBe(true);
  });

  it('should return false when user has none of the permissions', () => {
    const user = {
      permissions: ['bookings.read'],
      roleName: 'staff',
      isPlatformAdmin: false,
    };
    expect(hasAnyPermission(user, ['users.create', 'users.delete'])).toBe(false);
  });

  it('should return false for empty permissions and non-admin', () => {
    const user = {
      permissions: [] as string[],
      roleName: 'staff',
      isPlatformAdmin: false,
    };
    expect(hasAnyPermission(user, ['bookings.create'])).toBe(false);
  });

  it('should return false for empty permissions array', () => {
    const user = {
      permissions: ['bookings.read'],
      roleName: 'staff',
      isPlatformAdmin: false,
    };
    expect(hasAnyPermission(user, [])).toBe(false);
  });
});
