import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { getCurrencySymbol } from '@/lib/currencies';
import { auditLogService } from '@/lib/services/audit-service';

// GET - Get tax and currency settings
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Parse settings from tenant
    let tenantSettings: Record<string, unknown> = {};
    try {
      tenantSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
    } catch {
      tenantSettings = {};
    }

    // Get currency from tenant - default to INR
    const defaultCurrency = tenant.currency || 'INR';

    // Fetch real-time exchange rates
    let exchangeRates: Array<{ code: string; name: string; symbol: string; rate: number }> = [];
    let ratesLastUpdated: string | null = null;
    let isRealTimeRates = false;

    try {
      // ALWAYS use localhost for internal server-side fetches — avoids ECONNREFUSED
      // when APP_URL points to a public IP / reverse proxy without port info
      const port = process.env.PORT || 3000;
      const internalUrl = `http://localhost:${port}`;
      const ratesResponse = await fetch(`${internalUrl}/api/exchange-rates?base=${defaultCurrency}`);
      const ratesData = await ratesResponse.json();
      
      if (ratesData.success) {
        exchangeRates = ratesData.data.supportedCurrencies.map((c: { code: string; name: string; symbol: string; rate: number }) => ({
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          rate: c.rate,
        }));
        ratesLastUpdated = ratesData.data.lastUpdated;
        isRealTimeRates = ratesData.data.isRealTime;
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      // Use fallback rates
      exchangeRates = [
        { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 83.12 },
        { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1 },
        { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.92 },
        { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.79 },
        { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate: 3.67 },
        { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rate: 1.34 },
        { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rate: 1.53 },
        { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate: 149.50 },
      ];
    }

    // Default settings with tenant customization
    const settings = {
      currency: {
        default: defaultCurrency,
        symbol: getCurrencySymbol(defaultCurrency),
        position: (tenantSettings.currencyPosition as string) || 'before',
        decimalPlaces: (tenantSettings.currencyDecimalPlaces as number) ?? 2,
        thousandSeparator: (tenantSettings.currencyThousandSeparator as string) || ',',
        decimalSeparator: (tenantSettings.currencyDecimalSeparator as string) || '.',
      },
      supportedCurrencies: exchangeRates,
      exchangeRatesLastUpdated: ratesLastUpdated,
      isRealTimeRates,
      taxes: (tenantSettings.taxes as Array<{
        id: string;
        name: string;
        rate: number;
        type: string;
        appliesTo: string;
        included: boolean;
        enabled: boolean;
        priority?: number;
        compound?: boolean;
      }>) || getDefaultTaxes(),
      taxGroups: (tenantSettings.taxGroups as Array<{
        id: string;
        name: string;
        taxes: string[];
        isDefault?: boolean;
      }>) || getDefaultTaxGroups(),
      rounding: (tenantSettings.rounding as {
        method: string;
        precision: number;
      }) || {
        method: 'nearest',
        precision: 0.01,
      },
      taxSettings: (tenantSettings.taxSettings as {
        taxIdNumber?: string;
        taxInclusivePricing?: boolean;
        displayTaxInPrices?: boolean;
        taxRoundingMethod?: 'up' | 'down' | 'nearest';
        taxCalculationBasis?: 'line_item' | 'invoice_total';
      }) || {
        taxIdNumber: '',
        taxInclusivePricing: false,
        displayTaxInPrices: true,
        taxRoundingMethod: 'nearest',
        taxCalculationBasis: 'line_item',
      },
      tenantId,
    };

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching tax/currency settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tax/currency settings' },
      { status: 500 }
    );
  }
}

// PUT - Update tax and currency settings
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { currency, taxes, taxGroups, rounding, taxSettings } = body;

    // Wrap read-modify-write in a transaction to prevent race conditions
    await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId, deletedAt: null },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Update tenant with new settings
      const currentSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
      const newSettings = {
        ...currentSettings,
        currencyPosition: currency?.position,
        currencyDecimalPlaces: currency?.decimalPlaces,
        currencyThousandSeparator: currency?.thousandSeparator,
        currencyDecimalSeparator: currency?.decimalSeparator,
        taxes: taxes,
        taxGroups: taxGroups,
        rounding: rounding,
        taxSettings: taxSettings,
      };

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          currency: currency?.default,
          settings: JSON.stringify(newSettings),
          updatedAt: new Date(),
        },
      });
    });

    // Audit log
    try {
      await auditLogService.logWithContext({ tenantId: user.tenantId, userId: user.id, module: 'settings', action: 'update', entityType: 'tax_currency_settings', description: 'Updated tax and currency settings' }, request);
    } catch (auditErr) {
      console.error('Audit log failed (non-blocking):', auditErr);
    }

    return NextResponse.json({
      success: true,
      data: { tenantId, currency, taxes, taxGroups, rounding, taxSettings },
      message: 'Tax and currency settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating tax/currency settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update tax/currency settings' },
      { status: 500 }
    );
  }
}

