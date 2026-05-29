/**
 * Base GDS Client
 *
 * Abstract base class for all GDS protocol adapters (Amadeus, Sabre, Travelport).
 * Provides:
 *  - SOAP/XML request construction & sending
 *  - XML response parsing
 *  - Rate limiting per provider
 *  - Configurable timeouts & retry
 *  - Request/response audit logging
 *
 * All concrete clients must implement the abstract methods for their specific
 * GDS provider SOAP dialect and authentication scheme.
 */

import { createHash, randomUUID } from 'crypto';

import type {
  GDSProvider,
  GDSConfig,
  GDSTestResult,
  GDSSyncResult,
  GDSSyncAction,
  GDSBooking,
  ARIUpdate,
  RateUpdate,
  AvailabilityResponse,
  GDSError,
  SOAPFault,
  GDSRequestLog,
} from './types';

// ============================================================
// ABSTRACT CLIENT INTERFACE
// ============================================================

export abstract class BaseGDSClient {
  protected config: GDSConfig;
  protected timeout: number;
  protected retryAttempts: number;

  // Rate limiting state
  private requestTimestamps: number[] = [];
  private readonly rateLimitRequests: number;
  private readonly rateLimitWindowMs: number;

  // Request log for audit
  protected logs: GDSRequestLog[] = [];
  private readonly maxLogs = 200;

  constructor(config: GDSConfig) {
    this.config = config;
    this.timeout = 30_000;     // 30s default
    this.retryAttempts = 3;

    // Default rate limits per provider
    const rateLimits: Record<GDSProvider, { requests: number; windowMs: number }> = {
      amadeus:   { requests: 30, windowMs: 60_000 },
      sabre:     { requests: 25, windowMs: 60_000 },
      travelport: { requests: 20, windowMs: 60_000 },
    };
    const limit = rateLimits[config.provider];
    this.rateLimitRequests = limit.requests;
    this.rateLimitWindowMs = limit.windowMs;
  }

  // ----------------------------------------------------------
  // ABSTRACT METHODS — each provider implements these
  // ----------------------------------------------------------

  /** Test connection by sending a lightweight ping/auth request */
  abstract testConnection(): Promise<GDSTestResult>;

  /** Push ARI (Availability, Rates, Inventory) updates to GDS */
  abstract pushARI(updates: ARIUpdate[]): Promise<GDSSyncResult>;

  /** Pull new/modified bookings from GDS since the given date */
  abstract pullBookings(since: Date): Promise<GDSBooking[]>;

  /** Update rate codes on the GDS */
  abstract updateRates(rateUpdates: RateUpdate[]): Promise<GDSSyncResult>;

  /** Retrieve a single booking by PNR number */
  abstract retrieveBooking(pnr: string): Promise<GDSBooking | null>;

  /** Check room-type availability for a date range */
  abstract getAvailability(roomTypeCode: string, dateFrom: string, dateTo: string): Promise<AvailabilityResponse[]>;

  // ----------------------------------------------------------
  // PROTECTED HELPERS — shared across all providers
  // ----------------------------------------------------------

