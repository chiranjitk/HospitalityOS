/**
 * Payment Router Service
 * Routes payments through gateways with failover and retry logic
 *
 * IMPORTANT: PaymentRouter instances are per-request — use createPaymentRouter()
 * to create a new instance for each payment operation. The singleton pattern
 * (getInstance) is DEPRECATED and kept only for backward compatibility.
 * Gateway health status is cached by the shared gatewayRegistry, not by the router.
 */

import { db } from '@/lib/db';
import { gatewayRegistry, initializeGateways } from './gateway-registry';
import {
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  RoutingContext,
  RoutingDecision,
  RetryAttempt,
  PaymentTransactionLog,
  FailoverConfig,
  GatewayType,
  TokenResult,
  CardData,
  TransactionStatusResult,
} from './types';

// ============================================
// Default Configuration
// ============================================

const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  enabled: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
  maxRetryDelayMs: 10000,
  failoverOnErrors: [
    'api_connection_error',
    'api_error',
    'rate_limit_error',
    // NOTE: 'card_declined' is intentionally NOT listed here.
    // A genuine card decline means the card itself was declined by the issuer.
    // Retrying on a different gateway won't help — the card will still be declined.
    'processing_error',
  ],
  healthCheckIntervalMs: 60000,
  consecutiveFailureThreshold: 5,
};

// ============================================
// Payment Router Class
// ============================================

/**
 * Payment Router
 * Handles payment routing, failover, and retry logic.
 *
 * Each instance is scoped to a single tenant and request. Create via
 * createPaymentRouter() — do NOT use the deprecated getInstance() singleton.
 * Gateway health status is shared via gatewayRegistry, not per-instance.
 */
export class PaymentRouter {
  // ── Singleton kept ONLY for backward compatibility ─────────────────────
  // New code should use createPaymentRouter() instead.
  private static instance: PaymentRouter | null = null;

  private readonly failoverConfig: FailoverConfig;
  private readonly tenantId: string;
  
  /**
   * Create a new PaymentRouter for a specific tenant.
   * Prefer createPaymentRouter() over this constructor.
   */
  private constructor(tenantId: string, config?: Partial<FailoverConfig>) {
    this.tenantId = tenantId;
    this.failoverConfig = { ...DEFAULT_FAILOVER_CONFIG, ...config };
  }

  /**
   * DEPRECATED: Get singleton instance. Will use 'unknown' as tenant.
   * Use createPaymentRouter(tenantId, config) instead for per-request instances.
   */
  static getInstance(): PaymentRouter {
    if (!PaymentRouter.instance) {
      PaymentRouter.instance = new PaymentRouter('unknown');
    }
    return PaymentRouter.instance;
  }
  
  /**
   * Initialize gateways for this router's tenant.
   * Called automatically by createPaymentRouter.
   */
  async initialize(): Promise<void> {
    await initializeGateways(this.tenantId);
  }

  /**
   * Get the tenant ID this router is configured for.
   */
  getTenantId(): string {
    return this.tenantId;
  }
  
