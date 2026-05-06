import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

// Admin credentials
const ADMIN_EMAIL = "admin@staysuite.com";
const ADMIN_PASSWORD = "Admin@123456";

// Demo staff credentials
const STAFF_EMAIL = "staff@staysuite.com";
const STAFF_PASSWORD = "Staff@123456";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Helper: find or create pattern
async function findOrCreate<T>(
  model: string,
  where: Record<string, unknown>,
  create: Record<string, unknown>,
  prismaClient: PrismaClient,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prismaClient as any;
  const existing = await db[model].findFirst({ where });
  if (existing) return existing as T;
  return db[model].create({ data: create }) as Promise<T>;
}

async function main() {
  console.log("🌱 Seeding StaySuite database...\n");

  // ─────────────────────────────────────────────────────────
  // 1. Create Tenant
  // ─────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-hotel" },
    update: {},
    create: {
      name: "StaySuite Demo Hotel",
      slug: "demo-hotel",
      email: "info@staysuite.com",
      phone: "+1-555-0100",
      address: "123 Hospitality Drive",
      city: "San Francisco",
      country: "US",
      timezone: "America/Los_Angeles",
      currency: "USD",
      plan: "enterprise",
      status: "active",
      maxProperties: 10,
      maxUsers: 50,
      maxRooms: 500,
      storageLimitMb: 5000,
      features: JSON.stringify({
        pms: true, crs: true, channelManager: true, pos: true,
        housekeeping: true, maintenance: true, wifi: true, billing: true,
        analytics: true, guestApp: true, iot: true, energy: true,
        security: true, parking: true, foodBeverage: true, spa: true,
        loyalty: true, revenueManagement: true, aiAssist: true,
      }),
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.slug})`);

  // ─────────────────────────────────────────────────────────
  // 2. Create Property
  // ─────────────────────────────────────────────────────────
  const property = await prisma.property.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "grand-resort" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "StaySuite Grand Resort",
      slug: "grand-resort",
      description: "Luxury 5-star resort with ocean views and world-class amenities",
      type: "hotel",
      address: "456 Ocean Boulevard",
      city: "San Francisco",
      state: "California",
      country: "US",
      postalCode: "94102",
      latitude: 37.7749,
      longitude: -122.4194,
      email: "grand@staysuite.com",
      phone: "+1-555-0200",
      website: "https://grand.staysuite.com",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      timezone: "America/Los_Angeles",
      currency: "USD",
      totalRooms: 120,
      totalFloors: 8,
      status: "active",
    },
  });
  console.log(`✅ Property: ${property.name}`);

  // ─────────────────────────────────────────────────────────
  // 3. Create Roles
  // ─────────────────────────────────────────────────────────
  const allPermissions = [
    "dashboard.view",
    "bookings.view", "bookings.create", "bookings.edit", "bookings.delete", "bookings.checkin", "bookings.checkout",
    "guests.view", "guests.create", "guests.edit", "guests.delete",
    "rooms.view", "rooms.create", "rooms.edit", "rooms.delete",
    "rates.view", "rates.create", "rates.edit", "rates.delete",
    "inventory.view", "inventory.manage",
    "housekeeping.view", "housekeeping.manage", "housekeeping.assign",
    "maintenance.view", "maintenance.manage", "maintenance.assign",
    "wifi.view", "wifi.manage", "wifi.plans", "wifi.users", "wifi.vouchers", "wifi.radius",
    "billing.view", "billing.manage", "billing.invoices", "billing.payments",
    "reports.view", "reports.export",
    "staff.view", "staff.create", "staff.edit", "staff.delete",
    "staff.schedules.view", "staff.schedules.manage",
    "staff.attendance.view", "staff.attendance.manage",
    "channels.view", "channels.manage", "channels.connect",
    "settings.view", "settings.manage",
    "notifications.view", "notifications.manage",
    "ai.view", "ai.suggestions.view", "ai.conversations",
    "security.view", "security.manage", "security.cameras",
  ];

  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "admin" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "admin",
      displayName: "Administrator",
      description: "Full system access with all permissions",
      permissions: JSON.stringify(allPermissions),
      isSystem: true,
    },
  });
  console.log(`✅ Role: ${adminRole.displayName}`);

  const managerRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "manager" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "manager",
      displayName: "Hotel Manager",
      description: "Management access for day-to-day operations",
      permissions: JSON.stringify(allPermissions.filter((p) => !p.startsWith("settings."))),
      isSystem: true,
    },
  });
  console.log(`✅ Role: ${managerRole.displayName}`);

  const frontDeskRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "front_desk" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "front_desk",
      displayName: "Front Desk",
      description: "Front desk operations: check-in, check-out, guest management",
      permissions: JSON.stringify([
        "dashboard.view",
        "bookings.view", "bookings.create", "bookings.edit", "bookings.checkin", "bookings.checkout",
        "guests.view", "guests.create", "guests.edit",
        "rooms.view",
        "housekeeping.view", "housekeeping.manage",
        "wifi.view", "wifi.users", "wifi.vouchers",
        "billing.view",
      ]),
      isSystem: true,
    },
  });
  console.log(`✅ Role: ${frontDeskRole.displayName}`);

  // ─────────────────────────────────────────────────────────
  // 4. Create Admin User
  // ─────────────────────────────────────────────────────────
  const adminPasswordHash = await hashPassword(ADMIN_PASSWORD);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: ADMIN_EMAIL } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      firstName: "Admin",
      lastName: "User",
      jobTitle: "System Administrator",
      department: "Management",
      roleId: adminRole.id,
      isVerified: true,
      verifiedAt: new Date(),
      isPlatformAdmin: true,
      status: "active",
    },
  });
  console.log(`✅ Admin: ${adminUser.email}`);

  // ─────────────────────────────────────────────────────────
  // 5. Create Demo Staff User
  // ─────────────────────────────────────────────────────────
  const staffPasswordHash = await hashPassword(STAFF_PASSWORD);

  const staffUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: STAFF_EMAIL } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: STAFF_EMAIL,
      passwordHash: staffPasswordHash,
      firstName: "Front",
      lastName: "Desk",
      jobTitle: "Receptionist",
      department: "Front Office",
      roleId: frontDeskRole.id,
      isVerified: true,
      verifiedAt: new Date(),
      isPlatformAdmin: false,
      status: "active",
    },
  });
  console.log(`✅ Staff: ${staffUser.email}`);

  // ─────────────────────────────────────────────────────────
  // 6. Create WiFi Plans
  // ─────────────────────────────────────────────────────────
  const freePlan = await findOrCreate(
    "wiFiPlan",
    { tenantId: tenant.id, name: "Free Basic" },
    {
      tenantId: tenant.id,
      name: "Free Basic",
      description: "Complimentary internet access for all guests",
      downloadSpeed: 2048,
      uploadSpeed: 1024,
      dataLimit: 500,
      sessionTimeoutSec: 14400,
      idleTimeoutSec: 1800,
      maxDevices: 1,
      validityDays: 1,
      price: 0,
      currency: "USD",
      status: "active",
      priority: 10,
    },
    prisma,
  );
  console.log(`✅ WiFi Plan: ${freePlan.name}`);

  const premiumPlan = await findOrCreate(
    "wiFiPlan",
    { tenantId: tenant.id, name: "Premium High-Speed" },
    {
      tenantId: tenant.id,
      name: "Premium High-Speed",
      description: "High-speed internet for business travelers and VIP guests",
      downloadSpeed: 51200,
      uploadSpeed: 25600,
      dataLimit: 0,
      sessionTimeoutSec: 86400,
      idleTimeoutSec: 7200,
      maxDevices: 3,
      validityDays: 1,
      price: 9.99,
      currency: "USD",
      status: "active",
      priority: 1,
    },
    prisma,
  );
  console.log(`✅ WiFi Plan: ${premiumPlan.name}`);

  // ─────────────────────────────────────────────────────────
  // 7. Create Room Type (uses @@unique([propertyId, code]))
  // ─────────────────────────────────────────────────────────
  const deluxeRoomType = await prisma.roomType.upsert({
    where: { propertyId_code: { propertyId: property.id, code: "DLX-OV" } },
    update: {},
    create: {
      propertyId: property.id,
      name: "Deluxe Ocean View",
      code: "DLX-OV",
      description: "Elegant room with panoramic ocean views",
      maxAdults: 2,
      maxChildren: 1,
      maxOccupancy: 3,
      basePrice: 250,
      currency: "USD",
      amenities: JSON.stringify([
        "WiFi", "TV", "Minibar", "Safe", "Air Conditioning", "Coffee Machine",
      ]),
      status: "active",
    },
  });
  console.log(`✅ Room Type: ${deluxeRoomType.name}`);

  // ─────────────────────────────────────────────────────────
  // 8. Create Demo Rooms
  // ─────────────────────────────────────────────────────────
  const roomNumbers = [301, 302, 303, 401, 402, 403, 501, 502, 503];
  let roomsCreated = 0;

  for (const roomNum of roomNumbers) {
    const floor = Math.floor(roomNum / 100);
    const existing = await prisma.room.findFirst({
      where: { propertyId: property.id, number: String(roomNum) },
    });
    if (!existing) {
      await prisma.room.create({
        data: {
          propertyId: property.id,
          roomTypeId: deluxeRoomType.id,
          number: String(roomNum),
          name: `Room ${roomNum}`,
          floor,
          status: "available",
        },
      });
      roomsCreated++;
    }
  }
  console.log(`✅ Rooms: ${roomsCreated > 0 ? `${roomsCreated} created` : "already exist"} (floors 3-5)`);

  // ─────────────────────────────────────────────────────────
  // 9. Create Rate Plan
  // ─────────────────────────────────────────────────────────
  await prisma.ratePlan.upsert({
    where: { tenantId_roomTypeId_code: { tenantId: tenant.id, roomTypeId: deluxeRoomType.id, code: "BAR" } },
    update: {},
    create: {
      tenantId: tenant.id,
      roomTypeId: deluxeRoomType.id,
      name: "Best Available Rate",
      code: "BAR",
      description: "Standard flexible rate with free cancellation",
      basePrice: 250,
      currency: "USD",
      cancellationPolicy: "48h",
      cancellationHours: 48,
      mealPlan: "room_only",
      status: "active",
    },
  });
  console.log(`✅ Rate Plan: Best Available Rate`);

  // ─────────────────────────────────────────────────────────
  // Done!
  // ─────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("🎉 Seed completed successfully!");
  console.log("═".repeat(60));
  console.log("\n📋 Login Credentials:");
  console.log("─────────────────────────────────────────");
  console.log(`  🔑 Admin:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  🔑 Staff:  ${STAFF_EMAIL} / ${STAFF_PASSWORD}`);
  console.log("─────────────────────────────────────────");
  console.log(`  🏨 Tenant:   ${tenant.name}`);
  console.log(`  🏢 Property: ${property.name}`);
  console.log(`  📡 WiFi:     ${freePlan.name}, ${premiumPlan.name}`);
  console.log(`  🛏️  Rooms:    ${roomNumbers.length} rooms (floors 3-5)`);
  console.log("═══════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
