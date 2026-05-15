import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getClientIp } from '@/lib/ip-whitelist/utils';
import { checkIpAccess } from '@/lib/ip-whitelist/middleware';

// POST /api/security/ip-check — Check if a client IP is allowed before login
// Body: { email: string } (to resolve tenant)
// Returns: { allowed: boolean, reason: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Email is required' } },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        status: 'active',
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        isPlatformAdmin: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        data: { allowed: true, reason: '' },
      });
    }

    if (user.isPlatformAdmin) {
      return NextResponse.json({
        success: true,
        data: { allowed: true, reason: '' },
      });
    }

    const clientIp = getClientIp(request);
    const result = await checkIpAccess(user.tenantId, clientIp);

    return NextResponse.json({
      success: true,
      data: {
        allowed: result.allowed,
        reason: result.reason,
      },
    });
  } catch (error) {
    console.error('Error checking IP access:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check IP access' } },
      { status: 500 }
    );
  }
}
