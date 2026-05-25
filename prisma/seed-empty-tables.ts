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
    h.slice(19, 31),
  ].join('-');
};

// ─── Shared constants ───────────────────────────────────────────
const T1 = uuid('tenant-1');
const T2 = uuid('tenant-2');
const P1 = uuid('property-1');
const P2 = uuid('property-2');
const U1 = uuid('user-1');
const U2 = uuid('user-2');
const U3 = uuid('user-3');
const G1 = uuid('guest-1');
const G2 = uuid('guest-2');
const G3 = uuid('guest-3');
const G5 = uuid('guest-5');
const G6 = uuid('guest-6');

// Rooms
const ROOM_101 = uuid('room-101');
const ROOM_305 = uuid('room-305');
const ROOM_501 = uuid('room-501');
const ROOM_510 = uuid('room-510');
const ROOM_801 = uuid('room-801');
const ROOM_1002 = uuid('room-1002');

// Network
const IFACE_ETH0 = uuid('netif-eth0');
const IFACE_ETH1 = uuid('netif-eth1');
const IFACE_BOND0 = uuid('netif-bond0');

// Bandwidth
const BW_POOL_GUEST = uuid('bwpool-guest');
const BW_POOL_STAFF = uuid('bwpool-staff');
const BW_POLICY_FREE = uuid('bwpolicy-free');
const BW_POLICY_STD = uuid('bwpolicy-standard');
const BW_POLICY_PREM = uuid('bwpolicy-premium');

// Captive portals
const PORTAL_HOTEL = uuid('portal-hotel');
const PORTAL_STAFF = uuid('portal-staff');

// WiFi users & sessions
const WU1 = uuid('wifiuser-1');
const WU2 = uuid('wifiuser-2');
const WU3 = uuid('wifiuser-3');
const WS1 = uuid('wifisession-1');
const WS2 = uuid('wifisession-2');
const WS3 = uuid('wifisession-9');

// Rate plans
const RP1 = uuid('rateplan-1');
const RP4 = uuid('rateplan-4');
const RP6 = uuid('rateplan-6');

// Channel connections
const CH1 = uuid('channel-conn-1');
const CH2 = uuid('channel-conn-2');

// IoT devices
const IOT1 = uuid('iot-1');
const IOT2 = uuid('iot-2');
const IOT3 = uuid('iot-3');

// Cameras
const CAM1 = uuid('cam-1');
const CAM2 = uuid('cam-2');
const CAM3 = uuid('cam-3');

// Hardware adapters
const HWA1 = uuid('hwadpt-1');
const HWA2 = uuid('hwadpt-2');

// License keys
const LK1 = uuid('licensekey-1');
const LK2 = uuid('licensekey-2');

// Plugins
const PLUG1 = uuid('plugin-1');
const PLUG2 = uuid('plugin-2');
const PLUG3 = uuid('plugin-3');

// Device groups & policies
const DG1 = uuid('devgrp-1');
const DG2 = uuid('devgrp-2');
const DP1 = uuid('devpol-1');
const DP2 = uuid('devpol-2');

// Conversations
const CONV1 = uuid('conv-1');

// Webhook endpoints
const WH1 = uuid('wh-1');
const WH2 = uuid('wh-2');

// Notification templates
const NT1 = uuid('ntmpl-1');
const NT2 = uuid('ntmpl-2');

// Content filters
const CF1 = uuid('contentfilter-1');

// Competitor prices
const CP1 = uuid('cp-1');
const CP2 = uuid('cp-2');

// AP invoices
const AP1 = uuid('apinv-1');
const AP2 = uuid('apinv-2');

// Overbooking config
const OBC1 = uuid('obc-1');

// Last minute trigger
const LMT1 = uuid('lmt-1');
const LMT2 = uuid('lmt-2');

// Room types
const RT1 = uuid('roomtype-1');
const RT2 = uuid('roomtype-2');
const RT3 = uuid('roomtype-3');

// Bookings
const BK1 = uuid('booking-1');

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

