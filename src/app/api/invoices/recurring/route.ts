import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// Generate invoice number
function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = crypto.randomBytes(4).toString('hex').slice(0, 4);
  return `INV-${year}${month}-${random}`;
}

// Valid recurring frequencies
const VALID_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'];

// Helper: calculate the next date based on frequency
function calculateNextDate(currentDate: Date, frequency: string, endDate?: Date | null): Date | null {
  const next = new Date(currentDate);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      return null;
  }

  // Check if the next date exceeds the end date
  if (endDate && next > endDate) {
    return null;
  }

  return next;
}

// GET /api/invoices/recurring - List all active recurring invoice configurations
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'invoices.view') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // active, paused, all
    const limit = searchParams.get('limit');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      isRecurring: true,
      parentInvoiceId: null, // Only parent (template) invoices
    };

    // "active" = has a future recurringNextDate and not paid/cancelled
    if (status === 'active') {
      where.recurringNextDate = { gte: new Date() };
      where.status = { notIn: ['cancelled'] };
    } else if (status === 'paused') {
      where.recurringNextDate = null;
    }

    const recurringInvoices = await db.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: parseInt(limit, 10) } : {}),
    });

    // For each recurring invoice, count how many child invoices have been generated
    const withCounts = await Promise.all(
      recurringInvoices.map(async (inv) => {
        const childrenCount = await db.invoice.count({
          where: { parentInvoiceId: inv.id },
        });
        let lineItems: unknown[] = [];
        try { lineItems = JSON.parse(inv.lineItems || '[]'); } catch { /* empty */ }
        return {
          ...inv,
          lineItems,
          generatedCount: childrenCount,
          maxOccurrences: inv.recurringEndDate
            ? Math.ceil(
                (inv.recurringEndDate.getTime() - (inv.issuedAt?.getTime() || inv.createdAt.getTime())) /
                (1000 * 60 * 60 * 24)
              )
            : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: withCounts,
      total: withCounts.length,
    });
  } catch (error) {
    console.error('Error fetching recurring invoices:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch recurring invoices' } },
      { status: 500 }
    );
  }
}

// POST /api/invoices/recurring - Create a recurring invoice configuration
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'invoices.create') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      folioId,
      customerName,
      customerEmail,
      customerAddress,
      customerPhone,
      subtotal,
      taxes,
      discount,
      totalAmount,
      currency = 'USD',
      dueAt,
      notes,
      lineItems,
      templateId,
      frequency,
      nextDate,
      endDate,
      maxOccurrences,
    } = body;

    // Validate recurring-specific fields
    if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FREQUENCY', message: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` } },
        { status: 400 }
      );
    }

    if (!customerName?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'customerName is required' } },
        { status: 400 }
      );
    }

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'totalAmount must be greater than 0' } },
        { status: 400 }
      );
    }

    // Verify folio if provided
    if (folioId) {
      const folio = await db.folio.findUnique({ where: { id: folioId } });
      if (!folio || folio.tenantId !== user.tenantId) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
          { status: 404 }
        );
      }
    }

    // Parse nextDate
    const parsedNextDate = nextDate ? new Date(nextDate) : new Date();
    if (isNaN(parsedNextDate.getTime())) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATE', message: 'nextDate is not a valid date' } },
        { status: 400 }
      );
    }

    // Parse endDate if provided
    let parsedEndDate: Date | null = null;
    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_DATE', message: 'endDate is not a valid date' } },
          { status: 400 }
        );
      }
      if (parsedEndDate <= parsedNextDate) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_DATE', message: 'endDate must be after nextDate' } },
          { status: 400 }
        );
      }
    }

    const invoiceNumber = generateInvoiceNumber();

    // Create the parent recurring invoice configuration
    const recurringInvoice = await db.invoice.create({
      data: {
        tenantId: user.tenantId,
        invoiceNumber,
        folioId: folioId || null,
        customerName: customerName.trim(),
        customerEmail: customerEmail || null,
        customerAddress: customerAddress || null,
        customerPhone: customerPhone || null,
        subtotal: subtotal || 0,
        taxes: taxes || 0,
        discount: discount || 0,
        totalAmount,
        currency,
        dueAt: dueAt ? new Date(dueAt) : null,
        notes: notes || null,
        lineItems: JSON.stringify(lineItems || []),
        templateId: templateId || null,
        status: 'draft',
        isRecurring: true,
        recurringFrequency: frequency,
        recurringNextDate: parsedNextDate,
        recurringEndDate: parsedEndDate,
        parentInvoiceId: null,
      },
    });

    let parsedLineItems: unknown[] = [];
    try { parsedLineItems = JSON.parse(recurringInvoice.lineItems || '[]'); } catch { /* empty */ }

    return NextResponse.json({
      success: true,
      data: {
        ...recurringInvoice,
        lineItems: parsedLineItems,
        generatedCount: 0,
      },
    });
  } catch (error) {
    console.error('Error creating recurring invoice:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create recurring invoice' } },
      { status: 500 }
    );
  }
}

