import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/admin/license-keys/[id] (AUTH REQUIRED)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await db.session.findFirst({
      where: { token: sessionToken, expiresAt: { gt: new Date() } },
      include: { user: { include: { tenant: true } } },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Platform admin only
    if (!session.user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Platform admin access required' } },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Find the license key
    const licenseKey = await db.licenseKey.findUnique({
      where: { id },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!licenseKey) {
      return NextResponse.json(
        { success: false, error: 'License key not found' },
        { status: 404 }
      );
    }

    const { status, note } = await request.json();

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (note !== undefined) {
      if (typeof note !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Note must be a string' },
          { status: 400 }
        );
      }
      if (note.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Note must be at most 500 characters' },
          { status: 400 }
        );
      }
      updateData.note = note;
    }

    // Handle status transitions
    if (status !== undefined) {
      // Only allow active → revoked transitions
      if (licenseKey.status === 'active' && status === 'revoked') {
        updateData.status = 'revoked';
      } else if (licenseKey.status !== 'active') {
        return NextResponse.json(
          { success: false, error: `Cannot change status from "${licenseKey.status}" to "${status}". Only active keys can be revoked.` },
          { status: 400 }
        );
      } else if (status !== 'revoked') {
        return NextResponse.json(
          { success: false, error: 'Only "revoked" status transition is allowed' },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update the license key
    const updatedKey = await db.licenseKey.update({
      where: { id },
      data: updateData,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    // Fetch activated user name if applicable
    let activatedByName: string | null = null;
    let tenantName: string | null = null;

    if (updatedKey.activatedBy) {
      const user = await db.user.findUnique({
        where: { id: updatedKey.activatedBy },
        select: { firstName: true, lastName: true },
      });
      if (user) {
        activatedByName = `${user.firstName} ${user.lastName}`;
      }
    }

    if (updatedKey.tenantId) {
      const tenant = await db.tenant.findUnique({
        where: { id: updatedKey.tenantId },
        select: { name: true },
      });
      if (tenant) {
        tenantName = tenant.name;
      }
    }

    // Audit logging for key status changes
    if (updateData.status && licenseKey.status !== updatedKey.status) {
      try {
        await db.auditLog.create({
          data: {
            userId: session.user.id,
            tenantId: session.user.tenantId,
            action: 'license_key_revoke',
            entity: 'LicenseKey',
            entityId: id,
            details: JSON.stringify({
              licenseKey: updatedKey.key,
              previousStatus: licenseKey.status,
              newStatus: updatedKey.status,
              performedBy: session.user.email,
            }),
            ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown',
          },
        });
      } catch {
        // Audit log table may not exist — don't block the operation
      }
    }

    return NextResponse.json({
      success: true,
      key: {
        id: updatedKey.id,
        key: updatedKey.key,
        planId: updatedKey.planId,
        plan: updatedKey.plan,
        status: updatedKey.status,
        generatedBy: updatedKey.generatedBy,
        generatedFor: updatedKey.generatedFor,
        activatedBy: updatedKey.activatedBy,
        activatedByName,
        activatedAt: updatedKey.activatedAt,
        tenantId: updatedKey.tenantId,
        tenantName,
        expiresAt: updatedKey.expiresAt,
        note: updatedKey.note,
        batchId: updatedKey.batchId,
        createdAt: updatedKey.createdAt,
        updatedAt: updatedKey.updatedAt,
      },
    });
  } catch (error) {
    console.error('Failed to update license key:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update license key' },
      { status: 500 }
    );
  }
}
