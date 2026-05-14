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
  const random1 = Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
  const random2 = Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
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

    // Validate count: must be a positive integer, 1-100
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return NextResponse.json(
        { success: false, error: 'Count must be a positive integer between 1 and 100' },
        { status: 400 }
      );
    }

    // Validate note: if provided, must be a string with max length 500
    if (note !== undefined && note !== null) {
      if (typeof note !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Note must be a string' },
          { status: 400 }
        );
      }
      if (note.length > 500) {
        return NextResponse.json(
          { success: false, error: 'Note must be at most 500 characters' },
          { status: 400 }
        );
      }
    }

    // Validate generatedFor: if provided, must be a string with max length 200
    if (generatedFor !== undefined && generatedFor !== null) {
      if (typeof generatedFor !== 'string') {
        return NextResponse.json(
          { success: false, error: 'generatedFor must be a string' },
          { status: 400 }
        );
      }
      if (generatedFor.length > 200) {
        return NextResponse.json(
          { success: false, error: 'generatedFor must be at most 200 characters' },
          { status: 400 }
        );
      }
    }

    if (expiresInDays !== undefined) {
      if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 3650) {
        return NextResponse.json(
          { success: false, error: 'expiresInDays must be a positive integer between 1 and 3650' },
          { status: 400 }
        );
      }
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

    // Generate keys inside a transaction — if any key creation fails, entire batch rolls back
    const keys = await db.$transaction(async (tx) => {
      const createdKeys: Array<{
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
        let created = false;
        let attempts = 0;
        const maxAttempts = 3;

        // Attempt up to 3 times per key, catching P2002 unique constraint violations
        while (!created && attempts < maxAttempts) {
          licenseKey = generateLicenseKey(planPrefix);
          try {
            const keyRecord = await tx.licenseKey.create({
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

            createdKeys.push({
              id: keyRecord.id,
              key: keyRecord.key,
              planId: keyRecord.planId,
              status: keyRecord.status,
              expiresAt: keyRecord.expiresAt,
              batchId: keyRecord.batchId,
              note: keyRecord.note,
              generatedFor: keyRecord.generatedFor,
            });
            created = true;
          } catch (err: unknown) {
            attempts++;
            // Check for Prisma P2002 unique constraint violation
            if (
              err &&
              typeof err === 'object' &&
              'code' in err &&
              (err as { code: string }).code === 'P2002'
            ) {
              // Collision — retry with a new random key
              continue;
            }
            // Re-throw any other error (will roll back the transaction)
            throw err;
          }
        }

        if (!created) {
          throw new Error('Failed to generate unique license keys after retries. Please try again.');
        }
      }

      return createdKeys;
    });

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
