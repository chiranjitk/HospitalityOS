import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/billing/ap-workflow - AP Workflow
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'billing.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view AP workflow data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const stage = searchParams.get('stage');

    // Mock invoices
    const invoices = [
      { id: 'inv-ap-001', vendorId: 'vnd-001', vendorName: 'FreshFarm Supplies Pvt. Ltd.', invoiceNumber: 'FF-2026-0447', amount: 185000, tax: 33300, total: 218300, currency: 'INR', category: 'Food & Beverage', issueDate: '2026-06-01', dueDate: '2026-06-15', status: 'pending_approval', stage: 'department_review', department: 'F&B', departmentHead: 'Chef Arjun Mehta', costCenter: 'CC-FB-001', paymentTerms: 'Net 15', gstNumber: '27AABCF1234A1Z5', sacCode: '996311', notes: 'Monthly fresh produce supply - June' },
      { id: 'inv-ap-002', vendorId: 'vnd-002', vendorName: 'CleanPro Linens Ltd.', invoiceNumber: 'CPL-2026-0892', amount: 92000, tax: 16560, total: 108560, currency: 'INR', category: 'Housekeeping', issueDate: '2026-05-28', dueDate: '2026-06-12', status: 'pending_approval', stage: 'manager_review', department: 'Housekeeping', departmentHead: 'Sunita Reddy', costCenter: 'CC-HK-001', paymentTerms: 'Net 15', gstNumber: '29AABCL5678B2Z3', sacCode: '998511', notes: 'Linen rental and laundry service - May' },
      { id: 'inv-ap-003', vendorId: 'vnd-003', vendorName: 'TechSolve IT Solutions', invoiceNumber: 'TSI-2026-0156', amount: 45000, tax: 8100, total: 53100, currency: 'INR', category: 'IT & Technology', issueDate: '2026-05-30', dueDate: '2026-06-14', status: 'approved', stage: 'finance_review', department: 'IT', departmentHead: 'Ravi Kumar', costCenter: 'CC-IT-001', paymentTerms: 'Net 15', gstNumber: '06AABCT9012C3Z1', sacCode: '998313', notes: 'Network infrastructure maintenance - May' },
      { id: 'inv-ap-004', vendorId: 'vnd-004', vendorName: 'EcoEnergy Solutions', invoiceNumber: 'EES-2026-0334', amount: 275000, tax: 49500, total: 324500, currency: 'INR', category: 'Utilities', issueDate: '2026-05-25', dueDate: '2026-06-10', status: 'approved', stage: 'ready_for_payment', department: 'Maintenance', departmentHead: 'Vikram Joshi', costCenter: 'CC-MNT-001', paymentTerms: 'Net 30', gstNumber: '07AABCE3456D4Z9', sacCode: '996321', notes: 'Electricity bill - May 2026' },
      { id: 'inv-ap-005', vendorId: 'vnd-005', vendorName: 'AquaPure Water Systems', invoiceNumber: 'APW-2026-0211', amount: 32000, tax: 5760, total: 37760, currency: 'INR', category: 'Utilities', issueDate: '2026-06-02', dueDate: '2026-06-16', status: 'pending_approval', stage: 'department_review', department: 'Maintenance', departmentHead: 'Vikram Joshi', costCenter: 'CC-MNT-001', paymentTerms: 'Net 15', gstNumber: '19AABCA7890E5Z7', sacCode: '996321', notes: 'Water purification filter replacement' },
      { id: 'inv-ap-006', vendorId: 'vnd-006', vendorName: 'WellnessPharma Pvt. Ltd.', invoiceNumber: 'WPP-2026-0078', amount: 28000, tax: 5040, total: 33040, currency: 'INR', category: 'Spa & Wellness', issueDate: '2026-05-29', dueDate: '2026-06-13', status: 'approved', stage: 'finance_review', department: 'Spa', departmentHead: 'Dr. Kavitha Nair', costCenter: 'CC-SPA-001', paymentTerms: 'Net 15', gstNumber: '24AABCW1234F6Z5', sacCode: '996311', notes: 'Spa products and essential oils restock' },
      { id: 'inv-ap-007', vendorId: 'vnd-007', vendorName: 'SecureGuard Services', invoiceNumber: 'SGS-2026-0512', amount: 150000, tax: 27000, total: 177000, currency: 'INR', category: 'Security', issueDate: '2026-06-01', dueDate: '2026-06-15', status: 'rejected', stage: 'returned', department: 'Security', departmentHead: 'Inspector Sharma', costCenter: 'CC-SEC-001', paymentTerms: 'Net 15', gstNumber: '27AABCS5678G7Z3', sacCode: '998511', notes: 'Monthly security services - June (Disputed overtime charges)' },
      { id: 'inv-ap-008', vendorId: 'vnd-008', vendorName: 'PrintMax Media', invoiceNumber: 'PMM-2026-0034', amount: 15000, tax: 2700, total: 17700, currency: 'INR', category: 'Marketing', issueDate: '2026-05-31', dueDate: '2026-06-14', status: 'paid', stage: 'completed', department: 'Marketing', departmentHead: 'Neha Kapoor', costCenter: 'CC-MKT-001', paymentTerms: 'Net 15', gstNumber: '06AABCP9012H8Z1', sacCode: '998313', notes: 'Brochure and banner printing - Summer campaign', paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), paymentRef: 'PAY-2026-0612-001' },
      { id: 'inv-ap-009', vendorId: 'vnd-009', vendorName: 'ComfortAir HVAC', invoiceNumber: 'CAH-2026-0189', amount: 67000, tax: 12060, total: 79060, currency: 'INR', category: 'Maintenance', issueDate: '2026-06-03', dueDate: '2026-06-17', status: 'pending_approval', stage: 'department_review', department: 'Maintenance', departmentHead: 'Vikram Joshi', costCenter: 'CC-MNT-001', paymentTerms: 'Net 30', gstNumber: '33AABCC3456I9Z7', sacCode: '996321', notes: 'AC servicing and refrigerant top-up for floors 3-5' },
      { id: 'inv-ap-010', vendorId: 'vnd-010', vendorName: 'RoyalWines Importers', invoiceNumber: 'RWI-2026-0671', amount: 245000, tax: 44100, total: 289100, currency: 'INR', category: 'Food & Beverage', issueDate: '2026-05-27', dueDate: '2026-06-11', status: 'overdue', stage: 'escalated', department: 'F&B', departmentHead: 'Chef Arjun Mehta', costCenter: 'CC-FB-001', paymentTerms: 'Net 15', gstNumber: '27AABCR7890J1Z5', sacCode: '996311', notes: 'Wine and spirits restock - May (OVERDUE)', daysOverdue: 1 },
    ];

    let filteredInvoices = invoices;
    if (status) filteredInvoices = filteredInvoices.filter(i => i.status === status);
    if (stage) filteredInvoices = filteredInvoices.filter(i => i.stage === stage);

    // Mock approval workflow stages
    const workflowStages = [
      { id: 'stage-1', name: 'Department Review', order: 1, description: 'Department head verifies goods/services received', approverRole: 'department_head', avgTurnaroundHours: 8, currentInQueue: 4, slas: { warning: 24, breach: 48 } },
      { id: 'stage-2', name: 'Manager Review', order: 2, description: 'Operations manager validates and approves amounts', approverRole: 'operations_manager', avgTurnaroundHours: 12, currentInQueue: 1, slas: { warning: 36, breach: 72 } },
      { id: 'stage-3', name: 'Finance Review', order: 3, description: 'Finance team verifies GL coding, tax compliance', approverRole: 'finance_manager', avgTurnaroundHours: 16, currentInQueue: 2, slas: { warning: 48, breach: 96 } },
      { id: 'stage-4', name: 'GM/Director Approval', order: 4, description: 'Final approval for invoices above threshold', approverRole: 'general_manager', avgTurnaroundHours: 4, currentInQueue: 0, slas: { warning: 24, breach: 48 }, amountThreshold: 500000 },
      { id: 'stage-5', name: 'Ready for Payment', order: 5, description: 'Invoice approved and scheduled for payment', approverRole: 'accounts_payable', avgTurnaroundHours: 2, currentInQueue: 1, slas: { warning: 12, breach: 24 } },
      { id: 'stage-6', name: 'Payment Processing', order: 6, description: 'Payment executed via bank transfer or cheque', approverRole: 'accounts_payable', avgTurnaroundHours: 24, currentInQueue: 0, slas: { warning: 48, breach: 72 } },
      { id: 'stage-7', name: 'Completed', order: 7, description: 'Payment confirmed and invoice archived', approverRole: null, avgTurnaroundHours: 0, currentInQueue: null, slas: null },
      { id: 'stage-8', name: 'Rejected / Returned', order: -1, description: 'Invoice sent back to vendor for correction', approverRole: null, avgTurnaroundHours: 0, currentInQueue: 1, slas: null },
    ];

    // Mock payment schedule
    const paymentSchedule = [
      { id: 'ps-001', invoiceId: 'inv-ap-004', vendorName: 'EcoEnergy Solutions', amount: 324500, dueDate: '2026-06-10', scheduledDate: '2026-06-10', paymentMethod: 'bank_transfer', bankAccount: 'HDFC - Current A/C', status: 'scheduled', priority: 'high', daysUntilDue: -2 },
      { id: 'ps-002', invoiceId: 'inv-ap-010', vendorName: 'RoyalWines Importers', amount: 289100, dueDate: '2026-06-11', scheduledDate: '2026-06-11', paymentMethod: 'bank_transfer', bankAccount: 'SBI - Current A/C', status: 'overdue', priority: 'critical', daysUntilDue: -1 },
      { id: 'ps-003', invoiceId: 'inv-ap-002', vendorName: 'CleanPro Linens Ltd.', amount: 108560, dueDate: '2026-06-12', scheduledDate: '2026-06-12', paymentMethod: 'bank_transfer', bankAccount: 'HDFC - Current A/C', status: 'scheduled', priority: 'medium', daysUntilDue: 1 },
      { id: 'ps-004', invoiceId: 'inv-ap-006', vendorName: 'WellnessPharma Pvt. Ltd.', amount: 33040, dueDate: '2026-06-13', scheduledDate: '2026-06-13', paymentMethod: 'bank_transfer', bankAccount: 'ICICI - Current A/C', status: 'scheduled', priority: 'low', daysUntilDue: 2 },
      { id: 'ps-005', invoiceId: 'inv-ap-003', vendorName: 'TechSolve IT Solutions', amount: 53100, dueDate: '2026-06-14', scheduledDate: '2026-06-14', paymentMethod: 'upi', bankAccount: null, status: 'pending_approval', priority: 'low', daysUntilDue: 3 },
      { id: 'ps-006', invoiceId: 'inv-ap-001', vendorName: 'FreshFarm Supplies Pvt. Ltd.', amount: 218300, dueDate: '2026-06-15', scheduledDate: '2026-06-15', paymentMethod: 'bank_transfer', bankAccount: 'HDFC - Current A/C', status: 'pending_approval', priority: 'medium', daysUntilDue: 4 },
      { id: 'ps-007', invoiceId: 'inv-ap-005', vendorName: 'AquaPure Water Systems', amount: 37760, dueDate: '2026-06-16', scheduledDate: '2026-06-16', paymentMethod: 'bank_transfer', bankAccount: 'SBI - Current A/C', status: 'pending_approval', priority: 'low', daysUntilDue: 5 },
      { id: 'ps-008', invoiceId: 'inv-ap-009', vendorName: 'ComfortAir HVAC', amount: 79060, dueDate: '2026-06-17', scheduledDate: '2026-06-17', paymentMethod: 'cheque', bankAccount: null, status: 'pending_approval', priority: 'low', daysUntilDue: 6 },
    ];

    // Mock documents
    const documents = [
      { id: 'doc-001', invoiceId: 'inv-ap-001', type: 'invoice_original', fileName: 'FF-2026-0447.pdf', fileSize: 245000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), uploadedBy: 'Rajesh Pandey', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-001/original.pdf' },
      { id: 'doc-002', invoiceId: 'inv-ap-001', type: 'grn', fileName: 'GRN-FF-2026-0447.pdf', fileSize: 189000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), uploadedBy: 'Amit Kumar (Stores)', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-001/grn.pdf' },
      { id: 'doc-003', invoiceId: 'inv-ap-002', type: 'invoice_original', fileName: 'CPL-2026-0892.pdf', fileSize: 198000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), uploadedBy: 'Rajesh Pandey', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-002/original.pdf' },
      { id: 'doc-004', invoiceId: 'inv-ap-003', type: 'invoice_original', fileName: 'TSI-2026-0156.pdf', fileSize: 156000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(), uploadedBy: 'Rajesh Pandey', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-003/original.pdf' },
      { id: 'doc-005', invoiceId: 'inv-ap-003', type: 'work_order', fileName: 'WO-Network-Maintenance-May.pdf', fileSize: 312000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(), uploadedBy: 'Ravi Kumar', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-003/work-order.pdf' },
      { id: 'doc-006', invoiceId: 'inv-ap-004', type: 'invoice_original', fileName: 'EES-2026-0334.pdf', fileSize: 421000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(), uploadedBy: 'Rajesh Pandey', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-004/original.pdf' },
      { id: 'doc-007', invoiceId: 'inv-ap-004', type: 'meter_reading', fileName: 'Meter-Reading-May-2026.jpg', fileSize: 1250000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(), uploadedBy: 'Vikram Joshi', mimeType: 'image/jpeg', url: '/documents/ap/inv-ap-004/meter.jpg' },
      { id: 'doc-008', invoiceId: 'inv-ap-007', type: 'invoice_original', fileName: 'SGS-2026-0512.pdf', fileSize: 167000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(), uploadedBy: 'Rajesh Pandey', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-007/original.pdf' },
      { id: 'doc-009', invoiceId: 'inv-ap-007', type: 'dispute_note', fileName: 'Dispute-SGS-Overtime-Charges.pdf', fileSize: 89000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), uploadedBy: 'Inspector Sharma', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-007/dispute.pdf' },
      { id: 'doc-010', invoiceId: 'inv-ap-008', type: 'invoice_original', fileName: 'PMM-2026-0034.pdf', fileSize: 134000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(), uploadedBy: 'Rajesh Pandey', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-008/original.pdf' },
      { id: 'doc-011', invoiceId: 'inv-ap-008', type: 'payment_receipt', fileName: 'PAY-2026-0612-001.pdf', fileSize: 98000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), uploadedBy: 'System (Auto)', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-008/receipt.pdf' },
      { id: 'doc-012', invoiceId: 'inv-ap-009', type: 'invoice_original', fileName: 'CAH-2026-0189.pdf', fileSize: 201000, uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), uploadedBy: 'Rajesh Pandey', mimeType: 'application/pdf', url: '/documents/ap/inv-ap-009/original.pdf' },
    ];

    const stats = {
      totalInvoices: invoices.length,
      pendingApproval: invoices.filter(i => i.status === 'pending_approval').length,
      approved: invoices.filter(i => i.status === 'approved').length,
      paid: invoices.filter(i => i.status === 'paid').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      rejected: invoices.filter(i => i.status === 'rejected').length,
      totalPayable: invoices.filter(i => i.status !== 'paid' && i.status !== 'rejected').reduce((sum, i) => sum + i.total, 0),
      overdueAmount: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.total, 0),
      avgApprovalTimeHours: 28,
      approvalRate: 85.7,
      documentsAttached: documents.length,
      scheduledPayments: paymentSchedule.filter(p => p.status === 'scheduled').length,
      nextPaymentDue: paymentSchedule.sort((a, b) => a.daysUntilDue - b.daysUntilDue).find(p => p.status !== 'completed')?.vendorName || null,
    };

    return NextResponse.json({
      success: true,
      data: {
        invoices: filteredInvoices,
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
