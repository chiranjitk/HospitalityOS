/**
 * POS Payment Webhook Handler
 *
 * Handles webhook callbacks from payment gateways (Stripe, Razorpay) to confirm
 * POS order payments that were initiated in 'processing' state.
 *
 * Flow:
 *   1. POS pay route creates a payment in 'processing' state + sets order to 'processing'
 *   2. Customer confirms payment on the gateway (Stripe Checkout, Razorpay, UPI app, etc.)
 *   3. Gateway sends webhook to this endpoint
 *   4. This handler:
 *      - Verifies the webhook signature
 *      - Finds the matching payment record by gatewayRef
 *      - Updates payment → 'completed'
 *      - Updates order → 'paid'
 *      - Updates folio balance
 *      - Marks table as available
 *      - Fires notifications and automation events
 *
 * Supported gateways: Stripe, Razorpay, UPI (via metadata matching)
 *
 * POST /api/orders/payment-webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { decrypt, isEncrypted } from '@/lib/encryption';
import { notifyPaymentReceived, notifyPaymentFailed } from '@/lib/notify';
import { fireAutomationEvent } from '@/lib/automation/hooks';

// ── Signature Verification Helpers ────────────────────────────────────────────

/**
 * Verify Stripe webhook signature.
 * Stripe sends `stripe-signature` header with HMAC-SHA256 of `timestamp.rawBody`.
 */
function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader || !secret) return false;

  try {
    const elements = signatureHeader.split(',');
    let timestamp = '';
    let sig = '';

    for (const element of elements) {
      const [key, value] = element.split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') sig = value;
    }

    if (!timestamp || !sig) return false;

    // Check freshness (5 minutes)
    const ts = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) {
      console.warn('[POS Webhook] Stripe timestamp too old');
      return false;
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Verify Razorpay webhook signature.
 * Razorpay sends `X-Razorpay-Signature` header with HMAC-SHA256 of rawBody.
 */
function verifyRazorpaySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;

  try {
    const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

// ── Resolve webhook secret from DB ────────────────────────────────────────────

async function getWebhookSecret(
  provider: string,
  tenantId?: string,
): Promise<{ secret: string; tenantId: string } | null> {
  const where: Record<string, unknown> = {
    provider,
    status: 'active',
    ...(tenantId ? { tenantId } : {}),
  };

  const gateway = await db.paymentGateway.findFirst({
    where,
    select: { webhookSecret: true, tenantId: true },
  });

  if (!gateway?.webhookSecret) return null;

  let secret = gateway.webhookSecret;
  if (isEncrypted(secret)) {
    secret = decrypt(secret) || secret;
  }

  return { secret, tenantId: gateway.tenantId };
}

// ── POST /api/orders/payment-webhook ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await request.text();

    // Detect gateway from headers
    const stripeSignature = request.headers.get('stripe-signature');
    const razorpaySignature = request.headers.get('x-razorpay-signature');

    if (stripeSignature) {
      return await handleStripeWebhook(rawBody, stripeSignature, startTime);
    }

    if (razorpaySignature) {
      return await handleRazorpayWebhook(rawBody, razorpaySignature, startTime);
    }

    // No recognized gateway signature
    console.error('[POS Webhook] Unrecognized webhook: no stripe-signature or x-razorpay-signature header');
    return NextResponse.json(
      { success: false, error: 'Unrecognized webhook — no supported signature header' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[POS Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ── Stripe Webhook Handler ────────────────────────────────────────────────────

async function handleStripeWebhook(
  rawBody: string,
  signatureHeader: string,
  startTime: number,
): Promise<NextResponse> {
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const eventObjectId = event.data?.object?.id as string | undefined;

  // Find the payment by gatewayRef to determine tenant
  let resolvedTenantId: string | undefined;
  if (eventObjectId) {
    const payment = await db.payment.findFirst({
      where: { gateway: 'stripe', gatewayRef: eventObjectId },
      select: { tenantId: true },
    });
    if (payment) {
      resolvedTenantId = payment.tenantId;
    }
  }

  // Get webhook secret
  const secretInfo = await getWebhookSecret('stripe', resolvedTenantId);
  if (!secretInfo) {
    // Fallback to env var
    const envSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!envSecret) {
      console.error('[POS Webhook] Stripe webhook secret not configured');
      return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 });
    }
    // Verify with env secret
    if (!verifyStripeSignature(rawBody, signatureHeader, envSecret)) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }
  } else {
    if (!verifyStripeSignature(rawBody, signatureHeader, secretInfo.secret)) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }
  }

  const eventType = event.type as string;

  switch (eventType) {
    case 'payment_intent.succeeded':
      return await handlePaymentSucceeded(event, 'stripe', startTime);
    case 'payment_intent.payment_failed':
      return await handlePaymentFailed(event, 'stripe', startTime);
    default:
      // Acknowledge other events
      console.log(`[POS Webhook] Acknowledged non-POS Stripe event: ${eventType}`);
      return NextResponse.json({ success: true, message: `Event ${eventType} acknowledged` });
  }
}

