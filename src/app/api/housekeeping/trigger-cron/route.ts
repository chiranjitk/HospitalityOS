import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[trigger-cron] CRON_SECRET environment variable is required in production');
}
const CRON_SECRET_VALUE = CRON_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-cron-secret' : '');

type CronAction = 'recurring-tasks' | 'pm-autotrigger' | 'no-show-detection';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, dryRun = false } = body as { action: CronAction; dryRun?: boolean };

    if (!action || !['recurring-tasks', 'pm-autotrigger', 'no-show-detection'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "recurring-tasks", "pm-autotrigger", or "no-show-detection"' },
        { status: 400 }
      );
    }

    if (!CRON_SECRET_VALUE) {
      return NextResponse.json(
        { success: false, error: 'Cron secret not configured' },
        { status: 403 }
      );
    }

    const cronUrl = `/api/cron/${action}`;
    const cronResponse = await fetch(
      new URL(cronUrl, request.url).toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CRON_SECRET_VALUE}`,
        },
        body: JSON.stringify({ dryRun }),
      }
    );

    const result = await cronResponse.json();

    return NextResponse.json(result, { status: cronResponse.status });
  } catch (error) {
    console.error('[trigger-cron] Error forwarding cron request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to trigger cron job' },
      { status: 500 }
    );
  }
}
