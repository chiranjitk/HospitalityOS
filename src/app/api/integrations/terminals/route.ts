import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/integrations/terminals - Payment Terminals
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (!hasPermission(user, 'integrations.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view payment terminal data' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const location = searchParams.get('location');

    // Mock terminal registry
    const terminals = [
      { id: 'term-001', serialNumber: 'PPD-4000-8847', name: 'Front Desk Terminal 1', model: 'PAX A920', provider: 'Razorpay', location: 'front_desk', merchantId: 'MRCH_DLY_001', status: 'online', connectionType: 'wifi', ipAddress: '10.0.1.101', batteryLevel: 95, firmwareVersion: '4.5.2', p2peCertified: true, lastTransaction: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
      { id: 'term-002', serialNumber: 'PPD-4000-9201', name: 'Front Desk Terminal 2', model: 'PAX A920', provider: 'Razorpay', location: 'front_desk', merchantId: 'MRCH_DLY_002', status: 'online', connectionType: 'wifi', ipAddress: '10.0.1.102', batteryLevel: 88, firmwareVersion: '4.5.2', p2peCertified: true, lastTransaction: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
      { id: 'term-003', serialNumber: 'VRF-5000-1100', name: 'Restaurant POS Terminal', model: 'Verifone P400', provider: 'Stripe', location: 'restaurant', merchantId: 'MRCH_RST_001', status: 'online', connectionType: 'ethernet', ipAddress: '10.0.2.50', batteryLevel: null, firmwareVersion: '3.8.1', p2peCertified: true, lastTransaction: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
      { id: 'term-004', serialNumber: 'VRF-5000-2200', name: 'Bar POS Terminal', model: 'Verifone P400', provider: 'Stripe', location: 'bar', merchantId: 'MRCH_BAR_001', status: 'online', connectionType: 'ethernet', ipAddress: '10.0.2.51', batteryLevel: null, firmwareVersion: '3.8.1', p2peCertified: true, lastTransaction: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
      { id: 'term-005', serialNumber: 'PPD-4000-5563', name: 'Spa Terminal', model: 'PAX A920', provider: 'Razorpay', location: 'spa', merchantId: 'MRCH_SPA_001', status: 'offline', connectionType: 'wifi', ipAddress: '10.0.3.20', batteryLevel: 12, firmwareVersion: '4.5.0', p2peCertified: true, lastTransaction: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
      { id: 'term-006', serialNumber: 'CLO-6000-7782', name: 'Gift Shop Terminal', model: 'Clover Flex', provider: 'Razorpay', location: 'gift_shop', merchantId: 'MRCH_GFT_001', status: 'online', connectionType: 'wifi', ipAddress: '10.0.4.10', batteryLevel: 72, firmwareVersion: '2.4.0', p2peCertified: true, lastTransaction: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
      { id: 'term-007', serialNumber: 'CLO-6000-3300', name: 'Concierge Mobile Terminal', model: 'Clover Flex', provider: 'Razorpay', location: 'mobile', merchantId: 'MRCH_MBL_001', status: 'online', connectionType: 'cellular', ipAddress: null, batteryLevel: 64, firmwareVersion: '2.4.0', p2peCertified: true, lastTransaction: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
      { id: 'term-008', serialNumber: 'VRF-5000-9901', name: 'Room Service Terminal', model: 'Verifone P400', provider: 'Stripe', location: 'room_service', merchantId: 'MRCH_RS_001', status: 'idle', connectionType: 'ethernet', ipAddress: '10.0.2.52', batteryLevel: null, firmwareVersion: '3.8.1', p2peCertified: true, lastTransaction: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    ];

    let filteredTerminals = terminals;
    if (status) filteredTerminals = filteredTerminals.filter(t => t.status === status);
    if (location) filteredTerminals = filteredTerminals.filter(t => t.location === location);

    // Mock recent transactions
    const transactions = [
      { id: 'txn-001', terminalId: 'term-002', terminalName: 'Front Desk Terminal 2', amount: 45000, currency: 'INR', type: 'charge', method: 'visa', last4: '4242', authCode: 'AUTH789234', status: 'captured', guestId: 'guest-001', guestName: 'James Richardson', folioId: 'folio-201', createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), processingTimeMs: 1200 },
      { id: 'txn-002', terminalId: 'term-003', terminalName: 'Restaurant POS Terminal', amount: 4500, currency: 'INR', type: 'charge', method: 'mastercard', last4: '8888', authCode: 'AUTH789235', status: 'captured', guestId: 'guest-003', guestName: 'Yuki Tanaka', folioId: 'folio-203', createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(), processingTimeMs: 980 },
      { id: 'txn-003', terminalId: 'term-001', terminalName: 'Front Desk Terminal 1', amount: 200000, currency: 'INR', type: 'preauth', method: 'amex', last4: '1000', authCode: 'AUTH789230', status: 'authorized', guestId: 'guest-004', guestName: 'Elena Popova', folioId: 'folio-204', createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(), processingTimeMs: 2100 },
      { id: 'txn-004', terminalId: 'term-004', terminalName: 'Bar POS Terminal', amount: 2800, currency: 'INR', type: 'charge', method: 'upi', last4: 'N/A', authCode: 'UPI789231', status: 'captured', guestId: 'guest-002', guestName: 'Sarah Chen', folioId: 'folio-202', createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(), processingTimeMs: 650 },
      { id: 'txn-005', terminalId: 'term-006', terminalName: 'Gift Shop Terminal', amount: 3500, currency: 'INR', type: 'charge', method: 'visa', last4: '5555', authCode: 'AUTH789232', status: 'captured', guestId: 'guest-005', guestName: 'Priya Sharma', folioId: null, createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), processingTimeMs: 1100 },
      { id: 'txn-006', terminalId: 'term-002', terminalName: 'Front Desk Terminal 2', amount: 8500, currency: 'INR', type: 'refund', method: 'mastercard', last4: '6666', authCode: 'RFND789233', status: 'refunded', guestId: 'guest-006', guestName: 'Rahul Mehta', folioId: 'folio-206', createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), processingTimeMs: 2400 },
      { id: 'txn-007', terminalId: 'term-007', terminalName: 'Concierge Mobile Terminal', amount: 15000, currency: 'INR', type: 'charge', method: 'visa', last4: '7777', authCode: 'AUTH789236', status: 'captured', guestId: 'guest-001', guestName: 'James Richardson', folioId: 'folio-201', createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), processingTimeMs: 1400 },
      { id: 'txn-008', terminalId: 'term-003', terminalName: 'Restaurant POS Terminal', amount: 6200, currency: 'INR', type: 'charge', method: 'upi', last4: 'N/A', authCode: 'UPI789237', status: 'captured', guestId: 'guest-007', guestName: 'David Kim', folioId: 'folio-207', createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(), processingTimeMs: 700 },
      { id: 'txn-009', terminalId: 'term-001', terminalName: 'Front Desk Terminal 1', amount: 50000, currency: 'INR', type: 'preauth', method: 'visa', last4: '3333', authCode: 'AUTH789238', status: 'authorized', guestId: 'guest-008', guestName: 'Michael O\'Brien', folioId: 'folio-208', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), processingTimeMs: 1800 },
      { id: 'txn-010', terminalId: 'term-002', terminalName: 'Front Desk Terminal 2', amount: 1800, currency: 'INR', type: 'void', method: 'mastercard', last4: '9999', authCode: 'VOID789239', status: 'voided', guestId: 'guest-009', guestName: 'Alex Turner', folioId: 'folio-209', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), processingTimeMs: 800 },
    ];

    // Mock P2PE status
    const p2peStatus = {
      overallCompliant: true,
      certificationExpiry: '2027-03-15',
      lastAuditDate: '2026-01-10',
      nextAuditDate: '2026-07-10',
      providers: [
        { provider: 'Razorpay', p2peVersion: 'v3.2', certified: true, encryptionMethod: 'AES-256', tokenFormat: 'TAVV', lastKeyRotation: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), nextKeyRotation: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString() },
        { provider: 'Stripe', p2peVersion: 'SCA-v2', certified: true, encryptionMethod: 'AES-256', tokenFormat: 'pi_xxx', lastKeyRotation: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(), nextKeyRotation: new Date(Date.now() + 1000 * 60 * 60 * 24 * 75).toISOString() },
      ],
      complianceNotes: [
        'All terminals have valid P2PE certification',
        'Key rotation schedule: every 90 days',
        'PCI DSS Level 1 compliance maintained',
        'EMV chip contact/contactless supported on all terminals',
      ],
    };

    // Mock tokens (stored payment methods)
    const tokens = [
      { id: 'tok-001', token: 'tok_raz_****3847', type: 'visa', last4: '4242', expiryMonth: 12, expiryYear: 2028, guestId: 'guest-001', guestName: 'James Richardson', provider: 'Razorpay', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(), lastUsed: new Date(Date.now() - 1000 * 60 * 5).toISOString(), status: 'active' },
      { id: 'tok-002', token: 'tok_raz_****9201', type: 'mastercard', last4: '8888', expiryMonth: 6, expiryYear: 2027, guestId: 'guest-003', guestName: 'Yuki Tanaka', provider: 'Razorpay', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(), lastUsed: new Date(Date.now() - 1000 * 60 * 2).toISOString(), status: 'active' },
      { id: 'tok-003', token: 'tok_str_****1100', type: 'amex', last4: '1000', expiryMonth: 3, expiryYear: 2028, guestId: 'guest-004', guestName: 'Elena Popova', provider: 'Stripe', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), lastUsed: new Date(Date.now() - 1000 * 60 * 12).toISOString(), status: 'active' },
      { id: 'tok-004', token: 'tok_raz_****5563', type: 'visa', last4: '5555', expiryMonth: 9, expiryYear: 2027, guestId: 'guest-005', guestName: 'Priya Sharma', provider: 'Razorpay', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(), lastUsed: new Date(Date.now() - 1000 * 60 * 45).toISOString(), status: 'active' },
      { id: 'tok-005', token: 'tok_raz_****2200', type: 'visa', last4: '7777', expiryMonth: 11, expiryYear: 2027, guestId: 'guest-001', guestName: 'James Richardson', provider: 'Razorpay', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(), lastUsed: new Date(Date.now() - 1000 * 60 * 30).toISOString(), status: 'active' },
      { id: 'tok-006', token: 'tok_str_****4400', type: 'mastercard', last4: '3333', expiryMonth: 1, expiryYear: 2029, guestId: 'guest-008', guestName: 'Michael O\'Brien', provider: 'Stripe', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), status: 'active' },
      { id: 'tok-007', token: 'tok_raz_****7782', type: 'visa', last4: '6666', expiryMonth: 5, expiryYear: 2026, guestId: 'guest-006', guestName: 'Rahul Mehta', provider: 'Razorpay', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(), lastUsed: new Date(Date.now() - 1000 * 60 * 60).toISOString(), status: 'expired' },
    ];

    const stats = {
      totalTerminals: terminals.length,
      onlineTerminals: terminals.filter(t => t.status === 'online').length,
      offlineTerminals: terminals.filter(t => t.status === 'offline').length,
      totalTransactionsToday: transactions.length,
      todayVolume: transactions.filter(t => t.type === 'charge' && t.status === 'captured').reduce((sum, t) => sum + t.amount, 0),
      avgProcessingTime: Math.round(transactions.reduce((sum, t) => sum + t.processingTimeMs, 0) / transactions.length),
      p2peCompliant: p2peStatus.overallCompliant,
      activeTokens: tokens.filter(t => t.status === 'active').length,
      refundsToday: transactions.filter(t => t.type === 'refund' || t.type === 'void').length,
      refundAmountToday: transactions.filter(t => t.type === 'refund' || t.type === 'void').reduce((sum, t) => sum + t.amount, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        terminals: filteredTerminals,
        transactions,
        p2peStatus,
        tokens,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching payment terminal data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment terminal data' } },
      { status: 500 }
    );
  }
}