export async function seedEmptyTables(prisma: PrismaClient) {
  console.log('\n📦 Seeding 49 empty tables...');

  // ────────────────────────────────────────────────────────────────
  // 1. StaticRoute (FK → Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  1/49  StaticRoute...');
  try {
    await prisma.staticRoute.createMany({
      data: [
        { id: uuid('sr-1'), tenantId: T1, propertyId: P1, name: 'Default internet route', destination: '0.0.0.0/0', gateway: '192.168.1.1', metric: 100, interfaceName: 'bond0', protocol: 'static', isDefault: true, description: 'Primary internet gateway via bonded WAN' },
        { id: uuid('sr-2'), tenantId: T1, propertyId: P1, name: 'IoT subnet route', destination: '10.100.0.0/24', gateway: '10.100.0.1', metric: 50, interfaceName: 'eth2', protocol: 'static', description: 'VLAN 40 IoT devices subnet' },
        { id: uuid('sr-3'), tenantId: T1, propertyId: P2, name: 'Default route Darjeeling', destination: '0.0.0.0/0', gateway: '192.168.0.1', metric: 100, interfaceName: 'eth0', isDefault: true, description: 'Primary ISP for Darjeeling resort' },
      ],
    });
  } catch (e: any) { console.log('  StaticRoute error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 2. MultiWanConfig (FK → Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  2/49  MultiWanConfig...');
  try {
    await prisma.multiWanConfig.createMany({
      data: [
        { id: uuid('mwan-1'), tenantId: T1, propertyId: P1, enabled: true, mode: 'weighted', checkInterval: 20, pingCount: 3, pingTimeout: 2, autoSwitchback: true, switchbackDelay: 300, flushConntrackOnFailover: true },
        { id: uuid('mwan-2'), tenantId: T1, propertyId: P2, enabled: false, mode: 'failover', checkInterval: 30, pingCount: 5 },
      ],
    });
  } catch (e: any) { console.log('  MultiWanConfig error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 3. Gateway (FK → Property, MultiWanConfig)
  // ────────────────────────────────────────────────────────────────
  console.log('  3/49  Gateway...');
  try {
    await prisma.gateway.createMany({
      data: [
        { id: uuid('gw-1'), tenantId: T1, propertyId: P1, multiWanConfigId: uuid('mwan-1'), name: 'WAN-1 Primary', ipAddress: '10.0.0.1', interfaceName: 'eth0', interfaceId: IFACE_ETH0, weight: 3, healthStatus: 'online', lastHealthCheck: daysAgo(0), enabled: true },
        { id: uuid('gw-2'), tenantId: T1, propertyId: P1, multiWanConfigId: uuid('mwan-1'), name: 'WAN-2 Backup', ipAddress: '10.0.1.1', interfaceName: 'eth1', interfaceId: IFACE_ETH1, weight: 1, isBackup: true, backupGatewayId: uuid('gw-1'), healthStatus: 'online', lastHealthCheck: daysAgo(0), enabled: true },
        { id: uuid('gw-3'), tenantId: T1, propertyId: P2, multiWanConfigId: uuid('mwan-2'), name: 'WAN-1 Darjeeling', ipAddress: '192.168.0.1', interfaceName: 'eth0', weight: 1, healthStatus: 'unknown', enabled: true },
      ],
    });
  } catch (e: any) { console.log('  Gateway error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 4. GatewayExplicitRoute (FK → Gateway)
  // ────────────────────────────────────────────────────────────────
  console.log('  4/49  GatewayExplicitRoute...');
  try {
    await prisma.gatewayExplicitRoute.createMany({
      data: [
        { id: uuid('ger-1'), gatewayId: uuid('gw-1'), tenantId: T1, propertyId: P1, network: '192.168.10.0/24', description: 'Guest VLAN 10 traffic via WAN-1' },
        { id: uuid('ger-2'), gatewayId: uuid('gw-2'), tenantId: T1, propertyId: P1, network: '10.100.0.0/24', description: 'IoT VLAN 40 traffic via WAN-2 backup' },
      ],
    });
  } catch (e: any) { console.log('  GatewayExplicitRoute error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 5. GatewayFwmark (FK → Gateway)
  // ────────────────────────────────────────────────────────────────
  console.log('  5/49  GatewayFwmark...');
  try {
    await prisma.gatewayFwmark.createMany({
      data: [
        { id: uuid('gfw-1'), gatewayId: uuid('gw-1'), tenantId: T1, fwmarkValue: '0x1', description: 'Portal auth traffic' },
        { id: uuid('gfw-2'), gatewayId: uuid('gw-2'), tenantId: T1, fwmarkValue: '0x2', description: 'Backup portal traffic' },
      ],
    });
  } catch (e: any) { console.log('  GatewayFwmark error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 6. GatewayHealthRule (FK → Gateway)
  // ────────────────────────────────────────────────────────────────
  console.log('  6/49  GatewayHealthRule...');
  try {
    await prisma.gatewayHealthRule.createMany({
      data: [
        { id: uuid('ghr-1'), gatewayId: uuid('gw-1'), tenantId: T1, protocol: 'PING', host: '8.8.8.8', port: 0, operator: '&', sortOrder: 0 },
        { id: uuid('ghr-2'), gatewayId: uuid('gw-1'), tenantId: T1, protocol: 'PING', host: '1.1.1.1', port: 0, operator: '|', sortOrder: 1 },
        { id: uuid('ghr-3'), gatewayId: uuid('gw-2'), tenantId: T1, protocol: 'TCP', host: 'google.com', port: 443, operator: '&', sortOrder: 0 },
      ],
    });
  } catch (e: any) { console.log('  GatewayHealthRule error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 7. RateLimitRule (FK → Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  7/49  RateLimitRule...');
  try {
    await prisma.rateLimitRule.createMany({
      data: [
        { id: uuid('rlr-1'), tenantId: T1, propertyId: P1, name: 'Guest subnet limit', targetIp: '192.168.10.0/24', downloadRate: '50mbit', uploadRate: '25mbit', protocol: 'all', enabled: true, comment: 'Per-device rate limit for guest VLAN' },
        { id: uuid('rlr-2'), tenantId: T1, propertyId: P1, name: 'API protection', targetIp: '0.0.0.0/0', downloadRate: '100mbit', uploadRate: '100mbit', protocol: 'tcp', enabled: true, comment: 'Protect management API from abuse' },
        { id: uuid('rlr-3'), tenantId: T1, propertyId: P2, name: 'Darjeeling guest', targetIp: '10.0.0.0/24', downloadRate: '20mbit', uploadRate: '10mbit' },
      ],
    });
  } catch (e: any) { console.log('  RateLimitRule error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 8. RateLimitEntry
  // ────────────────────────────────────────────────────────────────
  console.log('  8/49  RateLimitEntry...');
  try {
    await prisma.rateLimitEntry.createMany({
      data: [
        { id: uuid('rle-1'), key: 'login:user@example.com', count: 3, resetAt: daysFromNow(1) },
        { id: uuid('rle-2'), key: 'api:T1:bookings/create', count: 85, resetAt: daysFromNow(0) },
        { id: uuid('rle-3'), key: 'login:admin@royalstay.in', count: 1, resetAt: daysFromNow(0) },
      ],
    });
  } catch (e: any) { console.log('  RateLimitEntry error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 9. FairAccessPolicy (FK → Property) – note: no bandwidthPool FK in schema
  // ────────────────────────────────────────────────────────────────
  console.log('  9/49  FairAccessPolicy...');
  try {
    await prisma.fairAccessPolicy.createMany({
      data: [
        { id: uuid('fap-1'), tenantId: T1, propertyId: P1, name: 'Daily FUP – Guest', description: 'Throttle guests after 1 GB/day', cycleType: 'daily', limitType: 'total', dataLimitMb: 1024, dataLimitUnit: 'mb', cycleResetHour: 23, cycleResetMinute: 59, applicableOn: 'total', isEnabled: true, priority: 0 },
        { id: uuid('fap-2'), tenantId: T1, propertyId: P1, name: 'Weekly FUP – Long Stay', description: 'Weekly 5 GB cap for extended stays', cycleType: 'weekly', limitType: 'total', dataLimitMb: 5120, isEnabled: true, priority: 1 },
        { id: uuid('fap-3'), tenantId: T1, propertyId: P2, name: 'Daily FUP – Darjeeling', cycleType: 'daily', limitType: 'total', dataLimitMb: 2048, isEnabled: true },
      ],
    });
  } catch (e: any) { console.log('  FairAccessPolicy error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 10. IpWhitelistRule (FK → Tenant)
  // ────────────────────────────────────────────────────────────────
  console.log('  10/49 IpWhitelistRule...');
  try {
    await prisma.ipWhitelistRule.createMany({
      data: [
        { id: uuid('iwr-1'), tenantId: T1, type: 'whitelist', ipAddress: '103.45.67.0/24', description: 'Corporate HQ office range', isEnabled: true, createdBy: U1 },
        { id: uuid('iwr-2'), tenantId: T1, type: 'whitelist', ipAddress: '14.139.0.0/16', description: 'Jio broadband ISP range', isEnabled: true },
        { id: uuid('iwr-3'), tenantId: T1, type: 'blacklist', ipAddress: '45.33.32.156', description: 'Known malicious IP', isEnabled: true },
      ],
    });
  } catch (e: any) { console.log('  IpWhitelistRule error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 11. WebCategory (FK → Tenant via Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  11/49 WebCategory...');
  try {
    await prisma.webCategory.createMany({
      data: [
        { id: uuid('wc-1'), tenantId: T1, propertyId: P1, name: 'Social Media', description: 'Social networking sites', categoryType: 'custom', isUploadRestricted: true, isDefault: false, implementationOn: 'block', sortOrder: 1, enabled: true },
        { id: uuid('wc-2'), tenantId: T1, propertyId: P1, name: 'Streaming', description: 'Video/audio streaming services', categoryType: 'custom', isUploadRestricted: false, isDefault: false, implementationOn: 'block', sortOrder: 2, enabled: false },
        { id: uuid('wc-3'), tenantId: T1, propertyId: P1, name: 'Adult Content', description: 'Inappropriate content', categoryType: 'system', isDefault: true, implementationOn: 'block', sortOrder: 0, enabled: true },
      ],
    });
  } catch (e: any) { console.log('  WebCategory error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 12. WebCategorySchedule (FK → WebCategory)
  // ────────────────────────────────────────────────────────────────
  console.log('  12/49 WebCategorySchedule...');
  try {
    await prisma.webCategorySchedule.createMany({
      data: [
        { id: uuid('wcs-1'), tenantId: T1, propertyId: P1, webCategoryId: uuid('wc-1'), isAllow: false, orderIndex: 0, startTime: '06:00', endTime: '23:59', daysOfWeek: '1,2,3,4,5', enabled: true },
        { id: uuid('wcs-2'), tenantId: T1, propertyId: P1, webCategoryId: uuid('wc-1'), isAllow: true, orderIndex: 1, startTime: '00:00', endTime: '05:59', daysOfWeek: '1,2,3,4,5', enabled: true },
        { id: uuid('wcs-3'), tenantId: T1, propertyId: P1, webCategoryId: uuid('wc-2'), isAllow: true, orderIndex: 0, startTime: '18:00', endTime: '22:00', daysOfWeek: '0,6', enabled: true },
      ],
    });
  } catch (e: any) { console.log('  WebCategorySchedule error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 13. PortalWhitelist (FK → Property via propertyId)
  // ────────────────────────────────────────────────────────────────
  console.log('  13/49 PortalWhitelist...');
  try {
    await prisma.portalWhitelist.createMany({
      data: [
        { id: uuid('pwl-1'), propertyId: P1, domain: 'royalstay.in', path: null, description: 'Hotel website – always accessible', protocol: 'https', bypassAuth: true, priority: 10, status: 'active' },
        { id: uuid('pwl-2'), propertyId: P1, domain: 'google.com', path: null, description: 'Google for search access before auth', protocol: 'https', bypassAuth: true, priority: 5, status: 'active' },
        { id: uuid('pwl-3'), propertyId: P1, domain: 'staysuite.com', path: '/terms', description: 'Terms of service page', protocol: 'https', bypassAuth: true, priority: 8, status: 'active' },
      ],
    });
  } catch (e: any) { console.log('  PortalWhitelist error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 14. WiFiFloorPlan (FK → Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  14/49 WiFiFloorPlan...');
  try {
    await prisma.wiFiFloorPlan.createMany({
      data: [
        { id: uuid('fp-1'), tenantId: T1, propertyId: P1, floorName: 'Ground Floor Lobby', floorNumber: 0, svgData: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#f0f4f8" width="800" height="600"/></svg>', width: 800, height: 600, isActive: true },
        { id: uuid('fp-2'), tenantId: T1, propertyId: P1, floorName: 'Fifth Floor – Deluxe Wing', floorNumber: 5, svgData: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#f0f4f8" width="800" height="600"/></svg>', width: 800, height: 600, isActive: true },
        { id: uuid('fp-3'), tenantId: T1, propertyId: P1, floorName: 'Eighth Floor – Executive Wing', floorNumber: 8, svgData: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#f0f4f8" width="800" height="600"/></svg>', width: 800, height: 600, isActive: true },
      ],
    });
  } catch (e: any) { console.log('  WiFiFloorPlan error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 15. WiFiHeatmapReading (FK → WiFiFloorPlan)
  // ────────────────────────────────────────────────────────────────
  console.log('  15/49 WiFiHeatmapReading...');
  try {
    await prisma.wiFiHeatmapReading.createMany({
      data: [
        { id: uuid('whr-1'), tenantId: T1, propertyId: P1, floorPlanId: uuid('fp-1'), apName: 'AP-Lobby-1', apMac: 'AA:BB:CC:DD:EE:01', apX: 25.5, apY: 30.0, signalStrength: -45, clientCount: 12, band: '2.4', channel: 6, frequency: 2412, noiseFloor: -90, snr: 45, recordedAt: daysAgo(1) },
        { id: uuid('whr-2'), tenantId: T1, propertyId: P1, floorPlanId: uuid('fp-1'), apName: 'AP-Lobby-2', apMac: 'AA:BB:CC:DD:EE:02', apX: 75.0, apY: 60.0, signalStrength: -52, clientCount: 8, band: '5', channel: 36, frequency: 5180, noiseFloor: -88, snr: 36, recordedAt: daysAgo(1) },
        { id: uuid('whr-3'), tenantId: T1, propertyId: P1, floorPlanId: uuid('fp-2'), apName: 'AP-F5-E', apMac: 'AA:BB:CC:DD:EE:10', apX: 20.0, apY: 50.0, signalStrength: -58, clientCount: 6, band: '5', channel: 40, frequency: 5200, recordedAt: daysAgo(0) },
      ],
    });
  } catch (e: any) { console.log('  WiFiHeatmapReading error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 16. WiFiOTP (FK → WiFiSession, WiFiUser via sessionId, username)
  // ────────────────────────────────────────────────────────────────
  console.log('  16/49 WiFiOTP...');
  try {
    await prisma.wiFiOTP.createMany({
      data: [
        { id: uuid('wotp-1'), tenantId: T1, propertyId: P1, sessionId: WS1, username: 'guest.amit.mukherjee', destination: '+91-9830012345', channel: 'sms', codeHash: createHash('sha256').update('123456').digest('hex'), otpLength: 6, expiresAt: daysFromNow(1), attempts: 0, maxAttempts: 3, status: 'verified', verifiedAt: daysAgo(0) },
        { id: uuid('wotp-2'), tenantId: T1, propertyId: P1, sessionId: WS2, username: 'guest.rahul.banerjee', destination: 'rahul.b@email.com', channel: 'email', codeHash: createHash('sha256').update('654321').digest('hex'), otpLength: 6, expiresAt: daysFromNow(0), attempts: 1, maxAttempts: 3, status: 'pending' },
        { id: uuid('wotp-3'), tenantId: T1, propertyId: P1, sessionId: null, username: 'guest.newvisitor', destination: '+91-9876504321', channel: 'sms', codeHash: createHash('sha256').update('987654').digest('hex'), otpLength: 6, expiresAt: daysAgo(1), attempts: 3, maxAttempts: 3, status: 'expired' },
      ],
    });
  } catch (e: any) { console.log('  WiFiOTP error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 17. WiFiUserStatusHistory (FK → WiFiUser)
  // ────────────────────────────────────────────────────────────────
  console.log('  17/49 WiFiUserStatusHistory...');
  try {
    await prisma.wiFiUserStatusHistory.createMany({
      data: [
        { id: uuid('wush-1'), tenantId: T1, propertyId: P1, username: 'guest.amit.mukherjee', userId: WU1, oldStatus: 'pending', newStatus: 'active', changedBy: 'system', changeReason: 'Auto-provisioned on check-in' },
        { id: uuid('wush-2'), tenantId: T1, propertyId: P1, username: 'guest.amit.mukherjee', userId: WU1, oldStatus: 'active', newStatus: 'suspended', changedBy: U1, changeReason: 'FUP daily limit exceeded' },
        { id: uuid('wush-3'), tenantId: T1, propertyId: P1, username: 'guest.amit.mukherjee', userId: WU1, oldStatus: 'suspended', newStatus: 'active', changedBy: 'system', changeReason: 'FUP cycle reset' },
        { id: uuid('wush-4'), tenantId: T1, propertyId: P1, username: 'guest.rahul.banerjee', userId: WU2, oldStatus: 'pending', newStatus: 'active', changedBy: 'system', changeReason: 'Auto-provisioned on check-in' },
      ],
    });
  } catch (e: any) { console.log('  WiFiUserStatusHistory error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 18. WiFiAccountingSync (standalone)
  // ────────────────────────────────────────────────────────────────
  console.log('  18/49 WiFiAccountingSync...');
  try {
    await prisma.wiFiAccountingSync.createMany({
      data: [
        { id: uuid('was-1'), lastRadAcctId: 'RadAcct-00150', lastSyncedAt: daysAgo(0), recordsProcessed: 150, errors: 2, lastError: 'NAS timeout for session 98' },
        { id: uuid('was-2'), lastRadAcctId: 'RadAcct-00120', lastSyncedAt: daysAgo(1), recordsProcessed: 120, errors: 0 },
      ],
    });
  } catch (e: any) { console.log('  WiFiAccountingSync error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 19. OccupancySensor (FK → Property, Room)
  // ────────────────────────────────────────────────────────────────
  console.log('  19/49 OccupancySensor...');
  try {
    await prisma.occupancySensor.createMany({
      data: [
        { id: uuid('os-1'), tenantId: T1, propertyId: P1, roomId: ROOM_501, name: 'Room 501 Motion', sensorType: 'motion', protocol: 'zigbee', deviceId: 'ZIG-501-MOT-01', status: 'active', batteryLevel: 85, lastReading: daysAgo(0), config: '{"sensitivity": "high", "cooldown": 30}' },
        { id: uuid('os-2'), tenantId: T1, propertyId: P1, roomId: ROOM_801, name: 'Room 801 CO2', sensorType: 'co2', protocol: 'mqtt', deviceId: 'MQTT-801-CO2-01', status: 'active', batteryLevel: null, lastReading: daysAgo(0), config: '{"threshold_high": 1000, "threshold_low": 400}' },
        { id: uuid('os-3'), tenantId: T1, propertyId: P1, roomId: ROOM_510, name: 'Room 510 Door', sensorType: 'door', protocol: 'zigbee', deviceId: 'ZIG-510-DOOR-01', status: 'active', batteryLevel: 72 },
      ],
    });
  } catch (e: any) { console.log('  OccupancySensor error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 20. OccupancyReading (FK → OccupancySensor)
  // ────────────────────────────────────────────────────────────────
  console.log('  20/49 OccupancyReading...');
  try {
    await prisma.occupancyReading.createMany({
      data: [
        { id: uuid('oread-1'), sensorId: uuid('os-1'), tenantId: T1, value: 1.0, rawValue: 255, confidence: 0.95, timestamp: daysAgo(0) },
        { id: uuid('oread-2'), sensorId: uuid('os-2'), tenantId: T1, value: 0.6, rawValue: 620, confidence: 0.88, timestamp: daysAgo(0) },
        { id: uuid('oread-3'), sensorId: uuid('os-1'), tenantId: T1, value: 0.0, rawValue: 0, confidence: 0.92, timestamp: daysAgo(1) },
        { id: uuid('oread-4'), sensorId: uuid('os-3'), tenantId: T1, value: 1.0, rawValue: 1, confidence: 0.99, timestamp: daysAgo(0) },
      ],
    });
  } catch (e: any) { console.log('  OccupancyReading error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 21. IoTCommand (FK → IoTDevice)
  // ────────────────────────────────────────────────────────────────
  console.log('  21/49 IoTCommand...');
  try {
    await prisma.iOTCommand.createMany({
      data: [
        { id: uuid('iotcmd-1'), deviceId: IOT1, command: 'set_temperature', parameters: '{"value": 22}', status: 'completed', executedAt: daysAgo(0), source: 'manual', triggeredBy: U2 },
        { id: uuid('iotcmd-2'), deviceId: IOT2, command: 'turn_off', parameters: '{}', status: 'completed', executedAt: daysAgo(1), source: 'automation' },
        { id: uuid('iotcmd-3'), deviceId: IOT3, command: 'set_brightness', parameters: '{"value": 70}', status: 'pending', source: 'manual', triggeredBy: U3 },
      ],
    });
  } catch (e: any) { console.log('  IoTCommand error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 22. IoTReading (FK → IoTDevice)
  // ────────────────────────────────────────────────────────────────
  console.log('  22/49 IoTReading...');
  try {
    await prisma.iOTReading.createMany({
      data: [
        { id: uuid('iotr-1'), deviceId: IOT1, type: 'temperature', value: 22.5, unit: 'celsius', timestamp: daysAgo(0) },
        { id: uuid('iotr-2'), deviceId: IOT1, type: 'humidity', value: 55.0, unit: 'percent', timestamp: daysAgo(0) },
        { id: uuid('iotr-3'), deviceId: IOT2, type: 'power', value: 0.0, unit: 'watts', timestamp: daysAgo(1) },
        { id: uuid('iotr-4'), deviceId: IOT3, type: 'brightness', value: 70, unit: 'percent', timestamp: daysAgo(0) },
      ],
    });
  } catch (e: any) { console.log('  IoTReading error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 23. DevicePolicyAssignment (FK → DevicePolicy, DeviceGroup)
  // ────────────────────────────────────────────────────────────────
  console.log('  23/49 DevicePolicyAssignment...');
  try {
    await prisma.devicePolicyAssignment.createMany({
      data: [
        { id: uuid('dpa-1'), tenantId: T1, propertyId: P1, policyId: DP1, macAddress: 'AA:BB:CC:11:22:33', ipAddress: '192.168.10.55', source: 'auto_group', trustLevel: 'standard', isActive: true, appliedAt: daysAgo(5), lastSeenAt: daysAgo(0) },
        { id: uuid('dpa-2'), tenantId: T1, propertyId: P1, policyId: DP2, macAddress: 'AA:BB:CC:44:55:66', ipAddress: '192.168.10.88', source: 'manual', trustLevel: 'restricted', isActive: true, appliedAt: daysAgo(2), lastSeenAt: daysAgo(0) },
        { id: uuid('dpa-3'), tenantId: T1, propertyId: P1, policyId: DP1, macAddress: 'AA:BB:CC:77:88:99', ipAddress: null, source: 'auto_group', trustLevel: 'standard', isActive: false, appliedAt: daysAgo(30), expiresAt: daysAgo(5), lastSeenAt: daysAgo(5), revokedAt: daysAgo(5), revokedBy: 'Auto-expired' },
      ],
    });
  } catch (e: any) { console.log('  DevicePolicyAssignment error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 24. DeviceProfile (FK → Tenant via propertyId, wifiUserId)
  // ────────────────────────────────────────────────────────────────
  console.log('  24/49 DeviceProfile...');
  try {
    await prisma.deviceProfile.createMany({
      data: [
        { id: uuid('dprof-1'), tenantId: T1, propertyId: P1, wifiUserId: WU1, guestId: G1, fingerprintHash: 'a1b2c3d4e5f6789012345678abcdef01', storageToken: 'st-dummy-token-001', macAddress: 'AA:BB:CC:DD:EE:01', ipAddress: '192.168.10.55', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', deviceName: 'iPhone 15 Pro', deviceType: 'mobile', authCount: 5, lastAuthAt: daysAgo(0), isActive: true },
        { id: uuid('dprof-2'), tenantId: T1, propertyId: P1, wifiUserId: WU2, guestId: G3, fingerprintHash: 'b2c3d4e5f67890123456789012345678', storageToken: 'st-dummy-token-002', macAddress: 'AA:BB:CC:DD:EE:02', ipAddress: '192.168.10.88', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', deviceName: 'Windows Laptop', deviceType: 'desktop', authCount: 3, lastAuthAt: daysAgo(1), isActive: true },
      ],
    });
  } catch (e: any) { console.log('  DeviceProfile error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 25. SurveillanceConfig (FK → Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  25/49 SurveillanceConfig...');
  try {
    await prisma.surveillanceConfig.createMany({
      data: [
        { id: uuid('sv-1'), tenantId: T1, propertyId: P1, configType: 'streaming', settings: '{"resolution": "1080p", "framerate": 30, "retentionDays": 30, "h264Profile": "high"}', updatedAt: daysAgo(0) },
        { id: uuid('sv-2'), tenantId: T1, propertyId: P1, configType: 'recording', settings: '{"enabled": true, "schedule": "24/7", "storagePath": "/nvr/recordings", "maxStorageGb": 2000, "compression": "h265"}', updatedAt: daysAgo(0) },
        { id: uuid('sv-3'), tenantId: T1, propertyId: P1, configType: 'alerts', settings: '{"motionDetection": true, "motionSensitivity": 0.7, "alertChannels": ["email", "push"], "cooldownMinutes": 5}', updatedAt: daysAgo(1) },
      ],
    });
  } catch (e: any) { console.log('  SurveillanceConfig error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 26. UserProperty (FK → User, Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  26/49 UserProperty...');
  try {
    await prisma.userProperty.createMany({
      data: [
        { id: uuid('up-1'), tenantId: T1, userId: U1, propertyId: P1, role: 'admin', isDefault: true },
        { id: uuid('up-2'), tenantId: T1, userId: U2, propertyId: P1, role: 'front_desk', isDefault: true },
        { id: uuid('up-3'), tenantId: T1, userId: U3, propertyId: P1, role: 'housekeeping', isDefault: true },
        { id: uuid('up-4'), tenantId: T1, userId: U1, propertyId: P2, role: 'admin', isDefault: false },
        { id: uuid('up-5'), tenantId: T1, userId: U2, propertyId: P2, role: 'front_desk', isDefault: false },
      ],
    });
  } catch (e: any) { console.log('  UserProperty error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 27. UserFcmToken (FK → User)
  // ────────────────────────────────────────────────────────────────
  console.log('  27/49 UserFcmToken...');
  try {
    await prisma.userFcmToken.createMany({
      data: [
        { id: uuid('fcm-1'), tenantId: T1, userId: U1, token: 'fcm-token-admin-chrome-001', deviceType: 'web', deviceName: 'Chrome Desktop', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', isActive: true, lastUsedAt: daysAgo(0) },
        { id: uuid('fcm-2'), tenantId: T1, userId: U2, token: 'fcm-token-fd-ios-001', deviceType: 'ios', deviceName: 'iPhone 14', userAgent: 'StaySuite iOS/2.1.0', isActive: true, lastUsedAt: daysAgo(0) },
        { id: uuid('fcm-3'), tenantId: T1, userId: U3, token: 'fcm-token-hk-android-001', deviceType: 'android', deviceName: 'Samsung Galaxy A54', userAgent: 'StaySuite Android/2.0.5', isActive: false, lastUsedAt: daysAgo(5) },
      ],
    });
  } catch (e: any) { console.log('  UserFcmToken error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 28. UserTutorial (FK → User)
  // ────────────────────────────────────────────────────────────────
  console.log('  28/49 UserTutorial...');
  try {
    await prisma.userTutorial.createMany({
      data: [
        { id: uuid('ut-1'), tenantId: T1, userId: U1, tutorialKey: 'dashboard-tour', completed: true, completedAt: daysAgo(30), currentStep: 5, totalSteps: 5 },
        { id: uuid('ut-2'), tenantId: T1, userId: U1, tutorialKey: 'wifi-setup', completed: true, completedAt: daysAgo(28), currentStep: 3, totalSteps: 3 },
        { id: uuid('ut-3'), tenantId: T1, userId: U2, tutorialKey: 'dashboard-tour', completed: true, completedAt: daysAgo(25), currentStep: 5, totalSteps: 5 },
        { id: uuid('ut-4'), tenantId: T1, userId: U2, tutorialKey: 'bookings-intro', completed: false, currentStep: 2, totalSteps: 4 },
        { id: uuid('ut-5'), tenantId: T1, userId: U3, tutorialKey: 'dashboard-tour', completed: false, currentStep: 1, totalSteps: 5 },
      ],
    });
  } catch (e: any) { console.log('  UserTutorial error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 29. PluginInstallation (FK → Plugin, Tenant)
  // ────────────────────────────────────────────────────────────────
  console.log('  29/49 PluginInstallation...');
  try {
    await prisma.pluginInstallation.createMany({
      data: [
        { id: uuid('pi-1'), tenantId: T1, pluginId: PLUG1, isEnabled: true, config: '{"phoneNumber": "+91-33-40012345", "templateLanguage": "en"}', installedBy: U1, installedAt: daysAgo(90) },
        { id: uuid('pi-2'), tenantId: T1, pluginId: PLUG2, isEnabled: true, config: '{"gstIn": "19AABCR1234F1ZP", "hsnDefaults": true}', installedBy: U1, installedAt: daysAgo(90) },
        { id: uuid('pi-3'), tenantId: T1, pluginId: PLUG3, isEnabled: true, config: '{"fetchIntervalHours": 24, "sources": ["google", "tripadvisor"]}', installedBy: U1, installedAt: daysAgo(60) },
        { id: uuid('pi-4'), tenantId: T2, pluginId: PLUG1, isEnabled: false, config: '{}', installedBy: uuid('user-t2-1'), installedAt: daysAgo(30) },
      ],
    });
  } catch (e: any) { console.log('  PluginInstallation error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 30. CameraEvent (FK → Camera)
  // ────────────────────────────────────────────────────────────────
  console.log('  30/49 CameraEvent...');
  try {
    await prisma.cameraEvent.createMany({
      data: [
        { id: uuid('camevt-1'), tenantId: T1, cameraId: CAM1, type: 'motion_detected', timestamp: daysAgo(1), thumbnailUrl: '/captures/cam1/motion_20250101.jpg', clipUrl: '/captures/cam1/clip_20250101.mp4', description: 'Motion detected near main entrance', confidence: 0.91, isAlert: false },
        { id: uuid('camevt-2'), tenantId: T1, cameraId: CAM3, type: 'loitering', timestamp: daysAgo(0), thumbnailUrl: '/captures/cam3/loiter_20250102.jpg', description: 'Person loitering at parking gate for 15 minutes', confidence: 0.87, isAlert: true, alertType: 'security' },
        { id: uuid('camevt-3'), tenantId: T1, cameraId: CAM2, type: 'crowd_detected', timestamp: daysAgo(0), description: 'Large crowd near reception', confidence: 0.78, isAlert: false, acknowledgedBy: U2, acknowledgedAt: daysAgo(0) },
      ],
    });
  } catch (e: any) { console.log('  CameraEvent error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 31. BandwidthUsageSession (FK → WiFiSession, Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  31/49 BandwidthUsageSession...');
  try {
    await prisma.bandwidthUsageSession.createMany({
      data: [
        { id: uuid('bus-1'), tenantId: T1, propertyId: P1, sessionId: WS1, username: 'guest.amit.mukherjee', ipAddress: '192.168.10.55', macAddress: 'AA:BB:CC:DD:EE:01', planId: BW_POLICY_PREM, policyId: BW_POLICY_PREM, downloadBytes: 536870912, uploadBytes: 134217728, durationSeconds: 3600, startedAt: daysAgo(0), endedAt: null },
        { id: uuid('bus-2'), tenantId: T1, propertyId: P1, sessionId: WS2, username: 'guest.rahul.banerjee', ipAddress: '192.168.10.88', macAddress: 'AA:BB:CC:DD:EE:02', downloadBytes: 2147483648, uploadBytes: 536870912, durationSeconds: 7200, startedAt: daysAgo(1), endedAt: daysAgo(0) },
        { id: uuid('bus-3'), tenantId: T1, propertyId: P1, sessionId: WS3, username: 'guest.sneha.gupta', ipAddress: '192.168.10.102', downloadBytes: 1073741824, uploadBytes: 268435456, durationSeconds: 1800, startedAt: daysAgo(0), endedAt: null },
      ],
    });
  } catch (e: any) { console.log('  BandwidthUsageSession error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 32. DatabaseBackup (FK → Tenant)
  // ────────────────────────────────────────────────────────────────
  console.log('  32/49 DatabaseBackup...');
  try {
    await prisma.databaseBackup.createMany({
      data: [
        { id: uuid('dbbk-1'), tenantId: T1, type: 'full', status: 'completed', fileSize: 52428800, storageLocation: 's3://staysuite-backups/tenant-1/full-20250101.dump', startedAt: daysAgo(7), completedAt: daysAgo(7), expiresAt: daysFromNow(23), createdBy: U1, notes: 'Weekly full backup' },
        { id: uuid('dbbk-2'), tenantId: T1, type: 'incremental', status: 'completed', fileSize: 5242880, storageLocation: 's3://staysuite-backups/tenant-1/incr-20250108.dump', startedAt: daysAgo(0), completedAt: daysAgo(0), expiresAt: daysFromNow(30), createdBy: U1, notes: 'Daily incremental backup' },
        { id: uuid('dbbk-3'), tenantId: T2, type: 'full', status: 'failed', fileSize: null, storageLocation: null, startedAt: daysAgo(2), completedAt: null, createdBy: uuid('user-t2-1'), notes: 'Backup failed due to disk space' },
      ],
    });
  } catch (e: any) { console.log('  DatabaseBackup error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 33. StorageQuota (FK → Tenant)
  // ────────────────────────────────────────────────────────────────
  console.log('  33/49 StorageQuota...');
  try {
    await prisma.storageQuota.createMany({
      data: [
        { id: uuid('sq-1'), tenantId: T1, maxStorageMb: 10240, usedStorageMb: 3250, documentCount: 1547, lastCalculatedAt: daysAgo(0) },
        { id: uuid('sq-2'), tenantId: T2, maxStorageMb: 5120, usedStorageMb: 890, documentCount: 342, lastCalculatedAt: daysAgo(0) },
      ],
    });
  } catch (e: any) { console.log('  StorageQuota error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 34. OverbookingLog (FK → OverbookingConfig, Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  34/49 OverbookingLog...');
  try {
    await prisma.overbookingLog.createMany({
      data: [
        { id: uuid('oblog-1'), tenantId: T1, propertyId: P1, date: daysFromNow(7), roomTypeId: RT1, action: 'created', details: '{"maxExtra":2,"confidence":0.25,"bookingsAnalyzed":48}', performedBy: U1 },
        { id: uuid('oblog-2'), tenantId: T1, propertyId: P1, date: daysFromNow(14), roomTypeId: RT2, action: 'updated', details: '{"maxExtra":1,"confidence":0.35,"bookingsAnalyzed":52}', performedBy: U1, createdAt: daysAgo(0) },
        { id: uuid('oblog-3'), tenantId: T1, propertyId: P1, date: daysFromNow(21), roomTypeId: RT1, action: 'absorbed', details: '{"maxExtra":2,"confidence":0.18,"absorbedWalkups":1,"upgradedTo":"Deluxe Room"}', performedBy: U2, createdAt: daysAgo(1) },
      ],
    });
  } catch (e: any) { console.log('  OverbookingLog error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 35. AnalyticsQuery (FK → Tenant)
  // ────────────────────────────────────────────────────────────────
  console.log('  35/49 AnalyticsQuery...');
  try {
    await prisma.analyticsQuery.createMany({
      data: [
        { id: uuid('aq-1'), tenantId: T1, userId: U1, query: 'Show me occupancy rate trend for last 30 days', queryType: 'natural_language', intent: 'occupancy_trend', parameters: '{"period":"30d","metric":"occupancy_rate"}', resultData: '{"labels":["Dec 3","Dec 4",...],"values":[82,85,...]}', resultType: 'chart', processingMs: 1250 },
        { id: uuid('aq-2'), tenantId: T1, userId: U1, query: 'Revenue by channel this month', queryType: 'natural_language', intent: 'revenue_by_channel', parameters: '{"period":"month","metric":"revenue"}', resultData: '{"rows":[{"channel":"Direct","revenue":1250000},{"channel":"Booking.com","revenue":890000}]}', resultType: 'table', processingMs: 890 },
        { id: uuid('aq-3'), tenantId: T1, userId: U2, query: 'ADR comparison week over week', queryType: 'natural_language', intent: 'adr_comparison', resultData: '{"this_week_adr":6800,"last_week_adr":6500,"change_pct":4.62}', resultType: 'text', processingMs: 540 },
      ],
    });
  } catch (e: any) { console.log('  AnalyticsQuery error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 36. LastMinuteTriggerLog (FK → LastMinuteTrigger)
  // ────────────────────────────────────────────────────────────────
  console.log('  36/49 LastMinuteTriggerLog...');
  try {
    await prisma.lastMinuteTriggerLog.createMany({
      data: [
        { id: uuid('lmtlog-1'), tenantId: T1, propertyId: P1, triggerId: LMT1, roomTypeId: RT1, date: daysFromNow(1), action: 'decrease_rate', value: 15, bookingId: null, result: '{"newRate":2975,"oldRate":3500,"channel":"all","applied":true}' },
        { id: uuid('lmtlog-2'), tenantId: T1, propertyId: P1, triggerId: LMT2, roomTypeId: RT2, date: daysFromNow(0), action: 'increase_rate', value: 10, result: '{"newRate":6050,"oldRate":5500,"channel":"direct_only","applied":true}' },
      ],
    });
  } catch (e: any) { console.log('  LastMinuteTriggerLog error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 37. DocumentApproval (FK → ApInvoice via entityId)
  // ────────────────────────────────────────────────────────────────
  console.log('  37/49 DocumentApproval...');
  try {
    await prisma.documentApproval.createMany({
      data: [
        { id: uuid('docappr-1'), tenantId: T1, entityType: 'ap_invoice', entityId: AP1, title: 'Invoice PLS-2024-001 Approval', description: 'Premium Linen Supply monthly invoice', currentStage: 'approved', submittedBy: U2, submittedAt: daysAgo(15), approvedBy: U1, approvedAt: daysAgo(12), approvedNote: 'Approved – matches PO', status: 'approved' },
        { id: uuid('docappr-2'), tenantId: T1, entityType: 'ap_invoice', entityId: AP2, title: 'Invoice CPS-2024-010 Review', description: 'CleanPro Services cleaning invoice', currentStage: 'level1', submittedBy: U3, submittedAt: daysAgo(10), submittedNote: 'For housekeeping review', status: 'in_review' },
        { id: uuid('docappr-3'), tenantId: T1, entityType: 'ap_invoice', entityId: AP2, title: 'Invoice CPS-2024-010 Final Approval', description: 'CleanPro – awaiting manager sign-off', currentStage: 'approved', submittedBy: U1, submittedAt: daysAgo(5), approvedBy: U1, approvedAt: daysAgo(3), status: 'approved' },
      ],
    });
  } catch (e: any) { console.log('  DocumentApproval error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 38. HardwareOperationLog (FK → HardwareAdapter)
  // ────────────────────────────────────────────────────────────────
  console.log('  38/49 HardwareOperationLog...');
  try {
    await prisma.hardwareOperationLog.createMany({
      data: [
        { id: uuid('hwolog-1'), tenantId: T1, propertyId: P1, adapterId: HWA1, providerId: 'assa-abloy-visionline', category: 'lock', operation: 'connect', targetId: ROOM_501, vendorTargetId: 'LOCK-R501', success: true, durationMs: 450, initiatedBy: U2, createdAt: daysAgo(5) },
        { id: uuid('hwolog-2'), tenantId: T1, propertyId: P1, adapterId: HWA1, providerId: 'assa-abloy-visionline', category: 'lock', operation: 'issue_key', targetId: ROOM_801, vendorTargetId: 'LOCK-R801', success: true, durationMs: 890, initiatedBy: U2, createdAt: daysAgo(3) },
        { id: uuid('hwolog-3'), tenantId: T1, propertyId: P1, adapterId: HWA2, providerId: 'salto-ks', category: 'lock', operation: 'create_checkout', targetId: ROOM_510, vendorTargetId: 'SALTO-R510', success: false, errorCode: 'TIMEOUT', errorMessage: 'Gateway timeout after 5000ms', durationMs: 5000, initiatedBy: 'system', createdAt: daysAgo(1) },
      ],
    });
  } catch (e: any) { console.log('  HardwareOperationLog error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 39. HardwareWebhookLog (FK → HardwareAdapter)
  // ────────────────────────────────────────────────────────────────
  console.log('  39/49 HardwareWebhookLog...');
  try {
    await prisma.hardwareWebhookLog.createMany({
      data: [
        { id: uuid('hwwl-1'), tenantId: T1, providerId: 'assa-abloy-visionline', vendorEventId: 'VE-10001', eventType: 'door_opened', receivedAt: daysAgo(0), rawBody: '{"lockId":"LOCK-R501","event":"door_opened","timestamp":"2025-01-02T10:30:00Z"}', signature: 'sha256=abc123', processingStatus: 'completed', processedAt: daysAgo(0) },
        { id: uuid('hwwl-2'), tenantId: T1, providerId: 'salto-ks', vendorEventId: 'VE-20001', eventType: 'battery_low', receivedAt: daysAgo(1), rawBody: '{"lockId":"SALTO-R510","event":"battery_low","batteryLevel":15}', processingStatus: 'completed', processedAt: daysAgo(1) },
      ],
    });
  } catch (e: any) { console.log('  HardwareWebhookLog error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 40. LicenseModuleEntitlement (FK → LicenseKey via tenantId)
  // ────────────────────────────────────────────────────────────────
  console.log('  40/49 LicenseModuleEntitlement...');
  try {
    await prisma.licenseModuleEntitlement.createMany({
      data: [
        { id: uuid('lme-1'), tenantId: T1, moduleKey: 'wifi', moduleName: 'WiFi & Network Gateway', limitType: 'concurrent_users', limitValue: 200, currentUsage: 87, peakUsage: 145, warningThreshold: 0.8, hardLimit: true, billingDimension: 'per_room', pricePerUnit: 50, isValid: true, effectiveFrom: daysAgo(200) },
        { id: uuid('lme-2'), tenantId: T1, moduleKey: 'pos', moduleName: 'Restaurant & POS', limitType: 'terminals', limitValue: 10, currentUsage: 3, peakUsage: 5, warningThreshold: 0.8, hardLimit: false, billingDimension: 'flat', isValid: true, effectiveFrom: daysAgo(200) },
        { id: uuid('lme-3'), tenantId: T1, moduleKey: 'crm', moduleName: 'Guest CRM & Loyalty', limitType: 'guest_records', limitValue: 50000, currentUsage: 12847, peakUsage: 12847, isValid: true, effectiveFrom: daysAgo(90) },
        { id: uuid('lme-4'), tenantId: T2, moduleKey: 'wifi', moduleName: 'WiFi & Network Gateway', limitType: 'concurrent_users', limitValue: 50, currentUsage: 12, peakUsage: 20, isValid: true, effectiveFrom: daysAgo(60) },
      ],
    });
  } catch (e: any) { console.log('  LicenseModuleEntitlement error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 41. LicenseUsageLog (FK → LicenseModuleEntitlement)
  // ────────────────────────────────────────────────────────────────
  console.log('  41/49 LicenseUsageLog...');
  try {
    await prisma.licenseUsageLog.createMany({
      data: [
        { id: uuid('lul-1'), tenantId: T1, entitlementId: uuid('lme-1'), moduleKey: 'wifi', usageValue: 87, limitValue: 200, usagePercent: 43.5, sampledAt: daysAgo(0) },
        { id: uuid('lul-2'), tenantId: T1, entitlementId: uuid('lme-1'), moduleKey: 'wifi', usageValue: 145, limitValue: 200, usagePercent: 72.5, sampledAt: daysAgo(7) },
        { id: uuid('lul-3'), tenantId: T1, entitlementId: uuid('lme-2'), moduleKey: 'pos', usageValue: 3, limitValue: 10, usagePercent: 30.0, sampledAt: daysAgo(0) },
      ],
    });
  } catch (e: any) { console.log('  LicenseUsageLog error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 42. CompetitorSyncLog (FK → CompetitorPrice)
  // ────────────────────────────────────────────────────────────────
  console.log('  42/49 CompetitorSyncLog...');
  try {
    await prisma.competitorSyncLog.createMany({
      data: [
        { id: uuid('csl-1'), tenantId: T1, propertyId: P1, competitorName: 'Taj Bengal', syncType: 'auto', status: 'success', pricesCollected: 8, startedAt: daysAgo(2), completedAt: daysAgo(2) },
        { id: uuid('csl-2'), tenantId: T1, propertyId: P1, competitorName: 'ITC Sonar', syncType: 'auto', status: 'partial', pricesCollected: 4, errorMessage: 'Timeout fetching executive suite rate', startedAt: daysAgo(1), completedAt: daysAgo(1) },
        { id: uuid('csl-3'), tenantId: T1, propertyId: P1, competitorName: 'The Oberoi Grand', syncType: 'manual', status: 'success', pricesCollected: 6, startedAt: daysAgo(0), completedAt: daysAgo(0) },
      ],
    });
  } catch (e: any) { console.log('  CompetitorSyncLog error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 43. DerivedRatePlan (FK → RatePlan, Property)
  // ────────────────────────────────────────────────────────────────
  console.log('  43/49 DerivedRatePlan...');
  try {
    await prisma.derivedRatePlan.createMany({
      data: [
        { id: uuid('drp-1'), tenantId: T1, propertyId: P1, name: 'Booking.com +10% markup', description: '10% markup on BAR for Booking.com channel', connectionId: CH1, channelCode: 'booking_com', sourceRatePlanId: RP1, roomTypeId: RT1, derivationType: 'percentage', adjustmentValue: 10, roundingMethod: 'nearest', isActive: true, autoSync: true, syncInterval: 60, lastSyncAt: daysAgo(0), lastSyncStatus: 'success' },
        { id: uuid('drp-2'), tenantId: T1, propertyId: P1, name: 'Expedia -5% discount', description: '5% discount for Expedia channel competitiveness', connectionId: CH2, channelCode: 'expedia', sourceRatePlanId: RP4, roomTypeId: RT2, derivationType: 'percentage', adjustmentValue: -5, floorRate: 4000, isActive: true, autoSync: true, lastSyncStatus: 'success' },
        { id: uuid('drp-3'), tenantId: T1, propertyId: P1, name: 'Weekend +20% surcharge', description: 'Weekend surcharge for direct bookings', connectionId: null, channelCode: 'direct', sourceRatePlanId: RP6, roomTypeId: RT3, derivationType: 'percentage', adjustmentValue: 20, appliesTo: 'weekends', isActive: true },
      ],
    });
  } catch (e: any) { console.log('  DerivedRatePlan error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 44. DerivedRateSnapshot (FK → DerivedRatePlan)
  // ────────────────────────────────────────────────────────────────
  console.log('  44/49 DerivedRateSnapshot...');
  try {
    await prisma.derivedRateSnapshot.createMany({
      data: [
        { id: uuid('drs-1'), tenantId: T1, derivedPlanId: uuid('drp-1'), date: daysFromNow(7), sourceRate: 3500, derivedRate: 3850, adjustmentApplied: 10 },
        { id: uuid('drs-2'), tenantId: T1, derivedPlanId: uuid('drp-2'), date: daysFromNow(7), sourceRate: 5500, derivedRate: 5225, adjustmentApplied: -5 },
        { id: uuid('drs-3'), tenantId: T1, derivedPlanId: uuid('drp-1'), date: daysFromNow(14), sourceRate: 3500, derivedRate: 3850, adjustmentApplied: 10 },
        { id: uuid('drs-4'), tenantId: T1, derivedPlanId: uuid('drp-3'), date: daysFromNow(5), sourceRate: 12000, derivedRate: 14400, adjustmentApplied: 20 },
      ],
    });
  } catch (e: any) { console.log('  DerivedRateSnapshot error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 45. ChatAttachment (FK → conversationId)
  // ────────────────────────────────────────────────────────────────
  console.log('  45/49 ChatAttachment...');
  try {
    await prisma.chatAttachment.createMany({
      data: [
        { id: uuid('chatatt-1'), tenantId: T1, conversationId: CONV1, fileName: 'passport_scan.pdf', fileSize: 524288, mimeType: 'application/pdf', fileUrl: '/uploads/attachments/passport_scan.pdf', uploadedBy: G1 },
        { id: uuid('chatatt-2'), tenantId: T1, conversationId: CONV1, fileName: 'hotel_map.png', fileSize: 256000, mimeType: 'image/png', fileUrl: '/uploads/attachments/hotel_map.png', uploadedBy: U2 },
        { id: uuid('chatatt-3'), tenantId: T1, conversationId: CONV1, fileName: 'receipt_breakfast.jpg', fileSize: 128000, mimeType: 'image/jpeg', fileUrl: '/uploads/attachments/receipt_breakfast.jpg', uploadedBy: U2 },
      ],
    });
  } catch (e: any) { console.log('  ChatAttachment error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 46. ChatTransfer (FK → ChatConversation)
  // ────────────────────────────────────────────────────────────────
  console.log('  46/49 ChatTransfer...');
  try {
    await prisma.chatTransfer.createMany({
      data: [
        { id: uuid('chatxfr-1'), tenantId: T1, conversationId: CONV1, fromUserId: U2, toUserId: U1, reason: 'Escalation – VIP guest request', notes: 'Guest requesting late checkout for presidential suite' },
        { id: uuid('chatxfr-2'), tenantId: T1, conversationId: CONV1, fromUserId: U1, toUserId: U3, reason: 'Maintenance request', notes: 'AC not working in room 501' },
      ],
    });
  } catch (e: any) { console.log('  ChatTransfer error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 47. CoaSessionDetail (FK → ChatConversation) – actually sessionId
  // ────────────────────────────────────────────────────────────────
  console.log('  47/49 CoaSessionDetail...');
  try {
    await prisma.coaSessionDetail.createMany({
      data: [
        { id: uuid('coa-1'), tenantId: T1, propertyId: P1, sessionId: WS1, username: 'guest.amit.mukherjee', coaType: 'fup_switch', policyName: 'Daily FUP – Guest', bandwidthPercent: 50.0, triggeredBy: 'system', nasIpAddress: '10.0.0.10', actualSessionTime: 3600, effectiveSessionTime: 3600, actualDownloadBytes: 1073741824, actualUploadBytes: 268435456, effectiveDownloadBytes: 500000, effectiveUploadBytes: 125000, result: 'applied' },
        { id: uuid('coa-2'), tenantId: T1, propertyId: P1, sessionId: WS2, username: 'guest.rahul.banerjee', coaType: 'bandwidth_upgrade', policyName: 'Premium Upgrade', bandwidthPercent: 100.0, triggeredBy: U2, actualDownloadBytes: 1073741824, actualUploadBytes: 268435456, effectiveDownloadBytes: 100000000, effectiveUploadBytes: 50000000, result: 'applied' },
      ],
    });
  } catch (e: any) { console.log('  CoaSessionDetail error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 48. Session (FK → User)
  // ────────────────────────────────────────────────────────────────
  console.log('  48/49 Session...');
  try {
    await prisma.session.createMany({
      data: [
        { id: uuid('sess-1'), userId: U1, token: 'sess_admin_web_abc123', refreshToken: 'refresh_admin_web_abc123', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ipAddress: '103.45.67.89', expiresAt: daysFromNow(7), lastActive: daysAgo(0) },
        { id: uuid('sess-2'), userId: U2, token: 'sess_fd_ios_def456', refreshToken: 'refresh_fd_ios_def456', userAgent: 'StaySuite iOS/2.1.0 (iPhone 14)', ipAddress: '192.168.10.200', expiresAt: daysFromNow(30), lastActive: daysAgo(0) },
        { id: uuid('sess-3'), userId: U3, token: 'sess_hk_android_ghi789', refreshToken: 'refresh_hk_android_ghi789', userAgent: 'StaySuite Android/2.0.5 (Samsung)', ipAddress: '192.168.10.201', expiresAt: daysFromNow(5), lastActive: daysAgo(0) },
      ],
    });
  } catch (e: any) { console.log('  Session error:', e.message); }

  // ────────────────────────────────────────────────────────────────
  // 49. WebhookDeliveryLog (FK → WebhookEndpoint)
  // ────────────────────────────────────────────────────────────────
  console.log('  49/49 WebhookDeliveryLog...');
  try {
    await prisma.webhookDeliveryLog.createMany({
      data: [
        { id: uuid('wdl-1'), endpointId: WH1, eventType: 'booking.created', payload: '{"bookingId":"booking-1","confirmationCode":"RS-2024-0001"}', statusCode: 200, response: '{"received":true}', status: 'success', attemptCount: 1 },
        { id: uuid('wdl-2'), endpointId: WH1, eventType: 'booking.confirmed', payload: '{"bookingId":"booking-2","confirmationCode":"RS-2024-0002"}', statusCode: 503, response: '{"error":"service_unavailable"}', status: 'failed', attemptCount: 3, nextRetryAt: daysFromNow(1) },
        { id: uuid('wdl-3'), endpointId: WH2, eventType: 'payment.completed', payload: '{"paymentId":"pay-001","amount":35000,"currency":"INR"}', statusCode: 200, response: '{"acknowledged":true}', status: 'success', attemptCount: 1 },
      ],
    });
  } catch (e: any) { console.log('  WebhookDeliveryLog error:', e.message); }

  console.log('\n✅ Seeding of 49 empty tables complete!\n');
}
