/**
 * ConfigurableRestClient
 * A single, config-driven REST client that replaces 28+ near-identical Tier-3 OTA clones.
 *
 * Every Tier-3 OTA follows the same REST pattern — they differ only in:
 *   - OTA identifier / display name
 *   - Default currency
 *   - Auth header name & prefix
 *   - Which credential field to read for auth
 *   - Webhook header name
 *   - Whether they are metasearch (no booking/inventory push)
 *   - Minor endpoint path variations (hotels vs properties, etc.)
 *
 * This class captures all those differences in a `RESTClientConfig` object and
 * implements the full `BaseOTAClient` contract once.
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

// ============================================
// CONFIG TYPES
// ============================================

/**
 * Which credential field on `OTACredentials` should be used as the auth value.
 */
export type AuthCredentialKey = 'apiKey' | 'accessToken' | 'username';

/**
 * Auth strategy: simple API-key-in-header, or Bearer token.
 */
export type AuthMode = 'api_key_header' | 'bearer_token' | 'oauth2_client_credentials';

/**
 * Describes the resource path pattern — some OTAs use `/hotels/{id}/...`,
 * others use `/properties/{id}/...`, `/hotel/{id}/...`, etc.
 */
export interface RESTEndpointPaths {
  /** Base resource segment, e.g. 'hotels', 'properties', 'hotel'. Default: 'hotels' */
  resourceSegment?: string;
  /** Inventory/availability sub-path. Default: 'availability' */
  inventoryPath?: string;
  /** Rates sub-path. Default: 'rates' */
  ratesPath?: string;
  /** Restrictions sub-path. Default: 'restrictions' */
  restrictionsPath?: string;
  /** Bookings sub-path. Default: 'bookings' */
  bookingsPath?: string;
  /** Reservations path (alternative to bookings). If set, overrides bookingsPath for list/single/confirm/cancel. */
  reservationsPath?: string;
  /** Inventory read sub-path when different from write. Default: same as inventoryPath */
  inventoryReadPath?: string;
  /** Inventory write sub-path. Default: same as inventoryPath */
  inventoryWritePath?: string;
  /** API version prefix, e.g. '/v1', '/v2'. Default: '' */
  apiVersionPrefix?: string;
}

/**
 * Complete configuration for a single Tier-3 REST OTA.
 */
export interface RESTClientConfig {
  /** OTA identifier, e.g. 'priceline' */
  otaId: string;
  /** Human-readable OTA name, e.g. 'Priceline' */
  otaName: string;
  /** Default currency code. Default: 'USD' */
  defaultCurrency?: string;
  /** Default country code for guest country fallback. Default: '' */
  defaultCountry?: string;

  // --- Auth ---
  /** How to authenticate. Default: 'api_key_header' */
  authMode?: AuthMode;
  /** Header name for API-key auth, e.g. 'X-Priceline-Key', 'X-API-Key', 'Authorization'. Default: 'X-API-Key' */
  authHeaderName?: string;
  /** Prefix prepended to the credential value, e.g. 'Bearer '. Default: '' */
  authHeaderPrefix?: string;
  /** Which credential field to use for auth. Default: 'apiKey' */
  authCredentialKey?: AuthCredentialKey;

  // --- OAuth2 client-credentials ---
  /** If authMode is 'oauth2_client_credentials', the token endpoint path. */
  tokenEndpoint?: string;

  // --- Webhook ---
  /** Header name checked in processWebhook, e.g. 'X-Priceline-Event'. Default: 'X-Event-Type' */
  webhookHeaderName?: string;
  /** Default webhook event type fallback. Default: 'unknown' */
  webhookDefaultEvent?: string;

  // --- Metasearch ---
  /** If true, inventory push / restrictions / bookings are no-ops. Default: false */
  isMetasearch?: boolean;
  /** Metasearch connection test message suffix. Default: '' */
  metasearchLabel?: string;

  // --- Endpoint overrides ---
  /** Custom endpoint paths. All defaults follow the standard REST pattern. */
  endpoints?: RESTEndpointPaths;

  // --- Response field overrides ---
  /** Field name used in inventory response array. Default: 'availability' */
  inventoryResponseKey?: string;
  /** Additional inventory response keys to check (fallback). Default: ['data'] */
  inventoryFallbackKeys?: string[];
  /** Room ID field name in responses. Default: 'room_id' */
  roomIdField?: string;
  /** Rate plan ID field name in responses. Default: 'rate_plan_id' */
  ratePlanIdField?: string;
}