// POST - Add new tax
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { tax } = body;

    // Validate required fields
    if (!tax?.name || tax?.rate === undefined) {
      return NextResponse.json(
        { success: false, error: 'Tax name and rate are required' },
        { status: 400 }
      );
    }

    // Validate tax rate is a non-negative finite number
    const parsedRate = parseFloat(tax.rate);
    if (isNaN(parsedRate) || parsedRate < 0 || !Number.isFinite(parsedRate) || parsedRate > 100) {
      return NextResponse.json(
        { success: false, error: 'Tax rate must be a number between 0 and 100' },
        { status: 400 }
      );
    }

    // Validate currency code format if currency is being changed
    if (tax?.currencyDefault) {
      if (!/^[A-Z]{3}$/.test(tax.currencyDefault)) {
        return NextResponse.json(
          { success: false, error: 'Currency must be a valid 3-letter ISO code' },
          { status: 400 }
        );
      }
    }

    // Wrap read-modify-write in a transaction to prevent race conditions
    let newTax: {
      id: string; name: string; rate: number; type: string;
      appliesTo: string; included: boolean; enabled: boolean;
      priority: number; compound: boolean;
    };

    await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId, deletedAt: null },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const currentSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
      const currentTaxes = (currentSettings.taxes as Array<{
        id: string;
        name: string;
        rate: number;
        type: string;
        appliesTo: string;
        included: boolean;
        enabled: boolean;
        priority: number;
        compound: boolean;
      }>) || getDefaultTaxes();

      // Create new tax with unique ID
      newTax = {
        id: uuidv4(),
        name: tax.name,
        rate: parsedRate,
        type: tax.type || 'percentage',
        appliesTo: tax.appliesTo || 'all',
        included: tax.included ?? false,
        enabled: tax.enabled ?? true,
        priority: tax.priority ?? currentTaxes.length,
        compound: tax.compound ?? false,
      };

      currentTaxes.push(newTax);
      currentSettings.taxes = currentTaxes;

      // Audit log
      try {
        await auditLogService.logWithContext({ tenantId: user.tenantId, userId: user.id, module: 'settings', action: 'create', entityType: 'tax', entityId: newTax.id, newValue: { name: newTax.name, rate: newTax.rate, appliesTo: newTax.appliesTo }, description: `Created tax: ${newTax.name}` }, request);
      } catch (auditErr) {
        console.error('Audit log failed (non-blocking):', auditErr);
      }

      // Auto-populate: assign the new tax to relevant tax groups based on appliesTo
      const currentTaxGroups = (currentSettings.taxGroups as Array<{
        id: string;
        name: string;
        taxes: string[];
        isDefault?: boolean;
      }>) || getDefaultTaxGroups();

      const appliesToMapping: Record<string, string[]> = {
        all: ['Room Rates', 'Food & Beverage', 'Spa Services', 'Events & Conferences'],
        room: ['Room Rates'],
        food: ['Food & Beverage'],
        beverage: ['Food & Beverage'],
        service: ['Room Rates', 'Food & Beverage', 'Spa Services', 'Events & Conferences'],
      };

      const targetGroups = appliesToMapping[newTax.appliesTo] || appliesToMapping['all'];

      for (const group of currentTaxGroups) {
        if (targetGroups.includes(group.name) && newTax.enabled) {
          if (!group.taxes.includes(newTax.id)) {
            group.taxes.push(newTax.id);
          }
        }
      }
      currentSettings.taxGroups = currentTaxGroups;

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          settings: JSON.stringify(currentSettings),
          updatedAt: new Date(),
        },
      });
    });

    return NextResponse.json({
      success: true,
      data: newTax,
      message: 'Tax created successfully',
    });
  } catch (error) {
    console.error('Error creating tax:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create tax' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a tax
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const taxId = searchParams.get('taxId');

    if (!taxId) {
      return NextResponse.json(
        { success: false, error: 'Tax ID is required' },
        { status: 400 }
      );
    }

    // Wrap read-modify-write in a transaction to prevent race conditions
    await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId, deletedAt: null },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const currentSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
      const currentTaxes = (currentSettings.taxes as Array<{ id: string }>) || [];

      // Remove the tax
      currentSettings.taxes = currentTaxes.filter(t => t.id !== taxId);

      // Also remove from tax groups
      const currentTaxGroups = (currentSettings.taxGroups as Array<{
        id: string;
        name: string;
        taxes: string[];
      }>) || [];
      currentSettings.taxGroups = currentTaxGroups.map(group => ({
        ...group,
        taxes: group.taxes.filter(id => id !== taxId),
      }));

      // Audit log before deletion
      const deletedTax = currentTaxes.find(t => t.id === taxId);
      try {
        await auditLogService.logWithContext({ tenantId: user.tenantId, userId: user.id, module: 'settings', action: 'delete', entityType: 'tax', entityId: taxId, oldValue: deletedTax, description: `Deleted tax: ${deletedTax?.name || taxId}` }, request);
      } catch (auditErr) {
        console.error('Audit log failed (non-blocking):', auditErr);
      }

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          settings: JSON.stringify(currentSettings),
          updatedAt: new Date(),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Tax deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tax:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete tax' },
      { status: 500 }
    );
  }
}

