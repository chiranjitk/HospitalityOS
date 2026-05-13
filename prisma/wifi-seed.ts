import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Generate deterministic UUIDs from seed strings for PostgreSQL @db.Uuid compatibility.
const uuid = (seed: string): string => {
  const h = createHash('sha256').update('staysuite-seed:' + seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(12, 15),
    ((parseInt(h.charAt(15), 16) & 3) | 8).toString(16) + h.slice(16, 19),
    h.slice(19, 31)
  ].join('-');
};

const prisma = new PrismaClient();

const TENANT_ID = uuid('tenant-1');
const PROPERTY_ID = uuid('property-1');

// WiFi Plan IDs
const PLAN_IDS = {
  free: uuid('wifiplan-1'),
  basic: uuid('wifiplan-2'),
  standard: uuid('wifiplan-3'),
  premium: uuid('wifiplan-4'),
  vip: uuid('wifiplan-5'),
  conference: uuid('wifiplan-6'),
};

// Network Interface IDs
const IFACE_IDS = {
  eth0: uuid('netif-eth0'),
  eth1: uuid('netif-eth1'),
  br0: uuid('netif-br0'),
  bond0: uuid('netif-bond0'),
  wlan0: uuid('netif-wlan0'),
  eth2: uuid('netif-eth2'),
};

// VLAN IDs
const VLAN_IDS = {
  guest: uuid('vlan-10'),
  staff: uuid('vlan-20'),
  pos: uuid('vlan-30'),
  iot: uuid('vlan-40'),
  mgmt: uuid('vlan-50'),
};

// DHCP Subnet IDs
const SUBNET_IDS = {
  guest: uuid('dhcp-sub-guest'),
  staff: uuid('dhcp-sub-staff'),
  iot: uuid('dhcp-sub-iot'),
  mgmt: uuid('dhcp-sub-mgmt'),
};

// DNS Zone IDs
const ZONE_IDS = {
  main: uuid('dnszone-main'),
  guest: uuid('dnszone-guest'),
};

// Captive Portal IDs
const PORTAL_IDS = {
  hotel: uuid('portal-hotel'),
  staff: uuid('portal-staff'),
};

// Firewall Zone IDs
const FW_ZONE_IDS = {
  wan: uuid('fwzone-wan'),
  lan: uuid('fwzone-lan'),
  guest: uuid('fwzone-guest'),
};

// Firewall Schedule IDs
const FW_SCHED_IDS = {
  business: uuid('fwsched-business'),
  night: uuid('fwsched-night'),
};

// Bandwidth Policy IDs
const BW_POLICY_IDS = {
  free: uuid('bwpolicy-free'),
  standard: uuid('bwpolicy-standard'),
  premium: uuid('bwpolicy-premium'),
};

// Bandwidth Pool IDs
const BW_POOL_IDS = {
  guest: uuid('bwpool-guest'),
  staff: uuid('bwpool-staff'),
};

