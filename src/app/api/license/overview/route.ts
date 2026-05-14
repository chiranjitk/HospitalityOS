import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getTenantLicenseOverview } from '@/lib/license-enforcement';

// GET - Full license overview for tenant dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const overview = await getTenantLicenseOverview(tenantId);

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('Error fetching license overview:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch license overview' },
      { status: 500 }
    );
  }
}
