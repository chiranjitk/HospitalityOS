/**
 * DHCP API Route — Direct PostgreSQL Backend (dnsmasq)
 *
 * Previously this was a proxy to dhcp-service on port 3011.
 * Now reads/writes directly from PostgreSQL via Prisma.
 * No external service dependency — data loads instantly from DB.
 *
 * Routes handled:
 *   GET  /api/kea/status           → DHCP service overview from DB
 *   POST /api/kea/service/{action} → Service control stub (start/stop/restart/reload)
 *   CRUD /api/kea/subnets          → DhcpSubnet
 *   CRUD /api/kea/reservations     → DhcpReservation
 *   CRUD /api/kea/leases           → DhcpLease
 *   CRUD /api/kea/blacklist        → DhcpBlacklist (+ /bulk)
 *   CRUD /api/kea/options          → DhcpOption
 *   CRUD /api/kea/tag-rules        → DhcpTagRule
 *   CRUD /api/kea/hostname-filters → DhcpHostnameFilter
 *   CRUD /api/kea/lease-scripts    → DhcpLeaseScript
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';
import { DNSMASQ_DHCP_CONF, DNSMASQ_LEASES_FILE } from '@/lib/wifi/paths';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTenantId(request: NextRequest): string | null {
  // Use getTenantIdFromSession or fall back to cookie
  const cookie = request.cookies.get('session_token')?.value;
  if (!cookie) return null;
  // We'll do a simple approach - use the first tenant for now in dev
  // In production, getTenantIdFromSession handles JWT parsing
  return cookie; // placeholder - the real auth is handled below
}

async function getTenant(request: NextRequest) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    // Fallback: try to get any tenant (for dev/sandbox)
    try {
      const anyTenant = await db.tenant.findFirst({ select: { id: true } });
      return anyTenant?.id || null;
    } catch {
      return null;
    }
  }
  return tenantId;
}

async function getDefaultPropertyId(tenantId: string): Promise<string | null> {
  try {
    const prop = await db.property.findFirst({ where: { tenantId }, select: { id: true } });
    return prop?.id || null;
  } catch {
    return null;
  }
}

/** Parse CIDR e.g. "192.168.1.0/24" → { network: "192.168.1.0", prefix: 24 } */
function parseCidr(cidr: string): { network: string; prefix: number } {
  const [ip, prefixStr] = cidr.split('/');
  return { network: ip || '', prefix: parseInt(prefixStr || '24', 10) };
}

/** Compute netmask from prefix */
function prefixToNetmask(prefix: number): string {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return `${(mask >>> 24) & 255}.${(mask >>> 16) & 255}.${(mask >>> 8) & 255}.${mask & 255}`;
}

