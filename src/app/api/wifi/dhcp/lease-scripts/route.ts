/**
 * DHCP Lease Scripts API Route
 *
 * GET list and POST create for DHCP lease scripts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/dhcp/lease-scripts - List all lease scripts
export async function GET(request: NextRequest) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const scripts = await db.dhcpLeaseScript.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const data = scripts.map((script) => {
      let parsedEvents: string[];
      try {
        parsedEvents = JSON.parse(script.events);
      } catch {
        parsedEvents = ['add', 'del', 'old'];
      }
      return {
        ...script,
        events: parsedEvents,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching DHCP lease scripts:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP lease scripts' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/dhcp/lease-scripts - Create lease script
export async function POST(request: NextRequest) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json();
    const { propertyId, name, scriptPath, events, enabled, description } = body;

    if (!propertyId || !name || !scriptPath) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name, scriptPath' } },
        { status: 400 },
      );
    }

    const created = await db.dhcpLeaseScript.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        name,
        scriptPath,
        events: Array.isArray(events) ? JSON.stringify(events) : '["add","del","old"]',
        enabled: enabled !== undefined ? enabled : true,
        description: description ?? null,
      },
    });

    // Parse events back to array for response
    let parsedEvents: string[];
    try {
      parsedEvents = JSON.parse(created.events);
    } catch {
      parsedEvents = ['add', 'del', 'old'];
    }

    return NextResponse.json(
      {
        success: true,
        data: { ...created, events: parsedEvents },
        message: 'DHCP lease script created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating DHCP lease script:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create DHCP lease script' } },
      { status: 500 },
    );
  }
}