// ============================================
// CLIENT IMPLEMENTATION
// ============================================

export class ConfigurableRestClient extends BaseOTAClient {
  private readonly cfg: Required<RESTClientConfig>;
  private accessToken: string | null = null;

  constructor(config: OTAConfig, clientConfig: RESTClientConfig) {
    super(config);
    // Apply defaults — `Required<>` ensures we never check for undefined at runtime
    this.cfg = {
      otaId: clientConfig.otaId,
      otaName: clientConfig.otaName,
      defaultCurrency: clientConfig.defaultCurrency ?? 'USD',
      defaultCountry: clientConfig.defaultCountry ?? '',
      authMode: clientConfig.authMode ?? 'api_key_header',
      authHeaderName: clientConfig.authHeaderName ?? 'X-API-Key',
      authHeaderPrefix: clientConfig.authHeaderPrefix ?? '',
      authCredentialKey: clientConfig.authCredentialKey ?? 'apiKey',
      tokenEndpoint: clientConfig.tokenEndpoint ?? '/auth/token',
      webhookHeaderName: clientConfig.webhookHeaderName ?? 'X-Event-Type',
      webhookDefaultEvent: clientConfig.webhookDefaultEvent ?? 'unknown',
      isMetasearch: clientConfig.isMetasearch ?? false,
      metasearchLabel: clientConfig.metasearchLabel ?? '',
      endpoints: {
        resourceSegment: clientConfig.endpoints?.resourceSegment ?? 'hotels',
        inventoryPath: clientConfig.endpoints?.inventoryPath ?? 'availability',
        ratesPath: clientConfig.endpoints?.ratesPath ?? 'rates',
        restrictionsPath: clientConfig.endpoints?.restrictionsPath ?? 'restrictions',
        bookingsPath: clientConfig.endpoints?.bookingsPath ?? 'bookings',
        reservationsPath: clientConfig.endpoints?.reservationsPath,
        inventoryReadPath: clientConfig.endpoints?.inventoryReadPath ?? clientConfig.endpoints?.inventoryPath ?? 'availability',
        inventoryWritePath: clientConfig.endpoints?.inventoryWritePath ?? clientConfig.endpoints?.inventoryPath ?? 'availability',
        apiVersionPrefix: clientConfig.endpoints?.apiVersionPrefix ?? '',
      },
      inventoryResponseKey: clientConfig.inventoryResponseKey ?? 'availability',
      inventoryFallbackKeys: clientConfig.inventoryFallbackKeys ?? ['data'],
      roomIdField: clientConfig.roomIdField ?? 'room_id',
      ratePlanIdField: clientConfig.ratePlanIdField ?? 'rate_plan_id',
    };
  }

  // ============================================
  // PATH BUILDERS
  // ============================================

  private get ep() {
    return this.cfg.endpoints;
  }

  /** e.g. /v1/hotels/{hotelId} */
  private resourceBase(): string {
    const prefix = this.ep.apiVersionPrefix ? `${this.ep.apiVersionPrefix}/` : '';
    return `${this.baseUrl}${prefix}${this.ep.resourceSegment}/${this.credentials?.hotelId}`;
  }

  /** e.g. /v1/hotels/{hotelId}/availability */
  private inventoryReadUrl(): string {
    return `${this.resourceBase()}/${this.ep.inventoryReadPath}`;
  }

  /** e.g. /v1/hotels/{hotelId}/availability */
  private inventoryWriteUrl(): string {
    return `${this.resourceBase()}/${this.ep.inventoryWritePath}`;
  }

  /** e.g. /v1/rates  or  /v1/hotels/{hotelId}/rates */
  private ratesUrl(): string {
    if (this.ep.ratesPath!.includes('/')) return `${this.baseUrl}${this.ep.apiVersionPrefix}/${this.ep.ratesPath}`;
    return `${this.resourceBase()}/${this.ep.ratesPath}`;
  }

  /** e.g. /v1/restrictions  or  /v1/hotels/{hotelId}/restrictions */
  private restrictionsUrl(): string {
    if (this.ep.restrictionsPath!.includes('/')) return `${this.baseUrl}${this.ep.apiVersionPrefix}/${this.ep.restrictionsPath}`;
    return `${this.resourceBase()}/${this.ep.restrictionsPath}`;
  }

