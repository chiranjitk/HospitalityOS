import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { z } from 'zod';

// FIX (L-1): Added auto-fetch for exchange rates

const EXCHANGE_API_URL = 'https://open.er-api.com/v6/latest';

/**
 * POST /api/billing/exchange-rates/auto-fetch
 *
 * Fetches live exchange rates from the Open Exchange Rates API (free, no API key needed)
 * and stores them in the database.
 *
 * Request body:
 *   - baseCurrency (required): The base currency code (e.g., "EUR", "USD")
 *   - targetCurrency (optional): A specific target currency to fetch. If omitted,
 *     all available currencies from the API are stored.
 *
 * The API returns rates relative to the base currency. Each rate is stored as:
 *   - fromCurrency: baseCurrency
 *   - toCurrency: the target currency code
 *   - rate: the exchange rate
 *   - source: "auto"
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['billing.manage', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const tenantId = user.tenantId;

    const body = await request.json();
    const parsed = z.object({
      baseCurrency: z.string().min(3).max(3).default('EUR'),
      targetCurrency: z.string().min(3).max(3).optional(),
    }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request. baseCurrency must be a 3-letter code.' } },
        { status: 400 }
      );
    }

    const { baseCurrency, targetCurrency } = parsed.data;
    const base = baseCurrency.toUpperCase();

    // Fetch live rates from Open Exchange Rates API
    const apiUrl = `${EXCHANGE_API_URL}/${base}`;
    console.log(`[ExchangeRates AutoFetch] Fetching rates from ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15-second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ExchangeRates AutoFetch] API returned ${response.status}: ${errorText}`);
      return NextResponse.json(
        { success: false, error: { code: 'API_ERROR', message: `Exchange rate API returned status ${response.status}` } },
        { status: 502 }
      );
    }

    const apiData = await response.json();

    if (apiData.result !== 'success' || !apiData.rates) {
      console.error('[ExchangeRates AutoFetch] API response indicates failure:', apiData);
      return NextResponse.json(
        { success: false, error: { code: 'API_ERROR', message: 'Exchange rate API returned unsuccessful result' } },
        { status: 502 }
      );
    }

    const rates: Record<string, number> = apiData.rates;
    const lastUpdate = apiData.time_last_update_utc
      ? new Date(apiData.time_last_update_utc)
      : new Date();

    // Determine which currencies to store
    const targets = targetCurrency
      ? [targetCurrency.toUpperCase()]
      : Object.keys(rates);

    // Deactivate existing auto rates for the base currency
    await db.exchangeRate.updateMany({
      where: {
        tenantId,
        fromCurrency: base,
        source: 'auto',
        isActive: true,
      },
      data: { isActive: false },
    });

    // Store the new rates in the database
    const createdRates = [];
    const skippedCurrencies = [];

    for (const target of targets) {
      if (target === base) continue; // Skip self-referencing rate (always 1)

      const rate = rates[target];
      if (typeof rate !== 'number' || rate <= 0) {
        skippedCurrencies.push(target);
        continue;
      }

      // Deactivate any existing active rate for this pair
      await db.exchangeRate.updateMany({
        where: {
          tenantId,
          fromCurrency: base,
          toCurrency: target,
          isActive: true,
        },
        data: { isActive: false },
      });

      const exchangeRate = await db.exchangeRate.create({
        data: {
          tenantId,
          fromCurrency: base,
          toCurrency: target,
          rate: Math.round(rate * 1000000) / 1000000,
          source: 'auto',
          validFrom: lastUpdate,
          validUntil: null,
          isActive: true,
        },
      });

      createdRates.push(exchangeRate);
    }

    return NextResponse.json({
      success: true,
      data: {
        baseCurrency: base,
        lastUpdate,
        ratesCount: createdRates.length,
        rates: createdRates,
      },
      meta: {
        apiSource: 'open.er-api.com',
        ...(skippedCurrencies.length > 0 ? { skippedCurrencies } : {}),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      console.error('[ExchangeRates AutoFetch] Request timed out');
      return NextResponse.json(
        { success: false, error: { code: 'TIMEOUT', message: 'Exchange rate API request timed out' } },
        { status: 504 }
      );
    }

    console.error('[ExchangeRates AutoFetch] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch exchange rates' } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/billing/exchange-rates/auto-fetch
 *
 * Returns the current auto-fetched exchange rates from the database.
 *
 * Query parameters:
 *   - baseCurrency: Filter by base currency code
 *   - targetCurrency: Filter by target currency code
 *   - activeOnly: If "true", returns only active rates (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['billing.manage', 'billing.view', 'admin.billing', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const tenantId = user.tenantId;
    const { searchParams } = request.nextUrl;
    const baseCurrency = searchParams.get('baseCurrency');
    const targetCurrency = searchParams.get('targetCurrency');
    const activeOnly = searchParams.get('activeOnly') !== 'false'; // default true

    const where: Record<string, unknown> = {
      tenantId,
      source: 'auto',
    };

    if (baseCurrency) where.fromCurrency = baseCurrency.toUpperCase();
    if (targetCurrency) where.toCurrency = targetCurrency.toUpperCase();
    if (activeOnly) where.isActive = true;

    const rates = await db.exchangeRate.findMany({
      where,
      orderBy: [{ validFrom: 'desc' }, { fromCurrency: 'asc' }, { toCurrency: 'asc' }],
    });

    // Build a summary of unique base currencies and their latest fetch times
    const baseCurrencies = await db.exchangeRate.groupBy({
      by: ['fromCurrency'],
      where: { tenantId, source: 'auto', isActive: true },
      _max: { validFrom: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: rates,
      summary: {
        totalRates: rates.length,
        baseCurrencies: baseCurrencies.map(bc => ({
          base: bc.fromCurrency,
          lastFetched: bc._max.validFrom,
          targetCount: bc._count,
        })),
      },
    });
  } catch (error) {
    console.error('[ExchangeRates AutoFetch GET] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch auto exchange rates' } },
      { status: 500 }
    );
  }
}
