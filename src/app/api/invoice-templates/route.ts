import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/invoice-templates - List invoice templates
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasPermission(user, 'invoices.view') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const templates = await db.invoiceTemplate.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching invoice templates:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invoice templates' } },
      { status: 500 }
    );
  }
}

// POST /api/invoice-templates - Create custom template
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasPermission(user, 'invoices.create') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, primaryColor, logoUrl, footerText, isDefault } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Template name is required' } },
        { status: 400 }
      );
    }

    // Validate color format (hex)
    if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Primary color must be a valid hex color (e.g., #10b981)' } },
        { status: 400 }
      );
    }

    // If setting as default, unset existing default for this tenant
    if (isDefault) {
      await db.invoiceTemplate.updateMany({
        where: { tenantId: user.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await db.invoiceTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: name.trim(),
        description: description?.trim() || null,
        primaryColor: primaryColor || '#10b981',
        logoUrl: logoUrl?.trim() || null,
        footerText: footerText?.trim() || null,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice template:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create invoice template' } },
      { status: 500 }
    );
  }
}
