import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Deterministic UUIDs for plan IDs (same as seed.ts pattern)
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-plan:' + seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31)
  ].join('-');
};

const plans = [
  {
    id: uuid('plan-trial'),
    name: 'trial',
    displayName: 'Trial',
    description: '14-day free trial with core PMS features. No credit card required.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'INR',
    maxProperties: 1,
    maxUsers: 3,
    maxRooms: 10,
    storageLimitMb: 100,
    features: JSON.stringify([
      { name: 'Dashboard', included: true },
      { name: 'PMS', included: true },
      { name: 'Bookings', included: true },
      { name: 'Front Desk', included: true },
      { name: 'Guests', included: true },
      { name: 'Housekeeping', included: true },
      { name: 'Billing', included: true },
      { name: 'Settings', included: true },
      { name: 'Help', included: true },
    ]),
    sortOrder: 0,
    isPopular: false,
    isActive: true,
  },
  {
    id: uuid('plan-starter'),
    name: 'starter',
    displayName: 'Starter Cloud',
    description: 'For small hotels & guest houses up to 30 rooms. Core PMS + reports + notifications.',
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    currency: 'INR',
    maxProperties: 1,
    maxUsers: 5,
    maxRooms: 30,
    storageLimitMb: 500,
    features: JSON.stringify([
      { name: 'Dashboard', included: true },
      { name: 'PMS', included: true },
      { name: 'Bookings', included: true },
      { name: 'Front Desk', included: true },
      { name: 'Guests', included: true },
      { name: 'Housekeeping', included: true },
      { name: 'Billing', included: true },
      { name: 'Settings', included: true },
      { name: 'Help', included: true },
      { name: 'Reports', included: true },
      { name: 'Notifications', included: true },
    ]),
    sortOrder: 1,
    isPopular: false,
    isActive: true,
  },
  {
    id: uuid('plan-professional'),
    name: 'professional',
    displayName: 'Professional Cloud',
    description: 'For growing hotels up to 80 rooms. PMS + POS + CRM + Channel Manager + WiFi RADIUS.',
    monthlyPrice: 9999,
    yearlyPrice: 99990,
    currency: 'INR',
    maxProperties: 2,
    maxUsers: 15,
    maxRooms: 80,
    storageLimitMb: 2000,
    features: JSON.stringify([
      { name: 'Dashboard', included: true },
      { name: 'PMS', included: true },
      { name: 'Bookings', included: true },
      { name: 'Front Desk', included: true },
      { name: 'Guests', included: true },
      { name: 'Housekeeping', included: true },
      { name: 'Billing', included: true },
      { name: 'Settings', included: true },
      { name: 'Help', included: true },
      { name: 'Reports', included: true },
      { name: 'Notifications', included: true },
      { name: 'Guest Experience', included: true },
      { name: 'POS & Restaurant', included: true },
      { name: 'CRM & Marketing', included: true },
      { name: 'Channel Manager', included: true },
      { name: 'WiFi RADIUS', included: true },
    ]),
    sortOrder: 2,
    isPopular: true,
    isActive: true,
  },
  {
    id: uuid('plan-enterprise'),
    name: 'enterprise',
    displayName: 'Enterprise Cloud',
    description: 'For large hotels & chains up to 200 rooms. All cloud-compatible modules included.',
    monthlyPrice: 17999,
    yearlyPrice: 179990,
    currency: 'INR',
    maxProperties: 5,
    maxUsers: 30,
    maxRooms: 200,
    storageLimitMb: 10000,
    features: JSON.stringify([
      { name: 'Dashboard', included: true },
      { name: 'PMS', included: true },
      { name: 'Bookings', included: true },
      { name: 'Front Desk', included: true },
      { name: 'Guests', included: true },
      { name: 'Housekeeping', included: true },
      { name: 'Billing', included: true },
      { name: 'Settings', included: true },
      { name: 'Help', included: true },
      { name: 'Reports', included: true },
      { name: 'Notifications', included: true },
      { name: 'Guest Experience', included: true },
      { name: 'POS & Restaurant', included: true },
      { name: 'Inventory', included: true },
      { name: 'Parking', included: true },
      { name: 'WiFi & Network', included: true },
      { name: 'Revenue Management', included: true },
      { name: 'Channel Manager', included: true },
      { name: 'CRM & Marketing', included: true },
      { name: 'Marketing', included: true },
      { name: 'Digital Advertising', included: true },
      { name: 'Events', included: true },
      { name: 'Staff Management', included: true },
      { name: 'Security Center', included: true },
      { name: 'Integrations', included: true },
      { name: 'Automation', included: true },
      { name: 'AI Features', included: true },
      { name: 'Chain Management', included: true },
      { name: 'Webhooks', included: true },
    ]),
    sortOrder: 3,
    isPopular: false,
    isActive: true,
  },
];

async function main() {
  // First clear existing plans
  await prisma.subscriptionPlan.deleteMany({});
  console.log('Cleared existing plans');

  for (const plan of plans) {
    await prisma.subscriptionPlan.create({ data: plan });
    console.log(`Created plan: ${plan.name} (${plan.displayName}) - ₹${plan.monthlyPrice}/mo`);
  }

  // Verify
  const count = await prisma.subscriptionPlan.count();
  console.log(`\nTotal plans: ${count}`);

  await prisma.$disconnect();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
