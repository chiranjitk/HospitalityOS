import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET /api/wifi/alerts/[id] ────────────────────────────────────────────────
// Get a single WiFi alert by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const alert = await db.wiFiAlert.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        property: {
          select: { id: true, name: true },
        },
      },
    });

    if (!alert) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: alert });
  } catch (error: any) {
    console.error('[WiFi Alerts API] GET by ID error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch alert' } },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/wifi/alerts/[id] ───────────────────────────────────────────────
// Acknowledge or resolve an alert
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const { status, acknowledgedBy, resolvedBy, resolveNote } = body;

    // Verify alert exists and belongs to tenant
    const existing = await db.wiFiAlert.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (status === 'acknowledged') {
      // Validate transition: can only acknowledge active alerts
      if (existing.status !== 'active') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATE', message: 'Only active alerts can be acknowledged' } },
          { status: 400 }
        );
      }
      updateData.status = 'acknowledged';
      updateData.acknowledgedBy = acknowledgedBy || null;
      updateData.acknowledgedAt = new Date();
    } else if (status === 'resolved') {
      // Can resolve active or acknowledged alerts
      if (existing.status === 'resolved') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATE', message: 'Alert is already resolved' } },
          { status: 400 }
        );
      }
      updateData.status = 'resolved';
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = resolvedBy || null;
      updateData.resolveNote = resolveNote || null;
      // Auto-set acknowledged if not already
      if (!existing.acknowledgedAt) {
        updateData.acknowledgedAt = new Date();
        updateData.acknowledgedBy = acknowledgedBy || resolvedBy || null;
      }
    } else if (status) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Status must be "acknowledged" or "resolved"' } },
        { status: 400 }
      );
    }

    if (resolveNote !== undefined && status !== 'resolved') {
      updateData.resolveNote = resolveNote;
    }

    // Update the alert
    const updated = await db.wiFiAlert.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: status === 'acknowledged' ? 'Alert acknowledged' : status === 'resolved' ? 'Alert resolved' : 'Alert updated',
    });
  } catch (error: any) {
    console.error('[WiFi Alerts API] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update alert' } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/wifi/alerts/[id] ──────────────────────────────────────────────
// Delete a WiFi alert
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Verify alert exists and belongs to tenant
    const existing = await db.wiFiAlert.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } },
        { status: 404 }
      );
    }

    await db.wiFiAlert.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully',
    });
  } catch (error: any) {
    console.error('[WiFi Alerts API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete alert' } },
      { status: 500 }
    );
  }
}
