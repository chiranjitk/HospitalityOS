import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

// GET /api/billing/ap-workflow — AP Workflow dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view AP workflow data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Fetch invoices with lines
    const invoiceWhere: Record<string, unknown> = { tenantId: user.tenantId };
    if (status) invoiceWhere.status = status;

    const invoices = await db.apInvoice.findMany({
      where: invoiceWhere,
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { invoiceDate: 'desc' },
      take: 200,
    });

    const formattedInvoices = invoices.map(inv => ({
      id: inv.id,
      vendorId: inv.vendorId ?? null,
      vendorName: inv.vendorName,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.subtotal,
      tax: inv.taxAmount,
      total: inv.totalAmount,
      currency: inv.currency,
      category: inv.department ?? null,
      invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
      dueDate: inv.dueDate.toISOString().split('T')[0],
      status: inv.status,
      stage: inv.status === 'pending' ? 'department_review' : inv.status === 'reviewed' ? 'manager_review' : inv.status === 'approved' ? 'finance_review' : inv.status === 'paid' ? 'completed' : inv.status,
      department: inv.department ?? null,
      departmentHead: null,
      costCenter: inv.glAccount ?? null,
      paymentTerms: inv.paymentTerms,
      gstNumber: null,
      sacCode: null,
      notes: inv.notes ?? null,
      paidAt: inv.paidDate?.toISOString() ?? null,
      paymentRef: inv.paymentRef ?? null,
      lines: inv.lines.map(line => ({
        id: line.id,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        totalAmount: line.totalAmount,
        glAccount: line.glAccount ?? null,
      })),
    }));

    // Fetch payments
    const payments = await db.apPayment.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { paymentDate: 'desc' },
      take: 100,
    });

    const paymentSchedule = payments.map(p => ({
      id: p.id,
      invoiceId: p.invoiceId,
      vendorName: null,
      amount: p.amount,
      scheduledDate: p.paymentDate.toISOString().split('T')[0],
      paymentMethod: p.paymentMethod,
      reference: p.reference ?? null,
      bankAccount: p.bankAccountId ?? null,
      status: 'completed',
      priority: 'medium',
      daysUntilDue: 0,
    }));

    // Fetch approvals
    const approvals = await db.documentApproval.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const workflowStages = [
      { id: 'stage-1', name: 'Department Review', order: 1, description: 'Department head verifies goods/services received', approverRole: 'department_head', avgTurnaroundHours: 8, currentInQueue: invoices.filter(i => i.status === 'pending').length, slas: { warning: 24, breach: 48 } },
      { id: 'stage-2', name: 'Manager Review', order: 2, description: 'Operations manager validates and approves amounts', approverRole: 'operations_manager', avgTurnaroundHours: 12, currentInQueue: invoices.filter(i => i.status === 'reviewed').length, slas: { warning: 36, breach: 72 } },
      { id: 'stage-3', name: 'Finance Review', order: 3, description: 'Finance team verifies GL coding, tax compliance', approverRole: 'finance_manager', avgTurnaroundHours: 16, currentInQueue: invoices.filter(i => i.status === 'approved').length, slas: { warning: 48, breach: 96 } },
      { id: 'stage-4', name: 'Ready for Payment', order: 4, description: 'Invoice approved and scheduled for payment', approverRole: 'accounts_payable', avgTurnaroundHours: 2, currentInQueue: invoices.filter(i => i.status === 'approved').length, slas: { warning: 12, breach: 24 } },
      { id: 'stage-5', name: 'Payment Processing', order: 5, description: 'Payment executed via bank transfer or cheque', approverRole: 'accounts_payable', avgTurnaroundHours: 24, currentInQueue: invoices.filter(i => i.status === 'paid').length, slas: { warning: 48, breach: 72 } },
      { id: 'stage-6', name: 'Completed', order: 6, description: 'Payment confirmed and invoice archived', approverRole: null, avgTurnaroundHours: 0, currentInQueue: null, slas: null },
    ];

    const documents: unknown[] = [];

    const stats = {
      totalInvoices: invoices.length,
      pendingApproval: invoices.filter(i => i.status === 'pending').length,
      approved: invoices.filter(i => i.status === 'approved').length,
      paid: invoices.filter(i => i.status === 'paid').length,
      overdue: invoices.filter(i => {
        if (i.status === 'paid' || i.status === 'rejected' || i.status === 'void') return false;
        return new Date(i.dueDate) < new Date();
      }).length,
      rejected: invoices.filter(i => i.status === 'rejected').length,
      totalPayable: invoices.filter(i => !['paid', 'rejected', 'void'].includes(i.status)).reduce((sum, i) => sum + i.totalAmount, 0),
      overdueAmount: invoices.filter(i => {
        if (i.status === 'paid' || i.status === 'rejected' || i.status === 'void') return false;
        return new Date(i.dueDate) < new Date();
      }).reduce((sum, i) => sum + i.totalAmount, 0),
      documentsAttached: documents.length,
      scheduledPayments: paymentSchedule.length,
      nextPaymentDue: paymentSchedule.length > 0 ? paymentSchedule[0].vendorName : null,
    };

    return NextResponse.json({
      success: true,
      data: {
        invoices: formattedInvoices,
        workflowStages,
        paymentSchedule,
        documents,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching AP workflow data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch AP workflow data' } },
      { status: 500 }
    );
  }
}
