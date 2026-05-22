/**
 * DHCP Lease Scripts by ID API Route
 *
 * GET, PUT, DELETE for individual DHCP lease scripts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/dhcp/lease-scripts/[id] - Get single lease script
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;

    const script = await db.dhcpLeaseScript.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!script) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP lease script not found' } },
        { status: 404 },
      );
    }

    let parsedEvents: string[];
    try {
      parsedEvents = JSON.parse(script.events);
    } catch {
      parsedEvents = ['add', 'del', 'old'];
    }

    return NextResponse.json({
      success: true,
      data: { ...script, events: parsedEvents },
    });
  } catch (error) {
    console.error('Error fetching DHCP lease script:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP lease script' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/dhcp/lease-scripts/[id] - Update lease script
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.dhcpLeaseScript.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP lease script not found' } },
        { status: 404 },
      );
    }

    const { name, scriptPath, events, enabled, description } = body;

    const updated = await db.dhcpLeaseScript.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(scriptPath !== undefined && { scriptPath }),
        ...(events !== undefined && { events: Array.isArray(events) ? JSON.stringify(events) : events }),
        ...(enabled !== undefined && { enabled }),
        ...(description !== undefined && { description }),
      },
    });

    let parsedEvents: string[];
    try {
      parsedEvents = JSON.parse(updated.events);
    } catch {
      parsedEvents = ['add', 'del', 'old'];
    }

    return NextResponse.json({
      success: true,
      data: { ...updated, events: parsedEvents },
      message: 'DHCP lease script updated successfully',
    });
  } catch (error) {
    console.error('Error updating DHCP lease script:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update DHCP lease script' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/dhcp/lease-scripts/[id] - Delete lease script
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;

    const existing = await db.dhcpLeaseScript.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP lease script not found' } },
        { status: 404 },
      );
    }

    await db.dhcpLeaseScript.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'DHCP lease script deleted successfully' });
  } catch (error) {
    console.error('Error deleting DHCP lease script:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete DHCP lease script' } },
      { status: 500 },
    );
  }
}
