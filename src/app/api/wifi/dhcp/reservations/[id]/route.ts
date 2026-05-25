/**
 * DHCP Reservation by ID API Route
 *
 * GET, PUT, DELETE for individual DHCP reservations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { logWifi } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/dhcp/reservations/[id] - Get single reservation
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;

    const reservation = await db.dhcpReservation.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        dhcpSubnet: {
          select: { id: true, name: true, subnet: true },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP reservation not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Error fetching DHCP reservation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP reservation' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/dhcp/reservations/[id] - Update reservation
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.dhcpReservation.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP reservation not found' } },
        { status: 404 },
      );
    }

    const {
      macAddress, ipAddress, hostname, leaseTime,
      linkedType, linkedId, description, enabled,
    } = body;

    // Check for duplicate MAC if changing
    if (macAddress) {
      const normalizedMac = macAddress.toLowerCase().trim();
      if (normalizedMac !== existing.macAddress) {
        const duplicate = await db.dhcpReservation.findFirst({
          where: { subnetId: existing.subnetId, macAddress: normalizedMac, tenantId: ctx.tenantId, id: { not: id } },
        });
        if (duplicate) {
          return NextResponse.json(
            { success: false, error: { code: 'DUPLICATE_MAC', message: 'A reservation with this MAC address already exists in this subnet' } },
            { status: 400 },
          );
        }
      }
    }

    // Check for duplicate IP if changing
    if (ipAddress && ipAddress !== existing.ipAddress) {
      const duplicate = await db.dhcpReservation.findFirst({
        where: { subnetId: existing.subnetId, ipAddress, tenantId: ctx.tenantId, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_IP', message: 'A reservation with this IP address already exists in this subnet' } },
          { status: 400 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (macAddress) updateData.macAddress = macAddress.toLowerCase().trim();
    if (ipAddress) updateData.ipAddress = ipAddress;
    if (hostname !== undefined) updateData.hostname = hostname;
    if (leaseTime !== undefined) updateData.leaseTime = leaseTime ? parseInt(leaseTime, 10) : null;
    if (linkedType !== undefined) updateData.linkedType = linkedType;
    if (linkedId !== undefined) updateData.linkedId = linkedId;
    if (description !== undefined) updateData.description = description;
    if (enabled !== undefined) updateData.enabled = enabled;

    const reservation = await db.dhcpReservation.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    try {
      await logWifi(request, 'update', 'dhcp_reservation', id, { macAddress: reservation.macAddress, ipAddress: reservation.ipAddress, hostname: reservation.hostname, enabled: reservation.enabled }, { tenantId: ctx.tenantId, userId: ctx.userId, oldValue: existing as unknown as Record<string, unknown> });
    } catch (auditErr) {
      console.error('Audit log failed for DHCP reservation update:', auditErr);
    }

    return NextResponse.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Error updating DHCP reservation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update DHCP reservation' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/dhcp/reservations/[id] - Delete reservation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ctx = await requirePermission(request, 'wifi.manage');
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await params;

    const existing = await db.dhcpReservation.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP reservation not found' } },
        { status: 404 },
      );
    }

    await db.dhcpReservation.delete({ where: { id } });

    // Audit log
    try {
      await logWifi(request, 'delete', 'dhcp_reservation', id, { macAddress: existing.macAddress, ipAddress: existing.ipAddress, hostname: existing.hostname }, { tenantId: ctx.tenantId, userId: ctx.userId, oldValue: existing as unknown as Record<string, unknown> });
    } catch (auditErr) {
      console.error('Audit log failed for DHCP reservation delete:', auditErr);
    }

    return NextResponse.json({ success: true, message: 'DHCP reservation deleted successfully' });
  } catch (error) {
    console.error('Error deleting DHCP reservation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete DHCP reservation' } },
      { status: 500 },
    );
  }
}
