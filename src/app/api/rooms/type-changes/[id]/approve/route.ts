import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasAnyPermission(user, ['rooms.update', 'rooms.manage', 'rooms.*', '*']))
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'approve' | 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Action must be approve or reject' }, { status: 400 });
    }

    const change = await db.roomTypeChange.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!change) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    if (!['requested', 'pending_approval'].includes(change.status))
      return NextResponse.json({ success: false, error: `Cannot ${action} change in status: ${change.status}` }, { status: 400 });

    // Perform approval/rejection in a transaction to handle rate difference atomically
    const updated = await db.$transaction(async (tx) => {
      const updatedChange = await tx.roomTypeChange.update({
        where: { id },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          approvedBy: user.id,
          approvedAt: new Date(),
        },
      });

      // When approving, post rate difference adjustment to the booking's folio
      if (action === 'approve' && change.rateDifference !== 0) {
        const roundedDiff = Math.round(change.rateDifference * 100) / 100;

        // Find open folio for the booking
        const folio = await tx.folio.findFirst({
          where: { bookingId: change.bookingId, status: { in: ['open', 'partially_paid'] } },
        });

        if (folio) {
          await tx.folioLineItem.create({
            data: {
              folioId: folio.id,
              description: roundedDiff > 0
                ? `Room type upgrade charge (${change.oldRoomTypeId} → ${change.newRoomTypeId})`
                : `Room type downgrade credit (${change.oldRoomTypeId} → ${change.newRoomTypeId})`,
              category: 'room_type_change',
              quantity: 1,
              unitPrice: Math.abs(roundedDiff),
              totalAmount: Math.abs(roundedDiff),
              serviceDate: new Date(),
              postedBy: user.email || user.id,
              referenceType: 'room_type_change',
              referenceId: change.id,
            },
          });

          // Recalculate folio balance using canonical formula
          const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: folio.id } });
          const newSubtotal = allLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
          await tx.folio.update({
            where: { id: folio.id },
            data: {
              subtotal: Math.round(newSubtotal * 100) / 100,
              totalAmount: Math.round((newSubtotal + folio.taxes - folio.discount) * 100) / 100,
              balance: Math.round((newSubtotal - folio.paidAmount) * 100) / 100,
            },
          });

          // Mark charge as applied
          await tx.roomTypeChange.update({
            where: { id },
            data: { chargeApplied: true },
          });
        }
      }

      return updatedChange;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error processing room type change:', error);
    return NextResponse.json({ success: false, error: 'Failed to process change' }, { status: 500 });
  }
}
