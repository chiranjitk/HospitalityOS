/**
 * Base OTA API Client
 * Abstract base class for all OTA integrations
 */

import crypto from 'crypto';

import {
  OTAAPIClient,
  OTAConfig,
  OTACredentials,
  OTAConnectionTestResult,
  OTAInventoryUpdate,
  OTAInventoryData,
  OTARateUpdate,
  OTARateData,
  OTARestrictionUpdate,
  OTARestrictionData,
  OTABookingData,
  OTASyncResponse,
  OTAWebhookResult,
  OTAHealthStatus,
  OTAError,
} from './types';

export abstract class BaseOTAClient implements OTAAPIClient {
  protected config: OTAConfig;
  protected credentials: OTACredentials | null = null;
  protected baseUrl: string;
  protected timeout: number;
  protected retryAttempts: number;

  constructor(config: OTAConfig) {
    this.config = config;
    this.baseUrl = config.apiConfig.sandboxUrl || config.apiConfig.baseUrl;
    this.timeout = config.apiConfig.timeout;
    this.retryAttempts = config.apiConfig.retryAttempts;
    const period = this.config.apiConfig.rateLimit.period;
    this.rateLimitWindow = period === 'second' ? 1000 : period === 'minute' ? 60000 : 3600000;
  }

  // ============================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================

  abstract connect(credentials: OTACredentials): Promise<OTAConnectionTestResult>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<OTAConnectionTestResult>;
  
  abstract getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<OTAInventoryData[]>;
  abstract updateInventory(updates: OTAInventoryUpdate[]): Promise<OTASyncResponse>;
  
  abstract getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<OTARateData[]>;
  abstract updateRates(updates: OTARateUpdate[]): Promise<OTASyncResponse>;
  
  abstract getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<OTARestrictionData[]>;
  abstract updateRestrictions(updates: OTARestrictionUpdate[]): Promise<OTASyncResponse>;
  
  abstract getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<OTABookingData[]>;
  abstract getBooking(externalId: string): Promise<OTABookingData>;
  abstract confirmBooking(externalId: string): Promise<boolean>;
  abstract cancelBooking(externalId: string, reason: string): Promise<boolean>;
  
  abstract processWebhook(payload: unknown, headers: Record<string, string>): Promise<OTAWebhookResult>;
  abstract getWebhookUrl(): string;
  
  abstract getHealthStatus(): Promise<OTAHealthStatus>;

  // ============================================
  // PROTECTED HELPER METHODS
  // ============================================

  protected setCredentials(credentials: OTACredentials): void {
    this.credentials = credentials;
  }

  protected clearCredentials(): void {
    this.credentials = null;
  }

  // Bug Fix #4: Call enforceRateLimit at the start of each fetch attempt
  // to prevent exceeding the channel's API rate limit.
  protected async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    retries: number = this.retryAttempts
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Bug Fix #4: Enforce rate limit before every request attempt
        await this.enforceRateLimit();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Bug Fix #6: Use response.status instead of string matching to determine retryability.
        // Retry on 429 (rate limit), 500, 502, 503, 504 (server errors).
        // Don't retry on 400, 401, 403, 404 (client errors).
        const nonRetryableStatuses = [400, 401, 403, 404];
        const retryableStatuses = [429, 500, 502, 503, 504];

