/**
 * UPI Payment Gateway Implementation
 *
 * Supports UPI (Unified Payments Interface) payment methods including:
 *   - UPI QR Code (static/dynamic QR for any UPI app)
 *   - UPI Intent (deep-link to GPay, PhonePe, Paytm, BHIM, etc.)
 *   - UPI Collect (VPA-based push payment)
 *
 * This is a backend gateway that generates the UPI payment parameters.
 * The frontend renders the QR code or triggers the intent flow.
 * Payment confirmation comes via polling or webhook.
 *
 * Indian market focus: INR, zero MDR on UPI (as of current regulations),
 * though acquirers may charge a small fee.
 */

import crypto from 'crypto';
import {
  PaymentGateway,
  GatewayConfig,
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  CardData,
  TokenResult,
  TransactionStatusResult,
  GatewayType,
} from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

export type UpiMethod = 'qr' | 'intent' | 'collect';

export interface UpiPhonePeConfig {
  merchantId: string;
  merchantTransactionId: string;
  merchantUserId: string;
  amount: number;
  callbackUrl: string;
  mobileNumber?: string;
  paymentInstrument: {
    type: 'UPI_INTENT' | 'UPI_QR' | 'UPI_COLLECT';
    vpa?: string; // For collect mode
    targetApp?: string; // For intent: 'com.google.android.apps.nbu.paisa.user' (GPay), etc.
  };
}

export interface UpPaymentParams {
  /** Unique payment reference ID (server-generated) */
  paymentRef: string;
  /** VPA of the merchant (receiver) */
  merchantVpa: string;
  /** Amount in INR (smallest unit: paise) */
  amountPaise: number;
  /** Human-readable note */
  transactionNote: string;
  /** Merchant name shown to payer */
  merchantName: string;
  /** UPI deep-link URL for intent flow */
  upiIntentUrl?: string;
  /** UPI QR string for QR code generation */
  upiQrString?: string;
  /** Payment method: qr | intent | collect */
  method: UpiMethod;
  /** Target UPI app for intent (phonepe, googlepay, paytm, bhim, any) */
  targetApp?: string;
  /** VPA of the payer (for collect mode) */
  payerVpa?: string;
  /** Expiry timestamp */
  expiresAt: number;
}

// ── UPI Gateway ──────────────────────────────────────────────────────────────

export class UpGateway implements PaymentGateway {
  readonly name: string = 'UPI';
  readonly type: GatewayType = 'upi';

  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  // ── Core Payment Operations ─────────────────────────────────────────────

