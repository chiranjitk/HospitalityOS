import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { gatewayRegistry } from '@/lib/payments';
import { GatewayType } from '@/lib/payments/types';
import { decrypt, isEncrypted } from '@/lib/encryption';

/**
 * Razorpay Webhook Handler
 *
 * Handles events from Razorpay:
 *   - payment.captured    → Mark payment as completed
 *   - payment.failed       → Mark payment as failed
 *   - payment.refunded     → Update refund status
 *   - order.paid           → Mark order as paid
 *
 * Webhook URL: POST /api/webhooks/razorpay
 *
 * Razorpay sends the raw body with HMAC-SHA256 signature in the
 * `X-Razorpay-Signature` header.
 */

// Disable body parsing – we need raw body for signature verification
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get signature header
    const signature = request.headers.get('X-Razorpay-Signature');
    if (!signature) {
      console.warn('[Razorpay Webhook] Missing signature header');
      return NextResponse.json(
        { success: false, error: 'Missing signature' },
        { status: 400 },
      );
    }

    // Parse the event
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const eventType = event.event as string;
    const payload = event.payload?.payment?.entity as Record<string, unknown> | undefined
      || event.payload?.order?.entity as Record<string, unknown> | undefined
      || event.payload?.refund?.entity as Record<string, unknown> | undefined;

    if (!payload) {
      console.warn('[Razorpay Webhook] Missing payload entity');
      return NextResponse.json(
        { success: false, error: 'Missing payload' },
        { status: 400 },
      );
    }

    // Verify webhook signature
    // Load the first active Razorpay gateway's webhook secret
    const razorpayGateway = gatewayRegistry.getGateway('razorpay');
    if (!razorpayGateway) {
      console.warn('[Razorpay Webhook] No Razorpay gateway configured');
      return NextResponse.json(
        { success: false, error: 'Gateway not configured' },
        { status: 500 },
      );
    }

    const config = razorpayGateway.getConfig();

    // If webhook secret is encrypted, decrypt it
    let webhookSecret = config.webhookSecret || '';
    if (webhookSecret && isEncrypted(webhookSecret)) {
      webhookSecret = decrypt(webhookSecret) || webhookSecret;
    }

    if (!webhookSecret) {
      console.warn('[Razorpay Webhook] Webhook secret not configured');
      return NextResponse.json(
        { success: false, error: 'Webhook secret not configured' },
        { status: 500 },
      );
    }

    // Verify signature using Razorpay's expected format:
    // sha256 = hmac_sha256(webhookSecret, rawBody + "|")
    // (Razorpay docs: signature = HMAC-SHA256(rawBody + "|" + webhookSecret))
    // Actually, the correct formula is: sha256(rawBody, webhookSecret)
    const crypto = await import('crypto');
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Timing-safe comparison
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSig, 'hex'),
      );

      if (!isValid) {
        console.warn('[Razorpay Webhook] Invalid signature');
        return NextResponse.json(
          { success: false, error: 'Invalid signature' },
          { status: 401 },
        );
      }
    } catch {
      console.warn('[Razorpay Webhook] Signature comparison error');
      return NextResponse.json(
        { success: false, error: 'Signature verification failed' },
        { status: 401 },
      );
    }

    // Process the event
    await handleRazorpayEvent(eventType, payload);

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error('[Razorpay Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Handle specific Razorpay webhook events
 */
async function handleRazorpayEvent(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (eventType) {
    case 'payment.captured':
    case 'payment.authorized': {
      const paymentId = payload.id as string;
      const orderId = payload.order_id as string;
      const amount = (payload.amount as number) / 100; // paise → INR
      const currency = (payload.currency as string).toUpperCase();
      const method = payload.method as string;
      const vpa = payload.vpa as string;
      const fee = (payload.fee as number) / 100;
      const email = payload.email as string;
      const contact = payload.contact as string;
      const captured = payload.captured as boolean;

      console.log(`[Razorpay Webhook] Payment ${eventType}: ${paymentId}, amount: ${amount} ${currency}, method: ${method}`);

      // Find payment by gatewayRef (order ID) or transactionId
      let payment = await db.payment.findFirst({
        where: {
          OR: [
            { gatewayRef: orderId },
            { transactionId: orderId },
            { gatewayRef: paymentId },
          ],
        },
      });

      if (payment) {
        // Update payment record
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: 'completed',
            processedAt: new Date(),
            gatewayRef: paymentId,
            gatewayStatus: eventType === 'payment.captured' ? 'captured' : 'authorized',
            gatewayFee: fee,
            method: method || payment.method,
            metadata: JSON.stringify({
              ...(payment.metadata ? JSON.parse(typeof payment.metadata === 'string' ? payment.metadata : '{}') : {}),
              razorpayPaymentId: paymentId,
              razorpayOrderId: orderId,
              razorpayMethod: method,
              razorpayVpa: vpa || '',
              razorpayEmail: email || '',
              razorpayContact: contact || '',
              captured,
            }),
          },
        });

        // Update folio balance
        if (payment.folioId) {
          await db.folio.update({
            where: { id: payment.folioId },
            data: {
              paidAmount: { increment: amount },
              balance: { decrement: amount },
              status: 'paid',
            },
          });
        }

        // Update gateway stats
        if (payment.tenantId) {
          await db.paymentGateway.updateMany({
            where: { tenantId: payment.tenantId, provider: 'razorpay' },
            data: {
              totalTransactions: { increment: 1 },
              totalVolume: { increment: amount },
              lastSyncAt: new Date(),
            },
          });
        }
      } else {
        console.warn(`[Razorpay Webhook] No payment found for order ${orderId} or payment ${paymentId}`);
      }
      break;
    }

    case 'payment.failed': {
      const paymentId = payload.id as string;
      const orderId = payload.order_id as string;
      const errorCode = payload.error_code as string;
      const errorDescription = payload.error_description as string;

      console.log(`[Razorpay Webhook] Payment failed: ${paymentId}, error: ${errorCode} - ${errorDescription}`);

      let payment = await db.payment.findFirst({
        where: {
          OR: [
            { gatewayRef: orderId },
            { transactionId: orderId },
            { gatewayRef: paymentId },
          ],
        },
      });

      if (payment) {
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            gatewayStatus: 'failed',
            metadata: JSON.stringify({
              ...(payment.metadata ? JSON.parse(typeof payment.metadata === 'string' ? payment.metadata : '{}') : {}),
              razorpayPaymentId: paymentId,
              razorpayOrderId: orderId,
              razorpayErrorCode: errorCode,
              razorpayErrorDescription: errorDescription,
            }),
          },
        });
      }
      break;
    }

    case 'refund.processed': {
      const refundId = payload.id as string;
      const paymentId = payload.payment_id as string;
      const refundAmount = (payload.amount as number) / 100;
      const refundStatus = payload.status as string;

      console.log(`[Razorpay Webhook] Refund processed: ${refundId}, amount: ${refundAmount}, status: ${refundStatus}`);

      // Find the original payment
      const payment = await db.payment.findFirst({
        where: {
          OR: [
            { gatewayRef: paymentId },
            { transactionId: paymentId },
          ],
        },
      });

      if (payment) {
        await db.payment.update({
          where: { id: payment.id },
          data: {
            status: refundAmount >= payment.amount ? 'refunded' : 'partially_refunded',
            refundAmount: { increment: refundAmount },
            metadata: JSON.stringify({
              ...(payment.metadata ? JSON.parse(typeof payment.metadata === 'string' ? payment.metadata : '{}') : {}),
              razorpayRefundId: refundId,
              razorpayRefundStatus: refundStatus,
            }),
          },
        });
      }
      break;
    }

    case 'order.paid': {
      const orderId = payload.id as string;
      console.log(`[Razorpay Webhook] Order paid: ${orderId}`);
      // Order.paid is typically followed by payment.captured, so we don't
      // need to do anything extra here. The payment.captured handler
      // will update the payment and folio.
      break;
    }

    default:
      console.log(`[Razorpay Webhook] Unhandled event type: ${eventType}`);
  }
}
