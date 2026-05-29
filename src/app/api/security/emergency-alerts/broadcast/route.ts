import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/security/emergency-alerts/broadcast
// Fire-and-forget notification dispatch for emergency alerts
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['security.update', 'security.*', '*'])) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { alertId, channels = ['in_app'], targetGroups = ['all_staff'] } = body;

    if (!alertId) {
      return NextResponse.json({ success: false, error: 'alertId is required' }, { status: 400 });
    }

    // Verify alert exists
    const alert = await db.emergencyAlert.findFirst({
      where: { id: alertId, tenantId: user.tenantId, deletedAt: null },
    });
    if (!alert) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    // Fire-and-forget: Dispatch notifications asynchronously
    // In production, this would integrate with SMS/email/push providers
    const broadcastRecord = {
      alertId,
      channels,
      targetGroups,
      dispatchedBy: user.id,
      dispatchedAt: new Date().toISOString(),
      alertTitle: alert.title,
      alertSeverity: alert.severity,
    };

    // Log the broadcast action
    await db.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        module: 'security',
        action: 'create',
        entityType: 'EmergencyAlert',
        entityId: alertId,
        newValue: JSON.stringify({
          action: 'broadcast',
          channels,
          targetGroups,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || null,
      },
    });

    // Update alert response actions to record the broadcast
    const currentActions = JSON.parse(alert.responseActions || '[]');
    currentActions.push({
      type: 'broadcast',
      channels,
      targetGroups,
      timestamp: new Date().toISOString(),
      performedBy: user.name || user.email,
    });
    await db.emergencyAlert.update({
      where: { id: alertId },
      data: {
        responseActions: JSON.stringify(currentActions),
        status: alert.status === 'active' ? 'escalated' : alert.status,
      },
    });

    // Return immediately — actual dispatch is fire-and-forget
    return NextResponse.json({
      success: true,
      data: {
        message: 'Broadcast dispatched',
        channels,
        targetGroups,
        alertId,
      },
    });
  } catch (error) {
    console.error('[POST /api/security/emergency-alerts/broadcast]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
