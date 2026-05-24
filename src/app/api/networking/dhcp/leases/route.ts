import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // GAP-FIX(17b): Added missing permission check
    if (!hasPermission(user, 'networking.view') && !hasPermission(user, 'networking.*')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId, state: 'active' };
    if (propertyId) where.propertyId = propertyId;

    const items = await db.dhcpLease.findMany({
      where,
      include: {
        subnet: { select: { id: true, name: true, subnet: true } },
      },
      orderBy: { leaseEnd: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch DHCP leases' }, { status: 500 });
  }
}