        if (retryableStatuses.includes(response.status)) {
          const errorBody = await response.text();
          lastError = new Error(`HTTP ${response.status}: ${errorBody}`);
          // Wait before retrying (exponential backoff)
          if (attempt < retries) {
            await this.delay(Math.pow(2, attempt) * 1000);
          }
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else if (contentType?.includes('application/xml') || contentType?.includes('text/xml')) {
          const text = await response.text();
          return text as T;
        } else {
          const text = await response.text();
          try {
            return JSON.parse(text) as T;
          } catch {
            return text as T;
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Bug Fix #6: Don't retry on AbortError (timeout) or non-retryable errors
        if (lastError.name === 'AbortError') {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected generateCorrelationId(): string {
    return `${this.config.id}-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 15)}`;
  }

  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  protected createSuccessResponse(
    connectionId: string,
    syncType: 'inventory' | 'rates' | 'restrictions' | 'bookings',
    direction: 'inbound' | 'outbound',
    count: number,
    correlationId: string
  ): OTASyncResponse {
    return {
      success: true,
      connectionId,
      syncType,
      direction,
      correlationId,
      timestamp: new Date(),
      results: [
        {
          type: syncType,
          success: true,
          count,
          failed: 0,
        },
      ],
    };
  }

  protected createErrorResponse(
    connectionId: string,
    syncType: 'inventory' | 'rates' | 'restrictions' | 'bookings',
    direction: 'inbound' | 'outbound',
    error: string,
    correlationId: string,
    count: number = 0
  ): OTASyncResponse {
    return {
      success: false,
      connectionId,
      syncType,
      direction,
      correlationId,
      timestamp: new Date(),
      results: [
        {
          type: syncType,
          success: false,
          count,
          failed: count,
        },
      ],
      errors: [
        {
          code: 'SYNC_ERROR',
          message: error,
          severity: 'error',
          retryable: true,
        },
      ],
    };
  }

  protected createOTAError(code: string, message: string, retryable: boolean = false): OTAError {
    return {
      code,
      message,
      severity: 'error',
      retryable,
    };
  }

  // ============================================
  // AUTHENTICATION HELPERS
  // ============================================

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (!this.credentials) {
      return headers;
    }

    switch (this.config.apiConfig.authType) {
      case 'api_key':
        if (this.credentials.apiKey) {
          headers['X-API-Key'] = this.credentials.apiKey;
        }
        break;
      
      case 'bearer':
        if (this.credentials.accessToken) {
          headers['Authorization'] = `Bearer ${this.credentials.accessToken}`;
        }
        break;
      
      case 'basic':
        if (this.credentials.username && this.credentials.password) {
          const encoded = Buffer.from(
            `${this.credentials.username}:${this.credentials.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;
      
      case 'oauth2':
        if (this.credentials.accessToken) {
          headers['Authorization'] = `Bearer ${this.credentials.accessToken}`;
        }
        break;
      // Bug Fix #5: Added missing signature auth type - sets X-Signature header
      case 'signature':
        if (this.credentials.signature) {
          headers['X-Signature'] = this.credentials.signature;
        }
        break;
      // Bug Fix #5: Added missing certificate auth type - requires custom implementation
      case 'certificate':
        throw new Error(
          'Certificate-based authentication requires a custom implementation. ' +
          'Use the connect() method with mTLS or provide a custom fetch handler.'
        );
    }

    return headers;
  }

  protected getCommonHeaders(): Record<string, string> {
    const contentType = this.config.apiConfig.type === 'xml' ? 'application/xml' : 'application/json';
    return {
      'Content-Type': contentType,
      'Accept': contentType,
      'User-Agent': `StaySuite-ChannelManager/1.0`,
      'X-Request-ID': this.generateCorrelationId(),
      ...this.getAuthHeaders(),
    };
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  private requestTimestamps: number[] = [];
  private rateLimitWindow: number = 60000;

  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);
    
    // Check if we're at the limit
    if (this.requestTimestamps.length >= this.config.apiConfig.rateLimit.requests) {
      let oldestRequest = Infinity;
      for (const ts of this.requestTimestamps) {
        if (ts < oldestRequest) oldestRequest = ts;
      }
      const waitTime = oldestRequest + this.rateLimitWindow - now;
      
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }
    
    // Record this request
    this.requestTimestamps.push(now);
  }

  // ============================================
  // WEBHOOK VALIDATION
  // ============================================

  protected validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Default HMAC-SHA256 validation
    // Override in subclasses for channel-specific validation
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }
}