// ── Razorpay Webhook Handler ──────────────────────────────────────────────────

async function handleRazorpayWebhook(
  rawBody: string,
  signatureHeader: string,
  startTime: number,
): Promise<NextResponse> {
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const eventType = event.event as string;
  const payload = event.payload?.payment?.entity as Record<string, unknown> | undefined;

  // Find payment by gatewayRef to determine tenant
  let resolvedTenantId: string | undefined;
  if (payload?.id || payload?.order_id) {
    const payment = await db.payment.findFirst({
      where: {
        gateway: 'razorpay',
        OR: [
          { gatewayRef: (payload.order_id as string) || '' },
          { gatewayRef: (payload.id as string) || '' },
        ],
      },
      select: { tenantId: true },
    });
    if (payment) {
      resolvedTenantId = payment.tenantId;
    }
  }

  const secretInfo = await getWebhookSecret('razorpay', resolvedTenantId);
  if (!secretInfo) {
    console.error('[POS Webhook] Razorpay webhook secret not configured');
    return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 });
  }

  if (!verifyRazorpaySignature(rawBody, signatureHeader, secretInfo.secret)) {
    return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
  }

  switch (eventType) {
    case 'payment.captured':
    case 'payment.authorized':
      return await handleRazorpayPaymentCaptured(event, startTime);
    case 'payment.failed':
      return await handleRazorpayPaymentFailed(event, startTime);
    default:
      console.log(`[POS Webhook] Acknowledged non-POS Razorpay event: ${eventType}`);
      return NextResponse.json({ success: true, message: `Event ${eventType} acknowledged` });
  }
}

// ── Payment Success Handlers ──────────────────────────────────────────────────

/**
 * Handle Stripe payment_intent.succeeded — confirms POS payment.
 */
async function handlePaymentSucceeded(
  event: any,
  gateway: string,
  startTime: number,
): Promise<NextResponse> {
  const pi = event.data.object;
  const piId = pi.id as string;
  const amount = Math.round((pi.amount as number)) / 100;
  const currency = ((pi.currency as string) || 'USD').toUpperCase();

  // Find the processing payment
  const payment = await db.payment.findFirst({
    where: { gatewayRef: piId, status: 'processing' },
    include: {
      folio: { select: { id: true, totalAmount: true, bookingId: true, paidAmount: true, balance: true, status: true } },
    },
  });

  if (!payment) {
    console.log(`[POS Webhook] No processing payment found for ${piId} — may already be completed`);
    return NextResponse.json({ success: true, message: 'No matching processing payment' });
  }

  // Update payment → completed
  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'completed',
        gatewayStatus: 'succeeded',
        amount,
        currency,
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update folio balance
    if (payment.folio) {
      const newPaidAmount = (payment.folio.paidAmount || 0) + amount;
      const newBalance = Math.max(0, payment.folio.totalAmount - newPaidAmount);
      let folioStatus = payment.folio.status;
      if (newBalance <= 0) folioStatus = 'paid';
      else if (newPaidAmount > 0) folioStatus = 'partially_paid';

      await tx.folio.update({
        where: { id: payment.folio.id },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: folioStatus,
          updatedAt: new Date(),
        },
      });
    }
  });

  // Find and update the associated order(s) to 'paid'
  await finalizeOrdersForPayment(payment.id, payment.folioId, payment.tenantId);

  // Update gateway stats
  await db.paymentGateway.updateMany({
    where: { tenantId: payment.tenantId, provider: gateway },
    data: {
      totalTransactions: { increment: 1 },
      totalVolume: { increment: amount },
      lastSyncAt: new Date(),
    },
  });

  // Notify
  notifyPaymentReceived({
    tenantId: payment.tenantId,
    userId: payment.guestId || 'system',
    amount,
    currency,
    method: payment.method || gateway,
  });

  // Automation event
  fireAutomationEvent('payment.received', {
    tenantId: payment.tenantId,
    entityId: payment.id,
    data: {
      paymentId: payment.id,
      folioId: payment.folioId,
      amount,
      currency,
      method: payment.method,
      gateway,
      gatewayRef: piId,
      status: 'completed',
      source: 'pos_webhook',
    },
  });

  // Audit log
  await logWebhookAudit(payment.tenantId, gateway, event.id || piId, 'payment_intent.succeeded', 'processed', startTime);

  return NextResponse.json({
    success: true,
    message: 'Payment confirmed via webhook',
    paymentId: payment.id,
  });
}