// PUT /api/invoices/recurring - Update recurring config (pause, resume, change frequency)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'invoices.update') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, action, frequency, nextDate, endDate, customerName, customerEmail, lineItems, totalAmount, subtotal, taxes } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } },
        { status: 400 }
      );
    }

    // Verify the recurring invoice exists and belongs to the tenant
    const existing = await db.invoice.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Recurring invoice not found' } },
        { status: 404 }
      );
    }

    if (existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } },
        { status: 403 }
      );
    }

    if (!existing.isRecurring) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID', message: 'This invoice is not a recurring configuration' } },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Handle action-based updates
    if (action === 'pause') {
      updateData.recurringNextDate = null;
      updateData.status = 'draft';
    } else if (action === 'resume') {
      if (!existing.recurringNextDate) {
        // Set next date to today if resuming from paused state
        updateData.recurringNextDate = new Date();
      }
      updateData.status = 'issued';
    } else if (action === 'cancel') {
      updateData.isRecurring = false;
      updateData.recurringNextDate = null;
      updateData.status = 'cancelled';
    }

    // Handle field-level updates
    if (frequency && VALID_FREQUENCIES.includes(frequency)) {
      updateData.recurringFrequency = frequency;
    }

    if (nextDate) {
      const parsed = new Date(nextDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_DATE', message: 'nextDate is not valid' } },
          { status: 400 }
        );
      }
      updateData.recurringNextDate = parsed;
    }

    if (endDate !== undefined) {
      if (endDate === null) {
        updateData.recurringEndDate = null;
      } else {
        const parsed = new Date(endDate);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_DATE', message: 'endDate is not valid' } },
            { status: 400 }
          );
        }
        updateData.recurringEndDate = parsed;
      }
    }

    // General invoice field updates
    if (customerName) updateData.customerName = customerName;
    if (customerEmail !== undefined) updateData.customerEmail = customerEmail || null;
    if (lineItems) updateData.lineItems = JSON.stringify(lineItems);
    if (totalAmount) updateData.totalAmount = totalAmount;
    if (subtotal !== undefined) updateData.subtotal = subtotal;
    if (taxes !== undefined) updateData.taxes = taxes;

    const updated = await db.invoice.update({
      where: { id },
      data: updateData,
    });

    let parsedLineItems: unknown[] = [];
    try { parsedLineItems = JSON.parse(updated.lineItems || '[]'); } catch { /* empty */ }

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        lineItems: parsedLineItems,
      },
    });
  } catch (error) {
    console.error('Error updating recurring invoice:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update recurring invoice' } },
      { status: 500 }
    );
  }
}

// POST /api/invoices/recurring?action=generate - Auto-generate invoices due today (cron-style)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // This endpoint can be called by a cron or admin
    if (!hasPermission(user, 'invoices.create') && !hasPermission(user, 'invoices.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const dryRun = searchParams.get('dryRun') === 'true';

    // Find all recurring invoices that are due today or earlier
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueRecurring = await db.invoice.findMany({
      where: {
        tenantId: user.tenantId,
        isRecurring: true,
        parentInvoiceId: null,
        recurringNextDate: { lte: today },
        status: { not: 'cancelled' },
      },
    });

    if (dueRecurring.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          generated: 0,
          skipped: 0,
          message: 'No recurring invoices are due today',
        },
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        data: {
          dryRun: true,
          dueCount: dueRecurring.length,
          invoices: dueRecurring.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customerName,
            totalAmount: inv.totalAmount,
            frequency: inv.recurringFrequency,
            recurringNextDate: inv.recurringNextDate,
          })),
        },
      });
    }

    // Generate invoices for each recurring config
    const generated: Array<{ id: string; invoiceNumber: string; customerName: string; parentId: string }> = [];
    const skipped: Array<{ id: string; invoiceNumber: string; reason: string }> = [];

    for (const parent of dueRecurring) {
      try {
        const childInvoiceNumber = generateInvoiceNumber();
        const dueDate = parent.dueAt
          ? new Date(
              new Date(parent.recurringNextDate!).getTime() +
                (parent.dueAt.getTime() - parent.issuedAt.getTime())
            )
          : null;

        // Create child invoice
        await db.invoice.create({
          data: {
            tenantId: parent.tenantId,
            invoiceNumber: childInvoiceNumber,
            folioId: parent.folioId,
            customerName: parent.customerName,
            customerEmail: parent.customerEmail,
            customerAddress: parent.customerAddress,
            customerPhone: parent.customerPhone,
            subtotal: parent.subtotal,
            taxes: parent.taxes,
            discount: parent.discount,
            totalAmount: parent.totalAmount,
            currency: parent.currency,
            dueAt: dueDate,
            notes: parent.notes,
            lineItems: parent.lineItems, // Copy line items
            templateId: parent.templateId,
            status: 'issued',
            isRecurring: false, // Child is not a recurring config itself
            recurringFrequency: parent.recurringFrequency,
            recurringNextDate: null,
            recurringEndDate: null,
            parentInvoiceId: parent.id,
          },
        });

        // Calculate and update the next recurring date for the parent
        const nextDate = calculateNextDate(
          parent.recurringNextDate!,
          parent.recurringFrequency,
          parent.recurringEndDate
        );

        await db.invoice.update({
          where: { id: parent.id },
          data: {
            recurringNextDate: nextDate,
            // If no next date, the recurring has ended
            ...(nextDate === null ? { isRecurring: false } : {}),
          },
        });

        generated.push({
          id: parent.id,
          invoiceNumber: childInvoiceNumber,
          customerName: parent.customerName,
          parentId: parent.id,
        });
      } catch (error) {
        console.error(`Error generating recurring invoice for ${parent.invoiceNumber}:`, error);
        skipped.push({
          id: parent.id,
          invoiceNumber: parent.invoiceNumber,
          reason: 'Failed to generate child invoice',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        generated: generated.length,
        generatedInvoices: generated,
        skipped: skipped.length,
        skippedInvoices: skipped,
        message: `Generated ${generated.length} invoice(s), skipped ${skipped.length}`,
      },
    });
  } catch (error) {
    console.error('Error running recurring invoice generation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate recurring invoices' } },
      { status: 500 }
    );
  }
}
