import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getClientIp } from '@/lib/ip-whitelist/utils';

// GET /api/settings/ip-whitelist/client-ip — Return the client's IP address
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const clientIp = getClientIp(request);
    return NextResponse.json({ success: true, data: { ip: clientIp } });
  } catch (error) {
    console.error('[Client IP] GET error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
