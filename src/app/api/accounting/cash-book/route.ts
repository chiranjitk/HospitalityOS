import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
  getOrCreateCashBook, addCashEntry, updateCashEntry, deleteCashEntry,
  closeCashBook, approveCashBook, getCashBookHistory, autoPopulateFromPayments,
  getCashBookReport,
} from '@/lib/accounting/cash-book';

// GET /api/accounting/cash-book — Get cash book or history
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    if (!hasAnyPermission(user, ['billing.view', 'billing.manage', 'accounting.view'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const propertyId = searchParams.get('propertyId');
    const dateStr = searchParams.get('date');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'propertyId is required' } }, { status: 400 });
    }

    // History view
    if (action === 'history') {
      const startDate = new Date(searchParams.get('startDate') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
      const endDate = new Date(searchParams.get('endDate') || new Date().toISOString().split('T')[0]);
      const history = await getCashBookHistory(user.tenantId, propertyId, startDate, endDate);
      return NextResponse.json({ success: true, data: history });
    }

    // Auto-populate from payments
    if (action === 'auto-populate') {
      const date = dateStr ? new Date(dateStr) : new Date();
      const result = await autoPopulateFromPayments(user.tenantId, propertyId, date, user.id);
      return NextResponse.json({ success: true, data: result });
    }

    // Report view
    if (action === 'report') {
      const date = dateStr ? new Date(dateStr) : new Date();
      const report = await getCashBookReport(user.tenantId, propertyId, date);
      return NextResponse.json({ success: true, data: report });
    }

    // Default: get cash book for a date
    const date = dateStr ? new Date(dateStr) : new Date();
    const cashBook = await getOrCreateCashBook(user.tenantId, propertyId, date);
    return NextResponse.json({ success: true, data: cashBook });
  } catch (error: any) {
    console.error('[accounting/cash-book GET]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch cash book' } }, { status: 500 });
  }
}

// POST /api/accounting/cash-book — Create entry or close/approve
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Close cash book
    if (action === 'close') {
      if (!hasAnyPermission(user, ['billing.manage'])) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
      }
      const { cashBookId } = body;
      if (!cashBookId) {
        return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'cashBookId is required' } }, { status: 400 });
      }
      const result = await closeCashBook(user.tenantId, cashBookId, user.id);
      return NextResponse.json({ success: true, data: result });
    }

    // Approve cash book
    if (action === 'approve') {
      if (!hasAnyPermission(user, ['billing.manage'])) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
      }
      const { cashBookId } = body;
      if (!cashBookId) {
        return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'cashBookId is required' } }, { status: 400 });
      }
      const result = await approveCashBook(user.tenantId, cashBookId, user.id);
      return NextResponse.json({ success: true, data: result });
    }

    // Add cash entry
    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { cashBookId, time, description, category, amount, reference, paymentMethod } = body;
    if (!cashBookId || !time || !description || !category || !amount) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'cashBookId, time, description, category, and amount are required' } }, { status: 400 });
    }

    const result = await addCashEntry(user.tenantId, cashBookId, {
      time,
      description: String(description).trim().slice(0, 500),
      category,
      amount: Number(parseFloat(amount).toFixed(2)),
      reference: reference ? String(reference).trim().slice(0, 100) : undefined,
      paymentMethod: paymentMethod || 'cash',
      createdBy: user.id,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[accounting/cash-book POST]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to process cash book request' } }, { status: 500 });
  }
}

// PUT /api/accounting/cash-book — Update cash entry
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check for mutation
    if (!hasAnyPermission(user, ['billing.view', 'billing.manage'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const body = await request.json();
    const { transactionId, ...updates } = body;

    if (!transactionId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'transactionId is required' } }, { status: 400 });
    }

    const result = await updateCashEntry(user.tenantId, transactionId, updates);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[accounting/cash-book PUT]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update cash entry' } }, { status: 500 });
  }
}

// DELETE /api/accounting/cash-book — Delete cash entry
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }

    // Permission check for deletion
    if (!hasAnyPermission(user, ['billing.manage'])) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'transactionId is required' } }, { status: 400 });
    }

    const result = await deleteCashEntry(user.tenantId, transactionId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[accounting/cash-book DELETE]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete cash entry' } }, { status: 500 });
  }
}