  /** Use reservationsPath if set, otherwise bookingsPath */
  private get bookingsSegment(): string {
    return this.ep.reservationsPath ?? this.ep.bookingsPath!;
  }

  /** e.g. /v1/bookings */
  private bookingsListUrl(): string {
    if (this.bookingsSegment.includes('/')) return `${this.baseUrl}${this.ep.apiVersionPrefix}/${this.bookingsSegment}`;
    return `${this.baseUrl}${this.ep.apiVersionPrefix}/${this.bookingsSegment}`;
  }

  /** e.g. /v1/bookings/{id} */
  private bookingDetailUrl(id: string): string {
    return `${this.bookingsListUrl()}/${id}`;
  }

  /** e.g. /v1/bookings/{id}/confirm */
  private bookingConfirmUrl(id: string): string {
    return `${this.bookingsListUrl()}/${id}/confirm`;
  }

  /** e.g. /v1/bookings/{id}/cancel */
  private bookingCancelUrl(id: string): string {
    return `${this.bookingsListUrl()}/${id}/cancel`;
  }

  // ============================================
  // CONNECTION
  // ============================================

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    // If OAuth2 client-credentials mode, fetch a token first
    if (this.cfg.authMode === 'oauth2_client_credentials') {
      try {
        const tokenResponse = await this.fetchWithRetry<any>(
          `${this.baseUrl}${this.cfg.tokenEndpoint}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: credentials.apiKey || '',
              client_secret: credentials.apiSecret || '',
            }),
          }
        );
        if (tokenResponse.access_token) {
          this.accessToken = tokenResponse.access_token;
          return await this.testConnection();
        }
        return {
          success: false,
          message: `Failed to authenticate with ${this.cfg.otaName}`,
          errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
        };
      } catch (error) {
        return {
          success: false,
          message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.cfg.otaName}`)],
        };
      }
    }

    try {
      return await this.testConnection();
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.cfg.otaName}`)],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.resourceBase()}`,
        { method: 'GET', headers: this.getCommonHeaders() }
      );
      const label = this.cfg.isMetasearch ? ` ${this.cfg.metasearchLabel || '(metasearch)'}`.trimEnd() : '';
      return {
        success: true,
        message: `Successfully connected to ${this.cfg.otaName}${label ? ' ' + label : ''}`,
        propertyInfo: {
          id: response.hotelId || response.propertyId || this.credentials?.hotelId || '',
          name: response.name || response.propertyName || 'Unknown',
          roomCount: response.roomCount || response.listingCount || response.bedTypes?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')],
      };
    }
  }

  // ============================================
  // INVENTORY
  // ============================================

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    if (this.cfg.isMetasearch) {
      // Metasearch: availability is read-only but still fetchable
      const params = this.buildDateParams(startDate, endDate, roomTypeIds);
      const response = await this.fetchWithRetry<any>(
        `${this.resourceBase()}/availability?${params}`,
        { method: 'GET', headers: this.getCommonHeaders() }
      );
      return this.parseInventoryResponse(response);
    }

    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.inventoryReadUrl()}?${params}`,
      { method: 'GET', headers: this.getCommonHeaders() }
    );
    return this.parseInventoryResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    if (this.cfg.isMetasearch) {
      const correlationId = this.generateCorrelationId();
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', 0, correlationId);
    }

    const correlationId = this.generateCorrelationId();
    try {
      const ridField = this.cfg.roomIdField;
      await this.fetchWithRetry(
        this.inventoryWriteUrl(),
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({
            updates: updates.map(u => ({
              [ridField]: u.externalRoomId,
              date: u.date,
              available: u.availableRooms,
              total: u.totalRooms || u.availableRooms,
            })),
          }),
        }
      );
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '', 'inventory', 'outbound',
        error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length
      );
    }
  }

  // ============================================
  // RATES
  // ============================================

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));

    const url = this.cfg.isMetasearch
      ? `${this.resourceBase()}/${this.ep.ratesPath}?${params}`
      : `${this.ratesUrl()}?${params}`;

    const response = await this.fetchWithRetry<any>(url, { method: 'GET', headers: this.getCommonHeaders() });
    const ridField = this.cfg.roomIdField;
    const rpidField = this.cfg.ratePlanIdField;
    return (response?.rates || []).map((r: any) => ({
      externalRoomId: r[ridField] || r.roomId || r.room_id,
      externalRatePlanId: r[rpidField] || r.ratePlanId || r.rate_plan_id,
      date: r.date,
      baseRate: r.price,
      currency: r.currency || this.cfg.defaultCurrency,
      available: r.available !== false,
    }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      const ridField = this.cfg.roomIdField;
      const rpidField = this.cfg.ratePlanIdField;
      const url = this.cfg.isMetasearch
        ? `${this.resourceBase()}/${this.ep.ratesPath}`
        : this.ratesUrl();

      await this.fetchWithRetry(url, {
        method: 'PUT',
        headers: this.getCommonHeaders(),
        body: JSON.stringify({
          rates: updates.map(u => ({
            [ridField]: u.externalRoomId,
            [rpidField]: u.externalRatePlanId,
            date: u.date,
            price: u.baseRate,
            currency: u.currency || this.cfg.defaultCurrency,
          })),
        }),
      });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '', 'rates', 'outbound',
        error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length
      );
    }
  }

  // ============================================
  // RESTRICTIONS
  // ============================================

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    if (this.cfg.isMetasearch) return [];

    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.restrictionsUrl()}?${params}`,
      { method: 'GET', headers: this.getCommonHeaders() }
    );
    const ridField = this.cfg.roomIdField;
    return (response?.restrictions || []).map((r: any) => ({
      externalRoomId: r[ridField] || r.roomId || r.room_id,
      date: r.date,
      closedToArrival: r.closed_to_arrival || r.closedToArrival || false,
      closedToDeparture: r.closed_to_departure || r.closedToDeparture || false,
      closed: r.closed || false,
      minStay: r.min_stay || r.minStay || 1,
      maxStay: r.max_stay || r.maxStay || 99,
    }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    if (this.cfg.isMetasearch) {
      const correlationId = this.generateCorrelationId();
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', 0, correlationId);
    }

    const correlationId = this.generateCorrelationId();
    try {
      const ridField = this.cfg.roomIdField;
      await this.fetchWithRetry(this.restrictionsUrl(), {
        method: 'PUT',
        headers: this.getCommonHeaders(),
        body: JSON.stringify({
          restrictions: updates.map(u => ({
            [ridField]: u.externalRoomId,
            date: u.date,
            closed_to_arrival: u.closedToArrival,
            closed_to_departure: u.closedToDeparture,
            closed: u.closed,
            min_stay: u.minStay || 1,
            max_stay: u.maxStay || 99,
          })),
        }),
      });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '', 'restrictions', 'outbound',
        error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length
      );
    }
  }

  // ============================================
  // BOOKINGS
  // ============================================

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    if (this.cfg.isMetasearch) return [];

    const params = new URLSearchParams({
      start_date: this.formatDate(startDate),
      end_date: this.formatDate(endDate),
    });
    if (status?.length) params.append('status', status.join(','));

    const response = await this.fetchWithRetry<any>(
      `${this.bookingsListUrl()}?${params}`,
      { method: 'GET', headers: this.getCommonHeaders() }
    );
    const list = response?.bookings || response?.reservations || response?.data || [];
    return list.map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    if (this.cfg.isMetasearch) return null;

    const response = await this.fetchWithRetry<any>(
      this.bookingDetailUrl(externalId),
      { method: 'GET', headers: this.getCommonHeaders() }
    );
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    if (this.cfg.isMetasearch) return true;
    try {
      await this.fetchWithRetry(this.bookingConfirmUrl(externalId), {
        method: 'POST',
        headers: this.getCommonHeaders(),
      });
      return true;
    } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    if (this.cfg.isMetasearch) return true;
    try {
      await this.fetchWithRetry(this.bookingCancelUrl(externalId), {
        method: 'POST',
        headers: this.getCommonHeaders(),
        body: JSON.stringify({ reason }),
      });
      return true;
    } catch { return false; }
  }

  // ============================================
  // WEBHOOKS & HEALTH
  // ============================================

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return {
      success: true,
      eventType: headers[this.cfg.webhookHeaderName] || payload?.event_type || this.cfg.webhookDefaultEvent,
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return `/api/ota/webhooks/${this.cfg.otaId}`;
  }

  async getHealthStatus(): Promise<any> {
    try {
      const r = await this.testConnection();
      return r.success ? 'healthy' : 'unhealthy';
    } catch { return 'unhealthy'; }
  }

  // ============================================
  // AUTH OVERRIDE
  // ============================================

  protected getAuthHeaders(): Record<string, string> {
    if (this.cfg.authMode === 'bearer_token' || this.cfg.authMode === 'oauth2_client_credentials') {
      const token = this.accessToken || this.credentials?.accessToken;
      if (token) return { [this.cfg.authHeaderName]: `${this.cfg.authHeaderPrefix}${token}`.trim() };
      return super.getAuthHeaders();
    }

    // api_key_header mode
    const credValue = this.credentials?.[this.cfg.authCredentialKey as keyof OTACredentials] as string | undefined;
    if (credValue) {
      const headerValue = this.cfg.authHeaderPrefix
        ? `${this.cfg.authHeaderPrefix}${credValue}`
        : credValue;
      return { [this.cfg.authHeaderName]: headerValue };
    }
    return super.getAuthHeaders();
  }

  // ============================================
  // HELPERS
  // ============================================

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({
      start_date: this.formatDate(startDate),
      end_date: this.formatDate(endDate),
    });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseInventoryResponse(response: any): any[] {
    const ridField = this.cfg.roomIdField;
    let items = response?.[this.cfg.inventoryResponseKey] || [];
    if (!items.length) {
      for (const fallbackKey of this.cfg.inventoryFallbackKeys) {
        items = response?.[fallbackKey] || [];
        if (items.length) break;
      }
    }
    if (!items.length && Array.isArray(response?.inventory)) items = response.inventory;
    return items.map((r: any) => ({
      externalRoomId: r[ridField] || r.roomId || r.room_id || r.bedTypeId || r.bed_type_id || r.property_id,
      date: r.date,
      availableRooms: r.available || r.availableBeds || r.available_beds || r.vacantCount || r.vacant_count || r.quota || 0,
      totalRooms: r.total || r.totalBeds || r.total_beds || r.totalCount || r.total_count || r.stock || r.available || 0,
    }));
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response?.reservation || response;
    if (!r) return null;
    const ridField = this.cfg.roomIdField;
    const rpidField = this.cfg.ratePlanIdField;
    return {
      externalId: r.id || r.booking_id || r.reservationId || r.reservationNo || '',
      guest: {
        firstName: r.guest?.first_name || r.guest_first_name || r.guestFirstName || r.guestName || '',
        lastName: r.guest?.last_name || r.guest_last_name || r.guestLastName || '',
        email: r.guest?.email || r.guestEmail || r.guest_email || '',
        phone: r.guest?.phone || r.guestPhone || r.guest_phone || '',
        country: r.guest?.country || r.guestCountry || r.guest_country || this.cfg.defaultCountry,
      },
      room: {
        externalRoomId: r[ridField] || r.room_id || r.bedTypeId || r.bed_type_id || r.property_id || '',
        externalRatePlanId: r[rpidField] || r.rate_plan_id || r.ratePlanId || r.planId || '',
      },
      dates: {
        checkIn: r.check_in || r.checkIn || r.checkinDate || r.checkin_date || r.arrival_date || '',
        checkOut: r.check_out || r.checkOut || r.checkoutDate || r.checkout_date || r.departure_date || '',
      },
      guests: {
        adults: r.adults || r.adultCount || r.adult_count || r.num_adults || r.adultNum || 1,
        children: r.children || r.childCount || r.child_count || r.num_children || r.childNum || 0,
        total: (r.adults || r.adultCount || r.adult_count || r.num_adults || r.adultNum || 1) +
               (r.children || r.childCount || r.child_count || r.num_children || r.childNum || 0),
      },
      pricing: {
        roomRate: r.room_rate || r.grossRate || r.gross_rate || r.pricePerBed || r.price_per_bed || r.roomCharge || r.price || 0,
        taxes: r.taxes || r.vatAmount || r.vat_amount || r.tax || 0,
        fees: r.fees || r.serviceCharge || r.serviceFee || r.bathTax || 0,
        discount: r.discount || 0,
        totalAmount: r.total_amount || r.totalAmount || r.total_price || r.totalCharge || r.total_charge || r.total || 0,
        currency: r.currency || this.cfg.defaultCurrency,
        commission: r.commission || 0,
        commissionType: 'percentage' as const,
      },
      payment: {
        method: r.payment_method || r.paymentMethod || r.payment_type || (r.prepaid ? 'prepaid' : 'collect'),
      },
      specialRequests: r.special_requests || r.specialRequests || r.remarks || r.wishes || '',
      status: r.status || 'unknown',
      createdAt: r.created_at || r.createdAt || r.reserveDate || r.reserveDatetime || '',
      source: this.cfg.otaId,
    };
  }
}
