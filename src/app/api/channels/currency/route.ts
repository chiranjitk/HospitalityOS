import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// =====================================================
// Helper: Apply rounding
// =====================================================
function applyRounding(value: number, method: string): number {
  switch (method) {
    case 'up':
      return Math.ceil(value * 100) / 100;
    case 'down':
      return Math.floor(value * 100) / 100;
    case 'nearest':
    default:
      return Math.round(value * 100) / 100;
    case 'none':
      return Math.round(value * 10000) / 10000; // 4 decimal places
  }
}

// =====================================================
// Helper: Convert a single rate
// =====================================================
function convertRate(
  baseRate: number,
  exchangeRate: number,
  markupPercent: number,
  roundingMethod: string
): number {
  const withMarkup = baseRate * (1 + markupPercent / 100);
  const converted = withMarkup * exchangeRate;
  return applyRounding(converted, roundingMethod);
}

// =====================================================
// GET /api/channels/currency - List currency configs
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const channelCode = searchParams.get('channelCode');
    const isActive = searchParams.get('isActive');
    const includeHistory = searchParams.get('include') === 'history';

    const tenantId = ctx.tenantId;

    const where: Record<string, unknown> = { tenantId };

    if (connectionId) where.connectionId = connectionId;
    if (channelCode) where.channelCode = channelCode;
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const configs = await db.channelCurrencyConfig.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: includeHistory
        ? {
            history: {
              orderBy: { effectiveFrom: 'desc' },
              take: 20,
            },
          }
        : undefined,
    });

    // Enrich with connection display names
    const connectionIds = [...new Set(configs.map((c) => c.connectionId).filter(Boolean))] as string[];
    const connections =
      connectionIds.length > 0
        ? await db.channelConnection.findMany({
            where: { id: { in: connectionIds } },
            select: { id: true, displayName: true, channel: true },
          })
        : [];

    const connectionMap = new Map(
      connections.map((c) => [c.id, { displayName: c.displayName || c.channel, channel: c.channel }])
    );

    const enrichedConfigs = configs.map((config) => ({
      ...config,
      connectionDisplayName: connectionMap.get(config.connectionId)?.displayName || 'Unknown',
      connectionChannel: connectionMap.get(config.connectionId)?.channel || null,
    }));

    // Stats
    const allConfigs = await db.channelCurrencyConfig.findMany({
      where: { tenantId },
    });
    const activeCount = allConfigs.filter((c) => c.isActive).length;
    const currenciesUsed = new Set<string>();
    for (const c of allConfigs) {
      currenciesUsed.add(c.sourceCurrency);
      currenciesUsed.add(c.targetCurrency);
    }
    const lastUpdate = allConfigs
      .filter((c) => c.lastRateUpdate)
      .sort((a, b) => new Date(b.lastRateUpdate!).getTime() - new Date(a.lastRateUpdate!).getTime())[0]
      ?.lastRateUpdate || null;

    return NextResponse.json({
      success: true,
      data: enrichedConfigs,
      stats: {
        total: allConfigs.length,
        active: activeCount,
        inactive: allConfigs.length - activeCount,
        currenciesUsed: currenciesUsed.size,
        currenciesList: [...currenciesUsed],
        lastUpdate,
      },
    });
  } catch (error) {
    console.error('Error fetching currency configs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch currency configs' } },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/channels/currency - Create, Convert, Batch-Convert
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { action } = body;

    // ----- Action: convert -----
    if (action === 'convert') {
      const { configId, baseRate, tenantId } = body;

      if (!configId || baseRate === undefined || baseRate === null) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'configId and baseRate are required' } },
          { status: 400 }
        );
      }

      const config = await db.channelCurrencyConfig.findUnique({
        where: { id: configId },
      });

      if (!config || config.tenantId !== ctx.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Currency config not found' } },
          { status: 404 }
        );
      }

      if (!config.isActive) {
        return NextResponse.json(
          { success: false, error: { code: 'INACTIVE', message: 'Currency config is inactive' } },
          { status: 400 }
        );
      }

      const convertedRate = convertRate(
        baseRate,
        config.exchangeRate,
        config.markupPercent,
        config.roundingMethod
      );

      return NextResponse.json({
        success: true,
        data: {
          baseRate,
          sourceCurrency: config.sourceCurrency,
          targetCurrency: config.targetCurrency,
          exchangeRate: config.exchangeRate,
          markupPercent: config.markupPercent,
          roundingMethod: config.roundingMethod,
          convertedRate,
        },
      });
    }

    // ----- Action: batch-convert -----
    if (action === 'batch-convert') {
      const { configId, baseRates, tenantId } = body;

      if (!configId || !Array.isArray(baseRates) || baseRates.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'configId and non-empty baseRates array are required' } },
          { status: 400 }
        );
      }

      const config = await db.channelCurrencyConfig.findUnique({
        where: { id: configId },
      });

      if (!config || config.tenantId !== ctx.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Currency config not found' } },
          { status: 404 }
        );
      }

      if (!config.isActive) {
        return NextResponse.json(
          { success: false, error: { code: 'INACTIVE', message: 'Currency config is inactive' } },
          { status: 400 }
        );
      }

      const convertedRates = baseRates.map((item: { date: string; rate: number }) => ({
        date: item.date,
        baseRate: item.rate,
        convertedRate: convertRate(item.rate, config.exchangeRate, config.markupPercent, config.roundingMethod),
      }));

      return NextResponse.json({
        success: true,
        data: {
          sourceCurrency: config.sourceCurrency,
          targetCurrency: config.targetCurrency,
          exchangeRate: config.exchangeRate,
          markupPercent: config.markupPercent,
          roundingMethod: config.roundingMethod,
          convertedRates,
          totalItems: convertedRates.length,
        },
      });
    }

    // ----- Default: Create new config -----
    const {
      tenantId,
      propertyId,
      connectionId,
      channelCode,
      sourceCurrency,
      targetCurrency,
      conversionType,
      exchangeRate,
      markupPercent,
      roundingMethod,
      rateProvider,
      isActive,
    } = body;

    // SECURITY FIX: Use tenantId from auth context, not from request body
    const effectiveTenantId = ctx.tenantId;

    // SECURITY FIX: Verify connection belongs to tenant
    const connectionCheck = await db.channelConnection.findFirst({
      where: { id: connectionId, tenantId: effectiveTenantId },
    });
    if (!connectionCheck) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found or access denied' } },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!connectionId || !channelCode || !targetCurrency) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'connectionId, channelCode, and targetCurrency are required' } },
        { status: 400 }
      );
    }

    // Validate conversionType
    const validTypes = ['manual', 'auto', 'fixed_rate'];
    if (conversionType && !validTypes.includes(conversionType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid conversionType. Must be one of: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate roundingMethod
    const validRounding = ['nearest', 'up', 'down', 'none'];
    if (roundingMethod && !validRounding.includes(roundingMethod)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid roundingMethod. Must be one of: ${validRounding.join(', ')}` } },
        { status: 400 }
      );
    }

    // Connection already verified above (tenant-isolated)
    const connection = connectionCheck;

    const config = await db.channelCurrencyConfig.create({
      data: {
        tenantId: effectiveTenantId,
        propertyId: propertyId || null,
        connectionId,
        channelCode: channelCode || connection.channel,
        sourceCurrency: sourceCurrency || 'USD',
        targetCurrency,
        conversionType: conversionType || 'manual',
        exchangeRate: exchangeRate !== undefined && exchangeRate !== null ? exchangeRate : 1,
        markupPercent: markupPercent !== undefined && markupPercent !== null ? markupPercent : 0,
        roundingMethod: roundingMethod || 'nearest',
        rateProvider: rateProvider || null,
        isActive: isActive !== undefined ? isActive : true,
        lastRateUpdate: exchangeRate ? new Date() : null,
      },
    });

    // Create initial history entry if exchange rate was set
    if (exchangeRate) {
      await db.channelCurrencyHistory.create({
        data: {
          tenantId: effectiveTenantId,
          configId: config.id,
          sourceCurrency: config.sourceCurrency,
          targetCurrency: config.targetCurrency,
          exchangeRate: config.exchangeRate,
          effectiveFrom: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true, data: config }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in currency POST:', error);
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_CONSTRAINT', message: 'A currency config for this channel connection already exists' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT /api/channels/currency - Update a config
// =====================================================
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { id, changedBy, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Config ID is required' } },
        { status: 400 }
      );
    }

    // SECURITY FIX: Verify config belongs to user's tenant
    const existing = await db.channelCurrencyConfig.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Currency config not found' } },
        { status: 404 }
      );
    }

    const ALLOWED_FIELDS = [
      'propertyId',
      'channelCode',
      'sourceCurrency',
      'targetCurrency',
      'conversionType',
      'exchangeRate',
      'markupPercent',
      'roundingMethod',
      'rateProvider',
      'isActive',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in updates) {
        updateData[field] = updates[field];
      }
    }

    // If exchange rate changed, record in history
    if ('exchangeRate' in updates && updates.exchangeRate !== existing.exchangeRate) {
      // Close the previous history entry
      const lastHistory = await db.channelCurrencyHistory.findFirst({
        where: { configId: id, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (lastHistory) {
        await db.channelCurrencyHistory.update({
          where: { id: lastHistory.id },
          data: { effectiveTo: new Date() },
        });
      }

      // Create new history entry
      await db.channelCurrencyHistory.create({
        data: {
          tenantId: existing.tenantId,
          configId: id,
          sourceCurrency: updates.sourceCurrency || existing.sourceCurrency,
          targetCurrency: updates.targetCurrency || existing.targetCurrency,
          exchangeRate: updates.exchangeRate,
          effectiveFrom: new Date(),
          changedBy: changedBy || null,
        },
      });

      updateData.lastRateUpdate = new Date();
    }

    // Validate conversionType
    if ('conversionType' in updates) {
      const validTypes = ['manual', 'auto', 'fixed_rate'];
      if (!validTypes.includes(updates.conversionType)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid conversionType` } },
          { status: 400 }
        );
      }
    }

    // Validate roundingMethod
    if ('roundingMethod' in updates) {
      const validRounding = ['nearest', 'up', 'down', 'none'];
      if (!validRounding.includes(updates.roundingMethod)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid roundingMethod` } },
          { status: 400 }
        );
      }
    }

    const config = await db.channelCurrencyConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error: unknown) {
    console.error('Error updating currency config:', error);
    const err = error as { code?: string; message?: string };
    if (err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'UNIQUE_CONSTRAINT', message: 'A currency config for this channel connection already exists' } },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update currency config' } },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/channels/currency - Delete a config
// =====================================================
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requirePermission(request, 'channels.manage');
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Config ID is required' } },
        { status: 400 }
      );
    }

    // SECURITY FIX: Verify config belongs to user's tenant
    const existing = await db.channelCurrencyConfig.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Currency config not found' } },
        { status: 404 }
      );
    }

    // Delete related history entries
    await db.channelCurrencyHistory.deleteMany({
      where: { configId: id },
    });

    // Delete the config
    await db.channelCurrencyConfig.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Currency config deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting currency config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete currency config' } },
      { status: 500 }
    );
  }
}
