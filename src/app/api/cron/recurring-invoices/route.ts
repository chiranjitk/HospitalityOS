import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// Generate invoice number
function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = crypto.randomBytes(4).toString('hex').slice(0, 4);
  return `INV-${year}${month}-${random}`;
}

// Calculate next recurring date based on frequency
function calculateNextDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate);
  switch (frequency) {
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
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

// GET /api/cron/recurring-invoices - Check status
export async function GET() {
  try {
    const now = new Date();
    const pendingCount = await db.invoice.count({
      where: {
        isRecurring: true,
        status: { not: 'cancelled' },
        recurringNextDate: { lte: now },
        recurringEndDate: { or: [{ gte: now }, { equals: null }] },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        pendingCount,
        lastRun: null,
      },
    });
  } catch (error) {
    console.error('Error checking recurring invoices:', error);
    return NextResponse.json({ success: false, error: 'Failed to check' }, { status: 500 });
  }
}

// POST /api/cron/recurring-invoices - Process recurring invoices
export async function POST() {
  try {
    const now = new Date();

    // Find all recurring invoices where next date <= today and not past end date
    const recurringInvoices = await db.invoice.findMany({
      where: {
        isRecurring: true,
        status: { not: 'cancelled' },
        recurringNextDate: { lte: now },
        recurringEndDate: { or: [{ gte: now }, { equals: null }] },
      },
    });

    if (recurringInvoices.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          processed: 0,
          message: 'No recurring invoices due',
        },
      });
    }

    let processed = 0;
    const errors: string[] = [];

    for (const invoice of recurringInvoices) {
      try {
        // Parse line items from parent
        let lineItems: Array<{
          description: string;
          quantity: number;
          unitPrice: number;
          totalAmount: number;
          taxRate: number;
          taxAmount: number;
        }> = [];
        try {
          lineItems = JSON.parse(invoice.lineItems || '[]');
        } catch {
          errors.push(`${invoice.invoiceNumber}: Failed to parse line items`);
          continue;
        }

        // Calculate due date (same offset as original)
        const issuedAt = new Date();
        let dueAt: Date | null = null;
        if (invoice.dueAt && invoice.issuedAt) {
          const diffMs = new Date(invoice.dueAt).getTime() - new Date(invoice.issuedAt).getTime();
          dueAt = new Date(issuedAt.getTime() + diffMs);
        } else {
          dueAt = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        // Create new invoice as copy of original
        const newInvoiceNumber = generateInvoiceNumber();
        const newInvoice = await db.invoice.create({
          data: {
            tenantId: invoice.tenantId,
            invoiceNumber: newInvoiceNumber,
            folioId: invoice.folioId,
            customerName: invoice.customerName,
            customerEmail: invoice.customerEmail,
            customerAddress: invoice.customerAddress,
            customerPhone: invoice.customerPhone,
            subtotal: invoice.subtotal,
            taxes: invoice.taxes,
            discount: invoice.discount,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
            issuedAt,
            dueAt,
            status: 'draft',
            notes: invoice.notes,
            lineItems: invoice.lineItems,
            templateId: invoice.templateId,
            isRecurring: true,
            recurringFrequency: invoice.recurringFrequency,
            recurringNextDate: calculateNextDate(now, invoice.recurringFrequency || 'monthly'),
            recurringEndDate: invoice.recurringEndDate,
            parentInvoiceId: invoice.id,
          },
        });

        // Update parent's next generation date
        await db.invoice.update({
          where: { id: invoice.id },
          data: {
            recurringNextDate: calculateNextDate(now, invoice.recurringFrequency || 'monthly'),
          },
        });

        // Attempt to send email notification with PDF
        if (invoice.customerEmail) {
          try {
            // Import nodemailer lazily to avoid issues
            const nodemailer = await import('nodemailer');
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST || 'localhost',
              port: parseInt(process.env.SMTP_PORT || '587'),
              secure: process.env.SMTP_SECURE === 'true',
              auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || '',
              },
            });

            // Generate PDF for email
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');
            const doc = new jsPDF() as jsPDF & { lastAutoTable: { finalY: number } };
            doc.setFontSize(20);
            doc.setTextColor(16, 185, 129);
            doc.text('INVOICE', 105, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);
            doc.text(newInvoiceNumber, 14, 35);
            doc.text(`Date: ${issuedAt.toLocaleDateString()}`, 14, 42);
            doc.text(`Due: ${dueAt.toLocaleDateString()}`, 14, 49);
            doc.setFontSize(11);
            doc.text(`Bill To: ${invoice.customerName}`, 14, 62);
            if (invoice.customerEmail) doc.text(invoice.customerEmail, 14, 69);

            const tableData = lineItems.map(item => [
              item.description,
              item.quantity.toString(),
              `${invoice.currency} ${item.unitPrice.toFixed(2)}`,
              `${invoice.currency} ${item.totalAmount.toFixed(2)}`,
            ]);

            autoTable(doc, {
              startY: 80,
              head: [['Description', 'Qty', 'Unit Price', 'Total']],
              body: tableData,
              theme: 'striped',
              headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
              styles: { fontSize: 8, cellPadding: 3 },
            });

            const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

            await transporter.sendMail({
              from: process.env.SMTP_FROM || '"StaySuite" <noreply@staysuite.com>',
              to: invoice.customerEmail,
              subject: `New Invoice ${newInvoiceNumber} from StaySuite`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #10b981;">New Invoice Generated</h2>
                  <p>A new recurring invoice <strong>${newInvoiceNumber}</strong> has been generated.</p>
                  <p>Amount: <strong>${invoice.currency} ${invoice.totalAmount.toFixed(2)}</strong></p>
                  <p>Due Date: <strong>${dueAt.toLocaleDateString()}</strong></p>
                  <hr style="border-color: #e5e7eb; margin: 16px 0;" />
                  <p style="color: #6b7280; font-size: 14px;">Please find the invoice PDF attached.</p>
                </div>
              `,
              attachments: [{
                filename: `invoice-${newInvoiceNumber}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
              }],
            });
          } catch (emailError) {
            console.error(`Failed to send email for ${newInvoiceNumber}:`, emailError);
            // Don't fail the whole process just because email failed
          }
        }

        processed++;
      } catch (itemError) {
        console.error(`Error processing recurring invoice ${invoice.invoiceNumber}:`, itemError);
        errors.push(`${invoice.invoiceNumber}: ${(itemError as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed,
        total: recurringInvoices.length,
        errors,
      },
    });
  } catch (error) {
    console.error('Error processing recurring invoices:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process recurring invoices' },
    }, { status: 500 });
  }
}