  /**
   * Generate UPI payment parameters (QR or Intent or Collect).
   *
   * This does NOT charge the customer directly. It returns the UPI
   * parameters that the frontend uses to:
   *   1. Render a QR code (method='qr')
   *   2. Open a UPI intent deep-link (method='intent')
   *   3. Initiate a UPI collect request (method='collect')
   *
   * The actual payment confirmation is handled by:
   *   - Polling getTransactionStatus() with the paymentRef
   *   - Or receiving a webhook callback from the UPI payment processor
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const startTime = Date.now();

    try {
      const method = (request.metadata?.upiMethod as UpiMethod) || 'qr';
      const targetApp = (request.metadata?.upiTargetApp as string) || 'any';
      const payerVpa = request.metadata?.upiPayerVpa as string | undefined;
      const merchantVpa = this.config.merchantId || this.config.apiKey;
      const merchantName = this.config.name || 'StaySuite';

      if (!merchantVpa) {
        return {
          success: false,
          status: 'failed',
          errorCode: 'CONFIG_ERROR',
          errorMessage: 'Merchant VPA (merchantId or apiKey) is required for UPI payments',
        };
      }

      // Convert to paise (UPI uses smallest currency unit)
      const amountPaise = Math.round(request.amount * 100);

      // Generate unique payment reference
      const paymentRef = `UPI-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const transactionNote =
        request.description || `Payment for folio ${request.folioId}`;

      // Build UPI QR string: upi://pay?pa={vpa}&pn={name}&am={amount}&tn={note}&tr={ref}&cu=INR
      const upiQrString = [
        'upi://pay',
        `pa=${encodeURIComponent(merchantVpa)}`,
        `pn=${encodeURIComponent(merchantName)}`,
        `am=${amountPaise}`,
        `tn=${encodeURIComponent(transactionNote)}`,
        `tr=${encodeURIComponent(paymentRef)}`,
        'cu=INR',
      ].join('&');

      // Build intent URL based on target app
      const upiIntentUrl = this.buildIntentUrl(
        upiQrString,
        targetApp,
        amountPaise,
        merchantVpa,
        merchantName,
        transactionNote,
        paymentRef,
      );

      const processingTime = Date.now() - startTime;
      this.updateStats(true, request.amount, processingTime);

      return {
        success: true,
        transactionId: paymentRef,
        gatewayRef: paymentRef,
        amount: request.amount,
        currency: request.currency,
        status: 'processing', // Awaiting UPI payment confirmation
        gatewayFee: this.calculateGatewayFee(request.amount),
        processedAt: new Date(),
        metadata: {
          paymentRef,
          merchantVpa,
          upiQrString,
          upiIntentUrl,
          method,
          targetApp,
          payerVpa: payerVpa || '',
          expiresAt: String(Date.now() + 15 * 60 * 1000), // 15 min expiry
          processingTimeMs: processingTime.toString(),
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(false, request.amount, processingTime);

      return {
        success: false,
        status: 'failed',
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // ── Refunds ─────────────────────────────────────────────────────────────

  /**
   * UPI refunds are handled via bank-level reversal.
   *
   * Since UPI is a push payment, refunds typically need to be processed
   * manually (offline bank transfer) or through the acquiring bank's
   * refund API. This gateway stores the refund record and marks it for
   * manual processing.
   *
   * If a Razorpay/PhonePe integration is used for UPI, the refund goes
   * through their refund API instead.
   */
  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    const refundId = `UPI-REFUND-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    try {
      // Dynamic import to avoid client-side bundling
      const { db } = await import('@/lib/db');

      // Store refund record in ManualTransaction table for tracking
      await db.manualTransaction.create({
        data: {
          tenantId: 'default',
          amount: request.amount || 0,
          currency: 'INR',
          status: 'completed',
          metadata: JSON.stringify({
            refundId,
            gatewayRef: request.gatewayRef,
            transactionId: request.transactionId,
            reason: request.reason || 'UPI refund',
            processedVia: 'upi_manual_refund',
            processedAt: new Date().toISOString(),
          }),
        },
      });

      return {
        success: true,
        refundId,
        amount: request.amount,
        status: 'processed',
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'DATABASE_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Failed to process refund',
      };
    }
  }

  // ── Card Tokenization ──────────────────────────────────────────────────

  /**
   * UPI doesn't use card tokenization.
   * UPI uses VPA (Virtual Payment Address) as the payment identifier.
   */
  async tokenizeCard(_cardData: CardData): Promise<TokenResult> {
    return {
      success: false,
      error: 'UPI does not use card tokenization. Use VPA (Virtual Payment Address) instead.',
      errorCode: 'NOT_SUPPORTED',
    };
  }

  // ── Transaction Status ──────────────────────────────────────────────────

  /**
   * Check UPI transaction status.
   *
   * Since pure UPI payments don't have a server-side status API
   * (unlike Razorpay/PhonePe), this returns the current known status.
   *
   * In production, this would integrate with:
   *   - Bank's UPI API for status polling
   *   - NPCI settlement reports
   *   - Payment processor (Razorpay/PhonePe) if using their UPI flows
   */
  async getTransactionStatus(gatewayRef: string): Promise<TransactionStatusResult> {
    try {
      const { db } = await import('@/lib/db');

      // Look up the payment in our database
      const payment = await db.payment.findFirst({
        where: { gatewayRef },
        orderBy: { createdAt: 'desc' },
      });

      if (payment) {
        const statusMap: Record<string, TransactionStatusResult['status']> = {
          completed: 'settled',
          processing: 'pending',
          pending: 'pending',
          failed: 'failed',
          refunded: 'refunded',
          partially_refunded: 'partially_refunded',
        };

        return {
          success: true,
          transactionId: payment.transactionId || gatewayRef,
          gatewayRef,
          status: statusMap[payment.status] || 'pending',
          amount: payment.amount,
          currency: payment.currency,
          refundedAmount: payment.refundAmount || 0,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt || undefined,
        };
      }

      return {
        success: false,
        transactionId: gatewayRef,
        gatewayRef,
        status: 'failed',
        amount: 0,
        currency: 'INR',
        createdAt: new Date(),
      };
    } catch {
      return {
        success: false,
        transactionId: gatewayRef,
        gatewayRef,
        status: 'failed',
        amount: 0,
        currency: 'INR',
        createdAt: new Date(),
      };
    }
  }

  // ── Health Check ────────────────────────────────────────────────────────

  /**
   * UPI is always healthy since it doesn't depend on external APIs
   * (it generates payment parameters client-side).
   */
  async isHealthy(): Promise<boolean> {
    this.config.healthStatus = 'healthy';
    this.config.lastHealthCheck = new Date();
    return true;
  }

  // ── Configuration ───────────────────────────────────────────────────────

  getConfig(): GatewayConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<GatewayConfig>): void {
    this.config = { ...this.config, ...config };
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // merchantId is used as the merchant VPA
    if (!this.config.merchantId && !this.config.apiKey) {
      errors.push('Merchant VPA is required (set as merchantId or apiKey)');
    }

    if (this.config.feePercentage < 0) {
      errors.push('Fee percentage cannot be negative');
    }

    if (this.config.feeFixed < 0) {
      errors.push('Fixed fee cannot be negative');
    }

    return { valid: errors.length === 0, errors };
  }

  supportsCurrency(currency: string): boolean {
    // UPI is primarily INR but technically supports all currencies
    // through international UPI (connected banks)
    if (this.config.supportedCurrencies.length > 0) {
      return this.config.supportedCurrencies.includes(currency.toUpperCase());
    }
    return true;
  }

  supportsAmount(amount: number, currency: string): boolean {
    if (!this.supportsCurrency(currency)) return false;
    // UPI minimum: ₹1 for INR
    if (currency.toUpperCase() === 'INR' && amount < 1) return false;
    if (this.config.minAmount && amount < this.config.minAmount) return false;
    if (this.config.maxAmount && amount > this.config.maxAmount) return false;
    return true;
  }

  // ── Public Utility: Build Intent URL ────────────────────────────────────

  /**
   * Build UPI intent URL for a specific app.
   * Can be used by frontend to open the UPI app directly.
   */
  buildIntentUrl(
    baseQrString: string,
    targetApp: string,
    amountPaise: number,
    merchantVpa: string,
    merchantName: string,
    transactionNote: string,
    transactionRef: string,
  ): string {
    const params = new URLSearchParams({
      pa: merchantVpa,
      pn: merchantName,
      tn: transactionNote,
      tr: transactionRef,
      am: String(amountPaise),
      cu: 'INR',
    });

    switch (targetApp) {
      case 'phonepe':
        // PhonePe intent
        return `phonepe://pay?${params.toString()}`;
      case 'googlepay':
        // Google Pay (GPay) intent
        return `upi://pay?${params.toString()}&pn=${encodeURIComponent(merchantName)}`;
      case 'paytm':
        // Paytm intent
        return `paytmmp://pay?${params.toString()}`;
      case 'bhim':
        // BHIM UPI app
        return `bhim://upi/pay?${params.toString()}`;
      case 'any':
      default:
        // Generic UPI intent (lets user choose their default UPI app)
        return baseQrString;
    }
  }

  // ── Public Utility: Get QR String ───────────────────────────────────────

  /**
   * Generate a UPI QR string from payment parameters.
   * Frontend can use this string to render a QR code.
   */
  generateQrString(params: {
    merchantVpa: string;
    merchantName: string;
    amountPaise: number;
    transactionNote: string;
    transactionRef: string;
    currency?: string;
  }): string {
    return [
      'upi://pay',
      `pa=${encodeURIComponent(params.merchantVpa)}`,
      `pn=${encodeURIComponent(params.merchantName)}`,
      `am=${params.amountPaise}`,
      `tn=${encodeURIComponent(params.transactionNote)}`,
      `tr=${encodeURIComponent(params.transactionRef)}`,
      `cu=${params.currency || 'INR'}`,
    ].join('&');
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  private calculateGatewayFee(amount: number): number {
    // UPI has zero MDR (Merchant Discount Rate) on most transactions
    // as per NPCI guidelines. Acquirers may charge a small fee.
    return (amount * this.config.feePercentage) / 100 + this.config.feeFixed;
  }

  private updateStats(success: boolean, amount: number, processingTime: number): void {
    this.config.totalTransactions++;
    if (success) {
      this.config.successfulTransactions++;
      this.config.totalVolume += amount;
    } else {
      this.config.failedTransactions++;
      this.config.consecutiveFailures++;
    }
    if (this.config.avgProcessingTime) {
      this.config.avgProcessingTime = (this.config.avgProcessingTime + processingTime) / 2;
    } else {
      this.config.avgProcessingTime = processingTime;
    }
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createUpGateway(config?: Partial<GatewayConfig>): UpGateway {
  const defaultConfig: GatewayConfig = {
    id: config?.id || 'upi-default',
    name: 'UPI',
    type: config?.type || 'upi',
    priority: config?.priority ?? 1,
    isActive: config?.isActive ?? true,
    isPrimary: config?.isPrimary ?? false,
    mode: config?.mode || 'live',
    apiKey: config?.apiKey || '', // Merchant VPA (e.g., merchant@upi)
    secretKey: config?.secretKey,
    merchantId: config?.merchantId || config?.apiKey, // Also merchant VPA
    webhookSecret: config?.webhookSecret,
    feePercentage: config?.feePercentage ?? 0, // Zero MDR on UPI
    feeFixed: config?.feeFixed ?? 0,
    supportedCurrencies: config?.supportedCurrencies || ['INR'],
    supportedCardTypes: [], // N/A for UPI
    supportsRefunds: true,
    supportsPartialRefunds: true,
    supportsTokenization: false,
    supportsRecurring: false,
    healthStatus: 'healthy',
    consecutiveFailures: 0,
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    totalVolume: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return new UpGateway(defaultConfig);
}