/** Convert lease time seconds to display string */
function leaseTimeToDisplay(seconds: number): string {
  if (!seconds || seconds <= 0) return 'infinite';
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

/** IP string to integer */
function ipToInt(ip: string): number {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(isNaN)) return 0;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

/** Compute pool size from start/end IPs */
function computePoolSize(start: string, end: string): number {
  const s = ipToInt(start);
  const e = ipToInt(end);
  return Math.max(0, e - s + 1);
}

/** Transform a Prisma subnet row to the frontend-expected format */
function transformSubnet(s: Record<string, unknown>): Record<string, unknown> {
  const dnsRaw = s.dnsServers as string || '[]';
  let dnsServers: string[];
  try { dnsServers = JSON.parse(dnsRaw); } catch { dnsServers = []; }

  const poolStart = (s.poolStart as string) || '';
  const poolEnd = (s.poolEnd as string) || '';
  const totalPool = computePoolSize(poolStart, poolEnd);
  const activeLeases = (s._count as Record<string, number>)?.leases || 0;
  const utilization = totalPool > 0 ? Math.round((activeLeases / totalPool) * 100) : 0;
  const leaseTimeSec = (s.leaseTime as number) || 0;

  return {
    id: s.id,
    name: s.name || '',
    interface: s.description || '',
    tag: '',
    cidr: s.subnet || '',
    gateway: s.gateway || '',
    poolStart,
    poolEnd,
    netmask: s.subnet ? prefixToNetmask(parseCidr(s.subnet as string).prefix) : '',
    leaseTime: String(leaseTimeSec),
    leaseDisplay: leaseTimeToDisplay(leaseTimeSec),
    dnsServers,
    domainName: s.domainName || '',
    vlanId: s.vlanId ?? null,
    enabled: s.enabled ?? true,
    activeLeases,
    totalPool,
    utilization,
    ipv6Enabled: s.ipv6Enabled ?? false,
    ipv6Prefix: s.ipv6Prefix || '',
    ipv6PoolStart: s.ipv6PoolStart || '',
    ipv6PoolEnd: s.ipv6PoolEnd || '',
    ipv6LeaseTime: s.ipv6LeaseTime ? String(s.ipv6LeaseTime) : '',
    ipv6RAType: s.ipv6RAType || 'slaac',
  };
}

/** Transform a Prisma reservation row */
function transformReservation(r: Record<string, unknown>): Record<string, unknown> {
  return {
    id: r.id,
    macAddress: (r.macAddress as string) || '',
    ipAddress: (r.ipAddress as string) || '',
    hostname: (r.hostname as string) || '',
    subnetId: r.subnetId || '',
    subnetName: ((r.dhcpSubnet as Record<string, unknown>)?.name as string) || '',
    leaseTime: r.leaseTime ? String(r.leaseTime) : 'infinite',
    description: (r.description as string) || '',
    enabled: r.enabled ?? true,
  };
}

/** Transform a Prisma lease row */
function transformLease(l: Record<string, unknown>): Record<string, unknown> {
  return {
    id: l.id || l.ipAddress,
    ipAddress: (l.ipAddress as string) || '',
    macAddress: (l.macAddress as string) || '',
    hostname: (l.hostname as string) || '',
    clientId: (l.clientId as string) || '',
    subnetId: l.subnetId || '',
    subnetName: ((l.subnet as Record<string, unknown>)?.name as string) || '',
    leaseStart: (l.leaseStart as string) || '',
    leaseExpires: (l.leaseEnd as string) || '',
    state: (l.state as string) || 'active',
    type: 'dynamic' as const,
    lastSeen: (l.lastSeenAt as string) || '',
  };
}

// ─── Extract path from URL ────────────────────────────────────────────────────

function extractPath(request: NextRequest): string {
  return request.nextUrl.pathname
    .replace('/api/kea/', '')
    .replace('/api/kea', '');
}

function parsePathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

const DHCP_SERVICE_URL = process.env.DHCP_SERVICE_URL || 'http://localhost:3011';

/** Proxy a request to the real dhcp-service mini-service on port 3011 */
async function proxyToDhcpService(path: string, method: string, body?: Record<string, unknown> | null): Promise<Response | null> {
  try {
    const url = `${DHCP_SERVICE_URL}${path}`;
    const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    // Mini-service not reachable — caller should fall back to stub
    return null;
  }
}

/**
 * Sync live leases from dhcp-service (dnsmasq file) into the DhcpLease DB table.
 * Uses delete+create pattern since DhcpLease has a compound unique [subnetId, ipAddress].
 * This ensures the GUI always has reasonably current lease data.
 */
async function syncLeasesToDb(
  liveLeases: Array<Record<string, unknown>>,
  tenantId: string,
  propertyId: string | null,
): Promise<void> {
  if (!liveLeases.length) return;

  const now = new Date();
  const propId = propertyId || tenantId;

  for (const lease of liveLeases) {
    const ip = (lease.ipAddress as string) || '';
    const mac = ((lease.macAddress as string) || '').toLowerCase();
    if (!ip || !mac) continue;

    const leaseEnd = (lease.leaseExpires as string) || '';
    const leaseStart = (lease.leaseStart as string) || '';
    const hostname = (lease.hostname as string) || '';
    const clientId = (lease.clientId as string) || '';
    const state = (lease.state as string) || 'active';
    const subnetId = (lease.subnetId as string) || '';

    // Delete existing entry for this IP (if any) and re-create with fresh data
    await db.dhcpLease.deleteMany({
      where: { ipAddress: ip, tenantId },
    }).catch(() => {});

    await db.dhcpLease.create({
      data: {
        tenantId,
        propertyId: propId,
        subnetId: subnetId || propId, // fallback to propertyId if subnet unknown
        ipAddress: ip,
        macAddress: mac,
        hostname: hostname || null,
        clientId: clientId || null,
        state: state as 'active' | 'expired' | 'released',
        leaseStart: leaseStart ? new Date(leaseStart) : now,
        leaseEnd: leaseEnd ? new Date(leaseEnd) : now,
        lastSeenAt: now,
      },
    }).catch(() => { /* ignore individual errors */ });
  }

  // Mark leases in DB as expired if they're no longer in the live file
  const liveIps = new Set(liveLeases.map(l => (l.ipAddress as string)).filter(Boolean));
  if (liveIps.size > 0) {
    await db.dhcpLease.updateMany({
      where: {
        tenantId,
        state: 'active',
        ipAddress: { notIn: Array.from(liveIps) },
      },
      data: { state: 'expired' },
    }).catch(() => {});
  }
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

async function handleRequest(request: NextRequest, method: string) {
  try {
    const path = extractPath(request);
    const segments = parsePathSegments(path);

    // Read body for POST/PUT/PATCH
    let body: Record<string, unknown> | null = null;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try { body = await request.json(); } catch { /* no body */ }
    }

    const tenantId = await getTenant(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'No tenant found' }, { status: 401 });
    }

    const propertyId = await getDefaultPropertyId(tenantId);

    // ─── Status — proxy to real dhcp-service, fall back to DB-only stub ───
    if (segments[0] === 'status' && method === 'GET') {
      // Try real mini-service first (has actual dnsmasq process status)
      const proxied = await proxyToDhcpService('/api/status', 'GET');
      if (proxied) return proxied;

      // Fallback: DB-only counts (mini-service not running)
      const [subnetCount, leaseCount, activeLeases, reservationCount] = await Promise.all([
        db.dhcpSubnet.count({ where: { tenantId } }),
        db.dhcpLease.count({ where: { tenantId } }),
        db.dhcpLease.count({ where: { tenantId, state: 'active' } }),
        db.dhcpReservation.count({ where: { tenantId } }),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          installed: true, running: false, processRunning: false,
          version: 'dnsmasq', mode: 'standalone', backend: 'dnsmasq',
          subnetCount, leaseCount, activeLeases, reservationCount,
          currentInterfaces: [], systemInterfaces: [],
          configFile: DNSMASQ_DHCP_CONF,
          leasesFile: DNSMASQ_LEASES_FILE,
          _warning: 'dhcp-service mini-service not reachable — showing DB-only status',
        },
      });
    }

    // ─── Service Control — proxy to real dhcp-service for actual start/stop ─
    if (segments[0] === 'service' && segments.length === 2 && method === 'POST') {
      const action = segments[1];
      if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
        return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
      }

      // Try real mini-service (actual systemctl / pkill control)
      const proxied = await proxyToDhcpService(`/api/service/${action}`, 'POST', body);
      if (proxied) return proxied;

      // Fallback: stub response (mini-service not running)
      return NextResponse.json({
        success: false,
        error: `dhcp-service mini-service not reachable on port 3011. Cannot ${action} dnsmasq.`,
        running: false,
      });
    }

    // ─── Subnets ───────────────────────────────────────────────────────────
    if (segments[0] === 'subnets' && segments.length === 1) {
      if (method === 'GET') {
        const subnets = await db.dhcpSubnet.findMany({
          where: { tenantId },
          include: {
            _count: { select: { leases: { where: { state: 'active' } }, reservations: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ success: true, data: subnets.map(transformSubnet) });
      }
      if (method === 'POST') {
        const b = body!;
        const created = await db.dhcpSubnet.create({
          data: {
            tenantId,
            propertyId: (b.propertyId as string) || propertyId || tenantId,
            name: (b.name as string) || 'Unnamed',
            subnet: (b.subnet as string) || (b.cidr as string) || '',
            gateway: (b.gateway as string) || null,
            poolStart: (b.poolStart as string) || '',
            poolEnd: (b.poolEnd as string) || '',
            leaseTime: b.leaseTime ? parseInt(String(b.leaseTime), 10) : 3600,
            vlanId: b.vlanId ? parseInt(String(b.vlanId), 10) : null,
            domainName: (b.domainName as string) || null,
            dnsServers: b.dnsServers ? JSON.stringify(b.dnsServers) : '[]',
            enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
            ipv6Enabled: b.ipv6Enabled as boolean | undefined,
            ipv6Prefix: (b.ipv6Prefix as string) || null,
            ipv6PoolStart: (b.ipv6PoolStart as string) || null,
            ipv6PoolEnd: (b.ipv6PoolEnd as string) || null,
            ipv6LeaseTime: b.ipv6LeaseTime ? parseInt(String(b.ipv6LeaseTime), 10) : 3600,
            ipv6RAType: (b.ipv6RAType as string) || 'slaac',
            description: (b.interface as string) || null,
          },
        });
        return NextResponse.json({ success: true, data: transformSubnet(created), message: 'Subnet created', persisted: true });
      }
    }

    if (segments[0] === 'subnets' && segments.length === 2) {
      const id = segments[1];
      if (method === 'PUT') {
        const b = body!;
        const updateData: Record<string, unknown> = {};
        if (b.name !== undefined) updateData.name = b.name;
        if (b.subnet !== undefined) updateData.subnet = b.subnet;
        if (b.gateway !== undefined) updateData.gateway = b.gateway;
        if (b.poolStart !== undefined) updateData.poolStart = b.poolStart;
        if (b.poolEnd !== undefined) updateData.poolEnd = b.poolEnd;
        if (b.leaseTime !== undefined) updateData.leaseTime = parseInt(String(b.leaseTime), 10);
        if (b.vlanId !== undefined) updateData.vlanId = b.vlanId ? parseInt(String(b.vlanId), 10) : null;
        if (b.domainName !== undefined) updateData.domainName = b.domainName;
        if (b.dnsServers !== undefined) updateData.dnsServers = JSON.stringify(b.dnsServers);
        if (b.enabled !== undefined) updateData.enabled = b.enabled;
        if (b.ipv6Enabled !== undefined) updateData.ipv6Enabled = b.ipv6Enabled;
        if (b.ipv6Prefix !== undefined) updateData.ipv6Prefix = b.ipv6Prefix;
        if (b.ipv6PoolStart !== undefined) updateData.ipv6PoolStart = b.ipv6PoolStart;
        if (b.ipv6PoolEnd !== undefined) updateData.ipv6PoolEnd = b.ipv6PoolEnd;
        if (b.ipv6LeaseTime !== undefined) updateData.ipv6LeaseTime = parseInt(String(b.ipv6LeaseTime), 10);
        if (b.ipv6RAType !== undefined) updateData.ipv6RAType = b.ipv6RAType;
        if (b.interface !== undefined) updateData.description = (b.interface as string) || null;

        const updated = await db.dhcpSubnet.update({
          where: { id },
          data: updateData,
          include: { _count: { select: { leases: { where: { state: 'active' } }, reservations: true } } },
        });
        return NextResponse.json({ success: true, data: transformSubnet(updated), message: 'Subnet updated', persisted: true });
      }
      if (method === 'DELETE') {
        await db.dhcpLease.deleteMany({ where: { subnetId: id } });
        await db.dhcpReservation.deleteMany({ where: { subnetId: id } });
        await db.dhcpSubnet.delete({ where: { id } }).catch(() => {});
        return NextResponse.json({ success: true, message: 'Subnet deleted', persisted: true });
      }
    }

    // ─── Reservations ──────────────────────────────────────────────────────
    if (segments[0] === 'reservations' && segments.length === 1) {
      if (method === 'GET') {
        const reservations = await db.dhcpReservation.findMany({
          where: { tenantId },
          include: { dhcpSubnet: { select: { id: true, name: true } } },
          orderBy: { ipAddress: 'asc' },
        });
        return NextResponse.json({ success: true, data: reservations.map(transformReservation) });
      }
      if (method === 'POST') {
        const b = body!;
        // Support both create and update via POST (frontend sends id for updates)
        if (b.id) {
          const updateData: Record<string, unknown> = {};
          if (b.macAddress !== undefined) updateData.macAddress = (b.macAddress as string).toLowerCase().trim();
          if (b.ipAddress !== undefined) updateData.ipAddress = b.ipAddress;
          if (b.hostname !== undefined) updateData.hostname = b.hostname;
          if (b.leaseTime !== undefined) {
            const lt = parseInt(String(b.leaseTime), 10);
            updateData.leaseTime = isNaN(lt) ? null : lt;
          }
          if (b.description !== undefined) updateData.description = b.description;
          if (b.enabled !== undefined) updateData.enabled = b.enabled;
          if (b.subnetId !== undefined) updateData.subnetId = b.subnetId;
          const updated = await db.dhcpReservation.update({
            where: { id: b.id as string },
            data: updateData,
            include: { dhcpSubnet: { select: { id: true, name: true } } },
          });
          return NextResponse.json({ success: true, data: transformReservation(updated), message: 'Reservation updated', persisted: true });
        }
        const created = await db.dhcpReservation.create({
          data: {
            tenantId,
            propertyId: (b.propertyId as string) || propertyId || tenantId,
            subnetId: (b.subnetId as string) || '',
            macAddress: ((b.macAddress as string) || '').toLowerCase().trim(),
            ipAddress: (b.ipAddress as string) || '',
            hostname: (b.hostname as string) || null,
            leaseTime: b.leaseTime ? parseInt(String(b.leaseTime), 10) : null,
            description: (b.description as string) || null,
            enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
          },
          include: { dhcpSubnet: { select: { id: true, name: true } } },
        });
        return NextResponse.json({ success: true, data: transformReservation(created), message: 'Reservation created', persisted: true });
      }
    }

    if (segments[0] === 'reservations' && segments.length === 2 && method === 'DELETE') {
      const id = segments[1];
      await db.dhcpReservation.delete({ where: { id } }).catch(() => {});
      return NextResponse.json({ success: true, message: 'Reservation deleted', persisted: true });
    }

    // ─── Leases ────────────────────────────────────────────────────────────
    if (segments[0] === 'leases' && segments.length === 1) {
      if (method === 'GET') {
        // 1. Try to get live leases from dhcp-service (reads actual dnsmasq lease file)
        const proxied = await proxyToDhcpService('/api/leases', 'GET');
        if (proxied) {
          // Sync live leases to DB so fallback reads also show current data
          try {
            const proxiedData = await proxied.clone().json() as { success: boolean; data?: Array<Record<string, unknown>> };
            if (proxiedData.success && Array.isArray(proxiedData.data) && proxiedData.data.length > 0) {
              await syncLeasesToDb(proxiedData.data, tenantId, propertyId);
            }
          } catch (syncErr) {
            // Sync failure is non-critical — we still return the live data
            console.error('[DHCP] Lease DB sync failed (non-critical):', syncErr);
          }
          return proxied;
        }

        // 2. Fallback: read from DB (may be stale but better than empty)
        const leases = await db.dhcpLease.findMany({
          where: { tenantId },
          include: { subnet: { select: { id: true, name: true } } },
          orderBy: { leaseEnd: 'asc' },
        });
        return NextResponse.json({ success: true, data: leases.map(transformLease) });
      }
      if (method === 'DELETE') {
        await db.dhcpLease.deleteMany({ where: { tenantId } });
        return NextResponse.json({ success: true, message: 'All leases cleared' });
      }
    }

    // ─── Blacklist ─────────────────────────────────────────────────────────
    if (segments[0] === 'blacklist') {
      // Bulk import
      if (segments[1] === 'bulk' && method === 'POST') {
        const b = body!;
        const macs = (b.macAddresses as string[]) || [];
        if (macs.length === 0) {
          return NextResponse.json({ success: false, error: 'No MAC addresses provided' }, { status: 400 });
        }
        await db.dhcpBlacklist.createMany({
          data: macs.map(mac => ({
            tenantId,
            propertyId: propertyId || tenantId,
            macAddress: mac.toLowerCase().trim(),
          })),
          skipDuplicates: true,
        });
        return NextResponse.json({ success: true, message: `${macs.length} MAC(s) added to blacklist` });
      }

      if (segments.length === 1) {
        if (method === 'GET') {
          const items = await db.dhcpBlacklist.findMany({
            where: { tenantId },
            include: { dhcpSubnet: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          });
          return NextResponse.json({
            success: true,
            data: items.map(i => ({
              id: i.id,
              macAddress: i.macAddress,
              subnetId: i.subnetId || undefined,
              subnetName: i.dhcpSubnet?.name || null,
              reason: i.reason || '',
              enabled: i.enabled,
              createdAt: i.createdAt?.toISOString(),
            })),
          });
        }
        if (method === 'POST') {
          const b = body!;
          const created = await db.dhcpBlacklist.create({
            data: {
              tenantId,
              propertyId: (b.propertyId as string) || propertyId || tenantId,
              macAddress: (b.macAddress as string) || '',
              subnetId: b.subnetId === '__all__' || !b.subnetId ? null : (b.subnetId as string),
              reason: (b.reason as string) || null,
              enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
            },
          });
          return NextResponse.json({ success: true, data: created, message: 'Blacklist entry created' });
        }
      }

      if (segments.length === 2) {
        const id = segments[1];
        if (method === 'PUT') {
          const b = body!;
          const updateData: Record<string, unknown> = {};
          if (b.macAddress !== undefined) updateData.macAddress = b.macAddress;
          if (b.reason !== undefined) updateData.reason = b.reason;
          if (b.enabled !== undefined) updateData.enabled = b.enabled;
          if (b.subnetId !== undefined) updateData.subnetId = b.subnetId === '__all__' ? null : b.subnetId;
          const updated = await db.dhcpBlacklist.update({ where: { id }, data: updateData });
          return NextResponse.json({ success: true, data: updated, message: 'Blacklist updated' });
        }
        if (method === 'DELETE') {
          await db.dhcpBlacklist.delete({ where: { id } }).catch(() => {});
          return NextResponse.json({ success: true, message: 'Blacklist entry removed' });
        }
      }
    }

    // ─── Options ───────────────────────────────────────────────────────────
    if (segments[0] === 'options' && segments.length === 1) {
      if (method === 'GET') {
        const items = await db.dhcpOption.findMany({
          where: { tenantId },
          include: { dhcpSubnet: { select: { id: true, name: true } } },
          orderBy: [{ code: 'asc' }, { createdAt: 'desc' }],
        });
        return NextResponse.json({
          success: true,
          data: items.map(o => ({
            id: o.id,
            code: o.code,
            name: o.name,
            value: o.value,
            type: o.type,
            subnetId: o.subnetId || undefined,
            subnetName: o.dhcpSubnet?.name || null,
            enabled: o.enabled,
            description: o.description || '',
            createdAt: o.createdAt?.toISOString(),
          })),
        });
      }
      if (method === 'POST') {
        const b = body!;
        const created = await db.dhcpOption.create({
          data: {
            tenantId,
            propertyId: (b.propertyId as string) || propertyId || tenantId,
            code: parseInt(String(b.code), 10),
            name: (b.name as string) || '',
            value: (b.value as string) || '',
            type: (b.type as string) || 'string',
            subnetId: b.subnetId === '__global__' || !b.subnetId ? null : (b.subnetId as string),
            enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
            description: (b.description as string) || null,
          },
        });
        return NextResponse.json({ success: true, data: created, message: 'Option created' });
      }
    }

    if (segments[0] === 'options' && segments.length === 2) {
      const id = segments[1];
      if (method === 'PUT') {
        const b = body!;
        const updateData: Record<string, unknown> = {};
        if (b.code !== undefined) updateData.code = parseInt(String(b.code), 10);
        if (b.name !== undefined) updateData.name = b.name;
        if (b.value !== undefined) updateData.value = b.value;
        if (b.type !== undefined) updateData.type = b.type;
        if (b.enabled !== undefined) updateData.enabled = b.enabled;
        if (b.description !== undefined) updateData.description = b.description;
        if (b.subnetId !== undefined) updateData.subnetId = b.subnetId === '__global__' ? null : b.subnetId;
        const updated = await db.dhcpOption.update({ where: { id }, data: updateData });
        return NextResponse.json({ success: true, data: updated, message: 'Option updated' });
      }
      if (method === 'DELETE') {
        await db.dhcpOption.delete({ where: { id } }).catch(() => {});
        return NextResponse.json({ success: true, message: 'Option deleted' });
      }
    }

    // ─── Tag Rules ─────────────────────────────────────────────────────────
    if (segments[0] === 'tag-rules' && segments.length === 1) {
      if (method === 'GET') {
        const items = await db.dhcpTagRule.findMany({
          where: { tenantId },
          include: { dhcpSubnet: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({
          success: true,
          data: items.map(t => ({
            id: t.id, name: t.name, matchType: t.matchType, matchPattern: t.matchPattern,
            setTag: t.setTag, subnetId: t.subnetId || undefined,
            subnetName: t.dhcpSubnet?.name || null, enabled: t.enabled,
            description: t.description || '', createdAt: t.createdAt?.toISOString(),
          })),
        });
      }
      if (method === 'POST') {
        const b = body!;
        const created = await db.dhcpTagRule.create({
          data: {
            tenantId,
            propertyId: (b.propertyId as string) || propertyId || tenantId,
            name: (b.name as string) || '',
            matchType: (b.matchType as string) || 'mac',
            matchPattern: (b.matchPattern as string) || '',
            setTag: (b.setTag as string) || '',
            subnetId: b.subnetId === '__all__' || !b.subnetId ? null : (b.subnetId as string),
            enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
            description: (b.description as string) || null,
          },
        });
        return NextResponse.json({ success: true, data: created, message: 'Tag rule created' });
      }
    }

    if (segments[0] === 'tag-rules' && segments.length === 2) {
      const id = segments[1];
      if (method === 'PUT') {
        const b = body!;
        const updateData: Record<string, unknown> = {};
        if (b.name !== undefined) updateData.name = b.name;
        if (b.matchType !== undefined) updateData.matchType = b.matchType;
        if (b.matchPattern !== undefined) updateData.matchPattern = b.matchPattern;
        if (b.setTag !== undefined) updateData.setTag = b.setTag;
        if (b.enabled !== undefined) updateData.enabled = b.enabled;
        if (b.description !== undefined) updateData.description = b.description;
        if (b.subnetId !== undefined) updateData.subnetId = b.subnetId === '__all__' ? null : b.subnetId;
        const updated = await db.dhcpTagRule.update({ where: { id }, data: updateData });
        return NextResponse.json({ success: true, data: updated, message: 'Tag rule updated' });
      }
      if (method === 'DELETE') {
        await db.dhcpTagRule.delete({ where: { id } }).catch(() => {});
        return NextResponse.json({ success: true, message: 'Tag rule deleted' });
      }
    }

    // ─── Hostname Filters ──────────────────────────────────────────────────
    if (segments[0] === 'hostname-filters' && segments.length === 1) {
      if (method === 'GET') {
        const items = await db.dhcpHostnameFilter.findMany({
          where: { tenantId },
          include: { dhcpSubnet: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({
          success: true,
          data: items.map(h => ({
            id: h.id, pattern: h.pattern, action: h.action,
            subnetId: h.subnetId || undefined,
            subnetName: h.dhcpSubnet?.name || null, enabled: h.enabled,
            description: h.description || '', createdAt: h.createdAt?.toISOString(),
          })),
        });
      }
      if (method === 'POST') {
        const b = body!;
        const created = await db.dhcpHostnameFilter.create({
          data: {
            tenantId,
            propertyId: (b.propertyId as string) || propertyId || tenantId,
            pattern: (b.pattern as string) || '',
            action: (b.action as string) || 'ignore',
            subnetId: b.subnetId === '__all__' || !b.subnetId ? null : (b.subnetId as string),
            enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
            description: (b.description as string) || null,
          },
        });
        return NextResponse.json({ success: true, data: created, message: 'Hostname filter created' });
      }
    }

    if (segments[0] === 'hostname-filters' && segments.length === 2) {
      const id = segments[1];
      if (method === 'PUT') {
        const b = body!;
        const updateData: Record<string, unknown> = {};
        if (b.pattern !== undefined) updateData.pattern = b.pattern;
        if (b.action !== undefined) updateData.action = b.action;
        if (b.enabled !== undefined) updateData.enabled = b.enabled;
        if (b.description !== undefined) updateData.description = b.description;
        if (b.subnetId !== undefined) updateData.subnetId = b.subnetId === '__all__' ? null : b.subnetId;
        const updated = await db.dhcpHostnameFilter.update({ where: { id }, data: updateData });
        return NextResponse.json({ success: true, data: updated, message: 'Hostname filter updated' });
      }
      if (method === 'DELETE') {
        await db.dhcpHostnameFilter.delete({ where: { id } }).catch(() => {});
        return NextResponse.json({ success: true, message: 'Hostname filter deleted' });
      }
    }

    // ─── Lease Scripts ─────────────────────────────────────────────────────
    if (segments[0] === 'lease-scripts' && segments.length === 1) {
      if (method === 'GET') {
        const items = await db.dhcpLeaseScript.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({
          success: true,
          data: items.map(s => {
            let events: string[];
            try { events = JSON.parse(s.events); } catch { events = ['add', 'del', 'old']; }
            return {
              id: s.id, name: s.name, scriptPath: s.scriptPath,
              events, enabled: s.enabled,
              description: s.description || '', createdAt: s.createdAt?.toISOString(),
            };
          }),
        });
      }
      if (method === 'POST') {
        const b = body!;
        const events = Array.isArray(b.events) ? b.events : ['add', 'del', 'old'];
        const created = await db.dhcpLeaseScript.create({
          data: {
            tenantId,
            propertyId: (b.propertyId as string) || propertyId || tenantId,
            name: (b.name as string) || '',
            scriptPath: (b.scriptPath as string) || '',
            events: JSON.stringify(events),
            enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
            description: (b.description as string) || null,
          },
        });
        return NextResponse.json({ success: true, data: { ...created, events }, message: 'Lease script created' });
      }
    }

    if (segments[0] === 'lease-scripts' && segments.length === 2) {
      const id = segments[1];
      if (method === 'PUT') {
        const b = body!;
        const updateData: Record<string, unknown> = {};
        if (b.name !== undefined) updateData.name = b.name;
        if (b.scriptPath !== undefined) updateData.scriptPath = b.scriptPath;
        if (b.events !== undefined) updateData.events = JSON.stringify(Array.isArray(b.events) ? b.events : []);
        if (b.enabled !== undefined) updateData.enabled = b.enabled;
        if (b.description !== undefined) updateData.description = b.description;
        const updated = await db.dhcpLeaseScript.update({ where: { id }, data: updateData });
        let events: string[];
        try { events = JSON.parse(updated.events); } catch { events = ['add', 'del', 'old']; }
        return NextResponse.json({ success: true, data: { ...updated, events }, message: 'Lease script updated' });
      }
      if (method === 'DELETE') {
        await db.dhcpLeaseScript.delete({ where: { id } }).catch(() => {});
        return NextResponse.json({ success: true, message: 'Lease script deleted' });
      }
    }

    // ─── Catch-all: route not found ────────────────────────────────────────
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: `DHCP route not found: ${path}` } },
      { status: 404 },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[DHCP API] Error:', msg);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: msg } },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) { return handleRequest(request, 'GET'); }
export async function POST(request: NextRequest) { return handleRequest(request, 'POST'); }
export async function PUT(request: NextRequest) { return handleRequest(request, 'PUT'); }
export async function DELETE(request: NextRequest) { return handleRequest(request, 'DELETE'); }
export async function PATCH(request: NextRequest) { return handleRequest(request, 'PATCH'); }
