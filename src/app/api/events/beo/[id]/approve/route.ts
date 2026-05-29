import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { postBEOToFolio, getBEOSummary } from '@/lib/events/beo-folio-service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['events.manage', 'events.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const beo = await db.banquetEventOrder.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!beo) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    if (!['draft', 'confirmed'].includes(beo.status))
      return NextResponse.json({ success: false, error: 'Cannot approve BEO in current status' }, { status: 400 });

    const updated = await db.banquetEventOrder.update({
      where: { id },
      data: { status: 'confirmed', approvedBy: user.id, approvedAt: new Date() },
    });

    // ── Post-approval enhancements ──────────────────────────────────────

    // 1. Auto-post to folio if enabled in event settings
    try {
      const eventSettings = await db.tenant.findUnique({
        where: { id: user.tenantId },
        select: { settings: true },
      });

      let autoPostToFolio = false;
      if (eventSettings?.settings) {
        try {
          const settings = typeof eventSettings.settings === 'string'
            ? JSON.parse(eventSettings.settings)
            : eventSettings.settings;
          autoPostToFolio = settings.autoPostBEOTOFolio === true;
        } catch {
          // Ignore parse errors
        }
      }

      // Also auto-post if deposit amount > 0 (always post for deposit tracking)
      if (autoPostToFolio || beo.depositAmount > 0 || beo.totalAmount > 0) {
        await postBEOToFolio(id, user.tenantId);
      }
    } catch (folioError) {
      console.error('[beo-approve] Auto folio posting failed (non-fatal):', folioError);
      // Non-fatal — approval succeeded, folio posting is best-effort
    }

    // 2. Check if deposit reminder should be triggered
    let depositReminder = null;
    try {
      const summary = await getBEOSummary(id);
      if (summary.depositRequired > 0 && summary.depositPaid < summary.depositRequired) {
        depositReminder = {
          required: summary.depositRequired,
          paid: summary.depositPaid,
          outstanding: summary.outstandingDeposit,
        };
      }
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      data: updated,
      meta: {
        autoFolioPosted: true,
        depositReminder,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to approve BEO:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ success: false, error: 'BEO is already approved' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Failed to approve BEO' }, { status: 500 });
  }
}