export async function seedWiFiData() {
  console.log('\n📡 Seeding comprehensive WiFi module data...');

  // ─── Clean existing WiFi module data ───────────────────────────
  console.log('Cleaning WiFi module data...');
  try {
    // Order matters due to FK constraints
    await prisma.natLog.deleteMany({});
    await prisma.bandwidthUsageSession.deleteMany({});
    await prisma.bandwidthUsageDaily.deleteMany({});
    await prisma.bandwidthPolicy.deleteMany({});
    await prisma.bandwidthPool.deleteMany({});
    await prisma.contentFilter.deleteMany({});
    await prisma.scheduleAccess.deleteMany({});
    await prisma.macFilter.deleteMany({});
    await prisma.firewallRule.deleteMany({});
    await prisma.firewallSchedule.deleteMany({});
    await prisma.firewallZone.deleteMany({});
    await prisma.portalAuthentication.deleteMany({});
    await prisma.portalPage.deleteMany({});
    await prisma.portalMapping.deleteMany({});
    await prisma.portalTemplate.deleteMany({});
    await prisma.captivePortal.deleteMany({});
    await prisma.dnsRedirectRule.deleteMany({});
    await prisma.dnsRecord.deleteMany({});
    await prisma.dnsZone.deleteMany({});
    await prisma.dhcpOption.deleteMany({});
    await prisma.dhcpLease.deleteMany({});
    await prisma.dhcpReservation.deleteMany({});
    await prisma.dhcpSubnet.deleteMany({});
    await prisma.portForwardRule.deleteMany({});
    await prisma.wanFailover.deleteMany({});
    await prisma.bondMember.deleteMany({});
    await prisma.bondConfig.deleteMany({});
    await prisma.bridgeConfig.deleteMany({});
    await prisma.vlanConfig.deleteMany({});
    await prisma.interfaceConfig.deleteMany({});
    await prisma.interfaceRole.deleteMany({});
    await prisma.networkInterface.deleteMany({});
    await prisma.networkConfigBackup.deleteMany({});
    await prisma.systemNetworkHealth.deleteMany({});
    await prisma.syslogServer.deleteMany({});
    await prisma.radiusServerConfig.deleteMany({});
    await prisma.radiusNAS.deleteMany({});
    await prisma.wiFiAAAConfig.deleteMany({});
    await prisma.wiFiGateway.deleteMany({});
    await prisma.wiFiSession.deleteMany({});
    await prisma.wiFiVoucher.deleteMany({});
    await prisma.radUserGroup.deleteMany({});
    await prisma.radReply.deleteMany({});
    await prisma.radCheck.deleteMany({});
    await prisma.radGroupCheck.deleteMany({});
    await prisma.radGroupReply.deleteMany({});
    await prisma.radPostAuth.deleteMany({});
    await prisma.wiFiUser.deleteMany({});
    await prisma.wiFiPlan.deleteMany({});
    // New feature tables (9 features)
    await prisma.wiFiSLAMetric.deleteMany({});
    await prisma.wiFiSLAConfig.deleteMany({});
    await prisma.wiFiPreArrivalConfig.deleteMany({});
    await prisma.wiFiSatisfactionSurvey.deleteMany({});
    await prisma.wiFiBandwidthUpgrade.deleteMany({});
    await prisma.wiFiIdentityLog.deleteMany({});
    await prisma.wiFiConsentLog.deleteMany({});
    await prisma.wiFiDevice.deleteMany({});
    await prisma.wiFiAlert.deleteMany({});
    await prisma.wiFiPartnerAuth.deleteMany({});
    await prisma.wiFiPartner.deleteMany({});
    await prisma.portalAdCampaign.deleteMany({});
    console.log('WiFi module data cleaned.');
  } catch (e: any) {
    console.log('WiFi cleanup note:', e.message);
  }

  const now = new Date();
  const day = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
  const hour = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);
  const min = (m: number) => new Date(now.getTime() + m * 60 * 1000);

  // ═══════════════════════════════════════════════════════════════
  // 1. WiFi PLANS (6)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Plans (6)...');
  await prisma.wiFiPlan.createMany({
    data: [
      {
        id: PLAN_IDS.free,
        tenantId: TENANT_ID,
        name: 'Free WiFi',
        description: 'Complimentary basic WiFi for all guests. Suitable for browsing and email.',
        downloadSpeed: 5,
        uploadSpeed: 2,
        dataLimit: null, // unlimited
        sessionLimit: 1,
        price: 0,
        currency: 'INR',
        priority: 1,
        validityDays: 1,
        status: 'active',
      },
      {
        id: PLAN_IDS.basic,
        tenantId: TENANT_ID,
        name: 'Basic Plan',
        description: 'Entry-level paid plan with 2GB data. Good for light streaming.',
        downloadSpeed: 10,
        uploadSpeed: 5,
        dataLimit: 2048, // 2GB in MB
        sessionLimit: 2,
        price: 99,
        currency: 'INR',
        priority: 2,
        validityDays: 1,
        status: 'active',
      },
      {
        id: PLAN_IDS.standard,
        tenantId: TENANT_ID,
        name: 'Standard Plan',
        description: 'Mid-tier plan with 5GB data. Great for video calls and streaming.',
        downloadSpeed: 25,
        uploadSpeed: 10,
        dataLimit: 5120, // 5GB in MB
        sessionLimit: 3,
        price: 199,
        currency: 'INR',
        priority: 3,
        validityDays: 3,
        status: 'active',
      },
      {
        id: PLAN_IDS.premium,
        tenantId: TENANT_ID,
        name: 'Premium Plan',
        description: 'High-speed plan with 15GB data. Ideal for business travelers.',
        downloadSpeed: 50,
        uploadSpeed: 25,
        dataLimit: 15360, // 15GB in MB
        sessionLimit: 5,
        price: 399,
        currency: 'INR',
        priority: 4,
        validityDays: 5,
        status: 'active',
      },
      {
        id: PLAN_IDS.vip,
        tenantId: TENANT_ID,
        name: 'VIP Suite Plan',
        description: 'Unlimited high-speed WiFi for VIP and suite guests. Premium experience.',
        downloadSpeed: 100,
        uploadSpeed: 50,
        dataLimit: null, // unlimited
        sessionLimit: 10,
        price: 599,
        currency: 'INR',
        priority: 5,
        validityDays: 7,
        status: 'active',
      },
      {
        id: PLAN_IDS.conference,
        tenantId: TENANT_ID,
        name: 'Conference Plan',
        description: 'Optimized for conference rooms and events. 10GB shared data per session.',
        downloadSpeed: 30,
        uploadSpeed: 15,
        dataLimit: 10240, // 10GB in MB
        sessionLimit: 25,
        price: 299,
        currency: 'INR',
        priority: 3,
        validityDays: 1,
        status: 'active',
      },
    ],
  });
  console.log('✓ 6 WiFi Plans seeded');

  // ═══════════════════════════════════════════════════════════════
  // 2. WiFi USERS (8)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Users (8)...');
  await prisma.wiFiUser.createMany({
    data: [
      {
        id: uuid('wifiuser-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.amit.mukherjee',
        password: 'hashed_password_1',
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        userType: 'guest',
        planId: PLAN_IDS.premium,
        validFrom: day(-2),
        validUntil: day(1),
        maxSessions: 5,
        sessionCount: 2,
        totalBytesIn: 524288000, // ~500MB
        totalBytesOut: 104857600, // ~100MB
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-2),
        lastAccountingAt: min(-15),
      },
      {
        id: uuid('wifiuser-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.rahul.banerjee',
        password: 'hashed_password_2',
        guestId: uuid('guest-3'),
        bookingId: uuid('booking-2'),
        userType: 'guest',
        planId: PLAN_IDS.vip,
        validFrom: day(-1),
        validUntil: day(3),
        maxSessions: 10,
        sessionCount: 3,
        totalBytesIn: 2000000000, // ~2GB
        totalBytesOut: 500000000,
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-1),
        lastAccountingAt: min(-5),
      },
      {
        id: uuid('wifiuser-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.sneha.gupta',
        password: 'hashed_password_3',
        guestId: uuid('guest-2'),
        bookingId: uuid('booking-3'),
        userType: 'guest',
        planId: PLAN_IDS.standard,
        validFrom: day(0),
        validUntil: day(4),
        maxSessions: 3,
        sessionCount: 1,
        totalBytesIn: 157286400, // ~150MB
        totalBytesOut: 52428800,
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-4),
        lastAccountingAt: min(-30),
      },
      {
        id: uuid('wifiuser-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.vikram.singh',
        password: 'hashed_password_4',
        guestId: uuid('guest-5'),
        bookingId: uuid('booking-4'),
        userType: 'guest',
        planId: PLAN_IDS.vip,
        validFrom: day(0),
        validUntil: day(2),
        maxSessions: 10,
        sessionCount: 1,
        totalBytesIn: 78643200, // ~75MB
        totalBytesOut: 26214400,
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-3),
        lastAccountingAt: min(-20),
      },
      {
        id: uuid('wifiuser-5'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'staff.priya.das',
        password: 'hashed_password_5',
        guestId: null,
        bookingId: null,
        userType: 'staff',
        planId: PLAN_IDS.premium,
        validFrom: day(-30),
        validUntil: day(30),
        maxSessions: 3,
        sessionCount: 1,
        totalBytesIn: 314572800, // ~300MB
        totalBytesOut: 104857600,
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-6),
        lastAccountingAt: min(-45),
      },
      {
        id: uuid('wifiuser-6'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'staff.anita.roy',
        password: 'hashed_password_6',
        guestId: null,
        bookingId: null,
        userType: 'staff',
        planId: PLAN_IDS.standard,
        validFrom: day(-30),
        validUntil: day(30),
        maxSessions: 2,
        sessionCount: 0,
        totalBytesIn: 0,
        totalBytesOut: 0,
        status: 'active',
        radiusSynced: false,
        radiusSyncedAt: null,
        lastAccountingAt: null,
      },
      {
        id: uuid('wifiuser-7'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'guest.rina.chatterjee',
        password: 'hashed_password_7',
        guestId: uuid('guest-6'),
        bookingId: uuid('booking-6'),
        userType: 'guest',
        planId: PLAN_IDS.basic,
        validFrom: day(-3),
        validUntil: day(0),
        maxSessions: 2,
        sessionCount: 0,
        totalBytesIn: 1048576, // ~1MB
        totalBytesOut: 524288,
        status: 'expired',
        radiusSynced: true,
        radiusSyncedAt: day(-2),
        lastAccountingAt: day(-1),
      },
      {
        id: uuid('wifiuser-8'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        username: 'conference.room1',
        password: 'hashed_password_8',
        guestId: null,
        bookingId: null,
        userType: 'event',
        planId: PLAN_IDS.conference,
        validFrom: day(0),
        validUntil: day(1),
        maxSessions: 25,
        sessionCount: 8,
        totalBytesIn: 1000000000, // ~1GB
        totalBytesOut: 500000000, // ~500MB
        status: 'active',
        radiusSynced: true,
        radiusSyncedAt: hour(-1),
        lastAccountingAt: min(-10),
      },
    ],
  });
  console.log('✓ 8 WiFi Users seeded');

  // ═══════════════════════════════════════════════════════════════
  // 2b. RADIUS CREDENTIALS (RadCheck + RadReply + RadUserGroup)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding RADIUS credentials for WiFi users...');

  // RadCheck — authentication records (Cleartext-Password)
  await prisma.radCheck.createMany({
    data: [
      // Active guest users
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'Cleartext-Password', op: ':=', value: 'Amit@2024', isActive: true },
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'Cleartext-Password', op: ':=', value: 'Rahul@2024', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'Cleartext-Password', op: ':=', value: 'Sneha@2024', isActive: true },
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'Cleartext-Password', op: ':=', value: 'Vikram@2024', isActive: true },
      // Staff users
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'Cleartext-Password', op: ':=', value: 'Staff@Priya', isActive: true },
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'Cleartext-Password', op: ':=', value: 'Staff@Anita', isActive: true },
      // Event user
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'Cleartext-Password', op: ':=', value: 'Conf@2024', isActive: true },
    ],
  });
  console.log('✓ RadCheck records seeded');

  // RadReply — authorization attributes (bandwidth, data limits)
  // Uses Cryptsk VSA attributes (Vendor ID 64179) — device IS the NAS gateway.
  // WISPr attrs kept for cross-platform compatibility (RFC 5416).
  await prisma.radReply.createMany({
    data: [
      // guest.amit.mukherjee — Premium (50Mbps/25Mbps)
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '50M/25M', isActive: true },
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-1'), username: 'guest.amit.mukherjee', attribute: 'Cryptsk-Total-Limit', op: ':=', value: '16106127360', isActive: true },

      // guest.rahul.banerjee — VIP (100Mbps/50Mbps, unlimited data)
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '100000000', isActive: true },
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '100M/50M', isActive: true },
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '100000000', isActive: true },
      { wifiUserId: uuid('wifiuser-2'), username: 'guest.rahul.banerjee', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '50000000', isActive: true },

      // guest.sneha.gupta — Standard (25Mbps/10Mbps)
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '10000000', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '25M/10M', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '10000000', isActive: true },
      { wifiUserId: uuid('wifiuser-3'), username: 'guest.sneha.gupta', attribute: 'Cryptsk-Total-Limit', op: ':=', value: '5368709120', isActive: true },

      // guest.vikram.singh — VIP (100Mbps/50Mbps)
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '100000000', isActive: true },
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '100M/50M', isActive: true },
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '100000000', isActive: true },
      { wifiUserId: uuid('wifiuser-4'), username: 'guest.vikram.singh', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '50000000', isActive: true },

      // staff.priya.das — Premium (50Mbps/25Mbps)
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '50M/25M', isActive: true },
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '50000000', isActive: true },
      { wifiUserId: uuid('wifiuser-5'), username: 'staff.priya.das', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '25000000', isActive: true },

      // staff.anita.roy — Standard (25Mbps/10Mbps)
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '10000000', isActive: true },
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '25M/10M', isActive: true },
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '25000000', isActive: true },
      { wifiUserId: uuid('wifiuser-6'), username: 'staff.anita.roy', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '10000000', isActive: true },

      // conference.room1 — Conference (30Mbps/15Mbps)
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '30000000', isActive: true },
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '15000000', isActive: true },
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '30M/15M', isActive: true },
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '30000000', isActive: true },
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '15000000', isActive: true },
      { wifiUserId: uuid('wifiuser-8'), username: 'conference.room1', attribute: 'Cryptsk-Total-Limit', op: ':=', value: '10737418240', isActive: true },
    ],
  });
  console.log('✓ RadReply records seeded');

  // RadUserGroup — group mappings for each user
  await prisma.radUserGroup.createMany({
    data: [
      { username: 'guest.amit.mukherjee', groupname: 'premium_plan', priority: 0 },
      { username: 'guest.rahul.banerjee', groupname: 'vip_suite_plan', priority: 0 },
      { username: 'guest.sneha.gupta', groupname: 'standard_plan', priority: 0 },
      { username: 'guest.vikram.singh', groupname: 'vip_suite_plan', priority: 0 },
      { username: 'staff.priya.das', groupname: 'premium_plan', priority: 0 },
      { username: 'staff.anita.roy', groupname: 'standard_plan', priority: 0 },
      { username: 'conference.room1', groupname: 'conference_plan', priority: 0 },
    ],
  });
  console.log('✓ RadUserGroup records seeded');

  // RadGroupCheck — group-level authentication checks (Cryptsk VSA bandwidth + session limits)
  // Uses Cryptsk VSA attributes (Vendor ID 64179) — device IS the NAS gateway.
  await prisma.radGroupCheck.createMany({
    data: [
      // free_plan group: 5M/2M
      { groupname: 'free_plan', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '5M/2M', priority: 0 },
      { groupname: 'free_plan', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '5000000', priority: 1 },
      { groupname: 'free_plan', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '2000000', priority: 2 },
      { groupname: 'free_plan', attribute: 'Session-Timeout', op: ':=', value: '86400', priority: 3 },
      // basic_plan group: 10M/5M, 2GB data limit
      { groupname: 'basic_plan', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '10M/5M', priority: 0 },
      { groupname: 'basic_plan', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '10000000', priority: 1 },
      { groupname: 'basic_plan', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '5000000', priority: 2 },
      { groupname: 'basic_plan', attribute: 'Cryptsk-Total-Limit', op: ':=', value: '2147483648', priority: 3 },
      { groupname: 'basic_plan', attribute: 'Session-Timeout', op: ':=', value: '86400', priority: 4 },
      // standard_plan group: 25M/10M, 5GB data limit
      { groupname: 'standard_plan', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '25M/10M', priority: 0 },
      { groupname: 'standard_plan', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '25000000', priority: 1 },
      { groupname: 'standard_plan', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '10000000', priority: 2 },
      { groupname: 'standard_plan', attribute: 'Cryptsk-Total-Limit', op: ':=', value: '5368709120', priority: 3 },
      { groupname: 'standard_plan', attribute: 'Session-Timeout', op: ':=', value: '259200', priority: 4 },
      // premium_plan group: 50M/25M, 15GB data limit
      { groupname: 'premium_plan', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '50M/25M', priority: 0 },
      { groupname: 'premium_plan', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '50000000', priority: 1 },
      { groupname: 'premium_plan', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '25000000', priority: 2 },
      { groupname: 'premium_plan', attribute: 'Cryptsk-Total-Limit', op: ':=', value: '16106127360', priority: 3 },
      { groupname: 'premium_plan', attribute: 'Session-Timeout', op: ':=', value: '432000', priority: 4 },
      // vip_suite_plan group: 100M/50M, unlimited data
      { groupname: 'vip_suite_plan', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '100M/50M', priority: 0 },
      { groupname: 'vip_suite_plan', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '100000000', priority: 1 },
      { groupname: 'vip_suite_plan', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '50000000', priority: 2 },
      { groupname: 'vip_suite_plan', attribute: 'Session-Timeout', op: ':=', value: '604800', priority: 3 },
      // conference_plan group: 30M/15M, 10GB data limit, 25 sessions
      { groupname: 'conference_plan', attribute: 'Cryptsk-Rate-Limit', op: ':=', value: '30M/15M', priority: 0 },
      { groupname: 'conference_plan', attribute: 'Cryptsk-Bandwidth-Max-Down', op: ':=', value: '30000000', priority: 1 },
      { groupname: 'conference_plan', attribute: 'Cryptsk-Bandwidth-Max-Up', op: ':=', value: '15000000', priority: 2 },
      { groupname: 'conference_plan', attribute: 'Cryptsk-Total-Limit', op: ':=', value: '10737418240', priority: 3 },
      { groupname: 'conference_plan', attribute: 'Simultaneous-Use', op: ':=', value: '25', priority: 4 },
    ],
  });
  console.log('✓ RadGroupCheck records seeded (6 plan groups with Cryptsk VSA)');

  // RadGroupReply — group-level reply attributes
  // WISPr attrs kept for cross-platform compatibility; values in bps per RFC spec.
  await prisma.radGroupReply.createMany({
    data: [
      // free_plan: 5Mbps/2Mbps
      { groupname: 'free_plan', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '5000000', priority: 0 },
      { groupname: 'free_plan', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '2000000', priority: 1 },
      // basic_plan: 10Mbps/5Mbps
      { groupname: 'basic_plan', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '10000000', priority: 0 },
      { groupname: 'basic_plan', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '5000000', priority: 1 },
      // standard_plan: 25Mbps/10Mbps
      { groupname: 'standard_plan', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '25000000', priority: 0 },
      { groupname: 'standard_plan', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '10000000', priority: 1 },
      // premium_plan: 50Mbps/25Mbps
      { groupname: 'premium_plan', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '50000000', priority: 0 },
      { groupname: 'premium_plan', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '25000000', priority: 1 },
      // vip_suite_plan: 100Mbps/50Mbps
      { groupname: 'vip_suite_plan', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '100000000', priority: 0 },
      { groupname: 'vip_suite_plan', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '50000000', priority: 1 },
      // conference_plan: 30Mbps/15Mbps
      { groupname: 'conference_plan', attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: '30000000', priority: 0 },
      { groupname: 'conference_plan', attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: '15000000', priority: 1 },
    ],
  });
  console.log('✓ RadGroupReply records seeded (6 plan groups)');

  // RadPostAuth — RADIUS post-authentication logs (Accept + Reject)
  await prisma.radPostAuth.createMany({
    data: [
      // Recent accepts (12)
      { username: 'guest.amit.mukherjee', pass: 'Amit@2024', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:11:22:33', callingstationid: 'AA:BB:CC:11:22:33', authdate: hour(-3), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'guest.rahul.banerjee', pass: 'Rahul@2024', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:44:55:66', callingstationid: 'AA:BB:CC:44:55:66', authdate: hour(-5), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'guest.sneha.gupta', pass: 'Sneha@2024', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:77:88:99', callingstationid: 'AA:BB:CC:77:88:99', authdate: hour(-8), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.2' },
      { username: 'guest.vikram.singh', pass: 'Vikram@2024', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:AA:BB:CC', callingstationid: 'AA:BB:CC:AA:BB:CC', authdate: hour(-1), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'staff.priya.das', pass: 'Staff@Priya', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:55:66:77', callingstationid: 'AA:BB:CC:55:66:77', authdate: hour(-6), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'staff.anita.roy', pass: 'Staff@Anita', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:66:77:88', callingstationid: 'AA:BB:CC:66:77:88', authdate: day(-1), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.2' },
      { username: 'conference.room1', pass: 'Conf@2024', reply: 'Access-Accept', calledstationid: 'DD:EE:FF:11:22:33', callingstationid: 'DD:EE:FF:11:22:33', authdate: hour(-1), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.2' },
      { username: 'guest.amit.mukherjee', pass: 'Amit@2024', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:11:22:34', callingstationid: 'AA:BB:CC:11:22:34', authdate: day(-1), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'guest.rina.chatterjee', pass: 'Rina@2024', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:DD:EE:FF', callingstationid: 'AA:BB:CC:DD:EE:FF', authdate: day(-2), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'guest.sneha.gupta', pass: 'Sneha@2024', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:77:88:99', callingstationid: 'AA:BB:CC:77:88:99', authdate: hour(-2), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.2' },
      { username: 'guest.rahul.banerjee', pass: 'Rahul@2024', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:44:55:66', callingstationid: 'AA:BB:CC:44:55:66', authdate: day(-1), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'guest.vikram.singh', pass: 'Vikram@2024', reply: 'Access-Accept', calledstationid: 'AA:BB:CC:AA:BB:CC', callingstationid: 'AA:BB:CC:AA:BB:CC', authdate: hour(-4), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      // Rejects (12)
      { username: 'unknown_user_1', pass: 'wrong', reply: 'Access-Reject', calledstationid: '22:33:44:55:66:77', callingstationid: '22:33:44:55:66:77', authdate: hour(-6), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'expired_guest', pass: 'Expired@2024', reply: 'Access-Reject', calledstationid: '33:44:55:66:77:88', callingstationid: '33:44:55:66:77:88', authdate: hour(-5), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'guest.rina.chatterjee', pass: 'WrongPassword', reply: 'Access-Reject', calledstationid: 'AA:BB:CC:DD:EE:FF', callingstationid: 'AA:BB:CC:DD:EE:FF', authdate: min(-30), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'suspicious_mac_auth', pass: '', reply: 'Access-Reject', calledstationid: '22:33:44:55:66:77', callingstationid: '22:33:44:55:66:77', authdate: hour(-6), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'rogue_client', pass: 'hacked', reply: 'Access-Reject', calledstationid: '33:44:55:66:77:88', callingstationid: '33:44:55:66:77:88', authdate: day(-1), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.2' },
      { username: 'brute_force_1', pass: 'guess1', reply: 'Access-Reject', calledstationid: '44:55:66:77:88:99', callingstationid: '44:55:66:77:88:99', authdate: min(-45), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'brute_force_2', pass: 'guess2', reply: 'Access-Reject', calledstationid: '44:55:66:77:88:99', callingstationid: '44:55:66:77:88:99', authdate: min(-44), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'brute_force_3', pass: 'guess3', reply: 'Access-Reject', calledstationid: '44:55:66:77:88:99', callingstationid: '44:55:66:77:88:99', authdate: min(-43), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'unknown_user_2', pass: 'test123', reply: 'Access-Reject', calledstationid: '55:66:77:88:99:AA', callingstationid: '55:66:77:88:99:AA', authdate: hour(-3), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.2' },
      { username: 'denied_user', pass: 'NoAccess', reply: 'Access-Reject', calledstationid: '66:77:88:99:AA:BB', callingstationid: '66:77:88:99:AA:BB', authdate: hour(-2), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.1' },
      { username: 'staff.fired', pass: 'OldPassword', reply: 'Access-Reject', calledstationid: '77:88:99:AA:BB:CC', callingstationid: '77:88:99:AA:BB:CC', authdate: day(-1), propertyId: PROPERTY_ID, nasIpAddress: '10.0.1.2' },
    ],
  });
  console.log('✓ RadPostAuth records seeded (12 accepts + 12 rejects)');

  // ═══════════════════════════════════════════════════════════════
  // 3. WiFi SESSIONS (10)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Sessions (10)...');
  await prisma.wiFiSession.createMany({
    data: [
      // Active sessions (3)
      {
        id: uuid('wifisession-1'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.premium,
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        macAddress: 'AA:BB:CC:11:22:33',
        ipAddress: '192.168.10.105',
        deviceName: 'Amit-iPhone',
        deviceType: 'smartphone',
        startTime: hour(-3),
        endTime: null,
        dataUsed: 262144000, // ~250MB
        duration: 10800, // 3 hours
        authMethod: 'room_number',
        status: 'active',
      },
      {
        id: uuid('wifisession-2'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.vip,
        guestId: uuid('guest-3'),
        bookingId: uuid('booking-2'),
        macAddress: 'AA:BB:CC:44:55:66',
        ipAddress: '192.168.10.110',
        deviceName: 'Rahul-MacBook',
        deviceType: 'laptop',
        startTime: hour(-5),
        endTime: null,
        dataUsed: 1073741824, // ~1GB
        duration: 18000, // 5 hours
        authMethod: 'room_number',
        status: 'active',
      },
      {
        id: uuid('wifisession-3'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.conference,
        guestId: null,
        bookingId: null,
        macAddress: 'DD:EE:FF:11:22:33',
        ipAddress: '192.168.10.200',
        deviceName: 'ConfRoom-Display',
        deviceType: 'other',
        startTime: hour(-1),
        endTime: null,
        dataUsed: 52428800, // ~50MB
        duration: 3600, // 1 hour
        authMethod: 'voucher',
        status: 'active',
      },
      // Ended sessions (5)
      {
        id: uuid('wifisession-4'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.standard,
        guestId: uuid('guest-2'),
        bookingId: uuid('booking-3'),
        macAddress: 'AA:BB:CC:77:88:99',
        ipAddress: '192.168.10.115',
        deviceName: 'Sneha-Galaxy-S23',
        deviceType: 'smartphone',
        startTime: hour(-8),
        endTime: hour(-2),
        dataUsed: 314572800, // ~300MB
        duration: 21600, // 6 hours
        authMethod: 'voucher',
        status: 'ended',
      },
      {
        id: uuid('wifisession-5'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.premium,
        guestId: uuid('guest-5'),
        bookingId: uuid('booking-4'),
        macAddress: 'AA:BB:CC:AA:BB:CC',
        ipAddress: '192.168.10.120',
        deviceName: 'Vikram-ThinkPad',
        deviceType: 'laptop',
        startTime: day(-1),
        endTime: day(-1).getTime() + 8 * 60 * 60 * 1000 > now.getTime() ? now : new Date(day(-1).getTime() + 8 * 60 * 60 * 1000),
        dataUsed: 524288000, // ~500MB
        duration: 28800, // 8 hours
        authMethod: 'room_number',
        status: 'ended',
      },
      {
        id: uuid('wifisession-6'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.free,
        guestId: uuid('guest-6'),
        bookingId: uuid('booking-6'),
        macAddress: 'AA:BB:CC:DD:EE:FF',
        ipAddress: '192.168.10.125',
        deviceName: 'Rina-iPad',
        deviceType: 'tablet',
        startTime: day(-2),
        endTime: new Date(day(-2).getTime() + 4 * 60 * 60 * 1000),
        dataUsed: 104857600, // ~100MB
        duration: 14400, // 4 hours
        authMethod: 'sms_otp',
        status: 'ended',
      },
      {
        id: uuid('wifisession-7'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.standard,
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        macAddress: 'AA:BB:CC:11:22:34',
        ipAddress: '192.168.10.106',
        deviceName: 'Amit-Surface-Pro',
        deviceType: 'laptop',
        startTime: day(-1),
        endTime: new Date(day(-1).getTime() + 6 * 60 * 60 * 1000),
        dataUsed: 786432000, // ~750MB
        duration: 21600, // 6 hours
        authMethod: 'room_number',
        status: 'ended',
      },
      {
        id: uuid('wifisession-8'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.basic,
        guestId: uuid('guest-4'),
        bookingId: null,
        macAddress: '11:22:33:44:55:66',
        ipAddress: '192.168.10.130',
        deviceName: 'Unknown-Device',
        deviceType: 'smartphone',
        startTime: day(-3),
        endTime: new Date(day(-3).getTime() + 2 * 60 * 60 * 1000),
        dataUsed: 52428800, // ~50MB
        duration: 7200, // 2 hours
        authMethod: 'voucher',
        status: 'ended',
      },
      // Terminated sessions (2)
      {
        id: uuid('wifisession-9'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.free,
        guestId: null,
        bookingId: null,
        macAddress: '22:33:44:55:66:77',
        ipAddress: '192.168.10.140',
        deviceName: 'Suspicious-Client',
        deviceType: 'other',
        startTime: hour(-6),
        endTime: hour(-5),
        dataUsed: 1048576, // ~1MB
        duration: 3600,
        authMethod: 'mac_auth',
        status: 'terminated',
      },
      {
        id: uuid('wifisession-10'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.basic,
        guestId: null,
        bookingId: null,
        macAddress: '33:44:55:66:77:88',
        ipAddress: '192.168.10.141',
        deviceName: 'Rogue-AP-Client',
        deviceType: 'other',
        startTime: day(-1),
        endTime: new Date(day(-1).getTime() + 30 * 60 * 1000),
        dataUsed: 524288, // ~0.5MB
        duration: 1800, // 30 min
        authMethod: 'voucher',
        status: 'terminated',
      },
    ],
  });
  console.log('✓ 10 WiFi Sessions seeded');

  // ═══════════════════════════════════════════════════════════════
  // 4. WiFi VOUCHERS (10)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Vouchers (10)...');
  await prisma.wiFiVoucher.createMany({
    data: [
      // Active vouchers (4)
      {
        id: uuid('wifivoucher-1'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.premium,
        code: 'RS-PREM-A1B2C3',
        guestId: uuid('guest-1'),
        bookingId: uuid('booking-1'),
        isUsed: true,
        usedAt: hour(-3),
        validFrom: day(-2),
        validUntil: day(1),
        status: 'active',
      },
      {
        id: uuid('wifivoucher-2'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.vip,
        code: 'RS-VIP-D4E5F6',
        guestId: uuid('guest-3'),
        bookingId: uuid('booking-2'),
        isUsed: true,
        usedAt: hour(-5),
        validFrom: day(-1),
        validUntil: day(3),
        status: 'active',
      },
      {
        id: uuid('wifivoucher-3'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.standard,
        code: 'RS-STD-G7H8I9',
        guestId: uuid('guest-2'),
        bookingId: uuid('booking-3'),
        isUsed: true,
        usedAt: hour(-8),
        validFrom: day(0),
        validUntil: day(4),
        status: 'active',
      },
      {
        id: uuid('wifivoucher-4'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.conference,
        code: 'RS-CONF-J1K2L3',
        guestId: null,
        bookingId: null,
        isUsed: false,
        usedAt: null,
        validFrom: day(0),
        validUntil: day(1),
        status: 'active',
      },
      // Used vouchers (3)
      {
        id: uuid('wifivoucher-5'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.premium,
        code: 'RS-PREM-M4N5O6',
        guestId: uuid('guest-5'),
        bookingId: uuid('booking-4'),
        isUsed: true,
        usedAt: day(-1),
        validFrom: day(-1),
        validUntil: day(2),
        status: 'used',
      },
      {
        id: uuid('wifivoucher-6'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.basic,
        code: 'RS-BASIC-P7Q8R9',
        guestId: uuid('guest-4'),
        bookingId: null,
        isUsed: true,
        usedAt: day(-3),
        validFrom: day(-3),
        validUntil: day(-2),
        status: 'used',
      },
      {
        id: uuid('wifivoucher-7'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.free,
        code: 'RS-FREE-S1T2U3',
        guestId: uuid('guest-6'),
        bookingId: uuid('booking-6'),
        isUsed: true,
        usedAt: day(-2),
        validFrom: day(-3),
        validUntil: day(0),
        status: 'used',
      },
      // Expired vouchers (2)
      {
        id: uuid('wifivoucher-8'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.standard,
        code: 'RS-STD-V4W5X6',
        guestId: null,
        bookingId: null,
        isUsed: false,
        usedAt: null,
        validFrom: day(-10),
        validUntil: day(-7),
        status: 'expired',
      },
      {
        id: uuid('wifivoucher-9'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.basic,
        code: 'RS-BASIC-Y7Z8A9',
        guestId: null,
        bookingId: null,
        isUsed: false,
        usedAt: null,
        validFrom: day(-5),
        validUntil: day(-4),
        status: 'expired',
      },
      // Revoked voucher (1)
      {
        id: uuid('wifivoucher-10'),
        tenantId: TENANT_ID,
        planId: PLAN_IDS.conference,
        code: 'RS-CONF-B1C2D3',
        guestId: null,
        bookingId: null,
        isUsed: false,
        usedAt: null,
        validFrom: day(-1),
        validUntil: day(1),
        status: 'revoked',
      },
    ],
  });
  console.log('✓ 10 WiFi Vouchers seeded');

  // ═══════════════════════════════════════════════════════════════
  // 5. WiFi GATEWAYS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Gateways (2)...');
  await prisma.wiFiGateway.createMany({
    data: [
      {
        id: uuid('wifigw-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Main Controller (Cisco Meraki)',
        description: 'Primary WiFi controller managing all guest and staff access points across 10 floors.',
        ipAddress: '10.0.0.1',
        macAddress: '00:1A:2B:3C:4D:5E',
        vendor: 'cisco',
        model: 'Meraki MR46',
        version: '28.1.1',
        radiusSecret: 'rs_secret_main_2024',
        radiusAuthPort: 1812,
        radiusAcctPort: 1813,
        coaEnabled: true,
        coaPort: 3799,
        coaSecret: 'coa_secret_main',
        captivePortalEnabled: true,
        captivePortalUrl: 'https://wifi.royalstay.in/portal',
        defaultVlan: 10,
        guestVlan: 10,
        staffVlan: 20,
        managementUrl: 'https://meraki.royalstay.in',
        apiUsername: 'pms_api_user',
        apiPassword: 'encrypted_api_pass_1',
        apiPort: 443,
        status: 'active',
        lastSeenAt: min(-2),
        firmwareVersion: '28.1.1',
        totalClients: 47,
        totalSessions: 156,
      },
      {
        id: uuid('wifigw-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Backup Controller (Ubiquiti)',
        description: 'Secondary controller for conference rooms and outdoor areas. Currently offline for maintenance.',
        ipAddress: '10.0.0.2',
        macAddress: '00:1A:2B:3C:4D:5F',
        vendor: 'ubiquiti',
        model: 'UniFi U6-Pro',
        version: '7.0.23',
        radiusSecret: 'rs_secret_backup_2024',
        radiusAuthPort: 1812,
        radiusAcctPort: 1813,
        coaEnabled: true,
        coaPort: 3799,
        captivePortalEnabled: true,
        captivePortalUrl: 'https://wifi.royalstay.in/portal-backup',
        defaultVlan: 10,
        guestVlan: 10,
        staffVlan: 20,
        managementUrl: 'https://unifi.royalstay.in',
        status: 'disconnected',
        lastSeenAt: day(-2),
        firmwareVersion: '7.0.23',
        totalClients: 0,
        totalSessions: 42,
      },
    ],
  });
  console.log('✓ 2 WiFi Gateways seeded');

  // ═══════════════════════════════════════════════════════════════
  // 6. WiFi AAA CONFIG (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi AAA Config (1)...');
  await prisma.wiFiAAAConfig.create({
    data: {
      id: uuid('aaa-config-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      defaultPlanId: PLAN_IDS.free,
      defaultDownloadSpeed: 5,
      defaultUploadSpeed: 2,
      defaultSessionLimit: 1,
      defaultDataLimit: null,
      autoProvisionOnCheckin: true,
      autoDeprovisionOnCheckout: true,
      autoDeprovisionDelay: 30,
      authMethod: 'pap',
      allowMacAuth: true,
      accountingSyncInterval: 5,
      lastSyncAt: min(-5),
      lastSyncId: uuid('sync-2024-001'),
      maxConcurrentSessions: 3,
      sessionTimeoutPolicy: 'hard',
      portalEnabled: true,
      portalTitle: 'Royal Stay WiFi',
      portalLogo: '/assets/wifi-logo.png',
      portalTerms: 'By using our WiFi service, you agree to our terms of service and acceptable use policy.',
      portalRedirectUrl: 'https://www.royalstay.in/welcome',
      portalBrandColor: '#8B5E3C',
      status: 'active',
    },
  });
  console.log('✓ 1 WiFi AAA Config seeded');

  // ═══════════════════════════════════════════════════════════════
  // 7. RADIUS NAS (3) — First entry is the built-in Multimode NAS
  // ═══════════════════════════════════════════════════════════════
  // The 127.0.0.1 / cryptsk entry is the DEFAULT Multimode NAS client.
  // It represents the Cryptsk product itself acting as gateway + RADIUS server.
  // This is a SYSTEM entry — protected from deletion via the API and GUI.
  console.log('Seeding Radius NAS (3 — 1 system + 2 external)...');
  await prisma.radiusNAS.createMany({
    data: [
      // ── SYSTEM: Cryptsk Multimode (always present, protected) ──
      {
        id: uuid('nas-cryptsk-local'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Cryptsk Gateway (Multimode)',
        shortname: 'cryptsk-local',
        ipAddress: '127.0.0.1',
        type: 'cryptsk',
        ports: '1812',
        secret: 'localkey',
        description: 'Built-in Cryptsk gateway for multimode operation. Uses Cryptsk VSA (Vendor ID 64179). This system entry cannot be deleted.',
        coaEnabled: true,
        coaPort: 3799,
        authPort: 1812,
        acctPort: 1813,
        status: 'active',
        totalAuths: 12480,
        totalAccts: 95200,
      },
      // ── EXTERNAL: MikroTik ──
      {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'MikroTik Router - Main',
        shortname: 'mikrotik-main',
        ipAddress: '10.0.1.1',
        type: 'mikrotik',
        ports: '1812',
        secret: 'nas_secret_mikrotik_1',
        community: 'public_ro',
        description: 'Main MikroTik CCR2004 router handling guest and staff VLANs.',
        coaEnabled: true,
        coaPort: 3799,
        authPort: 1812,
        acctPort: 1813,
        status: 'active',
        lastSeenAt: min(-1),
        totalAuths: 4523,
        totalAccts: 38910,
      },
      // ── EXTERNAL: Aruba ──
      {
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Aruba Controller - Conference',
        shortname: 'aruba-conf',
        ipAddress: '10.0.1.2',
        type: 'aruba',
        ports: '1812',
        secret: 'nas_secret_aruba_1',
        community: 'public_ro',
        description: 'Aruba 7008 controller for conference and event spaces.',
        coaEnabled: true,
        coaPort: 3799,
        authPort: 1812,
        acctPort: 1813,
        status: 'active',
        lastSeenAt: min(-3),
        totalAuths: 1247,
        totalAccts: 8564,
      },
    ],
  });
  console.log('✓ 3 Radius NAS seeded (1 system + 2 external)');

  // Also seed the system Cryptsk NAS into the native FreeRADIUS `nas` table
  // so FreeRADIUS can accept RADIUS packets from the local gateway (read_clients = yes)
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO nas (nasname, shortname, type, ports, secret, server, community, description)
      VALUES ('127.0.0.1', 'cryptsk-local', 'cryptsk', 1812, 'localkey', NULL, NULL,
              'Cryptsk Multimode Gateway — built-in system NAS')
      ON CONFLICT DO NOTHING
    `);
    // Also seed the external NAS entries into native table
    await prisma.$executeRawUnsafe(`
      INSERT INTO nas (nasname, shortname, type, ports, secret, server, community, description)
      VALUES ('10.0.1.1', 'mikrotik-main', 'mikrotik', 1812, 'nas_secret_mikrotik_1', NULL, 'public_ro',
              'MikroTik Router - Main')
      ON CONFLICT DO NOTHING
    `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO nas (nasname, shortname, type, ports, secret, server, community, description)
      VALUES ('10.0.1.2', 'aruba-conf', 'aruba', 1812, 'nas_secret_aruba_1', NULL, 'public_ro',
              'Aruba Controller - Conference')
      ON CONFLICT DO NOTHING
    `);
    console.log('✓ 3 native nas table entries seeded');
  } catch (nasErr) {
    console.log('Native nas table seed note:', nasErr instanceof Error ? nasErr.message : nasErr);
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. RADIUS SERVER CONFIG (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Radius Server Config (1)...');
  await prisma.radiusServerConfig.create({
    data: {
      id: uuid('radius-server-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      serverIp: '127.0.0.1',
      serverHostname: 'radius.royalstay.local',
      authPort: 1812,
      acctPort: 1813,
      coaPort: 3799,
      listenAllInterfaces: true,
      bindAddress: '0.0.0.0',
      maxAuthWait: 30,
      maxAcctWait: 30,
      cleanupSessions: true,
      sessionCleanupInterval: 3600,
      logAuth: true,
      logAuthBadpass: false,
      logAuthGoodpass: false,
      logDestination: 'files',
      logLevel: 'info',
      status: 'active',
    },
  });
  console.log('✓ 1 Radius Server Config seeded');

  // ═══════════════════════════════════════════════════════════════
  // 9. NETWORK INTERFACES (6)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Network Interfaces (6)...');
  await prisma.networkInterface.createMany({
    data: [
      {
        id: IFACE_IDS.eth0,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'eth0',
        type: 'ethernet',
        hwAddress: '00:1A:2B:3C:4D:01',
        mtu: 1500,
        speed: '1000M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'Primary WAN uplink - ISP Airtel Fibre',
      },
      {
        id: IFACE_IDS.eth1,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'eth1',
        type: 'ethernet',
        hwAddress: '00:1A:2B:3C:4D:02',
        mtu: 1500,
        speed: '1000M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'Primary LAN - Connected to main switch',
      },
      {
        id: IFACE_IDS.br0,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'br0',
        type: 'bridge',
        hwAddress: '00:1A:2B:3C:4D:03',
        mtu: 1500,
        speed: '1000M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'Main bridge - LAN + Guest',
      },
      {
        id: IFACE_IDS.bond0,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'bond0',
        type: 'bond',
        hwAddress: '00:1A:2B:3C:4D:04',
        mtu: 1500,
        speed: '2000M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'LACP bond of eth0 + backup WAN',
      },
      {
        id: IFACE_IDS.wlan0,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'wlan0',
        type: 'wireless',
        hwAddress: '00:1A:2B:3C:4D:05',
        mtu: 1500,
        speed: '867M',
        status: 'up',
        carrier: true,
        isManagement: false,
        description: 'WiFi radio - 5GHz',
      },
      {
        id: IFACE_IDS.eth2,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'eth2',
        type: 'ethernet',
        hwAddress: '00:1A:2B:3C:4D:06',
        mtu: 1500,
        speed: '1000M',
        status: 'down',
        carrier: false,
        isManagement: false,
        description: 'Backup WAN - Jio Fibre (standby)',
      },
    ],
  });
  console.log('✓ 6 Network Interfaces seeded');

  // ═══════════════════════════════════════════════════════════════
  // 10. INTERFACE ROLES (6)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Interface Roles (6)...');
  await prisma.interfaceRole.createMany({
    data: [
      {
        id: uuid('ifrole-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth0,
        role: 'wan',
        priority: 1,
        isPrimary: true,
        enabled: true,
      },
      {
        id: uuid('ifrole-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth1,
        role: 'lan',
        priority: 0,
        isPrimary: true,
        enabled: true,
      },
      {
        id: uuid('ifrole-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.br0,
        role: 'dmz',
        priority: 0,
        isPrimary: false,
        enabled: true,
      },
      {
        id: uuid('ifrole-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.bond0,
        role: 'management',
        priority: 0,
        isPrimary: false,
        enabled: true,
      },
      {
        id: uuid('ifrole-5'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.wlan0,
        role: 'wifi',
        priority: 0,
        isPrimary: true,
        enabled: true,
      },
      {
        id: uuid('ifrole-6'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth2,
        role: 'unused',
        priority: 2,
        isPrimary: false,
        enabled: false,
      },
    ],
  });
  console.log('✓ 6 Interface Roles seeded');

  // ═══════════════════════════════════════════════════════════════
  // 11. VLAN CONFIGS (5)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding VLAN Configs (5)...');
  await prisma.vlanConfig.createMany({
    data: [
      {
        id: VLAN_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 10,
        subInterface: 'eth1.10',
        description: 'Guest WiFi VLAN - Internet only, no LAN access',
        mtu: 1500,
        enabled: true,
      },
      {
        id: VLAN_IDS.staff,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 20,
        subInterface: 'eth1.20',
        description: 'Staff VLAN - Full LAN and internet access',
        mtu: 1500,
        enabled: true,
      },
      {
        id: VLAN_IDS.pos,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 30,
        subInterface: 'eth1.30',
        description: 'POS/Payment VLAN - Isolated for PCI compliance',
        mtu: 1500,
        enabled: true,
      },
      {
        id: VLAN_IDS.iot,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 40,
        subInterface: 'eth1.40',
        description: 'IoT Devices VLAN - Smart locks, thermostats, sensors',
        mtu: 1500,
        enabled: true,
      },
      {
        id: VLAN_IDS.mgmt,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        parentInterfaceId: IFACE_IDS.eth1,
        vlanId: 50,
        subInterface: 'eth1.50',
        description: 'Management VLAN - Network devices and admin access',
        mtu: 1500,
        enabled: true,
      },
    ],
  });
  console.log('✓ 5 VLAN Configs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 12. INTERFACE CONFIGS (for key interfaces)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Interface Configs...');
  await prisma.interfaceConfig.createMany({
    data: [
      {
        id: uuid('ifcfg-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth0,
        mode: 'dhcp',
        ipAddress: null,
        netmask: null,
        gateway: null,
        dnsPrimary: null,
        dnsSecondary: null,
        enabled: true,
      },
      {
        id: uuid('ifcfg-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth1,
        mode: 'static',
        ipAddress: '192.168.1.1',
        netmask: '255.255.255.0',
        gateway: '192.168.1.254',
        dnsPrimary: '8.8.8.8',
        dnsSecondary: '1.1.1.1',
        enabled: true,
      },
      {
        id: uuid('ifcfg-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        interfaceId: IFACE_IDS.eth2,
        mode: 'disabled',
        ipAddress: null,
        netmask: null,
        gateway: null,
        dnsPrimary: null,
        dnsSecondary: null,
        enabled: false,
      },
    ],
  });
  console.log('✓ Interface Configs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 13. BRIDGE CONFIGS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bridge Configs (2)...');
  await prisma.bridgeConfig.createMany({
    data: [
      {
        id: uuid('bridge-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'br0',
        memberInterfaces: JSON.stringify(['eth1', 'wlan0']),
        stpEnabled: true,
        forwardDelay: 15,
        helloTime: 2,
        maxAge: 20,
        enabled: true,
      },
      {
        id: uuid('bridge-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'br-guest',
        memberInterfaces: JSON.stringify(['eth1.10']),
        stpEnabled: false,
        forwardDelay: 15,
        helloTime: 2,
        maxAge: 20,
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 Bridge Configs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 14. BOND CONFIG (1) + BOND MEMBERS
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bond Config (1)...');
  await prisma.bondConfig.create({
    data: {
      id: uuid('bond-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      name: 'bond0',
      mode: '802.3ad',
      miimon: 100,
      lacpRate: 'slow',
      primaryMember: IFACE_IDS.eth0,
      enabled: true,
    },
  });
  // Add bond members
  await prisma.bondMember.createMany({
    data: [
      {
        id: uuid('bondmember-1'),
        bondConfigId: uuid('bond-1'),
        interfaceId: IFACE_IDS.eth0,
        priority: 1,
      },
      {
        id: uuid('bondmember-2'),
        bondConfigId: uuid('bond-1'),
        interfaceId: IFACE_IDS.eth2,
        priority: 2,
      },
    ],
  });
  console.log('✓ 1 Bond Config + 2 members seeded');

  // ═══════════════════════════════════════════════════════════════
  // 15. PORT FORWARD RULES (4)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Port Forward Rules (4)...');
  await prisma.portForwardRule.createMany({
    data: [
      {
        id: uuid('pfwd-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Web Server',
        protocol: 'tcp',
        externalPort: 80,
        internalIp: '192.168.1.10',
        internalPort: 80,
        interfaceId: IFACE_IDS.eth0,
        enabled: true,
        description: 'Hotel website and booking portal',
      },
      {
        id: uuid('pfwd-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'HTTPS Server',
        protocol: 'tcp',
        externalPort: 443,
        internalIp: '192.168.1.10',
        internalPort: 443,
        interfaceId: IFACE_IDS.eth0,
        enabled: true,
        description: 'Secure web services and PMS access',
      },
      {
        id: uuid('pfwd-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'PMS Remote Access',
        protocol: 'tcp',
        externalPort: 8443,
        internalIp: '192.168.1.20',
        internalPort: 443,
        interfaceId: IFACE_IDS.eth0,
        enabled: true,
        description: 'Remote PMS management access',
      },
      {
        id: uuid('pfwd-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'VPN Server',
        protocol: 'udp',
        externalPort: 1194,
        internalIp: '192.168.1.30',
        internalPort: 1194,
        interfaceId: IFACE_IDS.eth0,
        enabled: true,
        description: 'WireGuard VPN for remote staff access',
      },
    ],
  });
  console.log('✓ 4 Port Forward Rules seeded');

  // ═══════════════════════════════════════════════════════════════
  // 16. WAN FAILOVER (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WAN Failover...');
  await prisma.wanFailover.create({
    data: {
      id: uuid('wanfo-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      primaryWanId: IFACE_IDS.eth0,
      backupWanId: IFACE_IDS.eth2,
      healthCheckUrl: 'https://1.1.1.1',
      healthCheckInterval: 30,
      failoverThreshold: 3,
      autoSwitchback: true,
      switchbackDelay: 300,
      enabled: true,
    },
  });
  console.log('✓ 1 WAN Failover seeded');

  // ═══════════════════════════════════════════════════════════════
  // 17. DHCP SUBNETS (4)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DHCP Subnets (4)...');
  await prisma.dhcpSubnet.createMany({
    data: [
      {
        id: SUBNET_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Guest WiFi Subnet',
        subnet: '192.168.10.0/24',
        gateway: '192.168.10.1',
        poolStart: '192.168.10.100',
        poolEnd: '192.168.10.254',
        leaseTime: 3600,
        vlanId: 10,
        vlanConfigId: VLAN_IDS.guest,
        domainName: 'guest.royalstay.local',
        dnsServers: JSON.stringify(['192.168.1.1', '8.8.8.8']),
        ntpServers: JSON.stringify(['162.159.200.1', '162.159.200.123']),
        enabled: true,
        description: 'DHCP pool for guest WiFi clients on VLAN 10',
      },
      {
        id: SUBNET_IDS.staff,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Staff LAN Subnet',
        subnet: '192.168.20.0/24',
        gateway: '192.168.20.1',
        poolStart: '192.168.20.50',
        poolEnd: '192.168.20.254',
        leaseTime: 86400,
        vlanId: 20,
        vlanConfigId: VLAN_IDS.staff,
        domainName: 'staff.royalstay.local',
        dnsServers: JSON.stringify(['192.168.1.1', '8.8.8.8']),
        ntpServers: JSON.stringify(['216.239.35.0', '216.239.35.4']),
        enabled: true,
        description: 'DHCP pool for staff devices on VLAN 20',
      },
      {
        id: SUBNET_IDS.iot,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'IoT Devices Subnet',
        subnet: '192.168.40.0/24',
        gateway: '192.168.40.1',
        poolStart: '192.168.40.100',
        poolEnd: '192.168.40.200',
        leaseTime: 604800,
        vlanId: 40,
        vlanConfigId: VLAN_IDS.iot,
        domainName: 'iot.royalstay.local',
        dnsServers: JSON.stringify(['192.168.1.1']),
        ntpServers: JSON.stringify(['162.159.200.1', '216.239.35.0']),
        enabled: true,
        description: 'DHCP pool for IoT devices on VLAN 40. Long lease for stability.',
      },
      {
        id: SUBNET_IDS.mgmt,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Management Subnet',
        subnet: '192.168.50.0/24',
        gateway: '192.168.50.1',
        poolStart: '192.168.50.10',
        poolEnd: '192.168.50.50',
        leaseTime: 86400,
        vlanId: 50,
        vlanConfigId: VLAN_IDS.mgmt,
        domainName: 'mgmt.royalstay.local',
        dnsServers: JSON.stringify(['192.168.1.1', '8.8.8.8']),
        ntpServers: JSON.stringify(['216.239.35.0', '216.239.35.4']),
        enabled: true,
        description: 'DHCP pool for management network devices on VLAN 50',
      },
    ],
  });
  console.log('✓ 4 DHCP Subnets seeded');

  // ═══════════════════════════════════════════════════════════════
  // 18. DHCP RESERVATIONS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DHCP Reservations (3)...');
  await prisma.dhcpReservation.createMany({
    data: [
      {
        id: uuid('dhcpres-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.iot,
        macAddress: 'AA:BB:CC:DD:01:01',
        ipAddress: '192.168.40.101',
        hostname: 'Room101-SmartLock',
        leaseTime: null,
        linkedType: 'room',
        linkedId: uuid('room-101'),
        description: 'Smart lock for Room 101 - always needs same IP',
        enabled: true,
      },
      {
        id: uuid('dhcpres-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.iot,
        macAddress: 'AA:BB:CC:DD:01:02',
        ipAddress: '192.168.40.102',
        hostname: 'Room101-Thermostat',
        leaseTime: null,
        linkedType: 'room',
        linkedId: uuid('room-101'),
        description: 'Smart thermostat for Room 101',
        enabled: true,
      },
      {
        id: uuid('dhcpres-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.staff,
        macAddress: 'AA:BB:CC:DD:02:01',
        ipAddress: '192.168.20.51',
        hostname: 'Priya-Laptop',
        leaseTime: null,
        linkedType: 'staff',
        linkedId: uuid('user-2'),
        description: 'Front desk manager laptop - fixed IP for printer access',
        enabled: true,
      },
    ],
  });
  console.log('✓ 3 DHCP Reservations seeded');

  // ═══════════════════════════════════════════════════════════════
  // 19. DHCP LEASES (5)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DHCP Leases (5)...');
  await prisma.dhcpLease.createMany({
    data: [
      {
        id: uuid('dhcplease-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.guest,
        macAddress: 'AA:BB:CC:11:22:33',
        ipAddress: '192.168.10.105',
        hostname: 'Amit-iPhone',
        clientId: '01:aabb:cc11:2233',
        leaseStart: hour(-3),
        leaseEnd: hour(1),
        state: 'active',
        lastSeenAt: min(-5),
      },
      {
        id: uuid('dhcplease-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.guest,
        macAddress: 'AA:BB:CC:44:55:66',
        ipAddress: '192.168.10.110',
        hostname: 'Rahul-MacBook',
        clientId: '01:aabb:cc44:5566',
        leaseStart: hour(-5),
        leaseEnd: hour(-1),
        state: 'active',
        lastSeenAt: min(-2),
      },
      {
        id: uuid('dhcplease-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.guest,
        macAddress: 'AA:BB:CC:DD:EE:FF',
        ipAddress: '192.168.10.125',
        hostname: 'Rina-iPad',
        clientId: '01:aabb:ccdd:eeff',
        leaseStart: day(-2),
        leaseEnd: day(-1),
        state: 'expired',
        lastSeenAt: day(-1),
      },
      {
        id: uuid('dhcplease-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.staff,
        macAddress: 'AA:BB:CC:DD:02:01',
        ipAddress: '192.168.20.51',
        hostname: 'Priya-Laptop',
        clientId: '01:aabb:ccdd:0201',
        leaseStart: day(-1),
        leaseEnd: day(1),
        state: 'active',
        lastSeenAt: min(-15),
      },
      {
        id: uuid('dhcplease-5'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.iot,
        macAddress: 'AA:BB:CC:DD:01:01',
        ipAddress: '192.168.40.101',
        hostname: 'Room101-SmartLock',
        clientId: null,
        leaseStart: day(-7),
        leaseEnd: day(0),
        state: 'released',
        lastSeenAt: hour(-6),
      },
    ],
  });
  console.log('✓ 5 DHCP Leases seeded');

  // ═══════════════════════════════════════════════════════════════
  // 20. DHCP OPTIONS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DHCP Options (3)...');
  await prisma.dhcpOption.createMany({
    data: [
      {
        id: uuid('dhcpopt-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: null, // Global
        code: 6,
        name: 'DNS Servers',
        value: '8.8.8.8, 1.1.1.1',
        type: 'ip',
        enabled: true,
        description: 'Default DNS servers for all subnets',
      },
      {
        id: uuid('dhcpopt-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: null, // Global
        code: 42,
        name: 'NTP Server',
        value: '162.159.200.1,162.159.200.123',
        type: 'string',
        enabled: true,
        description: 'Network time protocol server for time synchronization',
      },
      {
        id: uuid('dhcpopt-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        subnetId: SUBNET_IDS.guest,
        code: 15,
        name: 'Domain Name',
        value: 'guest.royalstay.local',
        type: 'string',
        enabled: true,
        description: 'Domain name for guest WiFi subnet',
      },
    ],
  });
  console.log('✓ 3 DHCP Options seeded');

  // ═══════════════════════════════════════════════════════════════
  // 21. DNS ZONES (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DNS Zones (2)...');
  await prisma.dnsZone.createMany({
    data: [
      {
        id: ZONE_IDS.main,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        domain: 'staysuite.local',
        description: 'Main internal DNS zone for hotel services',
        vlanId: 20,
        enabled: true,
      },
      {
        id: ZONE_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        domain: 'guest.staysuite.local',
        description: 'Guest-facing DNS zone for captive portal and services',
        vlanId: 10,
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 DNS Zones seeded');

  // ═══════════════════════════════════════════════════════════════
  // 22. DNS RECORDS (4)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DNS Records (4)...');
  await prisma.dnsRecord.createMany({
    data: [
      {
        id: uuid('dnsrec-1'),
        tenantId: TENANT_ID,
        zoneId: ZONE_IDS.guest,
        name: 'portal',
        type: 'A',
        value: '192.168.10.1',
        ttl: 300,
        priority: null,
        enabled: true,
      },
      {
        id: uuid('dnsrec-2'),
        tenantId: TENANT_ID,
        zoneId: ZONE_IDS.guest,
        name: 'dns',
        type: 'A',
        value: '192.168.1.1',
        ttl: 300,
        priority: null,
        enabled: true,
      },
      {
        id: uuid('dnsrec-3'),
        tenantId: TENANT_ID,
        zoneId: ZONE_IDS.main,
        name: 'portal',
        type: 'A',
        value: '192.168.1.10',
        ttl: 300,
        priority: null,
        enabled: true,
      },
      {
        id: uuid('dnsrec-4'),
        tenantId: TENANT_ID,
        zoneId: ZONE_IDS.main,
        name: 'dns',
        type: 'A',
        value: '192.168.1.1',
        ttl: 300,
        priority: null,
        enabled: true,
      },
    ],
  });
  console.log('✓ 4 DNS Records seeded');

  // ═══════════════════════════════════════════════════════════════
  // 23. DNS REDIRECT RULES (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding DNS Redirect Rules (2)...');
  await prisma.dnsRedirectRule.createMany({
    data: [
      {
        id: uuid('dnsredir-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Captive Portal Detection',
        matchPattern: '*',
        targetIp: '192.168.10.1',
        applyTo: 'unauthenticated',
        priority: 1,
        enabled: true,
        description: 'Redirect all DNS from unauthenticated clients to captive portal',
      },
      {
        id: uuid('dnsredir-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'All DNS Redirect',
        matchPattern: '*',
        targetIp: '0.0.0.0',
        applyTo: 'all',
        priority: 0,
        enabled: false,
        description: 'Emergency: Block all DNS resolution (disabled by default)',
      },
    ],
  });
  console.log('✓ 2 DNS Redirect Rules seeded');

  // ═══════════════════════════════════════════════════════════════
  // 24. CAPTIVE PORTALS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Captive Portals (2)...');
  await prisma.captivePortal.createMany({
    data: [
      {
        id: PORTAL_IDS.hotel,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Lobby - Hotel Guest Portal',
        description: 'Main captive portal for hotel guests in lobby area with voucher and room number authentication.',
        slug: 'lobby',
        roamingMode: 'auth_origin',
        allowsRoamingFrom: '[]',
        authMethod: 'voucher',
        maxBandwidthDown: 5242880,
        maxBandwidthUp: 1048576,
        bandwidthPolicy: 'zone',
        ssidList: '["RoyalStay-Guest", "RoyalStay-Lobby"]',
        listenIp: '0.0.0.0',
        listenPort: 80,
        useSsl: false,
        enabled: true,
        maxConcurrent: 500,
        sessionTimeout: 86400,
        idleTimeout: 3600,
        redirectUrl: 'https://www.royalstay.in/welcome',
        successMessage: 'Welcome to Royal Stay! Enjoy your complimentary WiFi.',
        failMessage: 'Authentication failed. Please check your credentials or contact the front desk.',
      },
      {
        id: PORTAL_IDS.staff,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Pool Area Portal',
        description: 'Captive portal for pool/garden area with seamless roaming from lobby.',
        slug: 'pool',
        roamingMode: 'seamless',
        allowsRoamingFrom: '["lobby"]',
        authMethod: 'room_number',
        maxBandwidthDown: 3145728,
        maxBandwidthUp: 524288,
        bandwidthPolicy: 'origin',
        ssidList: '["RoyalStay-Pool"]',
        listenIp: '0.0.0.0',
        listenPort: 80,
        useSsl: false,
        enabled: true,
        maxConcurrent: 200,
        sessionTimeout: 86400,
        idleTimeout: 3600,
        redirectUrl: 'https://www.royalstay.in/welcome',
        successMessage: 'Welcome! Pool WiFi connected.',
        failMessage: 'Authentication failed. Please contact the front desk.',
      },
    ],
  });
  console.log('✓ 2 Captive Portals seeded');

  // ═══════════════════════════════════════════════════════════════
  // 25. PORTAL AUTH METHODS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Auth Methods (3)...');
  await prisma.portalAuthentication.createMany({
    data: [
      {
        id: uuid('portalauth-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.hotel,
        method: 'voucher',
        enabled: true,
        priority: 1,
        config: JSON.stringify({ autoGenerate: true, codeLength: 8, codeFormat: 'alphanumeric' }),
      },
      {
        id: uuid('portalauth-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.hotel,
        method: 'room_number',
        enabled: true,
        priority: 2,
        config: JSON.stringify({ requireLastName: true, maxAttempts: 3, lockoutMinutes: 5 }),
      },
      {
        id: uuid('portalauth-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.hotel,
        method: 'sms_otp',
        enabled: true,
        priority: 3,
        config: JSON.stringify({ otpLength: 6, otpExpiry: 300, maxRetries: 3, senderId: 'ROYLST' }),
      },
    ],
  });
  console.log('✓ 3 Portal Auth Methods seeded');

  // ═══════════════════════════════════════════════════════════════
  // 26. PORTAL MAPPINGS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Mappings (2)...');
  await prisma.portalMapping.createMany({
    data: [
      {
        id: uuid('portmap-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.hotel,
        vlanId: 10,
        vlanConfigId: VLAN_IDS.guest,
        ssid: 'RoyalStay-Guest',
        subnet: '192.168.10.0/24',
        priority: 1,
        fallbackPortalId: null,
        enabled: true,
      },
      {
        id: uuid('portmap-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        portalId: PORTAL_IDS.staff,
        vlanId: 20,
        vlanConfigId: VLAN_IDS.staff,
        ssid: 'RoyalStay-Staff',
        subnet: '192.168.20.0/24',
        priority: 1,
        fallbackPortalId: null,
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 Portal Mappings seeded');

  // ═══════════════════════════════════════════════════════════════
  // 27. PORTAL PAGES (2 - one per portal)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Pages (2)...');
  await prisma.portalPage.createMany({
    data: [
      {
        id: uuid('portalpage-1'),
        tenantId: TENANT_ID,
        portalId: PORTAL_IDS.hotel,
        language: 'en',
        title: 'Welcome to Royal Stay WiFi',
        subtitle: 'Connect to complimentary high-speed internet',
        logoUrl: '/assets/royal-stay-logo.png',
        backgroundImage: null,
        backgroundColor: '#1a1a2e',
        textColor: '#ffffff',
        accentColor: '#8B5E3C',
        termsText: 'By connecting, you agree to our Acceptable Use Policy.',
        termsUrl: 'https://www.royalstay.in/terms',
        customCss: '',
        customHtml: '',
        showSocial: false,
        showBranding: true,
      },
      {
        id: uuid('portalpage-2'),
        tenantId: TENANT_ID,
        portalId: PORTAL_IDS.staff,
        language: 'en',
        title: 'Staff WiFi Login',
        subtitle: 'Use your PMS credentials to connect',
        logoUrl: '/assets/royal-stay-logo.png',
        backgroundImage: null,
        backgroundColor: '#f8fafc',
        textColor: '#1f2937',
        accentColor: '#0d9488',
        termsText: 'Staff WiFi is for authorized personnel only.',
        termsUrl: 'https://staff.royalstay.in/policy',
        customCss: '',
        customHtml: '',
        showSocial: false,
        showBranding: true,
      },
    ],
  });
  console.log('✓ 2 Portal Pages seeded');

  // ═══════════════════════════════════════════════════════════════
  // 28. PORTAL TEMPLATES (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Templates (2)...');
  await prisma.portalTemplate.createMany({
    data: [
      {
        id: uuid('portaltemplate-1'),
        tenantId: TENANT_ID,
        name: 'Hotel Luxury',
        description: 'Elegant dark theme with gold accents, perfect for luxury hotels.',
        category: 'hotel',
        thumbnail: '/templates/hotel-luxury-thumb.png',
        htmlContent: '<div class="portal-container"><div class="logo-section"><img src="{{logoUrl}}" alt="Logo"/></div><h1>{{title}}</h1><p>{{subtitle}}</p><div class="auth-section">{{authMethods}}</div><div class="terms">{{termsText}}</div></div>',
        cssContent: '.portal-container{max-width:480px;margin:0 auto;padding:2rem;text-align:center;background:#1a1a2e;color:#fff;border-radius:16px;}.logo-section img{max-height:80px;margin-bottom:1.5rem;}h1{font-size:1.8rem;color:#8B5E3C;margin-bottom:0.5rem;}p{color:#a0a0b0;margin-bottom:2rem;}',
        isBuiltIn: true,
      },
      {
        id: uuid('portaltemplate-2'),
        tenantId: TENANT_ID,
        name: 'Corporate Clean',
        description: 'Clean professional look with teal accents, ideal for business hotels.',
        category: 'corporate',
        thumbnail: '/templates/corporate-clean-thumb.png',
        htmlContent: '<div class="portal-container"><div class="logo-section"><img src="{{logoUrl}}" alt="Logo"/></div><h1>{{title}}</h1><p>{{subtitle}}</p><div class="auth-section">{{authMethods}}</div><div class="terms">{{termsText}}</div></div>',
        cssContent: '.portal-container{max-width:480px;margin:0 auto;padding:2rem;text-align:center;background:#f8fafc;color:#1f2937;border-radius:8px;border:1px solid #e5e7eb;}.logo-section img{max-height:60px;margin-bottom:1.5rem;}h1{font-size:1.5rem;color:#0d9488;}',
        isBuiltIn: true,
      },
    ],
  });
  console.log('✓ 2 Portal Templates seeded');

  // ═══════════════════════════════════════════════════════════════
  // 29. FIREWALL ZONES (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Firewall Zones (3)...');
  await prisma.firewallZone.createMany({
    data: [
      {
        id: FW_ZONE_IDS.wan,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'wan',
        interfaces: JSON.stringify(['eth0', 'eth2']),
        inputPolicy: 'accept',
        forwardPolicy: 'drop',
        outputPolicy: 'accept',
        masquerade: true,
        description: 'WAN zone - Internet facing interfaces with masquerade (NAT)',
      },
      {
        id: FW_ZONE_IDS.lan,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'lan',
        interfaces: JSON.stringify(['eth1', 'br0']),
        inputPolicy: 'accept',
        forwardPolicy: 'accept',
        outputPolicy: 'accept',
        masquerade: false,
        description: 'LAN zone - Internal trusted network for staff and management',
      },
      {
        id: FW_ZONE_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'guest',
        interfaces: JSON.stringify(['eth1.10', 'br-guest']),
        inputPolicy: 'accept',
        forwardPolicy: 'drop',
        outputPolicy: 'accept',
        masquerade: false,
        description: 'Guest zone - Internet only, no LAN forwarding by default',
      },
    ],
  });
  console.log('✓ 3 Firewall Zones seeded');

  // ═══════════════════════════════════════════════════════════════
  // 30. FIREWALL RULES (6)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Firewall Rules (6)...');
  await prisma.firewallRule.createMany({
    data: [
      {
        id: uuid('fwrule-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.wan,
        chain: 'input',
        protocol: 'tcp',
        sourceIp: null,
        sourcePort: null,
        destIp: null,
        destPort: '80',
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow HTTP from WAN',
        priority: 10,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.wan,
        chain: 'input',
        protocol: 'tcp',
        sourceIp: null,
        sourcePort: null,
        destIp: null,
        destPort: '443',
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow HTTPS from WAN',
        priority: 11,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.guest,
        chain: 'forward',
        protocol: null,
        sourceIp: '192.168.10.0/24',
        sourcePort: null,
        destIp: '192.168.20.0/24',
        destPort: null,
        action: 'drop',
        jumpTarget: null,
        logPrefix: 'GUEST-LAN-DROP:',
        enabled: true,
        comment: 'Drop guest-to-LAN traffic (isolation)',
        priority: 5,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.guest,
        chain: 'forward',
        protocol: null,
        sourceIp: '192.168.10.0/24',
        sourcePort: null,
        destIp: null,
        destPort: '53',
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow DNS from guest to all',
        priority: 1,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-5'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.wan,
        chain: 'input',
        protocol: 'icmp',
        sourceIp: null,
        sourcePort: null,
        destIp: null,
        destPort: null,
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow ICMP (ping) from WAN',
        priority: 20,
        scheduleId: null,
      },
      {
        id: uuid('fwrule-6'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        zoneId: FW_ZONE_IDS.lan,
        chain: 'forward',
        protocol: null,
        sourceIp: null,
        sourcePort: null,
        destIp: null,
        destPort: '53',
        action: 'accept',
        jumpTarget: null,
        logPrefix: null,
        enabled: true,
        comment: 'Allow DNS from all zones',
        priority: 1,
        scheduleId: null,
      },
    ],
  });
  console.log('✓ 6 Firewall Rules seeded');

  // ═══════════════════════════════════════════════════════════════
  // 31. FIREWALL SCHEDULES (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Firewall Schedules (2)...');
  await prisma.firewallSchedule.createMany({
    data: [
      {
        id: FW_SCHED_IDS.business,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Business Hours',
        daysOfWeek: '1,2,3,4,5',
        startTime: '08:00',
        endTime: '18:00',
        timezone: 'Asia/Kolkata',
        enabled: true,
      },
      {
        id: FW_SCHED_IDS.night,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Night Mode',
        daysOfWeek: '1,2,3,4,5,6,7',
        startTime: '23:00',
        endTime: '06:00',
        timezone: 'Asia/Kolkata',
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 Firewall Schedules seeded');

  // ═══════════════════════════════════════════════════════════════
  // 32. MAC FILTERS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding MAC Filters (3)...');
  await prisma.macFilter.createMany({
    data: [
      {
        id: uuid('macfilter-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        macAddress: '22:33:44:55:66:77',
        action: 'deny',
        listType: 'blacklist',
        description: 'Suspicious device detected on guest network',
        linkedType: null,
        linkedId: null,
        expiresAt: null,
        enabled: true,
      },
      {
        id: uuid('macfilter-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        macAddress: '33:44:55:66:77:88',
        action: 'deny',
        listType: 'blacklist',
        description: 'Known rogue AP client - banned permanently',
        linkedType: null,
        linkedId: null,
        expiresAt: null,
        enabled: true,
      },
      {
        id: uuid('macfilter-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        macAddress: 'AA:BB:CC:DD:02:01',
        action: 'allow',
        listType: 'whitelist',
        description: 'Front desk manager laptop - always allowed',
        linkedType: 'staff',
        linkedId: uuid('user-2'),
        expiresAt: null,
        enabled: true,
      },
    ],
  });
  console.log('✓ 3 MAC Filters seeded');

  // ═══════════════════════════════════════════════════════════════
  // 33. BANDWIDTH POLICIES (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bandwidth Policies (3)...');
  await prisma.bandwidthPolicy.createMany({
    data: [
      {
        id: BW_POLICY_IDS.free,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Free Tier',
        downloadKbps: 2048, // 2 Mbps
        uploadKbps: 1024, // 1 Mbps
        burstDownloadKbps: 4096,
        burstUploadKbps: 2048,
        priority: 8,
        planId: PLAN_IDS.free,
        description: 'Basic bandwidth for free WiFi users',
        enabled: true,
      },
      {
        id: BW_POLICY_IDS.standard,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Standard Tier',
        downloadKbps: 25600, // 25 Mbps
        uploadKbps: 10240, // 10 Mbps
        burstDownloadKbps: 51200,
        burstUploadKbps: 20480,
        priority: 5,
        planId: PLAN_IDS.standard,
        description: 'Standard bandwidth for paid WiFi plans',
        enabled: true,
      },
      {
        id: BW_POLICY_IDS.premium,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Premium Tier',
        downloadKbps: 51200, // 50 Mbps
        uploadKbps: 25600, // 25 Mbps
        burstDownloadKbps: 102400,
        burstUploadKbps: 51200,
        priority: 2,
        planId: PLAN_IDS.premium,
        description: 'Premium bandwidth for VIP and business users',
        enabled: true,
      },
    ],
  });
  console.log('✓ 3 Bandwidth Policies seeded');

  // ═══════════════════════════════════════════════════════════════
  // 34. BANDWIDTH POOLS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bandwidth Pools (2)...');
  await prisma.bandwidthPool.createMany({
    data: [
      {
        id: BW_POOL_IDS.guest,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Guest Pool',
        subnet: '192.168.10.0/24',
        vlanId: 10,
        totalDownloadKbps: 200000, // 200 Mbps shared
        totalUploadKbps: 100000,
        perUserDownloadKbps: 51200, // 50 Mbps per user max
        perUserUploadKbps: 25600,
        enabled: true,
      },
      {
        id: BW_POOL_IDS.staff,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Staff Pool',
        subnet: '192.168.20.0/24',
        vlanId: 20,
        totalDownloadKbps: 100000, // 100 Mbps shared
        totalUploadKbps: 50000,
        perUserDownloadKbps: 25600, // 25 Mbps per user
        perUserUploadKbps: 10240,
        enabled: true,
      },
    ],
  });
  console.log('✓ 2 Bandwidth Pools seeded');

  // ═══════════════════════════════════════════════════════════════
  // 35. BANDWIDTH DAILY USAGE (7) - last 7 days
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Bandwidth Daily Usage (7)...');
  const dailyUsage = [
    { dayOffset: -6, dl: 125000.5, ul: 42000.3, users: 45, peak: 38, peakTime: '20:00' },
    { dayOffset: -5, dl: 132000.7, ul: 45000.1, users: 52, peak: 44, peakTime: '21:00' },
    { dayOffset: -4, dl: 98000.2, ul: 33000.8, users: 38, peak: 32, peakTime: '19:00' },
    { dayOffset: -3, dl: 145000.9, ul: 51000.5, users: 58, peak: 49, peakTime: '22:00' },
    { dayOffset: -2, dl: 158000.3, ul: 55000.2, users: 63, peak: 54, peakTime: '20:00' },
    { dayOffset: -1, dl: 141000.6, ul: 48000.7, users: 55, peak: 47, peakTime: '21:00' },
    { dayOffset: 0,  dl: 89000.4, ul: 30000.9, users: 35, peak: 28, peakTime: '10:00' },
  ];

  await prisma.bandwidthUsageDaily.createMany({
    data: dailyUsage.map((d, i) => ({
      id: uuid(`bwudaily-${i + 1}`),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      date: day(d.dayOffset),
      totalDownloadMb: d.dl,
      totalUploadMb: d.ul,
      uniqueUsers: d.users,
      peakUsers: d.peak,
      peakTime: d.peakTime,
    })),
  });
  console.log('✓ 7 Bandwidth Daily Usage records seeded');

  // ═══════════════════════════════════════════════════════════════
  // 36. CONTENT FILTERS (4)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Content Filters (4)...');
  await prisma.contentFilter.createMany({
    data: [
      {
        id: uuid('contentfilter-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Social Media Block',
        category: 'social_media',
        domains: JSON.stringify(['facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com', 'snapchat.com']),
        enabled: false,
        scheduleId: null,
      },
      {
        id: uuid('contentfilter-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Adult Content Block',
        category: 'adult',
        domains: JSON.stringify(['*adult*', '*porn*', '*xxx*']),
        enabled: true,
        scheduleId: null,
      },
      {
        id: uuid('contentfilter-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Malware Protection',
        category: 'malware',
        domains: JSON.stringify(['*malware*', '*phishing*', '*ransomware*']),
        enabled: true,
        scheduleId: null,
      },
      {
        id: uuid('contentfilter-4'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Ad Blocker',
        category: 'ads',
        domains: JSON.stringify(['*doubleclick*', '*googlesyndication*', '*adnxs*', '*adserv*']),
        enabled: true,
        scheduleId: FW_SCHED_IDS.night,
      },
    ],
  });
  console.log('✓ 4 Content Filters seeded');

  // ═══════════════════════════════════════════════════════════════
  // 37. SYSLOG SERVER (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Syslog Server (1)...');
  await prisma.syslogServer.create({
    data: {
      id: uuid('syslog-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      name: 'Local Syslog Server',
      protocol: 'udp',
      host: '127.0.0.1',
      port: 514,
      format: 'ietf',
      facility: 'local1',
      severity: 'info',
      categories: JSON.stringify(['auth', 'firewall', 'dhcp', 'dns', 'portal']),
      enabled: true,
      tlsCertPath: null,
      tlsVerify: true,
    },
  });
  console.log('✓ 1 Syslog Server seeded');

  // ═══════════════════════════════════════════════════════════════
  // 38. NAT LOGS (3)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding NAT Logs (3)...');
  await prisma.natLog.createMany({
    data: [
      {
        id: uuid('natlog-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        timestamp: hour(-2),
        sourceIp: '192.168.10.105',
        sourcePort: 54321,
        destIp: '142.250.80.46',
        destPort: 443,
        protocol: 'tcp',
        destDomain: 'www.google.com',
        action: 'allow',
        bytes: 524288,
        sessionId: uuid('wifisession-1'),
      },
      {
        id: uuid('natlog-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        timestamp: hour(-4),
        sourceIp: '192.168.10.110',
        sourcePort: 54322,
        destIp: '13.107.42.14',
        destPort: 443,
        protocol: 'tcp',
        destDomain: 'api.microsoft.com',
        action: 'allow',
        bytes: 1048576,
        sessionId: uuid('wifisession-2'),
      },
      {
        id: uuid('natlog-3'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        timestamp: hour(-6),
        sourceIp: '192.168.10.140',
        sourcePort: 54323,
        destIp: '45.33.32.156',
        destPort: 443,
        protocol: 'tcp',
        destDomain: 'suspicious-domain.xyz',
        action: 'deny',
        bytes: 0,
        sessionId: uuid('wifisession-9'),
      },
    ],
  });
  console.log('✓ 3 NAT Logs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 39. NETWORK CONFIG BACKUPS (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Network Config Backups (2)...');
  await prisma.networkConfigBackup.createMany({
    data: [
      {
        id: uuid('netbackup-1'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Weekly Auto-Backup',
        configData: JSON.stringify({
          interfaces: { eth0: { type: 'wan', ip: 'dhcp' }, eth1: { type: 'lan', ip: '192.168.1.1/24' } },
          vlans: { 10: 'Guest', 20: 'Staff', 30: 'POS', 40: 'IoT', 50: 'Management' },
          dhcp: { guest: '192.168.10.0/24', staff: '192.168.20.0/24' },
          firewall: { defaultPolicy: 'drop', rules: 6 },
        }),
        version: 12,
        autoBackup: true,
        createdAt: day(-1),
      },
      {
        id: uuid('netbackup-2'),
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        name: 'Manual Pre-Maintenance Backup',
        configData: JSON.stringify({
          interfaces: { eth0: { type: 'wan', ip: 'dhcp' }, eth1: { type: 'lan', ip: '192.168.1.1/24' } },
          vlans: { 10: 'Guest', 20: 'Staff', 30: 'POS', 40: 'IoT', 50: 'Management' },
          note: 'Pre-maintenance snapshot before firmware upgrade',
        }),
        version: 11,
        autoBackup: false,
        createdAt: day(-5),
      },
    ],
  });
  console.log('✓ 2 Network Config Backups seeded');

  // ═══════════════════════════════════════════════════════════════
  // 40. SYSTEM NETWORK HEALTH (1)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding System Network Health (1)...');
  await prisma.systemNetworkHealth.create({
    data: {
      id: uuid('syshealth-1'),
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      hostname: 'gateway.royalstay.local',
      kernelVersion: '6.1.0-17-amd64',
      uptime: 864000, // 10 days
      cpuUsage: 23.5,
      ramTotal: 8192,
      ramUsed: 3276,
      diskTotal: 128000,
      diskUsed: 42000,
      cpuTemperature: 48.2,
      services: JSON.stringify({
        freeradius: { running: true, pid: 1234, uptime: 864000 },
        kea: { running: true, pid: 5678, uptime: 864000 },
        dnsmasq: { running: true, pid: 9012, uptime: 864000 },
        nftables: { running: true, rules: 24 },
        nginx: { running: true, pid: 3456, uptime: 864000 },
      }),
      lastUpdated: min(-1),
    },
  });
  console.log('✓ 1 System Network Health seeded');

  // ═══════════════════════════════════════════════════════════════
  // 41. IP POOLS (4)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding IP Pools (4)...');

  const POOL_IDS = {
    guest: uuid('ippool-guest'),
    staff: uuid('ippool-staff'),
    vip: uuid('ippool-vip'),
    iot: uuid('ippool-iot'),
  };

  // IpPool uses Prisma client with raw inet values
  for (const [key, id] of Object.entries(POOL_IDS)) {
    const cfg: Record<string, any> = {
      guest: { name: 'Guest VLAN Pool', desc: 'DHCP pool for guest WiFi on VLAN 10', subnet: '10.10.10.0/24', gateway: '10.10.10.1', def: true, captive: true, enabled: true, ranges: [['10.10.10.50', '10.10.10.200', 'Guest usable range']] },
      staff: { name: 'Staff VLAN Pool', desc: 'DHCP pool for staff network on VLAN 20', subnet: '10.10.20.0/24', gateway: '10.10.20.1', def: false, captive: false, enabled: true, ranges: [['10.10.20.10', '10.10.20.100', 'Staff devices']] },
      vip: { name: 'VIP Lounge Pool', desc: 'Premium VIP lounge WiFi on VLAN 30', subnet: '10.10.30.0/24', gateway: '10.10.30.1', def: false, captive: true, enabled: true, ranges: [['10.10.30.20', '10.10.30.80', 'VIP guests']] },
      iot: { name: 'IoT Devices Pool', desc: 'IoT sensor and smart device pool on VLAN 40', subnet: '10.10.40.0/24', gateway: '10.10.40.1', def: false, captive: false, enabled: true, ranges: [['10.10.40.10', '10.10.40.50', 'IoT devices']] },
    }[key];
    if (!cfg) continue;

    // Use raw SQL for inet columns
    await prisma.$executeRawUnsafe(`
      INSERT INTO "IpPool" (id, "tenantId", "propertyId", name, description, gateway, subnet, "isDefault", "captivePortal", enabled, "createdAt", "updatedAt")
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::inet, $7::inet, $8, $9, $10, $11, $12)
      ON CONFLICT ("tenantId", name) DO UPDATE SET
        gateway = EXCLUDED.gateway, subnet = EXCLUDED.subnet, "isDefault" = EXCLUDED."isDefault",
        "captivePortal" = EXCLUDED."captivePortal", enabled = EXCLUDED.enabled, "updatedAt" = EXCLUDED."updatedAt"
    `, id, TENANT_ID, PROPERTY_ID, cfg.name, cfg.desc, cfg.gateway, cfg.subnet, cfg.def, cfg.captive, cfg.enabled, now, now);

    // Clear old ranges and insert new ones
    await prisma.$executeRawUnsafe(`DELETE FROM "IpPoolRange" WHERE "poolId" = $1::uuid`, id);
    for (const [start, end, comment] of cfg.ranges) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "IpPoolRange" (id, "poolId", "startIp", "endIp", comment, "createdAt")
        VALUES (gen_random_uuid(), $1::uuid, $2::inet, $3::inet, $4, $5)
      `, id, start, end, comment, now);
    }
  }
  console.log('✓ 4 IP Pools seeded with ranges');

  // ═══════════════════════════════════════════════════════════════
  // 42. CAPTIVE PORTAL INSTANCES (2)
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Captive Portal Instances (2)...');

  const PORTAL_INSERT = [
    {
      id: PORTAL_IDS.hotel, tenantId: TENANT_ID, propertyId: PROPERTY_ID,
      name: 'Royal Stay Guest Portal', description: 'Main captive portal for hotel guests',
      slug: 'royal-stay-guest', authMethod: 'pms_credentials', roamingMode: 'auth_origin',
      allowsRoamingFrom: '[]', maxBandwidthDown: 5242880, maxBandwidthUp: 1048576,
      bandwidthPolicy: 'zone', nasIdentifier: 'stayserie-radius-01',
      ssidList: JSON.stringify(['StaySuite-Guest', 'StaySuite-VIP']),
      listenIp: '0.0.0.0', listenPort: 80, useSsl: false, enabled: true,
      maxConcurrent: 1000, sessionTimeout: 86400, idleTimeout: 3600,
      redirectUrl: 'https://www.royalstay.in',
      successMessage: 'Welcome to Royal Stay Resort & Spa!',
      failMessage: 'Authentication failed. Please try again or contact reception.',
    },
    {
      id: PORTAL_IDS.staff, tenantId: TENANT_ID, propertyId: PROPERTY_ID,
      name: 'Staff Network Portal', description: 'Captive portal for staff WiFi authentication',
      slug: 'royal-stay-staff', authMethod: 'pms_credentials', roamingMode: 'auth_origin',
      allowsRoamingFrom: '[]', maxBandwidthDown: 10485760, maxBandwidthUp: 5242880,
      bandwidthPolicy: 'zone', nasIdentifier: 'stayserie-radius-01',
      ssidList: JSON.stringify(['StaySuite-Staff']),
      listenIp: '0.0.0.0', listenPort: 80, useSsl: false, enabled: true,
      maxConcurrent: 200, sessionTimeout: 28800, idleTimeout: 1800,
      redirectUrl: 'https://intranet.royalstay.in',
      successMessage: 'Staff network access granted.',
      failMessage: 'Invalid staff credentials. Contact IT support.',
    },
  ];

  for (const p of PORTAL_INSERT) {
    await prisma.captivePortal.upsert({
      where: { id: p.id },
      create: {
        id: p.id, tenantId: p.tenantId, propertyId: p.propertyId,
        name: p.name, description: p.description, slug: p.slug,
        authMethod: p.authMethod, roamingMode: p.roamingMode,
        allowsRoamingFrom: p.allowsRoamingFrom,
        maxBandwidthDown: p.maxBandwidthDown, maxBandwidthUp: p.maxBandwidthUp,
        bandwidthPolicy: p.bandwidthPolicy, nasIdentifier: p.nasIdentifier,
        ssidList: p.ssidList, listenIp: p.listenIp, listenPort: p.listenPort,
        useSsl: p.useSsl, enabled: p.enabled, maxConcurrent: p.maxConcurrent,
        sessionTimeout: p.sessionTimeout, idleTimeout: p.idleTimeout,
        redirectUrl: p.redirectUrl, successMessage: p.successMessage, failMessage: p.failMessage,
      },
      update: {
        name: p.name, slug: p.slug, enabled: p.enabled, description: p.description,
        authMethod: p.authMethod, ssidList: p.ssidList,
      },
    });
  }
  console.log('✓ 2 Captive Portal Instances seeded');

  // ═══════════════════════════════════════════════════════════════
  // 43. PORTAL MAPPINGS (2) — subnet → portal routing
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Mappings (2)...');

  const MAPPING_IDS = {
    guestPortal: uuid('portalmap-guest'),
    vipPortal: uuid('portalmap-vip'),
  };

  for (const m of [
    { id: MAPPING_IDS.guestPortal, tenantId: TENANT_ID, propertyId: PROPERTY_ID, portalId: PORTAL_IDS.hotel, subnet: '10.10.10.0/24', vlanId: 10, ssid: 'StaySuite-Guest', priority: 100, enabled: true },
    { id: MAPPING_IDS.vipPortal, tenantId: TENANT_ID, propertyId: PROPERTY_ID, portalId: PORTAL_IDS.hotel, subnet: '10.10.30.0/24', vlanId: 30, ssid: 'StaySuite-VIP', priority: 90, enabled: true },
  ]) {
    await prisma.portalMapping.upsert({
      where: { id: m.id },
      create: { id: m.id, tenantId: m.tenantId, propertyId: m.propertyId, portalId: m.portalId, subnet: m.subnet, vlanId: m.vlanId, ssid: m.ssid, priority: m.priority, enabled: m.enabled },
      update: { subnet: m.subnet, vlanId: m.vlanId, ssid: m.ssid, priority: m.priority, enabled: m.enabled },
    });
  }
  console.log('✓ 2 Portal Mappings seeded');

  // ═══════════════════════════════════════════════════════════════
  // 44. PORTAL AUTH METHODS (5) — for hotel portal
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Auth Methods (5)...');

  const AUTH_METHOD_DATA = [
    { method: 'pms_credentials', priority: 1, config: { label: 'Room Number + Last Name', description: 'Guest enters room number and last name for verification' } },
    { method: 'voucher', priority: 2, config: { label: 'WiFi Voucher Code', description: 'Enter a pre-printed voucher code' } },
    { method: 'sms_otp', priority: 3, config: { label: 'SMS OTP', description: 'Receive a one-time password via SMS' } },
    { method: 'room_number', priority: 4, config: { label: 'Room Number Only', description: 'Quick access with just room number' } },
    { method: 'open_access', priority: 10, config: { label: 'Open Access', description: 'No authentication required' } },
  ];

  for (const am of AUTH_METHOD_DATA) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "PortalAuthentication" (id, "tenantId", "propertyId", "portalId", method, priority, config, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, $8)
      ON CONFLICT DO NOTHING
    `, TENANT_ID, PROPERTY_ID, PORTAL_IDS.hotel, am.method, am.priority, JSON.stringify(am.config), now, now);
  }
  console.log('✓ 5 Portal Auth Methods seeded');

  // NOTE: RadiusProvisioningLog is NOT seeded — it gets populated
  // automatically from real provisioning actions (sync, provision,
  // deprovision, suspend, resume, guest-wifi-link/unlink, update).
  // See: wifiUserService.logProvisioning() in wifi-user-service.ts

  // ═══════════════════════════════════════════════════════════════
  // 45. WiFi PARTNERS (2) — Sponsored WiFi access partners
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Partners (2)...');
  await prisma.wiFiPartner.createMany({
    data: [
      { id: uuid('wifipartner-1'), tenantId: TENANT_ID, name: 'Emirates Skywards', partnerType: 'airline', authMethod: 'promo_code', costPerAuth: 15, commission: 3, maxDailyAuths: 50, activeAuths: 12, totalAuths: 342, totalRevenue: 1026, status: 'active' },
      { id: uuid('wifipartner-2'), tenantId: TENANT_ID, name: 'HDFC Diners Club', partnerType: 'credit_card', authMethod: 'auto_detect', costPerAuth: 10, commission: 5, maxDailyAuths: 100, activeAuths: 8, totalAuths: 156, totalRevenue: 780, status: 'active' },
    ],
  });
  console.log('✓ 2 WiFi Partners seeded');

  // ═══════════════════════════════════════════════════════════════
  // 46. WiFi PARTNER AUTHS (6) — Individual sponsored sessions
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Partner Auths (6)...');
  await prisma.wiFiPartnerAuth.createMany({
    data: [
      { id: uuid('wifipartnerauth-1'), tenantId: TENANT_ID, partnerId: uuid('wifipartner-1'), guestId: uuid('guest-1'), username: 'guest.amit.mukherjee', partnerRef: 'EK-SKY-12345', partnerTier: 'Gold', costToPartner: 15, commission: 3, ipAddress: '192.168.10.105', createdAt: day(-1) },
      { id: uuid('wifipartnerauth-2'), tenantId: TENANT_ID, partnerId: uuid('wifipartner-1'), guestId: uuid('guest-2'), username: 'guest.sneha.gupta', partnerRef: 'EK-SKY-67890', partnerTier: 'Silver', costToPartner: 15, commission: 3, ipAddress: '192.168.10.115', createdAt: day(-2) },
      { id: uuid('wifipartnerauth-3'), tenantId: TENANT_ID, partnerId: uuid('wifipartner-1'), guestId: uuid('guest-3'), username: 'guest.rahul.banerjee', partnerRef: 'EK-SKY-11111', partnerTier: 'Platinum', costToPartner: 15, commission: 3, ipAddress: '192.168.10.110', createdAt: hour(-8) },
      { id: uuid('wifipartnerauth-4'), tenantId: TENANT_ID, partnerId: uuid('wifipartner-2'), guestId: uuid('guest-4'), username: 'guest.dev.sharma', partnerRef: 'HDFC-DC-98765', partnerTier: 'Premium', costToPartner: 10, commission: 5, ipAddress: '192.168.10.130', createdAt: day(-1) },
      { id: uuid('wifipartnerauth-5'), tenantId: TENANT_ID, partnerId: uuid('wifipartner-2'), guestId: uuid('guest-5'), username: 'guest.vikram.singh', partnerRef: 'HDFC-DC-43210', partnerTier: 'Standard', costToPartner: 10, commission: 5, ipAddress: '192.168.10.120', createdAt: hour(-3) },
      { id: uuid('wifipartnerauth-6'), tenantId: TENANT_ID, partnerId: uuid('wifipartner-2'), guestId: null, username: 'guest.unknown.patel', partnerRef: 'HDFC-DC-55555', partnerTier: 'Standard', costToPartner: 10, commission: 5, ipAddress: '192.168.10.145', createdAt: hour(-1) },
    ],
  });
  console.log('✓ 6 WiFi Partner Auths seeded');

  // ═══════════════════════════════════════════════════════════════
  // 47. PORTAL AD CAMPAIGNS (3) — Monetized WiFi portal ads
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding Portal Ad Campaigns (3)...');
  await prisma.portalAdCampaign.createMany({
    data: [
      { id: uuid('adcamp-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, name: 'Spa Weekend Special', advertiser: 'Royal Stay Spa', creativeUrl: '/ads/spa-banner.jpg', creativeType: 'image', slot: 'banner', impressions: 15420, clicks: 312, revenue: 1560, status: 'active', startDate: day(-14), endDate: day(14), maxBudget: 5000, spentBudget: 1560 },
      { id: uuid('adcamp-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, name: 'Restaurant Dinner Promo', advertiser: 'Royal Stay Restaurant', creativeUrl: '/ads/restaurant-promo.jpg', creativeType: 'image', slot: 'interstitial', impressions: 8930, clicks: 189, revenue: 945, status: 'active', startDate: day(-7), endDate: day(7), maxBudget: 3000, spentBudget: 945 },
      { id: uuid('adcamp-3'), tenantId: TENANT_ID, name: 'Airport Transfer Service', advertiser: 'CityCab', creativeUrl: '/ads/cab-service.jpg', creativeType: 'image', slot: 'footer', impressions: 22100, clicks: 442, revenue: 2210, status: 'active', startDate: day(-30), endDate: day(30), maxBudget: 10000, spentBudget: 2210 },
    ],
  });
  console.log('✓ 3 Portal Ad Campaigns seeded');

  // ═══════════════════════════════════════════════════════════════
  // 48. WiFi ALERTS (8) — Network monitoring alerts
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Alerts (8)...');
  await prisma.wiFiAlert.createMany({
    data: [
      { id: uuid('wifialert-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, type: 'ap_down', severity: 'critical', title: 'AP Lobby-01 Unreachable', message: 'Access point Lobby-01 has not responded to health check for 5 minutes.', source: 'AA:BB:CC:11:22:33', status: 'active', createdAt: hour(-1) },
      { id: uuid('wifialert-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, type: 'latency', severity: 'warning', title: 'High Latency on 3rd Floor', message: 'Average latency on 3rd floor APs exceeded 50ms threshold (current: 78ms).', source: 'AA:BB:CC:44:55:66', status: 'acknowledged', acknowledgedAt: hour(-4), createdAt: hour(-6) },
      { id: uuid('wifialert-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, type: 'capacity', severity: 'warning', title: 'Pool Area AP at 85% Capacity', message: 'Pool AP has 51 connected clients (recommended max: 60).', source: 'AA:BB:CC:77:88:99', status: 'active', createdAt: min(-30) },
      { id: uuid('wifialert-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, type: 'radius_error', severity: 'critical', title: 'RADIUS Authentication Failures', message: '15 authentication failures in last 10 minutes from unknown sources.', status: 'resolved', resolvedAt: hour(-3), createdAt: hour(-5) },
      { id: uuid('wifialert-5'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, type: 'bandwidth_exhaustion', severity: 'warning', title: 'Guest VLAN Bandwidth Near Limit', message: 'Guest VLAN using 920 Mbps of 1000 Mbps capacity (92%).', status: 'acknowledged', acknowledgedAt: hour(-2), createdAt: hour(-3) },
      { id: uuid('wifialert-6'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, type: 'ap_down', severity: 'info', title: 'AP Conference-B1 Rebooted', message: 'Access point Conference-B1 restarted successfully after firmware update.', source: 'DD:EE:FF:11:22:33', status: 'resolved', resolvedAt: day(-1), createdAt: day(-1) },
      { id: uuid('wifialert-7'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, type: 'auth_failure', severity: 'warning', title: 'Brute Force Detection', message: 'Multiple failed auth attempts from MAC 44:55:66:77:88:99 (5 attempts in 2 min).', status: 'resolved', resolvedAt: hour(-5), createdAt: hour(-6) },
      { id: uuid('wifialert-8'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, type: 'nas_offline', severity: 'critical', title: 'NAS Gateway Primary Offline', message: 'Primary NAS gateway (10.0.1.1) is not responding. Traffic redirected to backup.', source: '10.0.1.1', status: 'active', createdAt: min(-15) },
    ],
  });
  console.log('✓ 8 WiFi Alerts seeded');

  // ═══════════════════════════════════════════════════════════════
  // 49. WiFi DEVICES (10) — Multi-device registration for guests
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Devices (10)...');
  await prisma.wiFiDevice.createMany({
    data: [
      { id: uuid('wifidevice-1'), tenantId: TENANT_ID, guestId: uuid('guest-1'), propertyId: PROPERTY_ID, macAddress: 'AA:BB:CC:11:22:33', deviceName: 'Amit-iPhone-15', deviceType: 'phone', ipAddress: '192.168.10.105', isApproved: true, firstSeen: day(-2), lastSeen: min(-15), autoAuth: true },
      { id: uuid('wifidevice-2'), tenantId: TENANT_ID, guestId: uuid('guest-1'), propertyId: PROPERTY_ID, macAddress: 'AA:BB:CC:11:22:34', deviceName: 'Amit-Surface-Pro', deviceType: 'laptop', ipAddress: '192.168.10.106', isApproved: true, firstSeen: day(-1), lastSeen: hour(-6), autoAuth: true },
      { id: uuid('wifidevice-3'), tenantId: TENANT_ID, guestId: uuid('guest-2'), propertyId: PROPERTY_ID, macAddress: 'AA:BB:CC:77:88:99', deviceName: 'Sneha-Galaxy-S23', deviceType: 'phone', ipAddress: '192.168.10.115', isApproved: true, firstSeen: day(0), lastSeen: min(-30), autoAuth: true },
      { id: uuid('wifidevice-4'), tenantId: TENANT_ID, guestId: uuid('guest-3'), propertyId: PROPERTY_ID, macAddress: 'AA:BB:CC:44:55:66', deviceName: 'Rahul-MacBook-Pro', deviceType: 'laptop', ipAddress: '192.168.10.110', isApproved: true, firstSeen: day(-1), lastSeen: min(-5), autoAuth: true },
      { id: uuid('wifidevice-5'), tenantId: TENANT_ID, guestId: uuid('guest-3'), propertyId: PROPERTY_ID, macAddress: 'BB:CC:DD:44:55:66', deviceName: 'Rahul-iPad-Air', deviceType: 'tablet', ipAddress: '192.168.10.111', isApproved: true, firstSeen: day(-1), lastSeen: hour(-2), autoAuth: true },
      { id: uuid('wifidevice-6'), tenantId: TENANT_ID, guestId: uuid('guest-5'), propertyId: PROPERTY_ID, macAddress: 'AA:BB:CC:AA:BB:CC', deviceName: 'Vikram-ThinkPad-X1', deviceType: 'laptop', ipAddress: '192.168.10.120', isApproved: true, firstSeen: day(0), lastSeen: min(-20), autoAuth: true },
      { id: uuid('wifidevice-7'), tenantId: TENANT_ID, guestId: uuid('guest-5'), propertyId: PROPERTY_ID, macAddress: 'CC:DD:EE:AA:BB:CC', deviceName: 'Vikram-Apple-Watch', deviceType: 'watch', ipAddress: null, isApproved: true, firstSeen: day(0), lastSeen: hour(-1), autoAuth: true },
      { id: uuid('wifidevice-8'), tenantId: TENANT_ID, guestId: uuid('guest-6'), propertyId: PROPERTY_ID, macAddress: 'AA:BB:CC:DD:EE:FF', deviceName: 'Rina-iPad-mini', deviceType: 'tablet', ipAddress: '192.168.10.125', isApproved: true, firstSeen: day(-3), lastSeen: day(-1), autoAuth: true },
      { id: uuid('wifidevice-9'), tenantId: TENANT_ID, guestId: uuid('guest-6'), propertyId: PROPERTY_ID, macAddress: 'EE:FF:AA:BB:CC:DD', deviceName: 'Rina-Samsung-TV', deviceType: 'tv', ipAddress: '192.168.10.126', isApproved: true, firstSeen: day(-2), lastSeen: day(-1), autoAuth: true },
      { id: uuid('wifidevice-10'), tenantId: TENANT_ID, guestId: uuid('guest-2'), propertyId: PROPERTY_ID, macAddress: 'DD:EE:FF:AA:BB:CC', deviceName: 'Sneha-Galaxy-Tab', deviceType: 'tablet', ipAddress: '192.168.10.116', isApproved: true, firstSeen: day(0), lastSeen: hour(-3), autoAuth: true },
    ],
  });
  console.log('✓ 10 WiFi Devices seeded');

  // ═══════════════════════════════════════════════════════════════
  // 50. WiFi CONSENT LOGS (12) — GDPR/Privacy consent records
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Consent Logs (12)...');
  await prisma.wiFiConsentLog.createMany({
    data: [
      { id: uuid('wificonsent-1'), tenantId: TENANT_ID, guestId: uuid('guest-1'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-001', consentType: 'wifi_access', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.105', macAddress: 'AA:BB:CC:11:22:33', optInMarketing: true, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(-2) },
      { id: uuid('wificonsent-2'), tenantId: TENANT_ID, guestId: uuid('guest-1'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-001', consentType: 'marketing', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.105', macAddress: 'AA:BB:CC:11:22:33', optInMarketing: true, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(-2) },
      { id: uuid('wificonsent-3'), tenantId: TENANT_ID, guestId: uuid('guest-1'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-001', consentType: 'data_processing', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.105', macAddress: 'AA:BB:CC:11:22:33', optInMarketing: true, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(-2) },
      { id: uuid('wificonsent-4'), tenantId: TENANT_ID, guestId: uuid('guest-2'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-002', consentType: 'wifi_access', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.115', macAddress: 'AA:BB:CC:77:88:99', optInMarketing: false, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(0) },
      { id: uuid('wificonsent-5'), tenantId: TENANT_ID, guestId: uuid('guest-2'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-002', consentType: 'data_processing', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.115', macAddress: 'AA:BB:CC:77:88:99', optInMarketing: false, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(0) },
      { id: uuid('wificonsent-6'), tenantId: TENANT_ID, guestId: uuid('guest-3'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-003', consentType: 'wifi_access', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.110', macAddress: 'AA:BB:CC:44:55:66', optInMarketing: true, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(-1) },
      { id: uuid('wificonsent-7'), tenantId: TENANT_ID, guestId: uuid('guest-3'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-003', consentType: 'marketing', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.110', macAddress: 'AA:BB:CC:44:55:66', optInMarketing: true, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(-1) },
      { id: uuid('wificonsent-8'), tenantId: TENANT_ID, guestId: uuid('guest-5'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-004', consentType: 'wifi_access', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.120', macAddress: 'AA:BB:CC:AA:BB:CC', optInMarketing: false, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(0) },
      { id: uuid('wificonsent-9'), tenantId: TENANT_ID, guestId: uuid('guest-5'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-004', consentType: 'data_processing', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.120', macAddress: 'AA:BB:CC:AA:BB:CC', optInMarketing: false, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(0) },
      { id: uuid('wificonsent-10'), tenantId: TENANT_ID, guestId: uuid('guest-6'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-005', consentType: 'wifi_access', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.125', macAddress: 'AA:BB:CC:DD:EE:FF', optInMarketing: true, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(-3) },
      { id: uuid('wificonsent-11'), tenantId: TENANT_ID, guestId: uuid('guest-6'), propertyId: PROPERTY_ID, sessionId: 'rad-sess-005', consentType: 'marketing', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.125', macAddress: 'AA:BB:CC:DD:EE:FF', optInMarketing: true, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(-3) },
      { id: uuid('wificonsent-12'), tenantId: TENANT_ID, guestId: null, propertyId: PROPERTY_ID, sessionId: 'rad-sess-006', consentType: 'wifi_access', consentTextHash: 'abc123hash456', ipAddress: '192.168.10.130', macAddress: '11:22:33:44:55:66', optInMarketing: false, dataRetentionDays: 90, expiresAt: day(90), createdAt: day(-7) },
    ],
  });
  console.log('✓ 12 WiFi Consent Logs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 51. WiFi IDENTITY LOGS (15) — KYC identity verification records
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Identity Logs (15)...');
  await prisma.wiFiIdentityLog.createMany({
    data: [
      { id: uuid('wifiidentity-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: 'rad-sess-001', username: 'guest.amit.mukherjee', verificationMethod: 'room_number', verifiedIdentity: 'Room 501', verificationStatus: 'verified', ipAddress: '192.168.10.105', macAddress: 'AA:BB:CC:11:22:33', countryCode: 'IN', verifiedAt: day(-2), createdAt: day(-2) },
      { id: uuid('wifiidentity-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: 'rad-sess-002', username: 'guest.sneha.gupta', verificationMethod: 'otp_sms', verifiedIdentity: '+91-XXXX-XXXX-78', verificationStatus: 'verified', ipAddress: '192.168.10.115', macAddress: 'AA:BB:CC:77:88:99', countryCode: 'IN', verifiedAt: day(0), createdAt: day(0) },
      { id: uuid('wifiidentity-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: 'rad-sess-003', username: 'guest.rahul.banerjee', verificationMethod: 'government_id', verifiedIdentity: 'PP-XXXX5678', verificationStatus: 'verified', ipAddress: '192.168.10.110', macAddress: 'AA:BB:CC:44:55:66', countryCode: 'IN', idType: 'passport', verifiedAt: day(-1), createdAt: day(-1) },
      { id: uuid('wifiidentity-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: 'rad-sess-004', username: 'guest.vikram.singh', verificationMethod: 'room_number', verifiedIdentity: 'Room 312', verificationStatus: 'verified', ipAddress: '192.168.10.120', macAddress: 'AA:BB:CC:AA:BB:CC', countryCode: 'IN', verifiedAt: day(0), createdAt: day(0) },
      { id: uuid('wifiidentity-5'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: 'rad-sess-005', username: 'guest.rina.chatterjee', verificationMethod: 'otp_sms', verifiedIdentity: '+91-XXXX-XXXX-34', verificationStatus: 'verified', ipAddress: '192.168.10.125', macAddress: 'AA:BB:CC:DD:EE:FF', countryCode: 'IN', verifiedAt: day(-3), createdAt: day(-3) },
      { id: uuid('wifiidentity-6'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'guest.dev.sharma', verificationMethod: 'government_id', verifiedIdentity: 'DL-XXXX9012', verificationStatus: 'failed', failureReason: 'ID expired', ipAddress: '192.168.10.130', macAddress: '11:22:33:44:55:66', countryCode: 'IN', idType: 'driving_license', createdAt: day(-3) },
      { id: uuid('wifiidentity-7'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'unknown_user_1', verificationMethod: 'room_number', verifiedIdentity: 'Room 9999', verificationStatus: 'failed', failureReason: 'Room not found', ipAddress: '192.168.10.140', macAddress: '22:33:44:55:66:77', countryCode: null, createdAt: hour(-6) },
      { id: uuid('wifiidentity-8'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'guest.jane.doe', verificationMethod: 'otp_sms', verifiedIdentity: '+1-XXX-XXX-4567', verificationStatus: 'failed', failureReason: 'Invalid OTP', ipAddress: '192.168.10.142', macAddress: '33:44:55:66:77:88', countryCode: 'US', createdAt: day(-1) },
      { id: uuid('wifiidentity-9'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'guest.james.smith', verificationMethod: 'government_id', verifiedIdentity: 'GB-XXXX7890', verificationStatus: 'verified', ipAddress: '192.168.10.143', macAddress: '44:55:66:77:88:99', countryCode: 'GB', idType: 'passport', verifiedAt: day(-5), createdAt: day(-5) },
      { id: uuid('wifiidentity-10'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'guest.ahmed.ali', verificationMethod: 'selfie_verify', verifiedIdentity: 'selfie-match-ok', verificationStatus: 'verified', ipAddress: '192.168.10.144', macAddress: '55:66:77:88:99:AA', countryCode: 'AE', idType: 'national_id', verifiedAt: day(-4), createdAt: day(-4) },
      { id: uuid('wifiidentity-11'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'guest.hans.mueller', verificationMethod: 'government_id', verifiedIdentity: 'DE-XXXX3456', verificationStatus: 'verified', ipAddress: '192.168.10.146', macAddress: '66:77:88:99:AA:BB', countryCode: 'DE', idType: 'national_id', verifiedAt: day(-6), createdAt: day(-6) },
      { id: uuid('wifiidentity-12'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'guest.priya.nair', verificationMethod: 'aadhaar', verifiedIdentity: 'XXXX-XXXX-1234', verificationStatus: 'verified', ipAddress: '192.168.10.147', macAddress: '77:88:99:AA:BB:CC', countryCode: 'IN', idType: 'aadhaar', verifiedAt: day(-8), createdAt: day(-8) },
      { id: uuid('wifiidentity-13'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'guest.robert.chen', verificationMethod: 'otp_sms', verifiedIdentity: '+1-XXX-XXX-8901', verificationStatus: 'pending', ipAddress: '192.168.10.148', macAddress: '88:99:AA:BB:CC:DD', countryCode: 'US', createdAt: min(-10) },
      { id: uuid('wifiidentity-14'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'staff.priya.das', verificationMethod: 'none', verifiedIdentity: null, verificationStatus: 'skipped', ipAddress: '192.168.10.150', macAddress: 'AA:BB:CC:55:66:77', countryCode: null, createdAt: day(-10) },
      { id: uuid('wifiidentity-15'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, sessionId: null, username: 'guest.ravi.kumar', verificationMethod: 'room_number', verifiedIdentity: 'Room 205', verificationStatus: 'verified', ipAddress: '192.168.10.149', macAddress: '99:AA:BB:CC:DD:EE', countryCode: 'IN', verifiedAt: day(-9), createdAt: day(-9) },
    ],
  });
  console.log('✓ 15 WiFi Identity Logs seeded');

  // ═══════════════════════════════════════════════════════════════
  // 52. WiFi BANDWIDTH UPGRADES (8) — Guest upsell transactions
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Bandwidth Upgrades (8)...');
  await prisma.wiFiBandwidthUpgrade.createMany({
    data: [
      { id: uuid('wifiupgrade-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-1'), bookingId: uuid('booking-1'), sessionId: 'rad-sess-001', username: 'guest.amit.mukherjee', fromPlanId: PLAN_IDS.standard, toPlanId: PLAN_IDS.premium, amount: 299, currency: 'INR', paymentStatus: 'completed', coaStatus: 'applied', activatedAt: day(-2), expiresAt: day(1), createdAt: day(-2) },
      { id: uuid('wifiupgrade-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-2'), bookingId: uuid('booking-3'), sessionId: 'rad-sess-002', username: 'guest.sneha.gupta', fromPlanId: PLAN_IDS.free, toPlanId: PLAN_IDS.standard, amount: 199, currency: 'INR', paymentStatus: 'completed', coaStatus: 'applied', activatedAt: day(0), expiresAt: day(4), createdAt: day(0) },
      { id: uuid('wifiupgrade-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-3'), bookingId: uuid('booking-2'), sessionId: 'rad-sess-003', username: 'guest.rahul.banerjee', fromPlanId: PLAN_IDS.premium, toPlanId: PLAN_IDS.vip, amount: 399, currency: 'INR', paymentStatus: 'completed', coaStatus: 'applied', activatedAt: day(-1), expiresAt: day(3), createdAt: day(-1) },
      { id: uuid('wifiupgrade-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-5'), bookingId: uuid('booking-4'), sessionId: 'rad-sess-004', username: 'guest.vikram.singh', fromPlanId: PLAN_IDS.standard, toPlanId: PLAN_IDS.vip, amount: 399, currency: 'INR', paymentStatus: 'completed', coaStatus: 'applied', activatedAt: day(0), expiresAt: day(2), createdAt: day(0) },
      { id: uuid('wifiupgrade-5'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-6'), bookingId: uuid('booking-6'), sessionId: 'rad-sess-005', username: 'guest.rina.chatterjee', fromPlanId: PLAN_IDS.free, toPlanId: PLAN_IDS.basic, amount: 99, currency: 'INR', paymentStatus: 'completed', coaStatus: 'applied', activatedAt: day(-3), expiresAt: day(0), createdAt: day(-3) },
      { id: uuid('wifiupgrade-6'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-1'), bookingId: uuid('booking-1'), sessionId: null, username: 'guest.amit.mukherjee', fromPlanId: PLAN_IDS.premium, toPlanId: PLAN_IDS.vip, amount: 399, currency: 'INR', paymentStatus: 'pending', coaStatus: null, activatedAt: null, expiresAt: null, createdAt: hour(-1) },
      { id: uuid('wifiupgrade-7'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-2'), bookingId: uuid('booking-3'), sessionId: null, username: 'guest.sneha.gupta', fromPlanId: PLAN_IDS.standard, toPlanId: PLAN_IDS.premium, amount: 299, currency: 'INR', paymentStatus: 'refunded', coaStatus: null, activatedAt: null, expiresAt: null, createdAt: day(-5) },
      { id: uuid('wifiupgrade-8'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-3'), bookingId: uuid('booking-2'), sessionId: null, username: 'guest.rahul.banerjee', fromPlanId: PLAN_IDS.vip, toPlanId: PLAN_IDS.conference, amount: 199, currency: 'INR', paymentStatus: 'failed', coaStatus: null, activatedAt: null, expiresAt: null, createdAt: day(-4) },
    ],
  });
  console.log('✓ 8 WiFi Bandwidth Upgrades seeded');

  // ═══════════════════════════════════════════════════════════════
  // 53. WiFi SATISFACTION SURVEYS (15) — In-portal guest feedback
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Satisfaction Surveys (15)...');
  await prisma.wiFiSatisfactionSurvey.createMany({
    data: [
      { id: uuid('wisurvey-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-1'), sessionId: 'rad-sess-001', rating: 5, comment: 'Great speed! No issues at all.', categories: '{"speed":5,"coverage":5,"easeOfConnect":5}', deviceType: 'phone', roomNumber: '501', apName: 'AP-Lobby-01', ipAddress: '192.168.10.105', createdAt: day(-2) },
      { id: uuid('wisurvey-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-1'), sessionId: null, rating: 4, comment: 'Good connection overall.', categories: '{"speed":4,"coverage":4,"easeOfConnect":5}', deviceType: 'laptop', roomNumber: '501', apName: 'AP-5F-01', ipAddress: '192.168.10.106', createdAt: day(-1) },
      { id: uuid('wisurvey-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-2'), sessionId: 'rad-sess-002', rating: 3, comment: 'Slow in evening during peak hours.', categories: '{"speed":2,"coverage":4,"easeOfConnect":4}', deviceType: 'phone', roomNumber: '205', apName: 'AP-2F-01', ipAddress: '192.168.10.115', createdAt: day(0) },
      { id: uuid('wisurvey-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-3'), sessionId: 'rad-sess-003', rating: 5, comment: 'Excellent for video calls.', categories: '{"speed":5,"coverage":5,"easeOfConnect":5}', deviceType: 'laptop', roomNumber: '312', apName: 'AP-3F-02', ipAddress: '192.168.10.110', createdAt: day(-1) },
      { id: uuid('wisurvey-5'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-3'), sessionId: null, rating: 4, comment: 'Good coverage everywhere.', categories: '{"speed":4,"coverage":5,"easeOfConnect":4}', deviceType: 'tablet', roomNumber: '312', apName: 'AP-Pool-01', ipAddress: '192.168.10.111', createdAt: day(-1) },
      { id: uuid('wisurvey-6'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-5'), sessionId: 'rad-sess-004', rating: 4, comment: null, categories: '{"speed":4,"coverage":4,"easeOfConnect":5}', deviceType: 'laptop', roomNumber: '312', apName: 'AP-3F-02', ipAddress: '192.168.10.120', createdAt: day(0) },
      { id: uuid('wisurvey-7'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-6'), sessionId: 'rad-sess-005', rating: 2, comment: 'Connection keeps dropping.', categories: '{"speed":2,"coverage":1,"easeOfConnect":3}', deviceType: 'tablet', roomNumber: '101', apName: 'AP-1F-02', ipAddress: '192.168.10.125', createdAt: day(-3) },
      { id: uuid('wisurvey-8'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: uuid('guest-6'), sessionId: null, rating: 3, comment: 'OK but could be faster.', categories: '{"speed":3,"coverage":3,"easeOfConnect":4}', deviceType: 'tv', roomNumber: '101', apName: 'AP-1F-02', ipAddress: '192.168.10.126', createdAt: day(-2) },
      { id: uuid('wisurvey-9'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: null, sessionId: null, rating: 4, comment: 'Decent WiFi for the price.', categories: '{"speed":4,"coverage":4,"easeOfConnect":4}', deviceType: 'laptop', roomNumber: '401', apName: 'AP-4F-01', ipAddress: '192.168.10.130', createdAt: day(-5) },
      { id: uuid('wisurvey-10'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: null, sessionId: null, rating: 1, comment: 'Terrible, could not connect at all.', categories: '{"speed":1,"coverage":1,"easeOfConnect":1}', deviceType: 'phone', roomNumber: '205', apName: 'AP-2F-02', ipAddress: '192.168.10.142', createdAt: day(-4) },
      { id: uuid('wisurvey-11'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: null, sessionId: null, rating: 5, comment: 'Best hotel WiFi I have used!', categories: '{"speed":5,"coverage":5,"easeOfConnect":5}', deviceType: 'laptop', roomNumber: '501', apName: 'AP-Lobby-01', ipAddress: '192.168.10.143', createdAt: day(-6) },
      { id: uuid('wisurvey-12'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: null, sessionId: null, rating: 3, comment: 'Average experience, nothing special.', categories: '{"speed":3,"coverage":3,"easeOfConnect":4}', deviceType: 'phone', roomNumber: '312', apName: 'AP-3F-01', ipAddress: '192.168.10.144', createdAt: day(-7) },
      { id: uuid('wisurvey-13'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: null, sessionId: null, rating: 4, comment: 'Worked well for my conference call.', categories: '{"speed":4,"coverage":4,"easeOfConnect":5}', deviceType: 'laptop', roomNumber: '401', apName: 'AP-4F-02', ipAddress: '192.168.10.145', createdAt: day(-8) },
      { id: uuid('wisurvey-14'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: null, sessionId: null, rating: 2, comment: 'Slow streaming, buffered constantly.', categories: '{"speed":1,"coverage":3,"easeOfConnect":3}', deviceType: 'tablet', roomNumber: '101', apName: 'AP-1F-01', ipAddress: '192.168.10.146', createdAt: day(-9) },
      { id: uuid('wisurvey-15'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, guestId: null, sessionId: null, rating: 4, comment: 'Good speed near the pool area.', categories: '{"speed":5,"coverage":4,"easeOfConnect":4}', deviceType: 'phone', roomNumber: '205', apName: 'AP-Pool-01', ipAddress: '192.168.10.147', createdAt: day(-10) },
    ],
  });
  console.log('✓ 15 WiFi Satisfaction Surveys seeded');

  // ═══════════════════════════════════════════════════════════════
  // 54. WiFi PRE-ARRIVAL CONFIG (1) — Pre-arrival WiFi credential settings
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi Pre-Arrival Config (1)...');
  await prisma.wiFiPreArrivalConfig.createMany({
    data: [
      { id: uuid('prearr-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, enabled: true, hoursBeforeArrival: 24, sendEmail: true, sendSms: true, includeQrCode: true, autoGenerateCreds: true, planId: PLAN_IDS.free },
    ],
  });
  console.log('✓ 1 WiFi Pre-Arrival Config seeded');

  // ═══════════════════════════════════════════════════════════════
  // 55. WiFi SLA CONFIG (1) — SLA targets and monitoring settings
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi SLA Config (1)...');
  await prisma.wiFiSLAConfig.createMany({
    data: [
      { id: uuid('slaconfig-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, uptimeTarget: 99.9, speedTargetDown: 50, speedTargetUp: 10, latencyTarget: 20, measurementInterval: 5, alertOnBreach: true, breachDuration: 15 },
    ],
  });
  console.log('✓ 1 WiFi SLA Config seeded');

  // ═══════════════════════════════════════════════════════════════
  // 56. WiFi SLA METRICS (14) — Daily SLA measurements for 14 days
  // ═══════════════════════════════════════════════════════════════
  console.log('Seeding WiFi SLA Metrics (14)...');
  await prisma.wiFiSLAMetric.createMany({
    data: [
      { id: uuid('wifisla-1'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-14), periodEnd: day(-13), actualUptime: 99.8, avgSpeedDown: 42, avgSpeedUp: 8, avgLatency: 25, totalSessions: 32, totalBandwidth: 85, breached: true, breachTypes: '["uptime"]', createdAt: day(-13) },
      { id: uuid('wifisla-2'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-13), periodEnd: day(-12), actualUptime: 100.0, avgSpeedDown: 48, avgSpeedUp: 10, avgLatency: 15, totalSessions: 28, totalBandwidth: 78, breached: false, breachTypes: '[]', createdAt: day(-12) },
      { id: uuid('wifisla-3'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-12), periodEnd: day(-11), actualUptime: 99.9, avgSpeedDown: 52, avgSpeedUp: 11, avgLatency: 12, totalSessions: 35, totalBandwidth: 95, breached: false, breachTypes: '[]', createdAt: day(-11) },
      { id: uuid('wifisla-4'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-11), periodEnd: day(-10), actualUptime: 99.7, avgSpeedDown: 38, avgSpeedUp: 9, avgLatency: 32, totalSessions: 42, totalBandwidth: 120, breached: true, breachTypes: '["uptime","speed"]', createdAt: day(-10) },
      { id: uuid('wifisla-5'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-10), periodEnd: day(-9), actualUptime: 100.0, avgSpeedDown: 55, avgSpeedUp: 13, avgLatency: 10, totalSessions: 30, totalBandwidth: 88, breached: false, breachTypes: '[]', createdAt: day(-9) },
      { id: uuid('wifisla-6'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-9), periodEnd: day(-8), actualUptime: 99.9, avgSpeedDown: 50, avgSpeedUp: 10, avgLatency: 14, totalSessions: 25, totalBandwidth: 72, breached: false, breachTypes: '[]', createdAt: day(-8) },
      { id: uuid('wifisla-7'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-8), periodEnd: day(-7), actualUptime: 100.0, avgSpeedDown: 47, avgSpeedUp: 11, avgLatency: 16, totalSessions: 38, totalBandwidth: 105, breached: false, breachTypes: '[]', createdAt: day(-7) },
      { id: uuid('wifisla-8'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-7), periodEnd: day(-6), actualUptime: 99.9, avgSpeedDown: 51, avgSpeedUp: 12, avgLatency: 13, totalSessions: 40, totalBandwidth: 110, breached: false, breachTypes: '[]', createdAt: day(-6) },
      { id: uuid('wifisla-9'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-6), periodEnd: day(-5), actualUptime: 99.5, avgSpeedDown: 35, avgSpeedUp: 8, avgLatency: 35, totalSessions: 55, totalBandwidth: 160, breached: true, breachTypes: '["uptime","speed","latency"]', createdAt: day(-5) },
      { id: uuid('wifisla-10'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-5), periodEnd: day(-4), actualUptime: 100.0, avgSpeedDown: 49, avgSpeedUp: 11, avgLatency: 18, totalSessions: 33, totalBandwidth: 92, breached: false, breachTypes: '[]', createdAt: day(-4) },
      { id: uuid('wifisla-11'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-4), periodEnd: day(-3), actualUptime: 99.9, avgSpeedDown: 53, avgSpeedUp: 14, avgLatency: 11, totalSessions: 27, totalBandwidth: 76, breached: false, breachTypes: '[]', createdAt: day(-3) },
      { id: uuid('wifisla-12'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-3), periodEnd: day(-2), actualUptime: 100.0, avgSpeedDown: 50, avgSpeedUp: 12, avgLatency: 15, totalSessions: 45, totalBandwidth: 130, breached: false, breachTypes: '[]', createdAt: day(-2) },
      { id: uuid('wifisla-13'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-2), periodEnd: day(-1), actualUptime: 99.9, avgSpeedDown: 48, avgSpeedUp: 10, avgLatency: 17, totalSessions: 36, totalBandwidth: 98, breached: false, breachTypes: '[]', createdAt: day(-1) },
      { id: uuid('wifisla-14'), tenantId: TENANT_ID, propertyId: PROPERTY_ID, slaConfigId: uuid('slaconfig-1'), periodStart: day(-1), periodEnd: day(0), actualUptime: 99.6, avgSpeedDown: 41, avgSpeedUp: 9, avgLatency: 28, totalSessions: 50, totalBandwidth: 145, breached: true, breachTypes: '["uptime"]', createdAt: day(0) },
    ],
  });
  console.log('✓ 14 WiFi SLA Metrics seeded');

  console.log('\n📡 WiFi module seed data completed! All 56 categories seeded.');
}