  /**
   * Process a payment with routing and failover
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Build routing context
    const context: RoutingContext = {
      amount: request.amount,
      currency: request.currency,
      cardType: undefined, // Would be extracted from card data if provided
      customerId: request.customerId,
      guestId: request.guestId,
      previousFailures: [],
    };
    
    // Determine routing
    const routing = gatewayRegistry.determineRouting(context);
    
    // Track attempts
    const attempts: RetryAttempt[] = [];
    let lastResult: PaymentResult | null = null;
    let currentGateway = routing.primaryGateway;
    const fallbackGateways = [...routing.fallbackGateways];
    
    // Process with retries and failover
    for (let attempt = 1; attempt <= this.failoverConfig.maxRetries; attempt++) {
      const gateway = gatewayRegistry.getGateway(currentGateway);
      
      if (!gateway) {
        // Try next fallback
        if (fallbackGateways.length > 0) {
          currentGateway = fallbackGateways.shift()!;
          continue;
        }
        break;
      }
      
      // Log attempt
      const attemptStart = Date.now();
      
      try {
        // Process payment
        lastResult = await gateway.processPayment(request);
        
        const processingTime = Date.now() - attemptStart;
        attempts.push({
          attempt,
          gateway: currentGateway,
          timestamp: new Date(),
          success: lastResult.success,
          processingTime,
          error: lastResult.errorMessage,
        });
        
        // Log transaction
        await this.logTransaction({
          tenantId: this.tenantId,
          gateway: currentGateway,
          operation: 'payment',
          amount: request.amount,
          currency: request.currency,
          status: lastResult.success ? 'success' : 'failed',
          errorCode: lastResult.errorCode,
          errorMessage: lastResult.errorMessage,
          requestTimestamp: new Date(attemptStart),
          responseTimestamp: new Date(),
          processingTimeMs: processingTime,
          retryCount: attempt - 1,
          failoverFrom: attempt > 1 ? routing.primaryGateway : undefined,
          gatewayRef: lastResult.gatewayRef,
          idempotencyKey: request.idempotencyKey,
        });
        
        // Success - return result
        if (lastResult.success) {
          return {
            ...lastResult,
            metadata: {
              ...lastResult.metadata,
              routingDecision: routing.reason,
              attemptCount: String(attempt),
              attempts: JSON.stringify(attempts),
            },
          };
        }
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastResult.errorCode || '');
        
        // Check if we should failover
        const shouldFailover = this.shouldFailover(
          lastResult.errorCode || '',
          attempt,
          context.previousFailures?.length || 0
        );
        
        if (shouldFailover && fallbackGateways.length > 0) {
          // Record failure and try next gateway
          context.previousFailures = context.previousFailures || [];
          context.previousFailures.push(currentGateway);
          currentGateway = fallbackGateways.shift()!;
          continue;
        }
        
        // Not retryable or no more fallbacks
        if (!isRetryable || attempt >= this.failoverConfig.maxRetries) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
        
      } catch (error) {
        const processingTime = Date.now() - attemptStart;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        attempts.push({
          attempt,
          gateway: currentGateway,
          timestamp: new Date(),
          success: false,
          processingTime,
          error: errorMessage,
        });
        
        // Log failed attempt
        await this.logTransaction({
          tenantId: this.tenantId,
          gateway: currentGateway,
          operation: 'payment',
          amount: request.amount,
          currency: request.currency,
          status: 'failed',
          errorCode: 'INTERNAL_ERROR',
          errorMessage,
          requestTimestamp: new Date(attemptStart),
          responseTimestamp: new Date(),
          processingTimeMs: processingTime,
          retryCount: attempt - 1,
        });
        
        // Try next gateway
        if (fallbackGateways.length > 0) {
          context.previousFailures = context.previousFailures || [];
          context.previousFailures.push(currentGateway);
          currentGateway = fallbackGateways.shift()!;
        } else {
          break;
        }
      }
    }
    
    // All attempts failed
    return {
      success: false,
      status: 'failed',
      errorCode: lastResult?.errorCode || 'ALL_GATEWAYS_FAILED',
      errorMessage: lastResult?.errorMessage || 'All payment gateways failed',
      metadata: {
        attempts: JSON.stringify(attempts),
        routingDecision: routing.reason,
      },
    };
  }
  
  /**
   * Process a refund with routing
   */
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    // For refunds, use the same gateway that processed the original payment
    // This is determined by the gatewayRef (transaction ID)
    
    // Try to determine gateway from transaction ID
    const gateway = this.determineGatewayFromRef(request.gatewayRef);
    
    if (!gateway) {
      return {
        success: false,
        errorCode: 'GATEWAY_NOT_FOUND',
        errorMessage: 'Could not determine gateway for refund',
      };
    }
    
