/**
 * StaySuite-HospitalityOS — Database Seed Script
 *
 * Creates a demo tenant, property, admin user, and system roles
 * so the app can be logged into immediately after `bun run db:push`.
 *
 * Usage:  bunx prisma db seed
 *         (or: npx prisma db seed)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const SALT_ROUNDS = 12;

/** All permissions a super-admin should have */
const ALL_PERMISSIONS = [
  // PMS
  'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.delete',
  'rooms.view', 'rooms.create', 'rooms.edit', 'rooms.delete',
  'housekeeping.view', 'housekeeping.manage',
  'guests.view', 'guests.create', 'guests.edit', 'guests.delete',
  'frontdesk.manage', 'nightaudit.manage',
  // Revenue
  'rates.view', 'rates.create', 'rates.edit', 'rates.delete',
  'discounts.view', 'discounts.create', 'discounts.edit', 'discounts.delete',
  'invoices.view', 'invoices.create', 'invoices.edit',
  'payments.view', 'payments.create', 'payments.manage',
  'pos.view', 'pos.manage',
  // CRM
  'crm.view', 'crm.manage',
  'campaigns.view', 'campaigns.create', 'campaigns.edit',
  'loyalty.view', 'loyalty.manage',
  // Channel
  'channels.view', 'channels.manage', 'channels.sync',
  // Reports
  'reports.view', 'reports.export',
  // Settings
  'settings.view', 'settings.edit',
  'users.view', 'users.create', 'users.edit', 'users.delete',
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
  'integrations.view', 'integrations.manage',
  'automation.view', 'automation.manage',
  // Engineering
  'maintenance.view', 'maintenance.manage',
  'iot.view', 'iot.manage',
  // Accounting
  'accounting.view', 'accounting.manage',
  'purchasing.view', 'purchasing.manage',
  'inventory.view', 'inventory.manage',
  'hr.view', 'hr.manage',
  // Analytics
  'analytics.view', 'analytics.export',
];

async function main() {
  console.log('🌱 Seeding StaySuite-HospitalityOS...');

  // ─── 1. Create Tenant ───────────────────────────────────────────────
  const tenant = await db.tenant.upsert({
    where: { slug: 'demo-hotel' },
    update: {},
    create: {
      name: 'Demo Hotel',
      slug: 'demo-hotel',
      email: 'admin@demo-hotel.com',
      phone: '+91-22-12345678',
      address: '123 Marine Drive',
      city: 'Mumbai',
      country: 'India',
      timezone: 'Asia/Kolkata',
      plan: 'enterprise',
      status: 'active',
    },
  });
  console.log(`  ✅ Tenant: ${tenant.name} (${tenant.id})`);

  // ─── 2. Create Property ─────────────────────────────────────────────
  const property = await db.property.upsert({
    where: { id: `${tenant.id}-prop-1` },
    update: {},
    create: {
      id: `${tenant.id}-prop-1`,
      tenantId: tenant.id,
      name: 'Demo Grand Hotel',
      code: 'DGH',
      type: 'hotel',
      starRating: 5,
      address: '123 Marine Drive, Colaba',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400001',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      totalRooms: 120,
      status: 'active',
    },
  });
  console.log(`  ✅ Property: ${property.name} (${property.id})`);

  // ─── 3. Create System Roles ─────────────────────────────────────────
  const superAdminRole = await db.role.upsert({
    where: { id: `${tenant.id}-role-superadmin` },
    update: {},
    create: {
      id: `${tenant.id}-role-superadmin`,
      tenantId: tenant.id,
      name: 'superadmin',
      displayName: 'Super Admin',
      description: 'Full access to all modules',
      permissions: JSON.stringify(ALL_PERMISSIONS),
      isSystem: true,
    },
  });

  const adminRole = await db.role.upsert({
    where: { id: `${tenant.id}-role-admin` },
    update: {},
    create: {
      id: `${tenant.id}-role-admin`,
      tenantId: tenant.id,
      name: 'admin',
      displayName: 'Administrator',
      description: 'Admin access with a few restrictions',
      permissions: JSON.stringify(ALL_PERMISSIONS.filter(p => !p.startsWith('hr.'))),
      isSystem: true,
    },
  });

  const frontDeskRole = await db.role.upsert({
    where: { id: `${tenant.id}-role-frontdesk` },
    update: {},
    create: {
      id: `${tenant.id}-role-frontdesk`,
      tenantId: tenant.id,
      name: 'front_desk',
      displayName: 'Front Desk',
      description: 'Check-in, check-out, room management',
      permissions: JSON.stringify([
        'bookings.view', 'bookings.create', 'bookings.edit',
        'rooms.view',
        'guests.view', 'guests.create', 'guests.edit',
        'frontdesk.manage',
        'payments.view', 'payments.create',
        'invoices.view', 'invoices.create',
      ]),
      isSystem: true,
    },
  });

  console.log(`  ✅ Roles: superadmin, admin, front_desk`);

  // ─── 4. Create Admin User ──────────────────────────────────────────
  const adminEmail = 'admin@demo-hotel.com';
  const adminPassword = 'Admin@123456'; // Change in production!
  const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  const admin = await db.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: adminEmail },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      roleId: superAdminRole.id,
      isVerified: true,
      isPlatformAdmin: true,
      status: 'active',
    },
  });
  console.log(`  ✅ Admin User: ${adminEmail} / ${adminPassword}`);
  console.log(`     User ID: ${admin.id}`);

  // ─── 5. Create Demo Staff User ──────────────────────────────────────
  const staffPassword = 'Staff@123456';
  const staffHash = await bcrypt.hash(staffPassword, SALT_ROUNDS);

  const staff = await db.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'frontdesk@demo-hotel.com' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'frontdesk@demo-hotel.com',
      passwordHash: staffHash,
      firstName: 'Priya',
      lastName: 'Patel',
      roleId: frontDeskRole.id,
      isVerified: true,
      status: 'active',
      department: 'Front Office',
      jobTitle: 'Front Desk Agent',
    },
  });
  console.log(`  ✅ Staff User: frontdesk@demo-hotel.com / ${staffPassword}`);

  // ─── 6. Create a few demo room types ────────────────────────────────
  const roomTypes = [
    { name: 'Standard Room', code: 'STD', basePrice: 3500, maxOccupancy: 2, totalRooms: 40 },
    { name: 'Deluxe Room', code: 'DLX', basePrice: 5500, maxOccupancy: 2, totalRooms: 35 },
    { name: 'Suite', code: 'STE', basePrice: 12000, maxOccupancy: 3, totalRooms: 20 },
    { name: 'Presidential Suite', code: 'PRS', basePrice: 35000, maxOccupancy: 4, totalRooms: 5 },
  ];

  for (const rt of roomTypes) {
    await db.roomType.upsert({
      where: {
        id: `${tenant.id}-rt-${rt.code}`,
      },
      update: {},
      create: {
        id: `${tenant.id}-rt-${rt.code}`,
        tenantId: tenant.id,
        propertyId: property.id,
        name: rt.name,
        code: rt.code,
        basePrice: rt.basePrice,
        maxOccupancy: rt.maxOccupancy,
        totalRooms: rt.totalRooms,
        status: 'active',
      },
    });
  }
  console.log(`  ✅ Room Types: ${roomTypes.length} created`);

  console.log('\n🎉 Seed complete! You can now log in with:');
  console.log('   Admin:  admin@demo-hotel.com / Admin@123456');
  console.log('   Staff:  frontdesk@demo-hotel.com / Staff@123456');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
