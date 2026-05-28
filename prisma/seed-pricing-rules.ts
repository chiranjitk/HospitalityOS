/**
 * Standalone script to seed ONLY the 31 pricing rules (all 15 types across 2 properties).
 * Does NOT touch any other data — safe to run on production without wiping existing data.
 *
 * Usage:
 *   npx tsx prisma/seed-pricing-rules.ts
 *   bunx tsx prisma/seed-pricing-rules.ts
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Deterministic UUID (same as main seed.ts)
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31),
  ].join('-');
};

async function main() {
  console.log('=== Seeding Pricing Rules Only (31 rules, 15 types) ===\n');

  const today = new Date();
  const d = (days: number) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  // Build all 31 rules
  const rules = [
    // ── Property 1: Royal Stay Kolkata ──────────────────────────
    // pr-1: markup
    {
      id: uuid('pr-1'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Peak Season Markup', type: 'markup',
      description: '10% general markup during peak season for all room types',
      value: 10, valueType: 'percentage',
      conditions: JSON.stringify({}),
      priority: 4, isActive: true,
      effectiveFrom: d(-30),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
      appliedCount: 89, lastAppliedAt: d(-1),
    },
    // pr-2: markdown
    {
      id: uuid('pr-2'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Monsoon Clearance Sale', type: 'markdown',
      description: '15% markdown across all rooms during monsoon',
      value: 15, valueType: 'percentage',
      conditions: JSON.stringify({ daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu'] }),
      priority: 3, isActive: true,
      effectiveFrom: d(-60), effectiveTo: d(60),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2')]),
      appliedCount: 34, lastAppliedAt: d(-3),
    },
    // pr-3: discount_percentage
    {
      id: uuid('pr-3'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Corporate Rate Discount', type: 'discount_percentage',
      description: '12% percentage discount for corporate bookings',
      value: 12, valueType: 'percentage',
      conditions: JSON.stringify({ bookingChannel: ['direct', 'phone'] }),
      priority: 6, isActive: true,
      effectiveFrom: d(-90),
      roomTypes: JSON.stringify([uuid('roomtype-2'), uuid('roomtype-3')]),
      appliedCount: 56, lastAppliedAt: d(0),
    },
    // pr-4: discount_fixed
    {
      id: uuid('pr-4'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Weekday Flash Sale', type: 'discount_fixed',
      description: 'Flat ₹500 off on weekday bookings',
      value: 500, valueType: 'fixed',
      conditions: JSON.stringify({ daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }),
      priority: 2, isActive: true,
      effectiveFrom: d(-15), effectiveTo: d(15),
      roomTypes: JSON.stringify([uuid('roomtype-1')]),
      appliedCount: 18,
    },
    // pr-5: surcharge_percentage
    {
      id: uuid('pr-5'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'New Year Eve Surcharge', type: 'surcharge_percentage',
      description: '30% surcharge for New Year Eve week',
      value: 30, valueType: 'percentage',
      conditions: JSON.stringify({}),
      priority: 15, isActive: true,
      effectiveFrom: d(-10), effectiveTo: d(20),
      roomTypes: JSON.stringify([uuid('roomtype-3'), uuid('roomtype-4')]),
      appliedCount: 5,
    },
    // pr-6: surcharge_fixed
    {
      id: uuid('pr-6'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Festival Gala Dinner Add-on', type: 'surcharge_fixed',
      description: 'Flat ₹2000 surcharge during Durga Puja for gala dinner inclusion',
      value: 2000, valueType: 'fixed',
      conditions: JSON.stringify({}),
      priority: 8, isActive: true,
      effectiveFrom: d(-45), effectiveTo: d(15),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
      appliedCount: 10,
    },
    // pr-7: early_bird
    {
      id: uuid('pr-7'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Plan Ahead & Save', type: 'early_bird',
      description: '15% off for bookings made 21+ days in advance',
      value: 15, valueType: 'percentage',
      conditions: JSON.stringify({ advanceBookingDaysMin: 21 }),
      priority: 5, isActive: true,
      effectiveFrom: d(-180),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3')]),
      appliedCount: 67, lastAppliedAt: d(-2),
    },
    // pr-8: last_minute
    {
      id: uuid('pr-8'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Last Minute Deal', type: 'last_minute',
      description: '20% off for bookings within 48 hours of check-in',
      value: 20, valueType: 'percentage',
      conditions: JSON.stringify({ advanceBookingDaysMax: 2 }),
      priority: 7, isActive: true,
      effectiveFrom: d(-60),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2')]),
      appliedCount: 23, lastAppliedAt: d(-1),
    },
    // pr-9: advance_booking
    {
      id: uuid('pr-9'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Summer Early Booking', type: 'advance_booking',
      description: '8% discount for summer bookings made 30-90 days in advance',
      value: 8, valueType: 'percentage',
      conditions: JSON.stringify({ advanceBookingDaysMin: 30, advanceBookingDaysMax: 90 }),
      priority: 4, isActive: true,
      effectiveFrom: d(-120), effectiveTo: d(180),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
      appliedCount: 41,
    },
    // pr-10: seasonal
    {
      id: uuid('pr-10'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Durga Puja Season Premium', type: 'seasonal',
      description: '25% premium during Durga Puja festival season',
      value: 25, valueType: 'percentage',
      conditions: JSON.stringify({ startDate: '2025-10-01', endDate: '2025-10-24' }),
      priority: 10, isActive: true,
      effectiveFrom: d(-60), effectiveTo: d(90),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
      appliedCount: 8,
    },
    // pr-11: weekend
    {
      id: uuid('pr-11'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Weekend Surge', type: 'weekend',
      description: '15% markup on weekends for all room types',
      value: 15, valueType: 'percentage',
      conditions: JSON.stringify({ daysOfWeek: ['Sat', 'Sun'] }),
      priority: 5, isActive: true,
      effectiveFrom: d(-90),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3')]),
      appliedCount: 78, lastAppliedAt: d(-1),
    },
    // pr-12: long_stay
    {
      id: uuid('pr-12'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Extended Stay Discount', type: 'long_stay',
      description: '12% discount for stays of 7+ nights',
      value: 12, valueType: 'percentage',
      conditions: JSON.stringify({ minNights: 7 }),
      priority: 3, isActive: true,
      effectiveFrom: d(-120),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2')]),
      appliedCount: 29, lastAppliedAt: d(-4),
    },
    // pr-13: occupancy
    {
      id: uuid('pr-13'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Extra Guest Surcharge', type: 'occupancy',
      description: '₹800 per extra guest beyond 2 adults',
      value: 800, valueType: 'fixed',
      conditions: JSON.stringify({ minOccupancy: 3 }),
      priority: 2, isActive: true,
      effectiveFrom: d(-200),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
      appliedCount: 112, lastAppliedAt: d(0),
    },
    // pr-14: promo_code
    {
      id: uuid('pr-14'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'Welcome Back Offer', type: 'promo_code',
      description: '18% off for returning guests using promo code STAY2025',
      value: 18, valueType: 'percentage',
      conditions: JSON.stringify({ promoCode: 'STAY2025', promoMaxUses: 200 }),
      priority: 8, isActive: true,
      effectiveFrom: d(-30), effectiveTo: d(120),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3')]),
      appliedCount: 43, lastAppliedAt: d(-1),
    },
    // pr-15: channel
    {
      id: uuid('pr-15'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'OTA Commission Offset', type: 'channel',
      description: '12% markup on OTA bookings to offset commission',
      value: 12, valueType: 'percentage',
      conditions: JSON.stringify({ bookingChannel: ['booking_com', 'expedia', 'agoda'] }),
      priority: 6, isActive: true,
      effectiveFrom: d(-60),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
      appliedCount: 87, lastAppliedAt: d(0),
    },
    // pr-16: dynamic (legacy, inactive)
    {
      id: uuid('pr-16'), tenantId: uuid('tenant-1'), propertyId: uuid('property-1'),
      name: 'AI Dynamic Pricing', type: 'dynamic',
      description: 'Auto-adjusted by RevPAR optimizer',
      value: 5, valueType: 'percentage',
      conditions: JSON.stringify({}),
      priority: 1, isActive: false,
      effectiveFrom: d(-180),
      roomTypes: JSON.stringify([uuid('roomtype-1'), uuid('roomtype-2'), uuid('roomtype-3'), uuid('roomtype-4')]),
      appliedCount: 0,
    },

    // ── Property 2: Royal Stay Darjeeling ────────────────────────
    // pr-17: weekend
    {
      id: uuid('pr-17'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Hill Station Weekend Premium', type: 'weekend',
      description: '20% weekend markup for mountain property',
      value: 20, valueType: 'percentage',
      conditions: JSON.stringify({ daysOfWeek: ['Sat', 'Sun'] }),
      priority: 5, isActive: true,
      effectiveFrom: d(-60),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 32, lastAppliedAt: d(-2),
    },
    // pr-18: markdown
    {
      id: uuid('pr-18'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Off-Season Markdown', type: 'markdown',
      description: '20% off during off-season months',
      value: 20, valueType: 'percentage',
      conditions: JSON.stringify({}),
      priority: 3, isActive: true,
      effectiveFrom: d(-30),
      roomTypes: JSON.stringify([uuid('roomtype-5')]),
      appliedCount: 15,
    },
    // pr-19: early_bird
    {
      id: uuid('pr-19'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Valley View Early Bird', type: 'early_bird',
      description: '10% off for 14+ day advance bookings',
      value: 10, valueType: 'percentage',
      conditions: JSON.stringify({ advanceBookingDaysMin: 14 }),
      priority: 4, isActive: true,
      effectiveFrom: d(-90),
      roomTypes: JSON.stringify([uuid('roomtype-6')]),
      appliedCount: 22,
    },
    // pr-20: last_minute
    {
      id: uuid('pr-20'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Mountain Last Minute Escape', type: 'last_minute',
      description: '25% markup for same-day bookings (high demand)',
      value: 25, valueType: 'percentage',
      conditions: JSON.stringify({ advanceBookingDaysMax: 1 }),
      priority: 8, isActive: true,
      effectiveFrom: d(-30),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 9,
    },
    // pr-21: advance_booking
    {
      id: uuid('pr-21'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Monsoon Advance Saver', type: 'advance_booking',
      description: '12% off for monsoon bookings made 30-60 days ahead',
      value: 12, valueType: 'percentage',
      conditions: JSON.stringify({ advanceBookingDaysMin: 30, advanceBookingDaysMax: 60 }),
      priority: 5, isActive: true,
      effectiveFrom: d(-45), effectiveTo: d(120),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 14,
    },
    // pr-22: seasonal
    {
      id: uuid('pr-22'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Summer Peak Premium', type: 'seasonal',
      description: '30% premium during summer months',
      value: 30, valueType: 'percentage',
      conditions: JSON.stringify({ months: [4, 5, 6] }),
      priority: 12, isActive: true,
      effectiveFrom: d(-60), effectiveTo: d(90),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 11,
    },
    // pr-23: long_stay
    {
      id: uuid('pr-23'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Retreat Long Stay Package', type: 'long_stay',
      description: '18% off for stays of 14+ nights',
      value: 18, valueType: 'percentage',
      conditions: JSON.stringify({ minNights: 14 }),
      priority: 6, isActive: true,
      effectiveFrom: d(-60),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 7,
    },
    // pr-24: occupancy
    {
      id: uuid('pr-24'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Family Room Extra Guest', type: 'occupancy',
      description: '₹600 per extra guest beyond 3 adults',
      value: 600, valueType: 'fixed',
      conditions: JSON.stringify({ minOccupancy: 4 }),
      priority: 3, isActive: true,
      effectiveFrom: d(-90),
      roomTypes: JSON.stringify([uuid('roomtype-5')]),
      appliedCount: 18,
    },
    // pr-25: promo_code
    {
      id: uuid('pr-25'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Honeymoon Special', type: 'promo_code',
      description: '22% off for honeymoon package with code LOVE2025',
      value: 22, valueType: 'percentage',
      conditions: JSON.stringify({ promoCode: 'LOVE2025', promoMaxUses: 50 }),
      priority: 10, isActive: true,
      effectiveFrom: d(-15), effectiveTo: d(180),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 8,
    },
    // pr-26: channel
    {
      id: uuid('pr-26'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Airbnb Host Fee Offset', type: 'channel',
      description: '15% markup on Airbnb to offset host service fee',
      value: 15, valueType: 'percentage',
      conditions: JSON.stringify({ bookingChannel: ['airbnb'] }),
      priority: 7, isActive: true,
      effectiveFrom: d(-45),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 33,
    },
    // pr-27: discount_percentage
    {
      id: uuid('pr-27'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Senior Citizen Discount', type: 'discount_percentage',
      description: '15% discount for senior citizen bookings',
      value: 15, valueType: 'percentage',
      conditions: JSON.stringify({ guestType: ['senior'] }),
      priority: 4, isActive: true,
      effectiveFrom: d(-120),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 19,
    },
    // pr-28: surcharge_fixed
    {
      id: uuid('pr-28'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Holiday Breakfast Buffet', type: 'surcharge_fixed',
      description: '₹1200 breakfast buffet surcharge on holidays',
      value: 1200, valueType: 'fixed',
      conditions: JSON.stringify({ daysOfWeek: ['Sun'] }),
      priority: 5, isActive: true,
      effectiveFrom: d(-30),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 21,
    },
    // pr-29: discount_fixed
    {
      id: uuid('pr-29'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Weekday Flat Discount', type: 'discount_fixed',
      description: 'Flat ₹300 off Monday-Thursday stays',
      value: 300, valueType: 'fixed',
      conditions: JSON.stringify({ daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu'] }),
      priority: 3, isActive: true,
      effectiveFrom: d(-20),
      roomTypes: JSON.stringify([uuid('roomtype-6')]),
      appliedCount: 12,
    },
    // pr-30: markup
    {
      id: uuid('pr-30'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Festival Season Uplift', type: 'markup',
      description: '8% markup across all rooms during festivals',
      value: 8, valueType: 'percentage',
      conditions: JSON.stringify({}),
      priority: 6, isActive: true,
      effectiveFrom: d(-10),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 5,
    },
    // pr-31: surcharge_percentage
    {
      id: uuid('pr-31'), tenantId: uuid('tenant-1'), propertyId: uuid('property-2'),
      name: 'Diwali Festival Surcharge', type: 'surcharge_percentage',
      description: '25% surcharge during Diwali week',
      value: 25, valueType: 'percentage',
      conditions: JSON.stringify({}),
      priority: 14, isActive: true,
      effectiveFrom: d(-5), effectiveTo: d(25),
      roomTypes: JSON.stringify([uuid('roomtype-5'), uuid('roomtype-6')]),
      appliedCount: 3,
    },
  ];

  // Use upsert to avoid duplicate key errors if rules already exist
  let created = 0;
  let skipped = 0;

  for (const rule of rules) {
    const exists = await prisma.pricingRule.findUnique({ where: { id: rule.id } });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.pricingRule.create({ data: rule as any });
    created++;
  }

  console.log(`✅ Done! ${created} pricing rules created, ${skipped} skipped (already exist).`);
  console.log('\nRule types seeded:');
  const types = [...new Set(rules.map(r => r.type))];
  types.forEach(t => {
    const names = rules.filter(r => r.type === t).map(r => r.name);
    console.log(`  • ${t}: ${names.join(', ')}`);
  });
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
