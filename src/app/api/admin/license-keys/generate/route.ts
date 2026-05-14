import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// Plan prefix mapping
const PLAN_PREFIXES: Record<string, string> = {
  trial: 'TRIAL',
  starter: 'STRT',
  professional: 'PROF',
  enterprise: 'ENTR',
};

function generateLicenseKey(planPrefix: string): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const random2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `STS-${planPrefix}-${year}-${random1}-${random2}`;
}

// POST /api/admin/license-keys/generate (AUTH REQUIRED)
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await db.session.findFirst({
      where: { token: sessionToken, expiresAt: { gt: new Date() } },
      include: { user: { include: { tenant: true } } },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Platform admin only
    if (!session.user.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Platform admin access required' } },
        { status: 403 }
      );
    }

    const { planId, count = 1, note, generatedFor, expiresInDays } = await request.json();

    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    if (count < 1 || count > 100) {
      return NextResponse.json(
        { success: false, error: 'Count must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Verify the plan exists
    const plan = await db.registrationPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Get plan prefix
    const planPrefix = PLAN_PREFIXES[plan.name] || plan.name.substring(0, 5).toUpperCase();

    // Generate batch ID
    const batchId = crypto.randomUUID();

    // Calculate expiration date if provided
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    // Generate keys
    const keys: Array<{
      id: string;
      key: string;
      planId: string;
      status: string;
      expiresAt: Date | null;
      batchId: string;
      note: string | null;
      generatedFor: string | null;
    }> = [];

    for (let i = 0; i < count; i++) {
      let licenseKey: string;
      let isUnique = false;
      let attempts = 0;

      // Ensure unique key
      while (!isUnique && attempts < 10) {
        licenseKey = generateLicenseKey(planPrefix);
        const existing = await db.licenseKey.findUnique({ where: { key: licenseKey } });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return NextResponse.json(
          { success: false, error: 'Failed to generate unique license keys. Please try again.' },
          { status: 500 }
        );
      }

      const created = await db.licenseKey.create({
        data: {
          key: licenseKey,
          planId,
          status: 'active',
          generatedBy: session.user.id,
          generatedFor: generatedFor || null,
          note: note || null,
          batchId,
          expiresAt,
        },
      });

      keys.push({
        id: created.id,
        key: created.key,
        planId: created.planId,
        status: created.status,
        expiresAt: created.expiresAt,
        batchId: created.batchId,
        note: created.note,
        generatedFor: created.generatedFor,
      });
    }

    return NextResponse.json({
      success: true,
      keys,
      count: keys.length,
    });
  } catch (error) {
    console.error('License key generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate license keys' },
      { status: 500 }
    );
  }
}