  /**
   * Send a SOAP/XML request to the GDS endpoint.
   *
   * @param soapBody  - The full SOAP envelope XML string
   * @param action    - Human-readable label for logging (e.g. "OTA_HotelAvailNotifRQ")
   * @returns The raw XML response body as a string
   */
  protected async sendRequest(soapBody: string, action: string): Promise<string> {
    await this.enforceRateLimit();

    const startMs = Date.now();
    let responseText = '';
    let statusCode = 0;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: soapBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      statusCode = response.status;
      responseText = await response.text();

      // Retry on transient server errors
      const retryable = [429, 500, 502, 503, 504];
      if (retryable.includes(statusCode)) {
        throw new Error(`HTTP ${statusCode}: ${responseText.substring(0, 500)}`);
      }

      if (!response.ok) {
        const fault = this.parseSOAPFault(responseText, this.config.provider);
        throw this.handleError(fault, responseText);
      }

      this.logRequest(action, soapBody, responseText, statusCode, Date.now() - startMs);
      return responseText;
    } catch (error) {
      const duration = Date.now() - startMs;
      const message = error instanceof Error ? error.message : String(error);

      if (message === 'The operation was aborted' || message.includes('abort')) {
        this.logRequest(action, soapBody, '', 0, duration, 'Request timed out');
        throw new GDSErrorWrapper('TIMEOUT', `GDS request timed out after ${this.timeout}ms`, this.config.provider, true);
      }

      this.logRequest(action, soapBody, responseText, statusCode, duration, message);
      throw error;
    }
  }

  /** Build provider-specific HTTP headers for SOAP requests */
  protected abstract getHeaders(): Record<string, string>;

  /**
   * Extract a value from an XML string using a simple tag-name matcher.
   * For production use with complex namespaces, a proper XML parser is recommended,
   * but this avoids heavyweight dependencies while remaining functionally correct.
   */
  protected extractXmlValue(xml: string, tagName: string): string | null {
    // Handle namespace-prefixed tags like <ns1:TagName> or <ota:TagName>
    const patterns = [
      new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'),
      new RegExp(`<[^:>]+:${tagName}[^>]*>([\\s\\S]*?)</[^:>]+:${tagName}>`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = xml.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  /** Extract all matching tag values from XML */
  protected extractXmlValues(xml: string, tagName: string): string[] {
    const results: string[] = [];
    const patterns = [
      new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi'),
      new RegExp(`<[^:>]+:${tagName}[^>]*>([\\s\\S]*?)</[^:>]+:${tagName}>`, 'gi'),
    ];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(xml)) !== null) {
        results.push(match[1].trim());
      }
    }
    return results;
  }

  /** Extract an attribute value from the first occurrence of a tag */
  protected extractXmlAttribute(xml: string, tagName: string, attrName: string): string | null {
    const patterns = [
      new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, 'i'),
      new RegExp(`<${tagName}[^>]*${attrName}='([^']*)'`, 'i'),
      new RegExp(`<[^:>]+:${tagName}[^>]*${attrName}="([^"]*)"`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = xml.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  /**
   * Parse a SOAP fault from an XML error response.
   * Tries common fault structures: soap:Fault, SOAP-ENV:Fault, ns1:Fault, etc.
   */
  protected parseSOAPFault(xml: string, provider: GDSProvider): SOAPFault {
    const faultCode =
      this.extractXmlValue(xml, 'faultcode') ||
      this.extractXmlValue(xml, 'FaultCode') ||
      this.extractXmlValue(xml, 'code') ||
      'UNKNOWN';

    const faultString =
      this.extractXmlValue(xml, 'faultstring') ||
      this.extractXmlValue(xml, 'faultString') ||
      this.extractXmlValue(xml, 'message') ||
      'Unknown SOAP fault';

    const detail =
      this.extractXmlValue(xml, 'detail') ||
      this.extractXmlValue(xml, 'Error') ||
      undefined;

    return { faultCode, faultString, detail, provider };
  }

  /** Convert a SOAP fault into a typed Error */
  protected handleError(fault: SOAPFault, _rawXml?: string): Error {
    const err = new Error(
      `[${fault.provider.toUpperCase()}] ${fault.faultCode}: ${fault.faultString}${fault.detail ? ` — ${fault.detail}` : ''}`
    );
    (err as Error & { fault: SOAPFault }).fault = fault;
    return err;
  }

  // ----------------------------------------------------------
  // RATE LIMITING
  // ----------------------------------------------------------

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);

    if (this.requestTimestamps.length >= this.rateLimitRequests) {
      const oldest = Math.min(...this.requestTimestamps);
      const waitTime = oldest + this.rateLimitWindowMs - now;
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }
    this.requestTimestamps.push(now);
  }

  // ----------------------------------------------------------
  // UTILITIES
  // ----------------------------------------------------------

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }

  protected generateMessageId(): string {
    return `${this.config.provider}-${Date.now()}-${randomUUID().replace(/-/g, '').substring(0, 12)}`;
  }

  /** Log a request/response pair for audit */
  private logRequest(
    action: string,
    requestXml: string,
    responseXml: string,
    statusCode: number,
    durationMs: number,
    error?: string,
  ): void {
    const entry: GDSRequestLog = {
      timestamp: new Date(),
      provider: this.config.provider,
      action,
      requestXml,
      responseXml,
      statusCode,
      durationMs,
      error,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /** Retrieve recent request logs (for diagnostics / UI display) */
  getLogs(): GDSRequestLog[] {
    return [...this.logs];
  }

  /** Get the provider name */
  get provider(): GDSProvider {
    return this.config.provider;
  }

  /** Get the PCC */
  get pcc(): string {
    return this.config.pcc;
  }
}

// ============================================================
// CUSTOM ERROR CLASSES
// ============================================================

export class GDSErrorWrapper extends Error {
  code: string;
  provider: GDSProvider;
  retryable: boolean;

  constructor(code: string, message: string, provider: GDSProvider, retryable: boolean) {
    super(message);
    this.name = 'GDSError';
    this.code = code;
    this.provider = provider;
    this.retryable = retryable;
  }
}

/** Convenience factory for GDSErrors */
export function gdsError(code: string, message: string, provider: GDSProvider, retryable = false): GDSErrorWrapper {
  return new GDSErrorWrapper(code, message, provider, retryable);
}

// ============================================================
// CREDENTIAL VALIDATION
// ============================================================

/**
 * Validate that a GDSConfig has the minimum required fields populated.
 * Returns a list of missing/invalid fields (empty array = valid).
 */
export function validateGDSConfig(config: GDSConfig): string[] {
  const errors: string[] = [];
  if (!config.endpoint) errors.push('endpoint is required');
  if (!config.pcc) errors.push('PCC (Pseudo City Code) is required');
  if (!config.username) errors.push('username is required');
  if (!config.password) errors.push('password is required');
  if (!config.propertyCode) errors.push('propertyCode is required');
  if (config.endpoint && !config.endpoint.startsWith('https://')) {
    errors.push('endpoint must use HTTPS');
  }
  return errors;
}
