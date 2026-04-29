import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/folios/[id]/audit - Get audit trail for a folio
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }
  const tenantId = user.tenantId;

  try {
    const { id } = await params;

    // Verify folio exists
    const folio = await db.folio.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    const auditEntries = await db.folioLineItemAudit.findMany({
      where: { folioId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      data: auditEntries,
    });
  } catch (error) {
    console.error('Error fetching folio audit trail:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit trail' } },
      { status: 500 }
    );
  }
}