/**
 * Handle Razorpay payment.captured — confirms POS payment.
 */
async function handleRazorpayPaymentCaptured(
  event: any,
  startTime: number,
): Promise<NextResponse> {
  const payload = event.payload?.payment?.entity as Record<string, unknown>;
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Missing payment entity' }, { status: 400 });
  }

  const paymentId = payload.id as string;
  const orderId = payload.order_id as string;
  const amount = Math.round((payload.amount as number)) / 100;
  const currency = ((payload.currency as string) || 'INR').toUpperCase();
  const method = payload.method as string;
  const fee = Math.round((payload.fee as number)) / 100;

  // Find the processing payment (match by order_id or payment_id)
  const payment = await db.payment.findFirst({
    where: {
      status: 'processing',
      OR: [
        { gatewayRef: orderId },
        { gatewayRef: paymentId },
        { transactionId: orderId },
      ],
    },
    include: {
      folio: { select: { id: true, totalAmount: true, bookingId: true, paidAmount: true, balance: true, status: true } },
    },
  });

  if (!payment) {
    console.log(`[POS Webhook] No processing payment found for Razorpay order ${orderId} / payment ${paymentId}`);
    return NextResponse.json({ success: true, message: 'No matching processing payment' });
  }

  // Update payment → completed
  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'completed',
        gatewayRef: paymentId,
        gatewayStatus: 'captured',
        gatewayFee: fee,
        method: method || payment.method,
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update folio balance
    if (payment.folio) {
      const newPaidAmount = (payment.folio.paidAmount || 0) + amount;
      const newBalance = Math.max(0, payment.folio.totalAmount - newPaidAmount);
      let folioStatus = payment.folio.status;
      if (newBalance <= 0) folioStatus = 'paid';
      else if (newPaidAmount > 0) folioStatus = 'partially_paid';

      await tx.folio.update({
        where: { id: payment.folio.id },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: folioStatus,
          updatedAt: new Date(),
        },
      });
    }
  });

  // Find and update the associated order(s) to 'paid'
  await finalizeOrdersForPayment(payment.id, payment.folioId, payment.tenantId);

  // Update gateway stats
  await db.paymentGateway.updateMany({
    where: { tenantId: payment.tenantId, provider: 'razorpay' },
    data: {
      totalTransactions: { increment: 1 },
      totalVolume: { increment: amount },
      lastSyncAt: new Date(),
    },
  });

  // Notify
  notifyPaymentReceived({
    tenantId: payment.tenantId,
    userId: payment.guestId || 'system',
    amount,
    currency,
    method: payment.method || 'razorpay',
  });

  // Automation event
  fireAutomationEvent('payment.received', {
    tenantId: payment.tenantId,
    entityId: payment.id,
    data: {
      paymentId: payment.id,
      folioId: payment.folioId,
      amount,
      currency,
      method: payment.method,
      gateway: 'razorpay',
      gatewayRef: paymentId,
      status: 'completed',
      source: 'pos_webhook',
    },
  });

  // Audit log
  await logWebhookAudit(payment.tenantId, 'razorpay', event.id || paymentId, 'payment.captured', 'processed', startTime);

  return NextResponse.json({
    success: true,
    message: 'Payment confirmed via Razorpay webhook',
    paymentId: payment.id,
  });
}

// ── Payment Failure Handlers ─────────────────────────────────────────────────

/**
 * Handle Stripe payment_intent.payment_failed — revert POS order.
 */
