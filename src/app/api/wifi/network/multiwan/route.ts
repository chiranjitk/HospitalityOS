/**
 * Multi-WAN / DGD Configuration API Route
 *
 * CRUD for MultiWanConfig with nested Gateways, GatewayHealthRules,
 * GatewayExplicitRoutes, and GatewayFwmarks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { isUUID, tenantWhere } from '@/lib/network/query-helpers';

// ─── Helper Types ────────────────────────────────────────────────────────────

interface HealthRuleInput {
  id?: string;
  protocol: 'PING' | 'TCP' | 'UDP';
  host: string;
  port: number;
  operator: '&' | '|';
  sortOrder: number;
}

interface ExplicitRouteInput {
  id?: string;
  network: string;
  description?: string;
}

interface FwmarkInput {
  id?: string;
  fwmarkValue: string;
  description?: string;
}

interface GatewayInput {
  id?: string;
  name: string;
  ipAddress: string;
  interfaceName: string;
  interfaceId?: string | null;
  weight: number;
  isBackup: boolean;
  backupGatewayId?: string | null;
  routingTableId: number;
  enabled: boolean;
  healthRules?: HealthRuleInput[];
  explicitRoutes?: ExplicitRouteInput[];
  fwmarks?: FwmarkInput[];
}

interface MultiWanBody {
  propertyId: string;
  enabled?: boolean;
  mode?: string;
  checkInterval?: number;
  pingCount?: number;
  pingTimeout?: number;
  tcpTimeout?: number;
  autoSwitchback?: boolean;
  switchbackDelay?: number;
  flushConntrackOnFailover?: boolean;
  gateways?: GatewayInput[];
}

// ─── GET ─────────────────────────────────────────────────────────────────────

// GET /api/wifi/network/multiwan?propertyId=...
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required query parameter: propertyId' } },
        { status: 400 },
      );
    }

    // Verify property belongs to this tenant before querying
    const propCheck = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!propCheck) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found for this tenant' } },
        { status: 404 },
      );
    }

    const config = await db.multiWanConfig.findUnique({
      where: { propertyId },
      include: {
        gateways: {
          orderBy: [{ isBackup: 'asc' }, { weight: 'desc' }],
          include: {
            backupOf: { select: { id: true, name: true } },
            healthRules: { orderBy: { sortOrder: 'asc' } },
            explicitRoutes: { orderBy: { createdAt: 'asc' } },
            fwmarks: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching multi-WAN config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch multi-WAN config' } },
      { status: 500 },
    );
  }
}

// ─── POST (Upsert) ──────────────────────────────────────────────────────────

// POST /api/wifi/network/multiwan
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body: MultiWanBody = await request.json();
    const tenantId = user.tenantId;

    if (!body.propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: propertyId' } },
        { status: 400 },
      );
    }

    // Verify property belongs to this tenant
    const property = await db.property.findFirst({
      where: { id: body.propertyId, tenantId },
    });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found for this tenant' } },
        { status: 404 },
      );
    }

    // Validate mode
    const validModes = ['weighted', 'failover', 'loadbalance'];
    if (body.mode && !validModes.includes(body.mode)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid mode. Must be one of: ${validModes.join(', ')}` } },
        { status: 400 },
      );
    }

    const {
      enabled = false,
      mode = 'weighted',
      checkInterval = 20,
      pingCount = 3,
      pingTimeout = 2,
      tcpTimeout = 5,
      autoSwitchback = true,
      switchbackDelay = 300,
      flushConntrackOnFailover = true,
      gateways = [],
    } = body;

    // Upsert MultiWanConfig
    const config = await db.multiWanConfig.upsert({
      where: { propertyId: body.propertyId },
      update: {
        enabled,
        mode,
        checkInterval,
        pingCount,
        pingTimeout,
        tcpTimeout,
        autoSwitchback,
        switchbackDelay,
        flushConntrackOnFailover,
      },
      create: {
        ...(isUUID(tenantId) && { tenant: { connect: { id: tenantId } } }),
        property: { connect: { id: body.propertyId } },
        enabled,
        mode,
        checkInterval,
        pingCount,
        pingTimeout,
        tcpTimeout,
        autoSwitchback,
        switchbackDelay,
        flushConntrackOnFailover,
      },
      include: {
        gateways: {
          include: {
            healthRules: true,
            explicitRoutes: true,
            fwmarks: true,
          },
        },
      },
    });

    // Delete existing gateways and their children (cascade handles health rules, explicit routes, fwmarks)
    await db.gateway.deleteMany({
      where: { multiWanConfigId: config.id },
    });

    // Recreate gateways with nested data
    if (Array.isArray(gateways) && gateways.length > 0) {
      for (const gw of gateways) {
        const createdGateway = await db.gateway.create({
          data: {
            multiWanConfigId: config.id,
            tenantId,
            propertyId: body.propertyId,
            name: gw.name || gw.interfaceName || 'WAN',
            ipAddress: gw.ipAddress || '',
            interfaceName: gw.interfaceName,
            interfaceId: gw.interfaceId || null,
            weight: typeof gw.weight === 'number' ? gw.weight : 1,
            isBackup: gw.isBackup || false,
            backupGatewayId: gw.backupGatewayId || null,
            routingTableId: typeof gw.routingTableId === 'number' ? gw.routingTableId : 0,
            enabled: gw.enabled !== false,
            healthRules: {
              create: (gw.healthRules || []).map((r, i) => ({
                tenantId,
                protocol: r.protocol || 'PING',
                host: r.host || '',
                port: r.port || 0,
                operator: r.operator || '&',
                sortOrder: r.sortOrder ?? i,
              })),
            },
            explicitRoutes: {
              create: (gw.explicitRoutes || []).map(r => ({
                tenantId,
                propertyId: body.propertyId,
                network: r.network || '',
                description: r.description || null,
              })),
            },
            fwmarks: {
              create: (gw.fwmarks || []).map(f => ({
                tenantId,
                fwmarkValue: f.fwmarkValue || '0x1',
                description: f.description || null,
              })),
            },
          },
        });
      }
    }

    // Return the full config with all nested data
    const result = await db.multiWanConfig.findUnique({
      where: { id: config.id },
      include: {
        gateways: {
          orderBy: [{ isBackup: 'asc' }, { weight: 'desc' }],
          include: {
            backupOf: { select: { id: true, name: true } },
            healthRules: { orderBy: { sortOrder: 'asc' } },
            explicitRoutes: { orderBy: { createdAt: 'asc' } },
            fwmarks: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating multi-WAN config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create/update multi-WAN config' } },
      { status: 500 },
    );
  }
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

// PUT /api/wifi/network/multiwan
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body: MultiWanBody = await request.json();
    const tenantId = user.tenantId;

    if (!body.propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: propertyId' } },
        { status: 400 },
      );
    }

    // Verify property belongs to this tenant
    const prop = await db.property.findFirst({
      where: { id: body.propertyId, tenantId },
    });
    if (!prop) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found for this tenant' } },
        { status: 404 },
      );
    }

    const existing = await db.multiWanConfig.findUnique({
      where: { propertyId: body.propertyId },
    });

    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Multi-WAN config not found for this property' } },
        { status: 404 },
      );
    }

    // Update config-level fields
    const updateData: Record<string, unknown> = {};
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.mode !== undefined) updateData.mode = body.mode;
    if (body.checkInterval !== undefined) updateData.checkInterval = body.checkInterval;
    if (body.pingCount !== undefined) updateData.pingCount = body.pingCount;
    if (body.pingTimeout !== undefined) updateData.pingTimeout = body.pingTimeout;
    if (body.tcpTimeout !== undefined) updateData.tcpTimeout = body.tcpTimeout;
    if (body.autoSwitchback !== undefined) updateData.autoSwitchback = body.autoSwitchback;
    if (body.switchbackDelay !== undefined) updateData.switchbackDelay = body.switchbackDelay;
    if (body.flushConntrackOnFailover !== undefined) updateData.flushConntrackOnFailover = body.flushConntrackOnFailover;

    await db.multiWanConfig.update({
      where: { propertyId: body.propertyId },
      data: updateData,
    });

    // If gateways provided, replace all (cascade handles children)
    if (Array.isArray(body.gateways)) {
      await db.gateway.deleteMany({
        where: { multiWanConfigId: existing.id },
      });

      if (body.gateways.length > 0) {
        for (const gw of body.gateways) {
          await db.gateway.create({
            data: {
              multiWanConfigId: existing.id,
              tenantId,
              propertyId: body.propertyId,
              name: gw.name || gw.interfaceName || 'WAN',
              ipAddress: gw.ipAddress || '',
              interfaceName: gw.interfaceName,
              interfaceId: gw.interfaceId || null,
              weight: typeof gw.weight === 'number' ? gw.weight : 1,
              isBackup: gw.isBackup || false,
              backupGatewayId: gw.backupGatewayId || null,
              routingTableId: typeof gw.routingTableId === 'number' ? gw.routingTableId : 0,
              enabled: gw.enabled !== false,
              healthRules: {
                create: (gw.healthRules || []).map((r, i) => ({
                  tenantId,
                  protocol: r.protocol || 'PING',
                  host: r.host || '',
                  port: r.port || 0,
                  operator: r.operator || '&',
                  sortOrder: r.sortOrder ?? i,
                })),
              },
              explicitRoutes: {
                create: (gw.explicitRoutes || []).map(r => ({
                  tenantId,
                  propertyId: body.propertyId,
                  network: r.network || '',
                  description: r.description || null,
                })),
              },
              fwmarks: {
                create: (gw.fwmarks || []).map(f => ({
                  tenantId,
                  fwmarkValue: f.fwmarkValue || '0x1',
                  description: f.description || null,
                })),
              },
            },
          });
        }
      }
    }

    // Return full updated config
    const result = await db.multiWanConfig.findUnique({
      where: { propertyId: body.propertyId },
      include: {
        gateways: {
          orderBy: [{ isBackup: 'asc' }, { weight: 'desc' }],
          include: {
            backupOf: { select: { id: true, name: true } },
            healthRules: { orderBy: { sortOrder: 'asc' } },
            explicitRoutes: { orderBy: { createdAt: 'asc' } },
            fwmarks: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating multi-WAN config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update multi-WAN config' } },
      { status: 500 },
    );
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

// DELETE /api/wifi/network/multiwan?propertyId=...
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required query parameter: propertyId' } },
        { status: 400 },
      );
    }

    const existing = await db.multiWanConfig.findUnique({
      where: { propertyId },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Multi-WAN config not found for this property' } },
        { status: 404 },
      );
    }

    // Gateways and their children cascade-deleted via onDelete: Cascade
    await db.multiWanConfig.delete({
      where: { propertyId },
    });

    return NextResponse.json({ success: true, message: 'Multi-WAN config deleted successfully' });
  } catch (error) {
    console.error('Error deleting multi-WAN config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete multi-WAN config' } },
      { status: 500 },
    );
  }
}
