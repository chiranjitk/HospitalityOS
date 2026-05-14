import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { checkModuleLimit, checkConcurrentUsers, checkRoomLimit } from '@/lib/license-enforcement';

// POST - Check license for a specific module
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { moduleKey } = body;

    if (!moduleKey) {
      return NextResponse.json(
        { success: false, error: 'moduleKey is required' },
        { status: 400 }
      );
    }

    let result;

    if (moduleKey === 'wifi') {
      // Special handling for wifi concurrent user check
      result = await checkConcurrentUsers(tenantId);
    } else if (moduleKey === 'rooms' || moduleKey === '__rooms__') {
      result = await checkRoomLimit(tenantId);
    } else {
      result = await checkModuleLimit(tenantId, moduleKey);
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error checking license:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check license' },
      { status: 500 }
    );
  }
}