// PATCH - Update a single tax
export async function PATCH(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { taxId, updates } = body;

    if (!taxId || !updates) {
      return NextResponse.json(
        { success: false, error: 'Tax ID and updates are required' },
        { status: 400 }
      );
    }

    // Validate rate if being updated
    // For 'percentage' type, rate must be 0-100. For 'fixed' type, rate can be any non-negative number.
    if (updates.rate !== undefined) {
      const parsedRate = parseFloat(updates.rate);
      const rateType = updates.type || 'percentage'; // default to percentage if type not specified
      if (isNaN(parsedRate) || parsedRate < 0 || !Number.isFinite(parsedRate)) {
        return NextResponse.json(
          { success: false, error: 'Tax rate must be a non-negative number' },
          { status: 400 }
        );
      }
      if (rateType === 'percentage' && parsedRate > 100) {
        return NextResponse.json(
          { success: false, error: 'Percentage tax rate must be between 0 and 100' },
          { status: 400 }
        );
      }
      if (parsedRate > 999999) {
        return NextResponse.json(
          { success: false, error: 'Tax rate is unreasonably large' },
          { status: 400 }
        );
      }
    }

    // Wrap read-modify-write in a transaction to prevent race conditions
    let updatedTax: { id: string; [key: string]: unknown };

    await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId, deletedAt: null },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const currentSettings = tenant.settings ? JSON.parse(tenant.settings) : {};
      const currentTaxes = (currentSettings.taxes as Array<{
        id: string;
        [key: string]: unknown;
      }>) || getDefaultTaxes();

      // Update the tax
      const taxIndex = currentTaxes.findIndex(t => t.id === taxId);
      if (taxIndex === -1) {
        throw new Error('TAX_NOT_FOUND');
      }

      currentTaxes[taxIndex] = {
        ...currentTaxes[taxIndex],
        ...updates,
        id: taxId, // Ensure ID doesn't change
      };

      currentSettings.taxes = currentTaxes;

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          settings: JSON.stringify(currentSettings),
          updatedAt: new Date(),
        },
      });

      updatedTax = currentTaxes[taxIndex];
    }).catch((error) => {
      if (error instanceof Error && error.message === 'TAX_NOT_FOUND') {
        return; // handled below
      }
      throw error;
    });

    // Check if tax was not found (from transaction error)
    if (!updatedTax) {
      return NextResponse.json(
        { success: false, error: 'Tax not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedTax,
      message: 'Tax updated successfully',
    });
  } catch (error) {
    console.error('Error updating tax:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update tax' },
      { status: 500 }
    );
  }
}

function getDefaultTaxes() {
  return [
    { id: uuidv4(), name: 'GST (18%)', rate: 18, type: 'percentage', appliesTo: 'all', included: true, enabled: true, priority: 1, compound: false },
    { id: uuidv4(), name: 'Luxury Tax', rate: 5, type: 'percentage', appliesTo: 'room', included: false, enabled: true, priority: 2, compound: false },
    { id: uuidv4(), name: 'Service Charge', rate: 10, type: 'percentage', appliesTo: 'food', included: true, enabled: true, priority: 3, compound: false },
    { id: uuidv4(), name: 'State Tax', rate: 12, type: 'percentage', appliesTo: 'room', included: false, enabled: false, priority: 4, compound: false },
    { id: uuidv4(), name: 'VAT', rate: 5, type: 'percentage', appliesTo: 'beverage', included: true, enabled: true, priority: 5, compound: false },
    { id: uuidv4(), name: 'Resort Fee', rate: 500, type: 'fixed', appliesTo: 'room', included: false, enabled: false, priority: 6, compound: false },
  ];
}

function getDefaultTaxGroups() {
  return [
    { id: uuidv4(), name: 'Room Rates', taxes: [], isDefault: true },
    { id: uuidv4(), name: 'Food & Beverage', taxes: [], isDefault: false },
    { id: uuidv4(), name: 'Spa Services', taxes: [], isDefault: false },
    { id: uuidv4(), name: 'Events & Conferences', taxes: [], isDefault: false },
  ];
}
