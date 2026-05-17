import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/corporate-accounts — List corporate accounts with outstanding balance
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('accountType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (accountType) where.accountType = accountType;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { taxId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const accounts = await db.corporateAccount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Aggregate outstanding balance from city ledger invoices
    const accountIds = accounts.map((a) => a.id);

    const cityLedgerBalances = await db.cityLedgerInvoice.groupBy({
      by: ['accountName', 'accountType'],
      where: {
        tenantId: user.tenantId,
        accountName: { in: accounts.map((a) => a.companyName) },
        status: { notIn: ['paid', 'cancelled'] },
      },
      _sum: { total: true, paidAmount: true },
    });

    const balanceMap: Record<string, number> = {};
    for (const item of cityLedgerBalances) {
      const total = item._sum.total || 0;
      const paid = item._sum.paidAmount || 0;
      balanceMap[item.accountName] = (balanceMap[item.accountName] || 0) + (total - paid);
    }

    return NextResponse.json({
      success: true,
      data: accounts.map((account) => ({
        id: account.id,
        companyName: account.companyName,
        contactName: account.contactName,
        contactEmail: account.contactEmail,
        contactPhone: account.contactPhone,
        address: account.address,
        city: account.city,
        state: account.state,
        country: account.country,
        postalCode: account.postalCode,
        taxId: account.taxId,
        website: account.website,
        industry: account.industry,
        accountType: account.accountType,
        billingTerms: account.billingTerms,
        creditLimit: account.creditLimit,
        outstandingBalance: balanceMap[account.companyName] || 0,
        paymentTerms: typeof account.paymentTerms === 'string' ? JSON.parse(account.paymentTerms) : account.paymentTerms,
        discountPercent: account.discountPercent,
        isPreferred: account.isPreferred,
        isActive: account.isActive,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      })),
      stats: {
        total: accounts.length,
        active: accounts.filter((a) => a.isActive).length,
        corporate: accounts.filter((a) => a.accountType === 'corporate').length,
        government: accounts.filter((a) => a.accountType === 'government').length,
        travelAgent: accounts.filter((a) => a.accountType === 'travel_agent').length,
        totalOutstanding: Object.values(balanceMap).reduce((sum, bal) => sum + bal, 0),
      },
    });
  } catch (error) {
    console.error('[corporate-accounts GET]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch corporate accounts' } },
      { status: 500 }
    );
  }
}

// POST /api/corporate-accounts — Create corporate account
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      address,
      city,
      state,
      country,
      postalCode,
      taxId,
      website,
      industry,
      accountType,
      billingTerms,
      creditLimit,
      paymentTerms,
      discountPercent,
      isPreferred,
    } = body;

    if (!companyName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'companyName is required' } },
        { status: 400 }
      );
    }

    // Check for duplicate company name
    const existing = await db.corporateAccount.findFirst({
      where: {
        tenantId: user.tenantId,
        companyName,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE', message: 'A corporate account with this name already exists' } },
        { status: 409 }
      );
    }

    const account = await db.corporateAccount.create({
      data: {
        tenantId: user.tenantId,
        companyName,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || null,
        postalCode: postalCode || null,
        taxId: taxId || null,
        website: website || null,
        industry: industry || null,
        accountType: accountType || 'corporate',
        billingTerms: billingTerms || 'net_30',
        creditLimit: creditLimit || 0,
        paymentTerms: JSON.stringify(paymentTerms || {}),
        discountPercent: discountPercent || 0,
        isPreferred: isPreferred || false,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: account.id,
        companyName: account.companyName,
        contactName: account.contactName,
        contactEmail: account.contactEmail,
        accountType: account.accountType,
        billingTerms: account.billingTerms,
        creditLimit: account.creditLimit,
        isActive: account.isActive,
        createdAt: account.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[corporate-accounts POST]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create corporate account' } },
      { status: 500 }
    );
  }
}

// PUT /api/corporate-accounts — Update corporate account
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Account id is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.corporateAccount.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Corporate account not found' } },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    const allowedFields = [
      'companyName', 'contactName', 'contactEmail', 'contactPhone',
      'address', 'city', 'state', 'country', 'postalCode',
      'taxId', 'website', 'industry', 'accountType', 'billingTerms',
      'creditLimit', 'discountPercent', 'isPreferred', 'isActive',
    ];

    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        data[field] = updateFields[field];
      }
    }

    if (updateFields.paymentTerms !== undefined) {
      data.paymentTerms = JSON.stringify(updateFields.paymentTerms);
    }

    const account = await db.corporateAccount.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: account.id,
        companyName: account.companyName,
        contactName: account.contactName,
        contactEmail: account.contactEmail,
        accountType: account.accountType,
        billingTerms: account.billingTerms,
        creditLimit: account.creditLimit,
        isActive: account.isActive,
        updatedAt: account.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[corporate-accounts PUT]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update corporate account' } },
      { status: 500 }
    );
  }
}

// DELETE /api/corporate-accounts — Delete corporate account
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Account id is required' } },
        { status: 400 }
      );
    }

    const existing = await db.corporateAccount.findUnique({
      where: { id: accountId },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Corporate account not found' } },
        { status: 404 }
      );
    }

    // Soft delete by marking inactive
    await db.corporateAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Corporate account deactivated successfully',
    });
  } catch (error) {
    console.error('[corporate-accounts DELETE]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete corporate account' } },
      { status: 500 }
    );
  }
}