async function handlePaymentFailed(
  event: any,
  gateway: string,
  startTime: number,
): Promise<NextResponse> {
  const pi = event.data.object;
  const piId = pi.id as string;
  const lastPaymentError = pi.last_payment_error as Record<string, unknown> | undefined;
  const errorMessage = (lastPaymentError?.message as string) || 'Payment failed';
  const errorCode = (lastPaymentError?.code as string) || 'PAYMENT_FAILED';

  const payment = await db.payment.findFirst({
    where: { gatewayRef: piId, status: 'processing' },
  });

  if (!payment) {
    console.log(`[POS Webhook] No processing payment found for failed ${piId}`);
    return NextResponse.json({ success: true, message: 'No matching processing payment' });
  }

  // Update payment → failed
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: 'failed',
      gatewayStatus: 'failed',
      reference: `Error: ${errorCode} - ${errorMessage}`,
      updatedAt: new Date(),
    },
  });

  // Revert order from 'processing' back to 'served'
  const ordersToRevert = await db.order.findMany({
    where: {
      folioId: payment.folioId,
      status: 'processing',
    },
    include: { table: { select: { id: true } } },
  });

  for (const orderToRevert of ordersToRevert) {
    await db.order.update({
      where: { id: orderToRevert.id },
      data: { status: 'served' },
    });
  }

  // Notify failure
  notifyPaymentFailed({
    tenantId: payment.tenantId,
    userId: payment.guestId || 'system',
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method || gateway,
    reason: errorMessage,
  });

  // Audit log
  await logWebhookAudit(payment.tenantId, gateway, event.id || piId, 'payment_intent.payment_failed', 'processed', startTime);

  return NextResponse.json({
    success: true,
    message: 'Payment failure recorded',
    paymentId: payment.id,
  });
}

/**
 * Handle Razorpay payment.failed — revert POS order.
 */
async function handleRazorpayPaymentFailed(
  event: any,
  startTime: number,
): Promise<NextResponse> {
  const payload = event.payload?.payment?.entity as Record<string, unknown>;
  if (!payload) {
    return NextResponse.json({ success: false, error: 'Missing payment entity' }, { status: 400 });
  }

  const paymentId = payload.id as string;
  const orderId = payload.order_id as string;
  const errorCode = payload.error_code as string;
  const errorDescription = payload.error_description as string;

  const payment = await db.payment.findFirst({
    where: {
      status: 'processing',
      OR: [
        { gatewayRef: orderId },
        { gatewayRef: paymentId },
      ],
    },
  });

  if (!payment) {
    console.log(`[POS Webhook] No processing payment found for failed Razorpay order ${orderId}`);
    return NextResponse.json({ success: true, message: 'No matching processing payment' });
  }

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: 'failed',
      gatewayStatus: 'failed',
      reference: `Error: ${errorCode} - ${errorDescription}`,
      updatedAt: new Date(),
    },
  });

  // Revert order from 'processing' back to 'served'
  const ordersToRevert = await db.order.findMany({
    where: {
      folioId: payment.folioId,
      status: 'processing',
    },
  });

  for (const orderToRevert of ordersToRevert) {
    await db.order.update({
      where: { id: orderToRevert.id },
      data: { status: 'served' },
    });
  }

  // Notify failure
  notifyPaymentFailed({
    tenantId: payment.tenantId,
    userId: payment.guestId || 'system',
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method || 'razorpay',
    reason: errorDescription || errorCode,
  });

  // Audit log
  await logWebhookAudit(payment.tenantId, 'razorpay', event.id || paymentId, 'payment.failed', 'processed', startTime);

  return NextResponse.json({
    success: true,
    message: 'Payment failure recorded',
    paymentId: payment.id,
  });
}

// ── Shared Helpers ────────────────────────────────────────────────────────────

/**
 * Finalize all 'processing' orders linked to the given folio by marking them 'paid'
 * and freeing up their tables.
 */
async function finalizeOrdersForPayment(
  paymentId: string,
  folioId: string,
  tenantId: string,
): Promise<void> {
  const processingOrders = await db.order.findMany({
    where: {
      folioId,
      tenantId,
      status: 'processing',
    },
    include: {
      table: { select: { id: true } },
      items: {
        include: {
          menuItem: { select: { id: true, name: true, price: true } },
        },
      },
    },
  });

  for (const order of processingOrders) {
    await db.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        completedAt: new Date(),
      },
    });

    // Free up the table
    if (order.tableId) {
      await db.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: 'available' },
      });
    }

    console.log(`[POS Webhook] Order ${order.orderNumber} marked as paid (via payment ${paymentId})`);
  }
}

/**
 * Log a webhook processing event to the audit log.
 */
async function logWebhookAudit(
  tenantId: string,
  gateway: string,
  gatewayEventId: string,
  eventType: string,
  status: string,
  startTime: number,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        tenantId,
        module: 'payments',
        action: 'pos_webhook_received',
        entityType: 'payment_webhook',
        newValue: JSON.stringify({
          gateway,
          gatewayEventId,
          eventType,
          status,
          processingTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          source: 'pos_payment_webhook',
        }),
      },
    });
  } catch (error) {
    console.error('[POS Webhook] Failed to log audit:', error);
  }
}
