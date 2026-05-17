import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { logAudit } from '@/lib/audit';
import { isValidIpOrCidr } from '@/lib/ip-whitelist/utils';

// GET /api/settings/ip-whitelist — List all rules for the tenant
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (user.roleName !== 'admin' && !user.permissions.includes('*') && !user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can manage IP whitelist rules' } },
        { status: 403 }
      );
    }

    const rules = await db.ipWhitelistRule.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error('Error fetching IP whitelist rules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch IP whitelist rules' } },
      { status: 500 }
    );
  }
}

// POST /api/settings/ip-whitelist — Add a new rule
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (user.roleName !== 'admin' && !user.permissions.includes('*') && !user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can manage IP whitelist rules' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, ipAddress, description, isEnabled } = body;

    if (!type || (type !== 'whitelist' && type !== 'blacklist')) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'type must be "whitelist" or "blacklist"' } },
        { status: 400 }
      );
    }

    if (!ipAddress || typeof ipAddress !== 'string' || !isValidIpOrCidr(ipAddress.trim())) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid IP address or CIDR range. Examples: "192.168.1.5" or "10.0.0.0/24"' } },
        { status: 400 }
      );
    }

    const trimmedIp = ipAddress.trim();

    const existing = await db.ipWhitelistRule.findFirst({
      where: { tenantId: user.tenantId, ipAddress: trimmedIp },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'This IP address/CIDR already exists for your tenant' } },
        { status: 409 }
      );
    }

    const rule = await db.ipWhitelistRule.create({
      data: {
        tenantId: user.tenantId,
        type,
        ipAddress: trimmedIp,
        description: description?.trim() || null,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        createdBy: user.id,
      },
      include: {
        creator: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    try {
      await logAudit(
        request,
        'security',
        'ip_whitelist_create',
        'ip_whitelist_rule',
        rule.id,
        undefined,
        { type, ipAddress: trimmedIp, description: description?.trim() || null, isEnabled },
        { tenantId: user.tenantId, userId: user.id }
      );
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('Error creating IP whitelist rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create IP whitelist rule' } },
      { status: 500 }
    );
  }
}

// PUT /api/settings/ip-whitelist — Update a rule (enable/disable, description)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (user.roleName !== 'admin' && !user.permissions.includes('*') && !user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can manage IP whitelist rules' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, isEnabled, description } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.ipWhitelistRule.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (description !== undefined) updateData.description = description?.trim() || null;

    const rule = await db.ipWhitelistRule.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    try {
      await logAudit(
        request,
        'security',
        'ip_whitelist_update',
        'ip_whitelist_rule',
        id,
        { isEnabled: existing.isEnabled, description: existing.description },
        { isEnabled: rule.isEnabled, description: rule.description },
        { tenantId: user.tenantId, userId: user.id }
      );
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error updating IP whitelist rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update IP whitelist rule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/ip-whitelist — Delete a rule
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (user.roleName !== 'admin' && !user.permissions.includes('*') && !user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can manage IP whitelist rules' } },
        { status: 403 }
      );
    }

    let ruleId: string | null = null;

    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');
    if (queryId) {
      ruleId = queryId;
    } else {
      try {
        const body = await request.json();
        ruleId = body.id;
      } catch {
        // No body
      }
    }

    if (!ruleId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.ipWhitelistRule.findUnique({
      where: { id: ruleId },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 }
      );
    }

    await db.ipWhitelistRule.delete({
      where: { id: ruleId },
    });

    try {
      await logAudit(
        request,
        'security',
        'ip_whitelist_delete',
        'ip_whitelist_rule',
        ruleId,
        { type: existing.type, ipAddress: existing.ipAddress, description: existing.description },
        undefined,
        { tenantId: user.tenantId, userId: user.id }
      );
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting IP whitelist rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete IP whitelist rule' } },
      { status: 500 }
    );
  }
}
