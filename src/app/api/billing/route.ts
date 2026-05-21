import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/billing - Billing module overview
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'billing.view') && !hasPermission(user, 'billing.*') && !hasPermission(user, 'invoices.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        module: 'billing',
        description: 'Billing and invoicing module for deposits, exchange rates, tax exemptions, AP workflow, and auto-invoicing',
        endpoints: {
          deposits: '/api/billing/deposits',
          exchangeRates: '/api/billing/exchange-rates',
          exchangeRatesConvert: '/api/billing/exchange-rates/convert',
          exchangeRatesAutoFetch: '/api/billing/exchange-rates/auto-fetch',
          financing: '/api/billing/financing',
          financingInstallments: '/api/billing/financing/installments',
          apInvoices: '/api/billing/ap/invoices',
          apWorkflow: '/api/billing/ap-workflow',
          taxExemptions: '/api/billing/tax-exemptions',
          autoInvoice: '/api/billing/auto-invoice',
          routingRules: '/api/billing/routing-rules',
        },
      },
      message: 'Billing module — explore the endpoints above for deposits, exchange rates, financing, AP, and more',
    });
  } catch (error) {
    console.error('Billing overview API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch billing overview' } },
      { status: 500 }
    );
  }
}