    const attemptStart = Date.now();
    
    try {
      const result = await gateway.refundPayment(request);
      
      // Log transaction
      await this.logTransaction({
        tenantId: this.tenantId,
        gateway: gateway.type,
        operation: 'refund',
        amount: request.amount,
        status: result.success ? 'success' : 'failed',
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        requestTimestamp: new Date(attemptStart),
        responseTimestamp: new Date(),
        processingTimeMs: Date.now() - attemptStart,
        retryCount: 0,
        gatewayRef: request.gatewayRef,
      });
      
      return result;
    } catch (error) {
      return {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Tokenize a card
   */
  async tokenizeCard(cardData: CardData): Promise<TokenResult> {
    // Use primary gateway for tokenization
    const gateway = gatewayRegistry.getPrimaryGateway();
    
    if (!gateway) {
      return {
        success: false,
        error: 'No primary gateway configured',
        errorCode: 'NO_GATEWAY',
      };
    }
    
    if (!gateway.getConfig().supportsTokenization) {
      return {
        success: false,
        error: 'Primary gateway does not support tokenization',
        errorCode: 'NOT_SUPPORTED',
      };
    }
    
    return gateway.tokenizeCard(cardData);
  }
  
  /**
   * Get transaction status
   */
  async getTransactionStatus(gatewayRef: string, gatewayType?: GatewayType): Promise<TransactionStatusResult> {
    const gateway = gatewayType 
      ? gatewayRegistry.getGateway(gatewayType)
      : this.determineGatewayFromRef(gatewayRef);
    
    if (!gateway) {
      return {
        success: false,
        transactionId: gatewayRef,
        gatewayRef,
        status: 'failed',
        amount: 0,
        currency: 'USD',
        createdAt: new Date(),
      };
    }
    
    return gateway.getTransactionStatus(gatewayRef);
  }
  
  /**
   * Get routing decision for preview
   */
  getRoutingDecision(context: RoutingContext): RoutingDecision {
    return gatewayRegistry.determineRouting(context);
  }
  
  /**
   * Get failover configuration
   */
  getFailoverConfig(): FailoverConfig {
    return { ...this.failoverConfig };
  }
  
  /**
   * Update failover configuration
   */
  updateFailoverConfig(config: Partial<FailoverConfig>): void {
    Object.assign(this.failoverConfig, config);
    gatewayRegistry.updateFailoverConfig(config);
  }
  
  // ============================================
  // Private Helper Methods
  // ============================================
  
  /**
   * Determine gateway from transaction reference
   */
  private determineGatewayFromRef(gatewayRef: string): import('./types').PaymentGateway | null {
    // Check prefix patterns
    if (gatewayRef.startsWith('pi_') || gatewayRef.startsWith('ch_')) {
      return gatewayRegistry.getGateway('stripe') ?? null;
    }
    
    if (gatewayRef.startsWith('PAYID') || gatewayRef.includes('paypal')) {
      return gatewayRegistry.getGateway('paypal') ?? null;
    }

    if (gatewayRef.startsWith('order_') || gatewayRef.startsWith('pay_')) {
      // Razorpay order IDs start with 'order_', payment IDs start with 'pay_'
      return gatewayRegistry.getGateway('razorpay') ?? null;
    }

    if (gatewayRef.startsWith('UPI-')) {
      return gatewayRegistry.getGateway('upi') ?? null;
    }
    
    if (gatewayRef.startsWith('MANUAL')) {
      return gatewayRegistry.getGateway('manual') ?? null;
    }
    
    // Default to primary gateway
    return gatewayRegistry.getPrimaryGateway() ?? null;
  }
  
  /**
   * Check if error is retryable (infrastructure/network errors only).
   * Card declines are intentionally excluded — a different gateway won't fix them.
   */
  private isRetryableError(errorCode: string): boolean {
    const retryableErrors = [
      'api_connection_error',
      'api_error',
      'rate_limit_error',
      'processing_error',
      'internal_error',
      'timeout',
      'service_unavailable',
    ];
    
    return retryableErrors.some(e => 
      errorCode.toLowerCase().includes(e.toLowerCase())
    );
  }
  
  /**
   * Check if should failover to next gateway.
   * card_declined is excluded — it's an issuer rejection, not a gateway problem.
   */
  private shouldFailover(
    errorCode: string,
    attempt: number,
    previousFailures: number
  ): boolean {
    // Failover for specific infrastructure/gateway errors (not card declines)
    const failoverErrors = this.failoverConfig.failoverOnErrors;
    const shouldFailover = failoverErrors.some(e => 
      errorCode.toLowerCase().includes(e.toLowerCase())
    );
    
    // Failover if we have more gateways to try
    return shouldFailover || previousFailures > 0;
  }
  
  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (!this.failoverConfig.exponentialBackoff) {
      return this.failoverConfig.retryDelayMs;
    }
    
    const delay = Math.min(
      this.failoverConfig.retryDelayMs * Math.pow(2, attempt - 1),
      this.failoverConfig.maxRetryDelayMs
    );
    
    // Add jitter (10% random)
    return delay + Math.random() * delay * 0.1;
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Log transaction to database
   */
  private async logTransaction(log: Omit<PaymentTransactionLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      // Store in PaymentGatewayLog table or AuditLog
      // NOTE: gatewayRef (e.g. 'pi_xxx', 'PAYID-xxx') is NOT a UUID — store in newValue JSON
      await db.auditLog.create({
        data: {
          tenantId: log.tenantId,
          module: 'payments',
          action: log.operation,
          entityType: 'payment_transaction',
          entityId: undefined, // gatewayRef is not a valid UUID
          newValue: JSON.stringify({
            gateway: log.gateway,
            gatewayRef: log.gatewayRef,
            amount: log.amount,
            currency: log.currency,
            status: log.status,
            errorCode: log.errorCode,
            errorMessage: log.errorMessage,
            processingTimeMs: log.processingTimeMs,
            retryCount: log.retryCount,
            failoverFrom: log.failoverFrom,
          }),
        },
      });
    } catch (error) {
      console.error('Failed to log transaction:', error);
    }
  }
}

// ============================================
// Factory Function (recommended for new code)
// ============================================

/**
 * Create a new PaymentRouter instance scoped to a specific tenant.
 *
 * Each call returns a fresh instance — safe for concurrent requests without
 * race conditions on tenant-specific state. Gateway health status is shared
 * across all instances via the global gatewayRegistry.
 *
 * @param tenantId - The tenant to route payments for
 * @param config - Optional failover configuration overrides
 * @returns A new PaymentRouter instance, already initialized with tenant gateways
 */
export async function createPaymentRouter(
  tenantId: string,
  config?: Partial<FailoverConfig>
): Promise<PaymentRouter> {
  const router = new PaymentRouter(tenantId, config);
  await router.initialize();
  return router;
}

// ============================================
// Legacy Singleton Export (deprecated)
// ============================================

/**
 * @deprecated Use createPaymentRouter(tenantId, config) instead.
 * The singleton pattern causes race conditions when tenant state is shared
 * across concurrent requests. This export is kept for backward compatibility only.
 */
export const paymentRouter = PaymentRouter.getInstance();

/**
 * @deprecated Use createPaymentRouter(tenantId) instead.
 */
export async function initializePaymentRouter(tenantId: string): Promise<void> {
  console.warn(
    '[payments] initializePaymentRouter is deprecated. Use createPaymentRouter(tenantId) instead. ' +
    'The singleton pattern causes race conditions on tenant-specific state.'
  );
  await initializeGateways(tenantId);
}

/**
 * @deprecated Use createPaymentRouter(tenantId) instead.
 */
export function getPaymentRouter(): PaymentRouter {
  return paymentRouter;
}
