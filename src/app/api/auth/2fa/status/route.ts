import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const session = await db.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          select: {
            twoFactorEnabled: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Session expired' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      enabled: session.user.twoFactorEnabled,
      message: session.user.twoFactorEnabled
        ? '2FA is enabled'
        : '2FA is not enabled',
    });
  } catch (error) {
    console.error('2FA status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch 2FA status' },
      { status: 500 }
    );
  }
}
