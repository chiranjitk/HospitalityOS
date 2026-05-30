import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── GET /api/v1/wifi/devices/[id] ──────────────────────────────────────────────
// Get a single device by ID

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const device = await db.wiFiUserDevice.findUnique({
      where: { id },
      include: {
        wifiUser: {
          select: {
            username: true,
            status: true,
            plan: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: device });
  } catch (error) {
    console.error('[WiFiUserDevice] Get error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch device' } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/v1/wifi/devices/[id] ──────────────────────────────────────────
// Deactivate a device by ID

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const device = await db.wiFiUserDevice.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      data: device,
      message: 'Device deactivated',
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } },
        { status: 404 }
      );
    }
    console.error('[WiFiUserDevice] Delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to deactivate device' } },
      { status: 500 }
    );
  }
}
