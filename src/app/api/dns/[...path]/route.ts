/**
 * DNS API Route — Direct PostgreSQL Backend (dnsmasq)
 *
 * Previously this was a proxy to dns-service on port 3012.
 * Now reads/writes directly from PostgreSQL via Prisma.
 * No external service dependency — data loads instantly from DB.
 *
 * Routes handled:
 *   GET  /api/dns/status              → DNS service overview from DB
 *   POST /api/dns/service/{action}    → Service control stub (start/stop/restart/reload)
 *   CRUD /api/dns/zones               → DnsZone
 *   CRUD /api/dns/records             → DnsRecord
 *   CRUD /api/dns/redirects           → DnsRedirectRule
 *   CRUD /api/dns/forwarders          → DnsForwarder (raw SQL — no Prisma model)
 *   GET  /api/dns/cache               → Cache stats stub
 *   POST /api/dns/cache/flush         → Flush cache stub
 *   GET  /api/dns/dhcp-dns            → DHCP-DNS integration (from DHCP leases)
 *   GET  /api/dns/activity            → Activity log (raw SQL — no Prisma model)
 *   GET  /api/dns/config              → Config file stub
 *   POST /api/dns/config              → Update config stub
 *   POST /api/dns/sync                → Trigger sync stub
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';
import { Prisma } from '@prisma/client';
import { DNSMASQ_DNS_CONF } from '@/lib/wifi/paths';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTenant(request: NextRequest) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
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

// ─── Extract path from URL ────────────────────────────────────────────────────

function extractPath(request: NextRequest): string {
  return request.nextUrl.pathname
    .replace('/api/dns/', '')
    .replace('/api/dns', '');
}

function parsePathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

// ─── DnsForwarder & DnsActivityLog (raw SQL — not in Prisma schema) ───────────

interface DnsForwarderRow {
  id: string;
  tenantId: string;
  propertyId: string;
  address: string;
  port: number;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DnsActivityLogRow {
  id: string;
  action: string;
  details: string | null;
  severity: string;
  timestamp: string;
}

/** Ensure DnsForwarder table exists (service-managed, not in Prisma schema) */
async function ensureForwarderTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DnsForwarder" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL DEFAULT 'default',
        "propertyId" TEXT NOT NULL DEFAULT 'default',
        "address" TEXT NOT NULL,
        "port" INTEGER NOT NULL DEFAULT 53,
        "description" TEXT,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE("address", "port", "propertyId")
      );
    `);
  } catch {}
}

/** Ensure DnsActivityLog table exists */
async function ensureActivityLogTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DnsActivityLog" (
        "id" TEXT PRIMARY KEY,
        "action" TEXT NOT NULL,
        "details" TEXT,
        "severity" TEXT NOT NULL DEFAULT 'info',
        "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch {}
}

const DNS_SERVICE_URL = process.env.DNS_SERVICE_URL || 'http://localhost:3012';

/** Proxy a request to the real dns-service mini-service on port 3012 */
async function proxyToDnsService(path: string, method: string, body?: Record<string, unknown> | null): Promise<Response | null> {
  try {
    const url = `${DNS_SERVICE_URL}${path}`;
    const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return null;
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

    // ─── Status — proxy to real dns-service, fall back to DB-only stub ───
    if (segments[0] === 'status' && segments.length === 1 && method === 'GET') {
      // Try real mini-service first (has actual dnsmasq process status)
      const proxied = await proxyToDnsService('/api/status', 'GET');
      if (proxied) return proxied;

      // Fallback: DB-only counts (mini-service not running)
      const [zoneCount, recordCount, redirectCount] = await Promise.all([
        db.dnsZone.count({ where: { tenantId } }),
        db.dnsRecord.count({ where: { tenantId } }),
        db.dnsRedirectRule.count({ where: { tenantId } }),
      ]);

      let forwarderCount = 0;
      try {
        await ensureForwarderTable();
        const result = await db.$queryRawUnsafe<{ count: string }[]>(
          `SELECT COUNT(*)::text as count FROM "DnsForwarder" WHERE enabled = true`
        );
        forwarderCount = parseInt(result[0]?.count) || 0;
      } catch {}

      return NextResponse.json({
        success: true,
        data: {
          installed: true, running: false, version: '', mode: 'standalone',
          configPath: DNSMASQ_DNS_CONF,
          zoneCount, recordCount, redirectCount, forwarderCount,
          cacheStats: { size: 10000, maxSize: 10000, inserts: 0, evictions: 0, hitRate: 'N/A' },
          _warning: 'dns-service mini-service not reachable — showing DB-only status',
        },
      });
    }

    // ─── Service Control — proxy to real dns-service ──────────────────────
    if (segments[0] === 'service' && segments.length === 2 && method === 'POST') {
      const action = segments[1];
      if (!['start', 'stop', 'restart', 'reload'].includes(action)) {
        return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
      }

      // Try real mini-service
      const proxied = await proxyToDnsService(`/api/service/${action}`, 'POST', body);
      if (proxied) return proxied;

      return NextResponse.json({
        success: false,
        error: `dns-service mini-service not reachable on port 3012. Cannot ${action} dnsmasq.`,
        running: false,
      });
    }

    // ─── Zones ─────────────────────────────────────────────────────────────
    if (segments[0] === 'zones') {
      // POST /zones/bulk-delete
      if (segments[1] === 'bulk-delete' && method === 'POST') {
        const b = body!;
        const ids = (b.ids as string[]) || [];
        if (ids.length === 0) {
          return NextResponse.json({ success: false, error: 'No IDs provided' }, { status: 400 });
        }
        const count = await db.dnsZone.deleteMany({ where: { id: { in: ids }, tenantId } });
        return NextResponse.json({ success: true, message: `${count.count} zone(s) deleted` });
      }

      if (segments.length === 1) {
        // GET /zones
        if (method === 'GET') {
          const zones = await db.dnsZone.findMany({
            where: { tenantId },
            include: {
              _count: { select: { records: true } },
            },
            orderBy: { domain: 'asc' },
          });
          return NextResponse.json({
            success: true,
            data: zones.map(z => ({
              id: z.id,
              domain: z.domain,
              type: 'forward',
              description: z.description,
              enabled: z.enabled ? 1 : 0,
              recordCount: z._count.records,
              vlanId: z.vlanId,
              createdAt: z.createdAt?.toISOString(),
            })),
          });
        }
        // POST /zones
        if (method === 'POST') {
          const b = body!;
          const created = await db.dnsZone.create({
            data: {
              tenantId,
              propertyId: (b.propertyId as string) || propertyId || tenantId,
              domain: (b.domain as string) || '',
              description: (b.description as string) || null,
              vlanId: b.vlanId ? parseInt(String(b.vlanId), 10) : null,
              enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
            },
          });
          return NextResponse.json({
            success: true,
            data: {
              id: created.id,
              domain: created.domain,
              type: 'forward',
              description: created.description,
              enabled: created.enabled ? 1 : 0,
              recordCount: 0,
              vlanId: created.vlanId,
            },
            message: 'Zone created',
          });
        }
      }

      if (segments.length === 2) {
        const id = segments[1];
        // PUT /zones/:id
        if (method === 'PUT') {
          const b = body!;
          const updateData: Record<string, unknown> = {};
          if (b.domain !== undefined) updateData.domain = b.domain;
          if (b.description !== undefined) updateData.description = b.description;
          if (b.vlanId !== undefined) updateData.vlanId = b.vlanId ? parseInt(String(b.vlanId), 10) : null;
          if (b.enabled !== undefined) updateData.enabled = b.enabled;

          const updated = await db.dnsZone.update({
            where: { id },
            data: updateData,
            include: { _count: { select: { records: true } } },
          });
          return NextResponse.json({
            success: true,
            data: {
              id: updated.id,
              domain: updated.domain,
              type: 'forward',
              description: updated.description,
              enabled: updated.enabled ? 1 : 0,
              recordCount: updated._count.records,
              vlanId: updated.vlanId,
            },
            message: 'Zone updated',
          });
        }
        // DELETE /zones/:id
        if (method === 'DELETE') {
          await db.dnsRecord.deleteMany({ where: { zoneId: id } });
          await db.dnsZone.delete({ where: { id } }).catch(() => {});
          return NextResponse.json({ success: true, message: 'Zone deleted' });
        }
      }
    }

    // ─── Records ───────────────────────────────────────────────────────────
    if (segments[0] === 'records') {
      // POST /records/bulk-delete
      if (segments[1] === 'bulk-delete' && method === 'POST') {
        const b = body!;
        const ids = (b.ids as string[]) || [];
        if (ids.length === 0) {
          return NextResponse.json({ success: false, error: 'No IDs provided' }, { status: 400 });
        }
        const count = await db.dnsRecord.deleteMany({ where: { id: { in: ids }, tenantId } });
        return NextResponse.json({ success: true, message: `${count.count} record(s) deleted` });
      }

      if (segments.length === 1) {
        // GET /records
        if (method === 'GET') {
          const searchParams = request.nextUrl.searchParams;
          const zoneId = searchParams.get('zoneId');
          const type = searchParams.get('type');

          const where: Record<string, unknown> = { tenantId };
          if (zoneId) where.zoneId = zoneId;
          if (type) where.type = type;

          const records = await db.dnsRecord.findMany({
            where,
            include: { dnsZone: { select: { domain: true } } },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
          });
          return NextResponse.json({
            success: true,
            data: records.map(r => ({
              id: r.id,
              zoneId: r.zoneId,
              name: r.name,
              type: r.type,
              value: r.value,
              ttl: r.ttl,
              priority: r.priority,
              enabled: r.enabled ? 1 : 0,
              zoneDomain: r.dnsZone?.domain,
            })),
          });
        }
        // POST /records
        if (method === 'POST') {
          const b = body!;
          const created = await db.dnsRecord.create({
            data: {
              tenantId,
              zoneId: (b.zoneId as string) || '',
              name: (b.name as string) || '',
              type: (b.type as string) || 'A',
              value: (b.value as string) || '',
              ttl: b.ttl ? parseInt(String(b.ttl), 10) : 300,
              priority: b.priority ? parseInt(String(b.priority), 10) : null,
              enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
            },
            include: { dnsZone: { select: { domain: true } } },
          });
          return NextResponse.json({
            success: true,
            data: {
              id: created.id,
              zoneId: created.zoneId,
              name: created.name,
              type: created.type,
              value: created.value,
              ttl: created.ttl,
              priority: created.priority,
              enabled: created.enabled ? 1 : 0,
              zoneDomain: created.dnsZone?.domain,
            },
            message: 'Record created',
          });
        }
      }

      if (segments.length === 2) {
        const id = segments[1];
        // PUT /records/:id
        if (method === 'PUT') {
          const b = body!;
          const updateData: Record<string, unknown> = {};
          if (b.name !== undefined) updateData.name = b.name;
          if (b.type !== undefined) updateData.type = b.type;
          if (b.value !== undefined) updateData.value = b.value;
          if (b.ttl !== undefined) updateData.ttl = parseInt(String(b.ttl), 10);
          if (b.priority !== undefined) updateData.priority = b.priority ? parseInt(String(b.priority), 10) : null;
          if (b.enabled !== undefined) updateData.enabled = b.enabled;
          if (b.zoneId !== undefined) updateData.zoneId = b.zoneId;

          const updated = await db.dnsRecord.update({
            where: { id },
            data: updateData,
            include: { dnsZone: { select: { domain: true } } },
          });
          return NextResponse.json({
            success: true,
            data: {
              id: updated.id,
              zoneId: updated.zoneId,
              name: updated.name,
              type: updated.type,
              value: updated.value,
              ttl: updated.ttl,
              priority: updated.priority,
              enabled: updated.enabled ? 1 : 0,
              zoneDomain: updated.dnsZone?.domain,
            },
            message: 'Record updated',
          });
        }
        // DELETE /records/:id
        if (method === 'DELETE') {
          await db.dnsRecord.delete({ where: { id } }).catch(() => {});
          return NextResponse.json({ success: true, message: 'Record deleted' });
        }
      }
    }

    // ─── Redirects (DnsRedirectRule) ───────────────────────────────────────
    if (segments[0] === 'redirects' && segments.length === 1) {
      // GET /redirects
      if (method === 'GET') {
        const redirects = await db.dnsRedirectRule.findMany({
          where: { tenantId },
          orderBy: [{ priority: 'asc' }, { matchPattern: 'asc' }],
        });
        return NextResponse.json({
          success: true,
          data: redirects.map(r => {
            let domain = r.matchPattern || '';
            let wildcard = false;
            if (domain.startsWith('*.')) {
              domain = domain.slice(2);
              wildcard = true;
            } else if (domain === '*') {
              wildcard = true;
            }
            return {
              id: r.id,
              tenantId: r.tenantId,
              propertyId: r.propertyId,
              name: r.name,
              domain,
              wildcard: wildcard ? 1 : 0,
              targetIp: r.targetIp,
              priority: r.priority,
              description: r.description,
              enabled: r.enabled ? 1 : 0,
              createdAt: r.createdAt?.toISOString(),
            };
          }),
        });
      }
      // POST /redirects
      if (method === 'POST') {
        const b = body!;
        let matchPattern = (b.domain as string) || '';
        const wildcard = b.wildcard as boolean;
        if (wildcard && matchPattern !== '*') {
          matchPattern = `*.${matchPattern}`;
        }
        const created = await db.dnsRedirectRule.create({
          data: {
            tenantId,
            propertyId: (b.propertyId as string) || propertyId || tenantId,
            name: (b.name as string) || (b.domain as string) || 'Redirect',
            matchPattern,
            targetIp: (b.targetIp as string) || '',
            applyTo: (b.applyTo as string) || 'unauthenticated',
            priority: b.priority ? parseInt(String(b.priority), 10) : 0,
            enabled: b.enabled !== undefined ? (b.enabled as boolean) : true,
            description: (b.description as string) || null,
          },
        });

        let respDomain = created.matchPattern;
        let respWildcard = false;
        if (respDomain.startsWith('*.')) { respDomain = respDomain.slice(2); respWildcard = true; }
        else if (respDomain === '*') { respWildcard = true; }

        return NextResponse.json({
          success: true,
          data: {
            id: created.id,
            tenantId: created.tenantId,
            propertyId: created.propertyId,
            name: created.name,
            domain: respDomain,
            wildcard: respWildcard ? 1 : 0,
            targetIp: created.targetIp,
            priority: created.priority,
            description: created.description,
            enabled: created.enabled ? 1 : 0,
          },
          message: 'Redirect created',
        });
      }
    }

    if (segments[0] === 'redirects' && segments.length === 2) {
      const id = segments[1];
      // PUT /redirects/:id
      if (method === 'PUT') {
        const b = body!;

        // Need to reconstruct matchPattern if domain/wildcard changed
        if (b.domain !== undefined || b.wildcard !== undefined) {
          const current = await db.dnsRedirectRule.findUnique({ where: { id } });
          if (current) {
            let currentDomain = current.matchPattern;
            let currentWildcard = false;
            if (currentDomain.startsWith('*.')) { currentDomain = currentDomain.slice(2); currentWildcard = true; }
            else if (currentDomain === '*') { currentWildcard = true; }

            const newDomain = (b.domain !== undefined ? String(b.domain) : currentDomain);
            const newWildcard = b.wildcard !== undefined ? (b.wildcard as boolean) : currentWildcard;
            let newMatchPattern = newDomain;
            if (newWildcard && newMatchPattern !== '*') newMatchPattern = `*.${newMatchPattern}`;

            (b as Record<string, unknown>).matchPattern = newMatchPattern;
          }
        }

        const updateData: Record<string, unknown> = {};
        if (b.matchPattern !== undefined) updateData.matchPattern = b.matchPattern;
        if (b.targetIp !== undefined) updateData.targetIp = b.targetIp;
        if (b.priority !== undefined) updateData.priority = parseInt(String(b.priority), 10);
        if (b.description !== undefined) updateData.description = b.description;
        if (b.enabled !== undefined) updateData.enabled = b.enabled;
        if (b.applyTo !== undefined) updateData.applyTo = b.applyTo;
        if (b.name !== undefined) updateData.name = b.name;

        const updated = await db.dnsRedirectRule.update({ where: { id }, data: updateData });

        let respDomain = updated.matchPattern;
        let respWildcard = false;
        if (respDomain.startsWith('*.')) { respDomain = respDomain.slice(2); respWildcard = true; }
        else if (respDomain === '*') { respWildcard = true; }

        return NextResponse.json({
          success: true,
          data: {
            id: updated.id,
            tenantId: updated.tenantId,
            propertyId: updated.propertyId,
            name: updated.name,
            domain: respDomain,
            wildcard: respWildcard ? 1 : 0,
            targetIp: updated.targetIp,
            priority: updated.priority,
            description: updated.description,
            enabled: updated.enabled ? 1 : 0,
          },
          message: 'Redirect updated',
        });
      }
      // DELETE /redirects/:id
      if (method === 'DELETE') {
        await db.dnsRedirectRule.delete({ where: { id } }).catch(() => {});
        return NextResponse.json({ success: true, message: 'Redirect deleted' });
      }
    }

    // ─── Forwarders (raw SQL — no Prisma model) ────────────────────────────
    if (segments[0] === 'forwarders') {
      await ensureForwarderTable();

      if (segments.length === 1) {
        // GET /forwarders
        if (method === 'GET') {
          const rows = await db.$queryRawUnsafe<DnsForwarderRow[]>(
            `SELECT * FROM "DnsForwarder" ORDER BY address ASC`
          );
          return NextResponse.json({
            success: true,
            data: rows.map(f => ({
              id: f.id,
              tenantId: f.tenantId,
              propertyId: f.propertyId,
              address: f.address,
              port: f.port,
              description: f.description,
              enabled: f.enabled ? 1 : 0,
            })),
          });
        }
        // POST /forwarders
        if (method === 'POST') {
          const b = body!;
          const id = crypto.randomUUID();
          await db.$executeRaw(
            Prisma.sql`INSERT INTO "DnsForwarder" (id, "tenantId", "propertyId", address, port, description, enabled)
             VALUES (${id}, ${tenantId}, ${propertyId || tenantId}, ${(b.address as string) || ''}, ${(b.port as number) || 53}, ${(b.description as string) || null}, ${b.enabled !== false})
             ON CONFLICT ON CONSTRAINT "DnsForwarder_address_port_propertyId_key" DO NOTHING`
          );
          const rows = await db.$queryRaw<DnsForwarderRow[]>(
            Prisma.sql`SELECT * FROM "DnsForwarder" WHERE id = ${id}`
          );
          return NextResponse.json({
            success: true,
            data: rows.length > 0 ? { ...rows[0], enabled: rows[0].enabled ? 1 : 0 } : { id, address: b.address, port: b.port || 53, description: b.description, enabled: 1 },
            message: 'Forwarder added',
          });
        }
      }

      if (segments.length === 2) {
        const id = segments[1];
        // DELETE /forwarders/:id
        if (method === 'DELETE') {
          await db.$executeRaw`DELETE FROM "DnsForwarder" WHERE id = ${id}`;
          return NextResponse.json({ success: true, message: 'Forwarder removed' });
        }
        // PUT /forwarders/:id
        if (method === 'PUT') {
          const b = body!;
          const setClauses: Prisma.Sql[] = [];

          if (b.address !== undefined) {
            setClauses.push(Prisma.sql`address = ${b.address}`);
          }
          if (b.port !== undefined) {
            setClauses.push(Prisma.sql`port = ${parseInt(String(b.port), 10)}`);
          }
          if (b.description !== undefined) {
            setClauses.push(Prisma.sql`description = ${b.description}`);
          }
          if (b.enabled !== undefined) {
            setClauses.push(Prisma.sql`enabled = ${b.enabled}`);
          }
          setClauses.push(Prisma.raw('"updatedAt" = NOW()'));

          if (setClauses.length === 0) {
            return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
          }

          await db.$executeRaw(
            Prisma.sql`UPDATE "DnsForwarder" SET ${Prisma.join(setClauses, ', ')} WHERE id = ${id}`
          );
          return NextResponse.json({ success: true, message: 'Forwarder updated' });
        }
      }
    }

    // ─── Cache — proxy to real dns-service, fall back to DB-only stub ────
    if (segments[0] === 'cache') {
      if (segments[1] === 'flush' && method === 'POST') {
        // Try real mini-service first
        const proxied = await proxyToDnsService('/api/cache/flush', 'POST', body);
        if (proxied) return proxied;
        return NextResponse.json({ success: false, error: 'dns-service mini-service not reachable' });
      }
      if (segments.length === 1 && method === 'GET') {
        // Try real mini-service first (has actual dnsmasq cache stats)
        const proxied = await proxyToDnsService('/api/cache', 'GET');
        if (proxied) return proxied;

        // Fallback: static info (mini-service not running)
        return NextResponse.json({
          success: true,
          data: {
            capacity: 10000,
            status: 'dns-service not reachable',
            serviceRunning: false,
            coldQueryMs: 0,
            hotQueryMs: 0,
            upstreamQueries: 0,
            upstreamRetried: 0,
            upstreamFailed: 0,
            nxdomainReplies: 0,
            avgLatencyMs: 0,
            forwarders: [],
            poolMemoryUsed: 0,
            poolMemoryMax: 0,
            cacheEntriesAvailable: false,
          },
        });
      }
    }

    // ─── DHCP-DNS Integration ──────────────────────────────────────────────
    if (segments[0] === 'dhcp-dns' && segments.length === 1 && method === 'GET') {
      // Return active DHCP leases that have hostnames (for DNS integration view)
      const leases = await db.dhcpLease.findMany({
        where: {
          tenantId,
          state: 'active',
          hostname: { not: '' },
        },
        orderBy: { ipAddress: 'asc' },
        take: 200,
      });
      return NextResponse.json({
        success: true,
        data: leases.map(l => ({
          timestamp: l.lastSeenAt?.toISOString() || l.leaseStart?.toISOString() || '',
          macAddress: l.macAddress,
          ipAddress: l.ipAddress,
          hostname: l.hostname,
          clientId: l.clientId || '',
        })),
      });
    }

    // ─── Activity Log (raw SQL) ────────────────────────────────────────────
    if (segments[0] === 'activity' && segments.length === 1 && method === 'GET') {
      await ensureActivityLogTable();
      const rows = await db.$queryRawUnsafe<DnsActivityLogRow[]>(
        `SELECT * FROM "DnsActivityLog" ORDER BY "timestamp" DESC LIMIT 500`
      );
      return NextResponse.json({
        success: true,
        data: rows.map(r => ({
          id: r.id,
          action: r.action,
          details: r.details,
          severity: r.severity,
          timestamp: r.timestamp,
        })),
      });
    }

    // ─── Config — proxy to real dns-service ───────────────────────────────
    if (segments[0] === 'config' && segments.length === 1) {
      if (method === 'GET') {
        const proxied = await proxyToDnsService('/api/config', 'GET');
        if (proxied) return proxied;
        return NextResponse.json({
          success: true,
          data: { path: DNSMASQ_DNS_CONF, content: '# dns-service not reachable\n# Config is managed by dns-service on port 3012\n' },
        });
      }
      if (method === 'POST') {
        const proxied = await proxyToDnsService('/api/config', 'POST', body);
        if (proxied) return proxied;
        return NextResponse.json({ success: false, error: 'dns-service not reachable' });
      }
    }

    // ─── Sync — proxy to real dns-service ─────────────────────────────────
    if (segments[0] === 'sync' && segments.length === 1 && method === 'POST') {
      const proxied = await proxyToDnsService('/api/sync', 'POST', body);
      if (proxied) return proxied;
      return NextResponse.json({ success: false, error: 'dns-service not reachable' });
    }

    // ─── Catch-all: route not found ────────────────────────────────────────
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: `DNS route not found: ${path}` } },
      { status: 404 },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[DNS API] Error:', msg);
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
