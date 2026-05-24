import { NextRequest, NextResponse } from 'next/server';
import { getNotificationMessages } from '@/lib/i18n-notifications';
import { getUserFromRequest } from '@/lib/auth-helpers';

/**
 * GET /api/notifications/i18n
 * Get notification messages for a specific locale.
 * Supports ?locale=en query parameter.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || 'en';

    const messages = await getNotificationMessages(locale);

    return NextResponse.json({
      locale,
      messages,
      totalKeys: Object.keys(messages).length,
    });
  } catch (error) {
    console.error('[Notifications i18n] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
