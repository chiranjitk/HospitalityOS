import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/campaigns/[id]/ab-test - Get A/B test results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'marketing.view');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const variants = await db.campaignAbTest.findMany({
      where: {
        campaignId: id,
        tenantId: user.tenantId,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (variants.length === 0) {
      return NextResponse.json({
        success: true,
        data: { variants: [], totalSent: 0, hasWinner: false },
      });
    }

    const totalSent = variants.reduce((acc, v) => acc + v.sentCount, 0);
    const hasWinner = variants.some(v => v.isWinner);

    const enrichedVariants = variants.map(v => ({
      ...v,
      openRate: v.sentCount > 0 ? ((v.openedCount / v.sentCount) * 100).toFixed(2) : '0.00',
      clickRate: v.sentCount > 0 ? ((v.clickedCount / v.sentCount) * 100).toFixed(2) : '0.00',
      conversionRate: v.sentCount > 0 ? ((v.conversionCount / v.sentCount) * 100).toFixed(2) : '0.00',
      splitPercentageOfTotal: totalSent > 0 ? ((v.sentCount / totalSent) * 100).toFixed(1) : '0.0',
    }));

    // Calculate statistical significance between top 2 variants
    let significance = null;
    if (variants.length >= 2) {
      const sorted = [...variants].sort((a, b) => {
        const rateA = a.sentCount > 0 ? a.clickedCount / a.sentCount : 0;
        const rateB = b.sentCount > 0 ? b.clickedCount / b.sentCount : 0;
        return rateB - rateA;
      });

      const winner = sorted[0];
      const runner = sorted[1];

      if (winner.sentCount > 0 && runner.sentCount > 0) {
        const p1 = winner.clickedCount / winner.sentCount;
        const p2 = runner.clickedCount / runner.sentCount;
        const pooledP = (winner.clickedCount + runner.clickedCount) / (winner.sentCount + runner.sentCount);
        const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / winner.sentCount + 1 / runner.sentCount));
        const zScore = se > 0 ? Math.abs(p1 - p2) / se : 0;
        // zScore > 1.96 means 95% confidence
        significance = {
          zScore: zScore.toFixed(2),
          isSignificant: zScore > 1.96,
          confidenceLevel: zScore > 2.576 ? '99%' : zScore > 1.96 ? '95%' : zScore > 1.645 ? '90%' : 'Not significant',
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        variants: enrichedVariants,
        totalSent,
        hasWinner,
        significance,
      },
    });
  } catch (error) {
    console.error('Error fetching A/B test results:', error);
    return NextResponse.json({ error: 'Failed to fetch A/B test results' }, { status: 500 });
  }
}

// POST /api/campaigns/[id]/ab-test - Create A/B test variant or declare winner
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'marketing.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'winner') {
      // Declare winning variant
      const { variantId } = data;
      if (!variantId) {
        return NextResponse.json({ error: 'variantId is required' }, { status: 400 });
      }

      // Clear previous winner
      await db.campaignAbTest.updateMany({
        where: { campaignId: id, tenantId: user.tenantId },
        data: { isWinner: false },
      });

      // Set new winner
      const winner = await db.campaignAbTest.update({
        where: { id: variantId, tenantId: user.tenantId },
        data: { isWinner: true, declaredAt: new Date() },
      });

      return NextResponse.json({ success: true, data: winner });
    }

    // Create a new variant
    const { variantLabel, variantName, subject, content, splitPercentage } = data;

    if (!variantLabel || !variantName || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: variantLabel, variantName, content' },
        { status: 400 }
      );
    }

    // Check if variant label already exists
    const existing = await db.campaignAbTest.findFirst({
      where: { campaignId: id, variantLabel, tenantId: user.tenantId },
    });

    if (existing) {
      return NextResponse.json({ error: 'Variant label already exists for this campaign' }, { status: 400 });
    }

    const variant = await db.campaignAbTest.create({
      data: {
        tenantId: user.tenantId,
        campaignId: id,
        variantLabel,
        variantName,
        subject: subject || null,
        content,
        splitPercentage: splitPercentage || 50,
      },
    });

    return NextResponse.json({ success: true, data: variant });
  } catch (error) {
    console.error('Error creating A/B test variant:', error);
    return NextResponse.json({ error: 'Failed to create A/B test variant' }, { status: 500 });
  }
}

// PUT /api/campaigns/[id]/ab-test - Update variant allocation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'crm.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();
    const { variantId, variantName, subject, content, splitPercentage } = body;

    if (!variantId) {
      return NextResponse.json({ error: 'variantId is required' }, { status: 400 });
    }

    const variant = await db.campaignAbTest.update({
      where: { id: variantId, tenantId: user.tenantId },
      data: {
        ...(variantName && { variantName }),
        ...(subject !== undefined && { subject }),
        ...(content && { content }),
        ...(splitPercentage !== undefined && { splitPercentage }),
      },
    });

    return NextResponse.json({ success: true, data: variant });
  } catch (error) {
    console.error('Error updating A/B test variant:', error);
    return NextResponse.json({ error: 'Failed to update A/B test variant' }, { status: 500 });
  }
}
