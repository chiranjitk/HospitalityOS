import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/voucher — Voucher Report tab data
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const planId = searchParams.get('planId');
    const search = searchParams.get('search');
    const propertyId = searchParams.get('propertyId');

    // Validate status if provided
    const validStatuses = ['active', 'used', 'expired', 'revoked'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } },
        { status: 400 }
      );
    }

    // Build base where clause with tenant isolation
    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (status) {
      where.status = status;
    }

    if (planId) {
      where.planId = planId;
    }

    if (search) {
      // Search by voucher code or issuedTo name
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { issuedTo: { contains: search, mode: 'insensitive' } },
      ];
    }

    // propertyId is accepted but WiFiVoucher does not have a propertyId column.
    // If provided, validate it belongs to the tenant (for API compatibility).
    let resolvedPropertyId: string | null = null;
    if (propertyId) {
      const prop = await db.property.findFirst({
        where: { id: propertyId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!prop) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property not found or does not belong to your tenant' } },
          { status: 400 }
        );
      }
      resolvedPropertyId = prop.id;
    }

    // ── Fetch all matching vouchers with plan data ──
    const vouchers = await db.wiFiVoucher.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ── Resolve tenant's first property for property name ──
    const property = await db.property.findFirst({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true },
    });

    // ── Batch-fetch guest names for all referenced guestIds ──
    const guestIds = [...new Set(vouchers.map((v) => v.guestId).filter(Boolean) as string[])];
    let guestMap = new Map<string, string>();
    if (guestIds.length > 0) {
      const guests = await db.guest.findMany({
        where: { id: { in: guestIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      for (const g of guests) {
        guestMap.set(g.id, `${g.firstName} ${g.lastName}`.trim());
      }
    }

    // ── Compute "expiring soon" threshold (next 24h) ──
    const now = new Date();
    const expiringSoonThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // ── Build summary counts ──
    let total = vouchers.length;
    let active = 0;
    let used = 0;
    let expired = 0;
    let revoked = 0;
    let expiringSoon = 0;

    for (const v of vouchers) {
      switch (v.status) {
        case 'active': active++; break;
        case 'used': used++; break;
        case 'expired': expired++; break;
        case 'revoked': revoked++; break;
      }
      // Count expiring soon: active vouchers whose validUntil is within 24h
      if (v.status === 'active' && v.validUntil <= expiringSoonThreshold && v.validUntil > now) {
        expiringSoon++;
      }
    }

    // Redemption rate: used / total (as percentage, 0–100)
    const redemptionRate = total > 0 ? Math.round((used / total) * 100 * 100) / 100 : 0;

    // ── Build plan breakdown ──
    const planMap = new Map<string, { planId: string; planName: string; total: number; used: number; active: number; expired: number }>();
    for (const v of vouchers) {
      const key = v.planId;
      const planName = v.plan?.name || 'Unknown Plan';
      if (!planMap.has(key)) {
        planMap.set(key, { planId: key, planName, total: 0, used: 0, active: 0, expired: 0 });
      }
      const entry = planMap.get(key)!;
      entry.total++;
      if (v.status === 'used') entry.used++;
      if (v.status === 'active') entry.active++;
      if (v.status === 'expired') entry.expired++;
    }

    const planBreakdown = Array.from(planMap.values()).map((entry) => ({
      ...entry,
      redemptionRate: entry.total > 0 ? Math.round((entry.used / entry.total) * 100 * 100) / 100 : 0,
    }));

    // ── Format voucher list ──
    const formattedVouchers = vouchers.map((v) => ({
      id: v.id,
      code: v.code,
      planId: v.planId,
      planName: v.plan?.name || null,
      guestId: v.guestId || null,
      guestName: v.guestId ? (guestMap.get(v.guestId) || null) : null,
      status: v.status,
      isUsed: v.isUsed,
      validFrom: v.validFrom.toISOString(),
      validUntil: v.validUntil.toISOString(),
      usedAt: v.usedAt ? v.usedAt.toISOString() : null,
      issuedTo: v.issuedTo || null,
      issuedAt: v.issuedAt ? v.issuedAt.toISOString() : null,
      notes: v.notes || null,
      propertyId: resolvedPropertyId || property?.id || null,
      propertyName: property?.name || null,
      createdAt: v.createdAt.toISOString(),
    }));

    // ── Assemble response ──
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total,
          active,
          used,
          expired,
          revoked,
          redemptionRate,
          expiringSoon,
        },
        planBreakdown,
        vouchers: formattedVouchers,
      },
    });
  } catch (error) {
    console.error('Error fetching voucher report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch voucher report' } },
      { status: 500 }
    );
  }
}
