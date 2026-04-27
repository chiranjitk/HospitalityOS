/**
 * OTA Client Factory
 * Factory for creating OTA API clients
 */

import crypto from 'crypto';

import { OTAConfig, OTACredentials, OTAAPIClient } from './types';
import { ALL_OTAS, getOTAById } from './config';
import { BaseOTAClient } from './base-client';

// ============================================
// XML ESCAPE HELPER
// ============================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================
// SPECIFIC OTA CLIENT IMPLEMENTATIONS
// ============================================

/**
 * Booking.com API Client
 * Uses XML-based API with Basic authentication
 */
class BookingComClient extends BaseOTAClient {
  private sessionId: string | null = null;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    
    try {
      // Booking.com uses a login endpoint to get a session
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
          },
          body: this.buildLoginXML(credentials),
        }
      );

      if (response.success === true) {
        this.sessionId = response.session_id;
        return await this.testConnection();
      }

      return {
        success: false,
        message: 'Failed to authenticate with Booking.com',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Booking.com')],
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.sessionId) {
      try {
        await this.fetchWithRetry(
          `${this.baseUrl}/xml/logout`,
          {
            method: 'POST',
            headers: {
              ...this.getCommonHeaders(),
              'Content-Type': 'application/xml',
            },
          }
        );
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
    }
    this.sessionId = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/hotels`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: this.buildHotelRequestXML(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Booking.com',
        propertyInfo: {
          id: this.credentials?.hotelId || '',
          name: response.hotel?.name || 'Unknown',
          roomCount: response.hotel?.rooms?.length || 0,
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const xml = this.buildInventoryRequestXML(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/roomavailability`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseInventoryResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const xml = this.buildInventoryUpdateXML(updates);
    const correlationId = this.generateCorrelationId();
    
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/roomavailability`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const xml = this.buildRateRequestXML(startDate, endDate, roomTypeIds, ratePlanIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/hotelrates`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseRateResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const xml = this.buildRateUpdateXML(updates);
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/hotelrates`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const xml = this.buildRestrictionsRequestXML(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/restrictions`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseRestrictionsResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const xml = this.buildRestrictionsUpdateXML(updates);
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/restrictions`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const xml = this.buildBookingsRequestXML(startDate, endDate, status);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/reservations`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseBookingsResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const xml = this.buildSingleBookingRequestXML(externalId);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/xml/reservations`,
      {
        method: 'POST',
        headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
        body: xml,
      }
    );
    return this.parseSingleBookingResponse(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      const xml = this.buildConfirmBookingXML(externalId);
      await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/reservations`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      const xml = this.buildCancelBookingXML(externalId, reason);
      await this.fetchWithRetry<any>(
        `${this.baseUrl}/xml/reservations`,
        {
          method: 'POST',
          headers: { ...this.getCommonHeaders(), 'Content-Type': 'application/xml' },
          body: xml,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const eventType = headers['X-Booking-Event'] || 'unknown';
    
    return {
      success: true,
      eventType,
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return `/api/ota/webhooks/booking_com`;
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  // XML Builder methods
  private buildLoginXML(credentials: OTACredentials): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <username>${escapeXml(credentials.username || '')}</username>
  <password>${escapeXml(credentials.password || '')}</password>
</request>`;
  }

  private buildHotelRequestXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${escapeXml(this.credentials?.hotelId || '')}</hotel_id>
</request>`;
  }

  private buildInventoryRequestXML(startDate: Date, endDate: Date, roomTypeIds?: string[]): string {
    const roomsXml = roomTypeIds?.map(id => `<room_id>${escapeXml(id)}</room_id>`).join('') || '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${escapeXml(this.credentials?.hotelId || '')}</hotel_id>
  <date_from>${this.formatDate(startDate)}</date_from>
  <date_to>${this.formatDate(endDate)}</date_to>
  <rooms>${roomsXml}</rooms>
</request>`;
  }

  private buildInventoryUpdateXML(updates: any[]): string {
    const updatesXml = updates.map(u => `
    <room>
      <room_id>${escapeXml(u.externalRoomId)}</room_id>
      <date>${escapeXml(u.date)}</date>
      <availability>${u.availableRooms}</availability>
    </room>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${escapeXml(this.credentials?.hotelId || '')}</hotel_id>
  <rooms>${updatesXml}
  </rooms>
</request>`;
  }

  private buildRateRequestXML(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${escapeXml(this.credentials?.hotelId || '')}</hotel_id>
  <date_from>${this.formatDate(startDate)}</date_from>
  <date_to>${this.formatDate(endDate)}</date_to>
</request>`;
  }

  private buildRateUpdateXML(updates: any[]): string {
    const updatesXml = updates.map(u => `
    <rate>
      <room_id>${escapeXml(u.externalRoomId)}</room_id>
      <rate_plan_id>${escapeXml(u.externalRatePlanId)}</rate_plan_id>
      <date>${escapeXml(u.date)}</date>
      <price>${u.baseRate}</price>
      <currency>${escapeXml(u.currency)}</currency>
    </rate>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${escapeXml(this.credentials?.hotelId || '')}</hotel_id>
  <rates>${updatesXml}
  </rates>
</request>`;
  }

  private buildRestrictionsRequestXML(startDate: Date, endDate: Date, roomTypeIds?: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${escapeXml(this.credentials?.hotelId || '')}</hotel_id>
  <date_from>${this.formatDate(startDate)}</date_from>
  <date_to>${this.formatDate(endDate)}</date_to>
</request>`;
  }

  private buildRestrictionsUpdateXML(updates: any[]): string {
    const updatesXml = updates.map(u => `
    <restriction>
      <room_id>${escapeXml(u.externalRoomId)}</room_id>
      <date>${escapeXml(u.date)}</date>
      <closed_to_arrival>${u.closedToArrival ? 1 : 0}</closed_to_arrival>
      <closed_to_departure>${u.closedToDeparture ? 1 : 0}</closed_to_departure>
      <closed>${u.closed ? 1 : 0}</closed>
      <min_stay>${u.minStayThrough || 1}</min_stay>
    </restriction>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${escapeXml(this.credentials?.hotelId || '')}</hotel_id>
  <restrictions>${updatesXml}
  </restrictions>
</request>`;
  }

  private buildBookingsRequestXML(startDate: Date, endDate: Date, status?: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <hotel_id>${escapeXml(this.credentials?.hotelId || '')}</hotel_id>
  <checkin_from>${this.formatDate(startDate)}</checkin_from>
  <checkin_to>${this.formatDate(endDate)}</checkin_to>
</request>`;
  }

  private buildSingleBookingRequestXML(externalId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <reservation_id>${escapeXml(externalId)}</reservation_id>
</request>`;
  }

  private buildConfirmBookingXML(externalId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <reservation_id>${escapeXml(externalId)}</reservation_id>
  <status>confirmed</status>
</request>`;
  }

  private buildCancelBookingXML(externalId: string, reason: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <reservation_id>${escapeXml(externalId)}</reservation_id>
  <status>cancelled</status>
  <cancellation_reason>${escapeXml(reason)}</cancellation_reason>
</request>`;
  }

  // Response parsers
  private parseInventoryResponse(response: any): any[] {
    // Parse XML response to inventory data
    return response?.rooms?.map((r: any) => ({
      externalRoomId: r.room_id,
      date: r.date,
      availableRooms: r.availability,
      totalRooms: r.total || r.availability,
    })) || [];
  }

  private parseRateResponse(response: any): any[] {
    return response?.rates?.map((r: any) => ({
      externalRoomId: r.room_id,
      externalRatePlanId: r.rate_plan_id,
      date: r.date,
      baseRate: r.price,
      currency: r.currency,
      available: r.available !== 0,
    })) || [];
  }

  private parseRestrictionsResponse(response: any): any[] {
    return response?.restrictions?.map((r: any) => ({
      externalRoomId: r.room_id,
      date: r.date,
      closedToArrival: r.closed_to_arrival === 1,
      closedToDeparture: r.closed_to_departure === 1,
      closed: r.closed === 1,
      minStay: r.min_stay || 1,
      maxStay: r.max_stay || 99,
    })) || [];
  }

  private parseBookingsResponse(response: any): any[] {
    return response?.reservations?.map(this.parseBooking.bind(this)) || [];
  }

  private parseSingleBookingResponse(response: any): any {
    return this.parseBooking(response?.reservation);
  }

  private parseBooking(r: any): any {
    return {
      guest: {
        firstName: r.guest_first_name,
        lastName: r.guest_last_name,
        email: r.guest_email,
        phone: r.guest_phone,
        country: r.guest_country,
      },
      room: {
        externalRoomId: r.room_id,
        externalRatePlanId: r.rate_plan_id,
      },
      dates: {
        checkIn: r.checkin_date,
        checkOut: r.checkout_date,
      },
      guests: {
        adults: r.num_adults || 1,
        children: r.num_children || 0,
      },
      pricing: {
        roomRate: r.room_rate,
        taxes: r.taxes || 0,
        fees: r.fees || 0,
        discount: r.discount || 0,
        totalAmount: r.total_price,
        currency: r.currency,
        commission: r.commission || 0,
        commissionType: 'percentage' as const,
      },
      payment: {
        method: r.prepaid ? 'prepaid' : 'collect',
      },
      specialRequests: r.special_requests,
      createdAt: r.created_at,
      source: 'booking_com',
    };
  }
}

/**
 * Expedia API Client
 * Uses REST API with OAuth2 authentication
 */
class ExpediaClient extends BaseOTAClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    
    try {
      const tokenResponse = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/auth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            username: credentials.username || '',
            password: credentials.password || '',
          }).toString(),
        }
      );

      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
        return await this.testConnection();
      }

      return {
        success: false,
        message: 'Failed to authenticate with Expedia',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Expedia')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Expedia',
        propertyInfo: {
          id: response.hotelId,
          name: response.name,
          roomCount: response.roomCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/inventory?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}` +
      (roomTypeIds ? `&roomTypeIds=${roomTypeIds.join(',')}` : ''),
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.inventory || [];
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/inventory`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/rates?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.rates || [];
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/rates`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/restrictions?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.restrictions || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/restrictions`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/bookings?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}` +
      (status ? `&status=${status.join(',')}` : ''),
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.bookings || [];
  }

  async getBooking(externalId: string): Promise<any> {
    return await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/bookings/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/bookings/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/bookings/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return {
      success: true,
      eventType: headers['X-Expedia-Event'] || 'unknown',
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return `/api/ota/webhooks/expedia`;
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) {
      return { 'Authorization': `Bearer ${this.accessToken}` };
    }
    return super.getAuthHeaders();
  }
}

// ============================================
// AIRBNB CLIENT
// ============================================

/**
 * Airbnb API Client
 * Uses REST API with OAuth2 authentication and calendar-based inventory sync
 * API: https://api.airbnb.com/v2
 */
class AirbnbClient extends BaseOTAClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private static readonly RATE_LIMIT_REQUESTS = 100;
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      const tokenResponse = await this.fetchWithRetry<any>(
        `${this.baseUrl}/oauth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: credentials.additionalFields?.authCode
              ? 'authorization_code'
              : 'client_credentials',
            client_id: credentials.apiKey || '',
            client_secret: credentials.apiSecret || '',
            ...(credentials.additionalFields?.authCode ? { code: credentials.additionalFields.authCode } : {}),
            ...(credentials.refreshToken ? { refresh_token: credentials.refreshToken } : {}),
          }).toString(),
        }
      );

      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        this.refreshToken = tokenResponse.refresh_token || null;
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
        return await this.testConnection();
      }

      return {
        success: false,
        message: 'Failed to authenticate with Airbnb',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Airbnb')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/listings/${this.credentials?.hotelId}`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Airbnb',
        propertyInfo: {
          id: response.listing?.id || this.credentials?.hotelId,
          name: response.listing?.name || 'Unknown',
          roomCount: response.listing?.bedrooms || 1,
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const listingId = roomTypeIds?.[0] || this.credentials?.hotelId || '';
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/listings/${listingId}/calendar?` +
      `start_date=${this.formatDate(startDate)}&end_date=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseCalendarInventory(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      // Airbnb updates availability per-date on each listing
      const groupedByListing = this.groupUpdatesByListing(updates);

      for (const [listingId, listingUpdates] of Array.from(groupedByListing)) {
        for (const update of listingUpdates as any[]) {
          await this.fetchWithRetry(
            `${this.baseUrl}/listings/${listingId}/calendar/${update.date}`,
            {
              method: 'PATCH',
              headers: this.getCommonHeaders(),
              body: JSON.stringify({
                available: update.availableRooms > 0,
                daily_price: update.price,
              }),
            }
          );
        }
      }

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const listingId = roomTypeIds?.[0] || this.credentials?.hotelId || '';
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/listings/${listingId}/pricing?` +
      `start_date=${this.formatDate(startDate)}&end_date=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parsePricingResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const groupedByListing = this.groupUpdatesByListing(updates);

      for (const [listingId, listingUpdates] of Array.from(groupedByListing)) {
        for (const update of listingUpdates as any[]) {
          await this.fetchWithRetry(
            `${this.baseUrl}/listings/${listingId}/pricing/${update.date}`,
            {
              method: 'PATCH',
              headers: this.getCommonHeaders(),
              body: JSON.stringify({
                base_price: update.baseRate,
                currency: update.currency,
                ...(update.weekendPrice ? { weekend_price: update.weekendPrice } : {}),
                ...(update.weeklyDiscount ? { weekly_discount_pct: update.weeklyDiscount } : {}),
                ...(update.monthlyDiscount ? { monthly_discount_pct: update.monthlyDiscount } : {}),
              }),
            }
          );
        }
      }

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const listingId = roomTypeIds?.[0] || this.credentials?.hotelId || '';
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/listings/${listingId}/house-rules`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseHouseRulesResponse(response, startDate, endDate);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const listingId = this.credentials?.hotelId || '';

      await this.fetchWithRetry(
        `${this.baseUrl}/listings/${listingId}/availability-settings`,
        {
          method: 'PATCH',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildAvailabilitySettingsPayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({
      listing_id: this.credentials?.hotelId || '',
      checkin_start: this.formatDate(startDate),
      checkin_end: this.formatDate(endDate),
    });

    if (status?.length) {
      params.append('status', status.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/reservations?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseReservationsResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/reservations/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseSingleReservation(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/reservations/${externalId}/accept`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/reservations/${externalId}/decline`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const eventType = payload?.type || payload?.event_type || 'unknown';
    const reservationData = payload?.reservation || payload?.data?.reservation;

    return {
      success: true,
      eventType,
      data: reservationData ? this.parseSingleReservation({ reservation: reservationData }) : payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/airbnb';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) {
      // Auto-refresh if token is expired or about to expire (5 minute buffer)
      if (this.tokenExpiresAt && new Date(Date.now() + 5 * 60 * 1000) >= this.tokenExpiresAt) {
        this.refreshAccessToken();
      }
      return { 'Authorization': `Bearer ${this.accessToken}` };
    }
    return super.getAuthHeaders();
  }

  // ---- Private helpers ----

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.credentials) return;

    try {
      const tokenResponse = await this.fetchWithRetry<any>(
        `${this.baseUrl}/oauth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.credentials.apiKey || '',
            client_secret: this.credentials.apiSecret || '',
            refresh_token: this.refreshToken,
          }).toString(),
        }
      );

      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        this.refreshToken = tokenResponse.refresh_token || this.refreshToken;
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
      }
    } catch (error) {
      console.error('Airbnb token refresh failed:', error);
    }
  }

  private parseCalendarInventory(response: any): any[] {
    const days = response?.calendar?.days || response?.data || [];
    return days.map((d: any) => ({
      externalRoomId: d.listing_id || this.credentials?.hotelId || '',
      date: d.date,
      availableRooms: d.available ? 1 : 0,
      totalRooms: 1,
      status: d.status || (d.available ? 'available' : 'booked'),
    }));
  }

  private parsePricingResponse(response: any): any[] {
    const days = response?.pricing?.days || response?.data || [];
    return days.map((d: any) => ({
      externalRoomId: d.listing_id || this.credentials?.hotelId || '',
      externalRatePlanId: 'default',
      date: d.date,
      baseRate: parseFloat(d.base_price || d.nightly_price || '0'),
      currency: d.currency || 'USD',
      available: d.available !== false,
    }));
  }

  private parseHouseRulesResponse(response: any, startDate: Date, endDate: Date): any[] {
    const rules = response?.house_rules || response?.data || {};
    return [
      {
        externalRoomId: this.credentials?.hotelId || '',
        date: this.formatDate(startDate),
        closedToArrival: rules.no_arrival || false,
        closedToDeparture: rules.no_departure || false,
        closed: rules.blocked || false,
        minStay: rules.min_nights || 1,
        maxStay: rules.max_nights || 365,
      },
    ];
  }

  private buildAvailabilitySettingsPayload(updates: any[]): Record<string, any> {
    const first = updates[0] || {};
    return {
      min_nights: first.minStay || null,
      max_nights: first.maxStay || null,
      preparation_time: first.preparationTime || 0,
      booking_window: first.bookingWindow || null,
    };
  }

  private parseReservationsResponse(response: any): any[] {
    const reservations = response?.reservations || response?.data || [];
    return reservations.map((r: any) => this.parseSingleReservation({ reservation: r }));
  }

  private parseSingleReservation(response: any): any {
    const r = response?.reservation || response;
    if (!r) return null;

    return {
      externalId: r.id || r.reservation_code || '',
      guest: {
        firstName: r.guest?.first_name || r.guest_first_name || '',
        lastName: r.guest?.last_name || r.guest_last_name || '',
        email: r.guest?.email || r.guest_email || '',
        phone: r.guest?.phone || r.guest_phone || '',
        country: r.guest?.country || r.guest_country || '',
      },
      room: {
        externalRoomId: r.listing_id || r.listing?.id || '',
        externalRatePlanId: r.rate_plan_id || 'default',
      },
      dates: {
        checkIn: r.checkin || r.start_date || '',
        checkOut: r.checkout || r.end_date || '',
      },
      guests: {
        adults: r.guests?.adults || r.num_adults || 1,
        children: r.guests?.children || r.num_children || 0,
        total: r.guests?.total || (r.num_adults || 1) + (r.num_children || 0),
      },
      pricing: {
        roomRate: r.price?.total || r.total_price || 0,
        taxes: r.price?.taxes || r.taxes || 0,
        fees: r.price?.service_fee || r.service_fee || 0,
        discount: r.price?.discount || r.discount || 0,
        totalAmount: r.price?.total || r.total_price || 0,
        currency: r.currency || r.price?.currency || 'USD',
        commission: r.host_fee || r.commission || 0,
        commissionType: 'percentage' as const,
      },
      payment: {
        method: r.payment_method || 'collect',
      },
      specialRequests: r.guest_notes || r.special_requests || '',
      status: r.status || 'unknown',
      createdAt: r.created_at || r.booked_at || '',
      source: 'airbnb',
    };
  }

  private groupUpdatesByListing(updates: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    for (const update of updates) {
      const listingId = update.externalRoomId || this.credentials?.hotelId || '';
      if (!grouped.has(listingId)) {
        grouped.set(listingId, []);
      }
      grouped.get(listingId)!.push(update);
    }
    return grouped;
  }
}

// ============================================
// VRBO CLIENT
// ============================================

/**
 * Vrbo / HomeAway API Client
 * Uses REST API with OAuth2 client-credentials grant (Expedia Group ecosystem)
 * API: https://api.vrbo.com
 */
class VrboClient extends BaseOTAClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private static readonly RATE_LIMIT_REQUESTS = 200;
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      const tokenResponse = await this.fetchWithRetry<any>(
        `${this.baseUrl}/oauth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: credentials.apiKey || '',
            client_secret: credentials.apiSecret || '',
            scope: 'read:write',
          }).toString(),
        }
      );

      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
        return await this.testConnection();
      }

      return {
        success: false,
        message: 'Failed to authenticate with Vrbo',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Vrbo')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/listings/${this.credentials?.hotelId}`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Vrbo',
        propertyInfo: {
          id: response.listingId || this.credentials?.hotelId,
          name: response.name || 'Unknown',
          roomCount: response.bedroomCount || 1,
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const listingId = roomTypeIds?.[0] || this.credentials?.hotelId || '';
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/listings/${listingId}/availability?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseAvailabilityResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const listingId = this.credentials?.hotelId || '';
      const availabilityBulk = this.buildAvailabilityBulkPayload(updates);

      await this.fetchWithRetry(
        `${this.baseUrl}/listings/${listingId}/availability/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(availabilityBulk),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const listingId = roomTypeIds?.[0] || this.credentials?.hotelId || '';
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/listings/${listingId}/rates?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRatesResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const listingId = this.credentials?.hotelId || '';
      const ratesBulk = this.buildRatesBulkPayload(updates);

      await this.fetchWithRetry(
        `${this.baseUrl}/listings/${listingId}/rates/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(ratesBulk),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const listingId = roomTypeIds?.[0] || this.credentials?.hotelId || '';
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/listings/${listingId}/restrictions?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRestrictionsResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const listingId = this.credentials?.hotelId || '';
      const restrictionsBulk = this.buildRestrictionsBulkPayload(updates);

      await this.fetchWithRetry(
        `${this.baseUrl}/listings/${listingId}/restrictions/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(restrictionsBulk),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({
      listingId: this.credentials?.hotelId || '',
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });

    if (status?.length) {
      params.append('status', status.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/reservations?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseBookingsResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/reservations/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/reservations/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/reservations/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    // VRBO webhooks follow the Expedia Group event envelope
    const eventType = payload?.event?.type || payload?.type || 'unknown';
    const reservationData = payload?.event?.data || payload?.data || payload;

    return {
      success: true,
      eventType,
      data: this.parseSingleBooking(reservationData),
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/vrbo';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) {
      // Auto-refresh if token is expired or about to expire (5 minute buffer)
      if (this.tokenExpiresAt && new Date(Date.now() + 5 * 60 * 1000) >= this.tokenExpiresAt) {
        this.refreshAccessToken();
      }
      return {
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Vrbo-Integration': 'StaySuite',
      };
    }
    return super.getAuthHeaders();
  }

  // ---- Private helpers ----

  private async refreshAccessToken(): Promise<void> {
    if (!this.credentials) return;

    try {
      const tokenResponse = await this.fetchWithRetry<any>(
        `${this.baseUrl}/oauth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.credentials.apiKey || '',
            client_secret: this.credentials.apiSecret || '',
            scope: 'read:write',
          }).toString(),
        }
      );

      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
      }
    } catch (error) {
      console.error('Vrbo token refresh failed:', error);
    }
  }

  private parseAvailabilityResponse(response: any): any[] {
    const days = response?.availability?.days || response?.data || [];
    return days.map((d: any) => ({
      externalRoomId: d.listingId || this.credentials?.hotelId || '',
      date: d.date,
      availableRooms: d.available ? 1 : 0,
      totalRooms: 1,
      status: d.status || (d.available ? 'available' : 'booked'),
    }));
  }

  private parseRatesResponse(response: any): any[] {
    const days = response?.rates?.days || response?.data || [];
    return days.map((d: any) => ({
      externalRoomId: d.listingId || this.credentials?.hotelId || '',
      externalRatePlanId: d.ratePlanId || 'default',
      date: d.date,
      baseRate: parseFloat(d.baseRate || d.amount || '0'),
      currency: d.currency || 'USD',
      available: d.available !== false,
    }));
  }

  private parseRestrictionsResponse(response: any): any[] {
    const restrictions = response?.restrictions?.days || response?.data || [];
    return restrictions.map((r: any) => ({
      externalRoomId: r.listingId || this.credentials?.hotelId || '',
      date: r.date,
      closedToArrival: r.closedToArrival || false,
      closedToDeparture: r.closedToDeparture || false,
      closed: r.closed || false,
      minStay: r.minStay || 1,
      maxStay: r.maxStay || 99,
    }));
  }

  private parseBookingsResponse(response: any): any[] {
    const reservations = response?.reservations || response?.data || [];
    return reservations.map((r: any) => this.parseSingleBooking(r));
  }

  private parseSingleBooking(r: any): any {
    if (!r) return null;

    const reservation = r.reservation || r;
    const traveler = reservation.traveler || reservation.guest || {};

    return {
      externalId: reservation.id || reservation.reservationId || '',
      guest: {
        firstName: traveler.firstName || traveler.first_name || '',
        lastName: traveler.lastName || traveler.last_name || '',
        email: traveler.email || '',
        phone: traveler.phone || '',
        country: traveler.country || '',
      },
      room: {
        externalRoomId: reservation.listingId || reservation.unitId || '',
        externalRatePlanId: reservation.ratePlanId || 'default',
      },
      dates: {
        checkIn: reservation.checkIn || reservation.arrival_date || '',
        checkOut: reservation.checkOut || reservation.departure_date || '',
      },
      guests: {
        adults: reservation.adults || reservation.num_adults || 1,
        children: reservation.children || reservation.num_children || 0,
        total: reservation.totalGuests || (reservation.adults || 1) + (reservation.children || 0),
      },
      pricing: {
        roomRate: reservation.rent || reservation.total_amount || 0,
        taxes: reservation.taxes || 0,
        fees: reservation.fees || reservation.service_fee || 0,
        discount: reservation.discount || 0,
        totalAmount: reservation.total || reservation.total_price || 0,
        currency: reservation.currency || 'USD',
        commission: reservation.commission || 0,
        commissionType: 'percentage' as const,
      },
      payment: {
        method: reservation.paymentMethod || 'collect',
      },
      specialRequests: reservation.notes || reservation.special_requests || '',
      status: reservation.status || 'unknown',
      createdAt: reservation.createdAt || reservation.created_at || '',
      source: 'vrbo',
    };
  }

  private buildAvailabilityBulkPayload(updates: any[]): Record<string, any> {
    return {
      listingId: this.credentials?.hotelId || '',
      availability: updates.map(u => ({
        date: u.date,
        available: u.availableRooms > 0,
        status: u.availableRooms > 0 ? 'available' : 'blocked',
      })),
    };
  }

  private buildRatesBulkPayload(updates: any[]): Record<string, any> {
    return {
      listingId: this.credentials?.hotelId || '',
      rates: updates.map(u => ({
        date: u.date,
        baseRate: u.baseRate,
        currency: u.currency || 'USD',
        ...(u.minStay ? { minStay: u.minStay } : {}),
        ...(u.maxStay ? { maxStay: u.maxStay } : {}),
      })),
    };
  }

  private buildRestrictionsBulkPayload(updates: any[]): Record<string, any> {
    return {
      listingId: this.credentials?.hotelId || '',
      restrictions: updates.map(u => ({
        date: u.date,
        closedToArrival: u.closedToArrival || false,
        closedToDeparture: u.closedToDeparture || false,
        closed: u.closed || false,
        minStay: u.minStay || 1,
        maxStay: u.maxStay || 99,
      })),
    };
  }
}

// ============================================
// GOOGLE HOTELS CLIENT
// ============================================

/**
 * Google Hotels (Hotel Price API) Client
 * Uses XML-based API with HMAC signature authentication
 * This is a metasearch channel - primarily pushes rates, does not pull bookings.
 * API: https://www.google.com/travel/hotels (Google Hotel Price API / Hotel Center)
 */
class GoogleHotelsClient extends BaseOTAClient {
  private hmacKey: string | null = null;
  private partnerKey: string | null = null;
  private static readonly RATE_LIMIT_REQUESTS = 1000;
  private static readonly RATE_LIMIT_WINDOW_MS = 3_600_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      // Verify the API key by making a lightweight request
      this.hmacKey = credentials.apiSecret || credentials.signature || '';
      this.partnerKey = credentials.apiKey || credentials.hotelId || '';

      if (!this.hmacKey || !this.partnerKey) {
        return {
          success: false,
          message: 'Missing HMAC key or partner key for Google Hotels',
          errors: [this.createOTAError('AUTH_FAILED', 'HMAC key and partner key are required')],
        };
      }

      return await this.testConnection();
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Google Hotels')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.hmacKey = null;
    this.partnerKey = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const xml = this.buildPingRequestXML();
      const signedHeaders = this.getSignedHeaders('/ping', xml);

      await this.fetchWithRetry<any>(
        `${this.baseUrl}/ping`,
        {
          method: 'POST',
          headers: signedHeaders,
          body: xml,
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Google Hotels',
        propertyInfo: {
          id: this.credentials?.hotelId || '',
          name: 'Google Hotel Price API',
          roomCount: 0,
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    try {
      const xml = this.buildHotelPriceRequestXML('HotelPrice', startDate, endDate, roomTypeIds);
      const signedHeaders = this.getSignedHeaders('/v1/hotelprices', xml);

      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotelprices`,
        {
          method: 'POST',
          headers: signedHeaders,
          body: xml,
        }
      );
      return this.parseHotelPriceResponse(response);
    } catch (error) {
      console.error('Google Hotels getInventory error:', error);
      return [];
    }
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const xml = this.buildRatePlanInventoryXML(updates);
      const signedHeaders = this.getSignedHeaders('/v1/rateplans', xml);

      await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/rateplans`,
        {
          method: 'POST',
          headers: signedHeaders,
          body: xml,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    try {
      const xml = this.buildHotelPriceRequestXML('HotelRatePlan', startDate, endDate, roomTypeIds);
      const signedHeaders = this.getSignedHeaders('/v1/hotelrateplans', xml);

      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotelrateplans`,
        {
          method: 'POST',
          headers: signedHeaders,
          body: xml,
        }
      );
      return this.parseHotelRatePlanResponse(response);
    } catch (error) {
      console.error('Google Hotels getRates error:', error);
      return [];
    }
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const xml = this.buildRateUpdateXML(updates);
      const signedHeaders = this.getSignedHeaders('/v1/rateplans', xml);

      await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/rateplans`,
        {
          method: 'POST',
          headers: signedHeaders,
          body: xml,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        partnerKey: this.partnerKey || '',
        hotelId: this.credentials?.hotelId || '',
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
      });

      const signature = this.signQuerystring(params.toString());
      const headers = this.getCommonHeaders();
      headers['X-Signature'] = signature;

      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/restrictions?${params}`,
        {
          method: 'GET',
          headers,
        }
      );
      return this.parseRestrictionsResponse(response);
    } catch (error) {
      console.error('Google Hotels getRestrictions error:', error);
      return [];
    }
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const xml = this.buildRestrictionsUpdateXML(updates);
      const signedHeaders = this.getSignedHeaders('/v1/restrictions', xml);

      await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/restrictions`,
        {
          method: 'POST',
          headers: signedHeaders,
          body: xml,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  /**
   * Google Hotels is a metasearch channel - it does not receive bookings directly.
   * Bookings are made through Google's search result links redirecting to the
   * hotel's booking page. This method returns an empty array.
   */
  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    return [];
  }

  /**
   * Google Hotels is a metasearch channel - no booking lookup available.
   */
  async getBooking(externalId: string): Promise<any> {
    return null;
  }

  /**
   * No-op for metasearch: Google Hotels does not support booking confirmation
   * as it does not manage bookings directly.
   */
  async confirmBooking(externalId: string): Promise<boolean> {
    return true;
  }

  /**
   * No-op for metasearch: Google Hotels does not support booking cancellation
   * as it does not manage bookings directly.
   */
  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    return true;
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const eventType = payload?.event?.type || payload?.event_type || 'unknown';

    return {
      success: true,
      eventType,
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/google_hotels';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Override to include HMAC signature headers on all requests
   */
  protected getCommonHeaders(): Record<string, string> {
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml',
      'User-Agent': 'StaySuite-ChannelManager/1.0',
      'X-Partner-Key': this.partnerKey || '',
      'X-Request-ID': this.generateCorrelationId(),
    };
    return baseHeaders;
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'X-Partner-Key': this.partnerKey || '',
    };
  }

  // ---- Private helpers ----

  /**
   * Generate HMAC-SHA256 signature for a request path + body
   */
  private signPayload(path: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}|${path}|${body}`;
    const signature = crypto
      .createHmac('sha256', this.hmacKey || '')
      .update(payload)
      .digest('hex');
    return `${timestamp}.${signature}`;
  }

  /**
   * Generate HMAC-SHA256 signature for a query string
   */
  private signQuerystring(queryString: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}|${queryString}`;
    const signature = crypto
      .createHmac('sha256', this.hmacKey || '')
      .update(payload)
      .digest('hex');
    return `${timestamp}.${signature}`;
  }

  /**
   * Build full signed headers map for a POST request
   */
  private getSignedHeaders(path: string, body: string): Record<string, string> {
    const headers = this.getCommonHeaders();
    headers['X-HMAC-Signature'] = this.signPayload(path, body);
    return headers;
  }

  // ---- XML Builders ----

  private buildPingRequestXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <Ping partnerKey="${escapeXml(this.partnerKey || '')}" />
</Request>`;
  }

  private buildHotelPriceRequestXML(
    transactionType: string,
    startDate: Date,
    endDate: Date,
    roomTypeIds?: string[]
  ): string {
    const roomsXml = roomTypeIds?.map(id =>
      `<RoomID>${escapeXml(id)}</RoomID>`
    ).join('') || '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <${escapeXml(transactionType)} timestamp="${new Date().toISOString()}">
    <HotelInfo>
      <HotelID>${escapeXml(this.credentials?.hotelId || '')}</HotelID>
    </HotelInfo>
    <DateRange>
      <StartDate>${this.formatDate(startDate)}</StartDate>
      <EndDate>${this.formatDate(endDate)}</EndDate>
    </DateRange>
    ${roomsXml}
  </${escapeXml(transactionType)}>
</Request>`;
  }

  private buildRatePlanInventoryXML(updates: any[]): string {
    const roomUpdates = updates.map(u => `
      <RoomData>
        <RoomID>${escapeXml(u.externalRoomId)}</RoomID>
        <Date>${escapeXml(u.date)}</Date>
        <Available>${u.availableRooms > 0}</Available>
      </RoomData>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <HotelRatePlan timestamp="${new Date().toISOString()}">
    <HotelInfo>
      <HotelID>${escapeXml(this.credentials?.hotelId || '')}</HotelID>
    </HotelInfo>
    <RoomDataList>${roomUpdates}
    </RoomDataList>
  </HotelRatePlan>
</Request>`;
  }

  private buildRateUpdateXML(updates: any[]): string {
    const rateUpdates = updates.map(u => `
      <Rate>
        <RoomID>${escapeXml(u.externalRoomId)}</RoomID>
        <RatePlanID>${escapeXml(u.externalRatePlanId)}</RatePlanID>
        <Date>${escapeXml(u.date)}</Date>
        <BaseRate currency="${escapeXml(u.currency || 'USD')}">${u.baseRate}</BaseRate>
      </Rate>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <HotelRatePlan timestamp="${new Date().toISOString()}">
    <HotelInfo>
      <HotelID>${escapeXml(this.credentials?.hotelId || '')}</HotelID>
    </HotelInfo>
    <RateList>${rateUpdates}
    </RateList>
  </HotelRatePlan>
</Request>`;
  }

  private buildRestrictionsUpdateXML(updates: any[]): string {
    const restrictionUpdates = updates.map(u => `
      <Restriction>
        <RoomID>${escapeXml(u.externalRoomId)}</RoomID>
        <Date>${escapeXml(u.date)}</Date>
        <ClosedToArrival>${u.closedToArrival ? 'true' : 'false'}</ClosedToArrival>
        <ClosedToDeparture>${u.closedToDeparture ? 'true' : 'false'}</ClosedToDeparture>
        <Closed>${u.closed ? 'true' : 'false'}</Closed>
        <MinStay>${u.minStay || 1}</MinStay>
        <MaxStay>${u.maxStay || 99}</MaxStay>
      </Restriction>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <HotelRestrictions timestamp="${new Date().toISOString()}">
    <HotelInfo>
      <HotelID>${escapeXml(this.credentials?.hotelId || '')}</HotelID>
    </HotelInfo>
    <RestrictionList>${restrictionUpdates}
    </RestrictionList>
  </HotelRestrictions>
</Request>`;
  }

  // ---- XML Response Parsers ----

  private parseHotelPriceResponse(response: any): any[] {
    // Response may be XML string or already-parsed object
    if (typeof response === 'string') {
      return this.extractInventoryFromXml(response);
    }
    const rooms = response?.RoomDataList?.RoomData || response?.data || [];
    return (Array.isArray(rooms) ? rooms : [rooms]).map((r: any) => ({
      externalRoomId: r.RoomID || r.roomId || '',
      date: r.Date || r.date || '',
      availableRooms: r.Available === 'true' || r.Available === true ? 1 : 0,
      totalRooms: 1,
    }));
  }

  private parseHotelRatePlanResponse(response: any): any[] {
    if (typeof response === 'string') {
      return this.extractRatesFromXml(response);
    }
    const rates = response?.RateList?.Rate || response?.data || [];
    return (Array.isArray(rates) ? rates : [rates]).map((r: any) => ({
      externalRoomId: r.RoomID || r.roomId || '',
      externalRatePlanId: r.RatePlanID || r.ratePlanId || 'default',
      date: r.Date || r.date || '',
      baseRate: parseFloat(r.BaseRate || r.baseRate || '0'),
      currency: r.BaseRate?.$?.currency || r.currency || 'USD',
      available: true,
    }));
  }

  private parseRestrictionsResponse(response: any): any[] {
    if (typeof response === 'string') {
      return this.extractRestrictionsFromXml(response);
    }
    const restrictions = response?.RestrictionList?.Restriction || response?.data || [];
    return (Array.isArray(restrictions) ? restrictions : [restrictions]).map((r: any) => ({
      externalRoomId: r.RoomID || r.roomId || '',
      date: r.Date || r.date || '',
      closedToArrival: r.ClosedToArrival === 'true' || r.ClosedToArrival === true,
      closedToDeparture: r.ClosedToDeparture === 'true' || r.ClosedToDeparture === true,
      closed: r.Closed === 'true' || r.Closed === true,
      minStay: parseInt(r.MinStay || '1', 10),
      maxStay: parseInt(r.MaxStay || '99', 10),
    }));
  }

  /**
   * Minimal XML extraction helpers for string responses.
   * In production, a proper XML parser (e.g., fast-xml-parser) should be used.
   */
  private extractInventoryFromXml(xml: string): any[] {
    const results: any[] = [];
    const roomRegex = /<RoomData[^>]*>([\s\S]*?)<\/RoomData>/g;
    let match;
    while ((match = roomRegex.exec(xml)) !== null) {
      const block = match[1];
      const roomId = this.extractXmlValue(block, 'RoomID');
      const date = this.extractXmlValue(block, 'Date');
      const available = this.extractXmlValue(block, 'Available');
      if (roomId && date) {
        results.push({
          externalRoomId: roomId,
          date,
          availableRooms: available === 'true' ? 1 : 0,
          totalRooms: 1,
        });
      }
    }
    return results;
  }

  private extractRatesFromXml(xml: string): any[] {
    const results: any[] = [];
    const rateRegex = /<Rate[^>]*>([\s\S]*?)<\/Rate>/g;
    let match;
    while ((match = rateRegex.exec(xml)) !== null) {
      const block = match[1];
      const roomId = this.extractXmlValue(block, 'RoomID');
      const ratePlanId = this.extractXmlValue(block, 'RatePlanID');
      const date = this.extractXmlValue(block, 'Date');
      const baseRate = this.extractXmlValue(block, 'BaseRate');
      if (roomId && date) {
        results.push({
          externalRoomId: roomId,
          externalRatePlanId: ratePlanId || 'default',
          date,
          baseRate: parseFloat(baseRate || '0'),
          currency: 'USD',
          available: true,
        });
      }
    }
    return results;
  }

  private extractRestrictionsFromXml(xml: string): any[] {
    const results: any[] = [];
    const restrictionRegex = /<Restriction[^>]*>([\s\S]*?)<\/Restriction>/g;
    let match;
    while ((match = restrictionRegex.exec(xml)) !== null) {
      const block = match[1];
      const roomId = this.extractXmlValue(block, 'RoomID');
      const date = this.extractXmlValue(block, 'Date');
      if (roomId && date) {
        results.push({
          externalRoomId: roomId,
          date,
          closedToArrival: this.extractXmlValue(block, 'ClosedToArrival') === 'true',
          closedToDeparture: this.extractXmlValue(block, 'ClosedToDeparture') === 'true',
          closed: this.extractXmlValue(block, 'Closed') === 'true',
          minStay: parseInt(this.extractXmlValue(block, 'MinStay') || '1', 10),
          maxStay: parseInt(this.extractXmlValue(block, 'MaxStay') || '99', 10),
        });
      }
    }
    return results;
  }

  private extractXmlValue(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
    const match = regex.exec(xml);
    return match ? match[1].trim() : '';
  }
}

// ============================================
// AGODA CLIENT
// ============================================

/**
 * Agoda API Client
 * Uses REST API with API Key (X-Api-Key header) authentication
 * API: https://api.agoda.com
 * Rate limit: 100 req/min
 */
class AgodaClient extends BaseOTAClient {
  private static readonly RATE_LIMIT_REQUESTS = 100;
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      // Verify API key by fetching partner hotel info
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/partner/hotel/info`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Agoda',
        propertyInfo: {
          id: response.hotelId || this.credentials?.hotelId || '',
          name: response.hotelName || response.name || 'Unknown',
          roomCount: response.roomCount || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Agoda')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/partner/hotel/info`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Agoda',
        propertyInfo: {
          id: response.hotelId || this.credentials?.hotelId || '',
          name: response.hotelName || 'Unknown',
          roomCount: response.roomCount || 0,
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const hotelId = this.credentials?.hotelId || '';
    const params = new URLSearchParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });

    if (roomTypeIds?.length) {
      params.append('roomTypeIds', roomTypeIds.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${hotelId}/availability?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseAvailabilityResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    const hotelId = this.credentials?.hotelId || '';

    try {
      const payload = this.buildAvailabilityBulkPayload(updates);

      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${hotelId}/availability/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(payload),
        }
      );

      return this.createSuccessResponse(
        hotelId,
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        hotelId,
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const hotelId = this.credentials?.hotelId || '';
    const params = new URLSearchParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });

    if (roomTypeIds?.length) {
      params.append('roomTypeIds', roomTypeIds.join(','));
    }
    if (ratePlanIds?.length) {
      params.append('ratePlanIds', ratePlanIds.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${hotelId}/rates?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRatesResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    const hotelId = this.credentials?.hotelId || '';

    try {
      const payload = this.buildRatesBulkPayload(updates);

      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${hotelId}/rates/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(payload),
        }
      );

      return this.createSuccessResponse(
        hotelId,
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        hotelId,
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const hotelId = this.credentials?.hotelId || '';

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${hotelId}/restrictions`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRestrictionsResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    const hotelId = this.credentials?.hotelId || '';

    try {
      const payload = this.buildRestrictionsBulkPayload(updates);

      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${hotelId}/restrictions/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(payload),
        }
      );

      return this.createSuccessResponse(
        hotelId,
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        hotelId,
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const hotelId = this.credentials?.hotelId || '';
    const params = new URLSearchParams({
      hotelId,
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });

    if (status?.length) {
      params.append('status', status.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/bookings?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseBookingsListResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/bookings/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseBookingDetail(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/bookings/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/bookings/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    // Agoda webhooks use XML format for booking events
    const eventType = headers['X-Agoda-Event'] || headers['x-agoda-event'] || 'unknown';
    const contentType = headers['content-type'] || '';

    let parsedData: any;

    if (contentType.includes('xml') || typeof payload === 'string') {
      parsedData = this.parseXmlWebhook(payload);
    } else {
      parsedData = payload;
    }

    return {
      success: true,
      eventType,
      data: parsedData,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/agoda';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const apiKey = this.credentials?.apiKey || '';
    if (apiKey) {
      return { 'X-Api-Key': apiKey };
    }
    return super.getAuthHeaders();
  }

  // ---- Private helpers ----

  private buildAvailabilityBulkPayload(updates: any[]): Record<string, any> {
    return {
      availability: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        date: u.date,
        quantity: u.availableRooms,
      })),
    };
  }

  private buildRatesBulkPayload(updates: any[]): Record<string, any> {
    return {
      rates: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        ratePlanId: u.externalRatePlanId,
        date: u.date,
        price: u.baseRate,
        currency: u.currency || 'USD',
      })),
    };
  }

  private buildRestrictionsBulkPayload(updates: any[]): Record<string, any> {
    return {
      restrictions: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        date: u.date,
        closedToArrival: u.closedToArrival || false,
        closedToDeparture: u.closedToDeparture || false,
        closed: u.closed || false,
        minStay: u.minStayThrough || u.minStay || 1,
        maxStay: u.maxStay || 99,
      })),
    };
  }

  private parseAvailabilityResponse(response: any): any[] {
    const items = response?.availability || response?.data || [];
    return items.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      date: r.date,
      availableRooms: r.quantity || r.availableRooms || 0,
      totalRooms: r.totalRooms || r.quantity || 0,
    }));
  }

  private parseRatesResponse(response: any): any[] {
    const items = response?.rates || response?.data || [];
    return items.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      externalRatePlanId: r.ratePlanId || r.rate_plan_id,
      date: r.date,
      baseRate: parseFloat(r.price || '0'),
      currency: r.currency || 'USD',
      available: r.available !== false,
    }));
  }

  private parseRestrictionsResponse(response: any): any[] {
    const items = response?.restrictions || response?.data || [];
    return items.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      date: r.date,
      closedToArrival: r.closedToArrival || false,
      closedToDeparture: r.closedToDeparture || false,
      closed: r.closed || false,
      minStay: r.minStay || 1,
      maxStay: r.maxStay || 99,
    }));
  }

  private parseBookingsListResponse(response: any): any[] {
    const items = response?.bookings || response?.data || [];
    return items.map((b: any) => this.parseBookingDetail(b));
  }

  private parseBookingDetail(b: any): any {
    return {
      guest: {
        firstName: b.guestFirstName || b.guest_first_name || '',
        lastName: b.guestLastName || b.guest_last_name || '',
        email: b.guestEmail || b.guest_email || '',
        phone: b.guestPhone || b.guest_phone || '',
        country: b.guestCountry || b.guest_country || '',
      },
      room: {
        externalRoomId: b.roomTypeId || b.room_type_id || '',
        externalRatePlanId: b.ratePlanId || b.rate_plan_id || '',
      },
      dates: {
        checkIn: b.checkIn || b.check_in || '',
        checkOut: b.checkOut || b.check_out || '',
      },
      guests: {
        adults: b.adults || b.num_adults || 1,
        children: b.children || b.num_children || 0,
      },
      pricing: {
        roomRate: parseFloat(b.roomRate || b.room_rate || '0'),
        taxes: parseFloat(b.taxes || '0'),
        fees: parseFloat(b.fees || '0'),
        discount: parseFloat(b.discount || '0'),
        totalAmount: parseFloat(b.totalAmount || b.total_amount || b.totalPrice || '0'),
        currency: b.currency || 'USD',
        commission: parseFloat(b.commission || '0'),
        commissionType: 'percentage' as const,
      },
      payment: {
        method: b.paymentMethod || (b.prepaid ? 'prepaid' : 'collect'),
      },
      specialRequests: b.specialRequests || b.special_requests || '',
      createdAt: b.createdAt || b.created_at || '',
      source: 'agoda',
    };
  }

  private parseXmlWebhook(payload: any): any {
    if (typeof payload !== 'string') return payload;
    const bookingId = this.extractXmlValue(payload, 'BookingId');
    const status = this.extractXmlValue(payload, 'Status');
    const eventType = this.extractXmlValue(payload, 'EventType');

    return {
      bookingId,
      status,
      eventType,
      raw: payload,
    };
  }

  private extractXmlValue(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
    const match = regex.exec(xml);
    return match ? match[1].trim() : '';
  }
}

// ============================================
// MAKEMYTRIP CLIENT
// ============================================

/**
 * MakeMyTrip API Client
 * Uses REST API with HMAC-SHA256 signature authentication
 * API: https://developer.makemytrip.com/api
 * Rate limit: 50 req/min (India OTA, stricter limits)
 */
class MakeMyTripClient extends BaseOTAClient {
  private static readonly RATE_LIMIT_REQUESTS = 50;
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      // Verify credentials by checking hotel status
      const signedHeaders = this.getSignedHeaders('GET', '/v1/hotel/status', '');
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotel/status`,
        {
          method: 'GET',
          headers: {
            ...this.getCommonHeaders(),
            ...signedHeaders,
          },
        }
      );

      return {
        success: true,
        message: 'Successfully connected to MakeMyTrip',
        propertyInfo: {
          id: response.hotelId || this.credentials?.hotelId || '',
          name: response.hotelName || response.name || 'Unknown',
          roomCount: response.roomCount || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to MakeMyTrip')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const signedHeaders = this.getSignedHeaders('GET', '/v1/hotel/status', '');
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotel/status`,
        {
          method: 'GET',
          headers: {
            ...this.getCommonHeaders(),
            ...signedHeaders,
          },
        }
      );

      return {
        success: true,
        message: 'Successfully connected to MakeMyTrip',
        propertyInfo: {
          id: response.hotelId || this.credentials?.hotelId || '',
          name: response.hotelName || 'Unknown',
          roomCount: response.roomCount || 0,
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildSignedQueryParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      ...(roomTypeIds?.length ? { roomTypeIds: roomTypeIds.join(',') } : {}),
    });
    const signedHeaders = this.getSignedHeaders('GET', '/v1/hotel/inventory', params.toString());

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/inventory?${params}`,
      {
        method: 'GET',
        headers: {
          ...this.getCommonHeaders(),
          ...signedHeaders,
        },
      }
    );
    return this.parseMMTInventoryResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const payload = this.buildMMTInventoryPayload(updates);
      const bodyStr = JSON.stringify(payload);
      const signedHeaders = this.getSignedHeaders('POST', '/v1/hotel/inventory/update', bodyStr);

      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/inventory/update`,
        {
          method: 'POST',
          headers: {
            ...this.getCommonHeaders(),
            ...signedHeaders,
          },
          body: bodyStr,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildSignedQueryParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      ...(roomTypeIds?.length ? { roomTypeIds: roomTypeIds.join(',') } : {}),
      ...(ratePlanIds?.length ? { ratePlanIds: ratePlanIds.join(',') } : {}),
    });
    const signedHeaders = this.getSignedHeaders('GET', '/v1/hotel/rates', params.toString());

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/rates?${params}`,
      {
        method: 'GET',
        headers: {
          ...this.getCommonHeaders(),
          ...signedHeaders,
        },
      }
    );
    return this.parseMMTRatesResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const payload = this.buildMMTRatesPayload(updates);
      const bodyStr = JSON.stringify(payload);
      const signedHeaders = this.getSignedHeaders('POST', '/v1/hotel/rates/update', bodyStr);

      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/rates/update`,
        {
          method: 'POST',
          headers: {
            ...this.getCommonHeaders(),
            ...signedHeaders,
          },
          body: bodyStr,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const signedHeaders = this.getSignedHeaders('GET', '/v1/hotel/restrictions', '');

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/restrictions`,
      {
        method: 'GET',
        headers: {
          ...this.getCommonHeaders(),
          ...signedHeaders,
        },
      }
    );
    return this.parseMMTRestrictionsResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const payload = this.buildMMTRestrictionsPayload(updates);
      const bodyStr = JSON.stringify(payload);
      const signedHeaders = this.getSignedHeaders('POST', '/v1/hotel/restrictions/update', bodyStr);

      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/restrictions/update`,
        {
          method: 'POST',
          headers: {
            ...this.getCommonHeaders(),
            ...signedHeaders,
          },
          body: bodyStr,
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = this.buildSignedQueryParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      ...(status?.length ? { status: status.join(',') } : {}),
    });
    const signedHeaders = this.getSignedHeaders('GET', '/v1/hotel/bookings', params.toString());

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/bookings?${params}`,
      {
        method: 'GET',
        headers: {
          ...this.getCommonHeaders(),
          ...signedHeaders,
        },
      }
    );
    return this.parseMMTBookingsResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const signedHeaders = this.getSignedHeaders('GET', `/v1/hotel/bookings/${externalId}`, '');

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/bookings/${externalId}`,
      {
        method: 'GET',
        headers: {
          ...this.getCommonHeaders(),
          ...signedHeaders,
        },
      }
    );
    return this.parseMMTBookingDetail(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      const signedHeaders = this.getSignedHeaders('POST', `/v1/hotel/bookings/${externalId}/confirm`, '');
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/bookings/${externalId}/confirm`,
        {
          method: 'POST',
          headers: {
            ...this.getCommonHeaders(),
            ...signedHeaders,
          },
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      const bodyStr = JSON.stringify({ reason });
      const signedHeaders = this.getSignedHeaders('POST', `/v1/hotel/bookings/${externalId}/cancel`, bodyStr);
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/bookings/${externalId}/cancel`,
        {
          method: 'POST',
          headers: {
            ...this.getCommonHeaders(),
            ...signedHeaders,
          },
          body: bodyStr,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    // MakeMyTrip webhooks use JSON format with booking lifecycle events
    const eventType = payload?.event_type || payload?.eventType || payload?.type || 'unknown';
    const bookingData = payload?.booking || payload?.data?.booking || payload?.data;

    return {
      success: true,
      eventType,
      data: bookingData ? this.parseMMTBookingDetail(bookingData) : payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/makemytrip';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const apiKey = this.credentials?.apiKey || '';
    if (apiKey) {
      return {
        'X-API-Key': apiKey,
        'X-Client-Key': apiKey,
      };
    }
    return super.getAuthHeaders();
  }

  // ---- Private helpers ----

  /**
   * Generate HMAC-SHA256 signature for a request.
   * Signature is computed over: method + path + sorted query + body
   */
  private getSignedHeaders(method: string, path: string, bodyOrQuery: string): Record<string, string> {
    const apiKey = this.credentials?.apiKey || '';
    const apiSecret = this.credentials?.apiSecret || '';
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Build signature string: METHOD + PATH + query/body + timestamp
    const signatureBase = `${method.toUpperCase()}\n${path}\n${bodyOrQuery}\n${timestamp}`;
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureBase)
      .digest('hex');

    return {
      'X-API-Key': apiKey,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    };
  }

  /**
   * Build query params with sorted keys for consistent signing
   */
  private buildSignedQueryParams(params: Record<string, string>): URLSearchParams {
    const sorted = Object.keys(params).sort();
    const urlParams = new URLSearchParams();
    for (const key of sorted) {
      urlParams.append(key, params[key]);
    }
    return urlParams;
  }

  private buildMMTInventoryPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId || '',
      inventory: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        date: u.date,
        availableRooms: u.availableRooms,
      })),
    };
  }

  private buildMMTRatesPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId || '',
      rates: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        ratePlanId: u.externalRatePlanId,
        date: u.date,
        price: u.baseRate,
        currency: u.currency || 'INR',
      })),
    };
  }

  private buildMMTRestrictionsPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId || '',
      restrictions: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        date: u.date,
        closedToArrival: u.closedToArrival || false,
        closedToDeparture: u.closedToDeparture || false,
        closed: u.closed || false,
        minStay: u.minStayThrough || u.minStay || 1,
        maxStay: u.maxStay || 99,
      })),
    };
  }

  private parseMMTInventoryResponse(response: any): any[] {
    const items = response?.inventory || response?.data || [];
    return items.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      date: r.date,
      availableRooms: r.availableRooms || r.quantity || 0,
      totalRooms: r.totalRooms || r.quantity || 0,
    }));
  }

  private parseMMTRatesResponse(response: any): any[] {
    const items = response?.rates || response?.data || [];
    return items.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      externalRatePlanId: r.ratePlanId || r.rate_plan_id,
      date: r.date,
      baseRate: parseFloat(r.price || '0'),
      currency: r.currency || 'INR',
      available: r.available !== false,
    }));
  }

  private parseMMTRestrictionsResponse(response: any): any[] {
    const items = response?.restrictions || response?.data || [];
    return items.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      date: r.date,
      closedToArrival: r.closedToArrival || false,
      closedToDeparture: r.closedToDeparture || false,
      closed: r.closed || false,
      minStay: r.minStay || 1,
      maxStay: r.maxStay || 99,
    }));
  }

  private parseMMTBookingsResponse(response: any): any[] {
    const items = response?.bookings || response?.data || [];
    return items.map((b: any) => this.parseMMTBookingDetail(b));
  }

  private parseMMTBookingDetail(b: any): any {
    return {
      guest: {
        firstName: b.guestFirstName || b.guest_first_name || '',
        lastName: b.guestLastName || b.guest_last_name || '',
        email: b.guestEmail || b.guest_email || '',
        phone: b.guestPhone || b.guest_phone || '',
        country: b.guestCountry || b.guest_country || 'IN',
      },
      room: {
        externalRoomId: b.roomTypeId || b.room_type_id || '',
        externalRatePlanId: b.ratePlanId || b.rate_plan_id || '',
      },
      dates: {
        checkIn: b.checkIn || b.check_in || '',
        checkOut: b.checkOut || b.check_out || '',
      },
      guests: {
        adults: b.adults || b.num_adults || 1,
        children: b.children || b.num_children || 0,
      },
      pricing: {
        roomRate: parseFloat(b.roomRate || b.room_rate || '0'),
        taxes: parseFloat(b.taxes || b.gst || '0'),
        fees: parseFloat(b.fees || '0'),
        discount: parseFloat(b.discount || '0'),
        totalAmount: parseFloat(b.totalAmount || b.total_amount || b.totalPrice || '0'),
        currency: b.currency || 'INR',
        commission: parseFloat(b.commission || '0'),
        commissionType: 'percentage' as const,
      },
      payment: {
        method: b.paymentMethod || (b.prepaid ? 'prepaid' : 'collect'),
      },
      specialRequests: b.specialRequests || b.special_requests || '',
      createdAt: b.createdAt || b.created_at || '',
      source: 'makemytrip',
    };
  }
}

// ============================================
// OYO CLIENT
// ============================================

/**
 * OYO API Client
 * Uses REST API with Bearer token authentication
 * API: https://api.oyorooms.com/partner
 * Rate limit: 200 req/min
 * OYO uses a flat room structure (no room types in the same way)
 */
class OYOClient extends BaseOTAClient {
  private static readonly RATE_LIMIT_REQUESTS = 200;
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      // Verify token and list properties
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotels`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to OYO',
        propertyInfo: {
          id: this.credentials?.hotelId || '',
          name: response.hotelName || response.name || 'Unknown',
          roomCount: response.roomCount || response.totalRooms || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to OYO')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotels`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to OYO',
        propertyInfo: {
          id: this.credentials?.hotelId || '',
          name: response.hotelName || 'Unknown',
          roomCount: response.roomCount || 0,
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const hotelId = this.credentials?.hotelId || '';
    const params = new URLSearchParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${hotelId}/rooms/availability?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseOYOInventoryResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    const hotelId = this.credentials?.hotelId || '';

    try {
      const payload = this.buildOYOInventoryPayload(updates);

      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${hotelId}/rooms/availability`,
        {
          method: 'PATCH',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(payload),
        }
      );

      return this.createSuccessResponse(
        hotelId,
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        hotelId,
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const hotelId = this.credentials?.hotelId || '';
    const params = new URLSearchParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${hotelId}/rates?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseOYORatesResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    const hotelId = this.credentials?.hotelId || '';

    try {
      const payload = this.buildOYORatesPayload(updates);

      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${hotelId}/rates`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(payload),
        }
      );

      return this.createSuccessResponse(
        hotelId,
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        hotelId,
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const hotelId = this.credentials?.hotelId || '';

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${hotelId}/restrictions`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseOYORestrictionsResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    const hotelId = this.credentials?.hotelId || '';

    try {
      const payload = this.buildOYORestrictionsPayload(updates);

      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${hotelId}/restrictions`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(payload),
        }
      );

      return this.createSuccessResponse(
        hotelId,
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        hotelId,
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const hotelId = this.credentials?.hotelId || '';
    const params = new URLSearchParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });

    if (status?.length) {
      params.append('status', status.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${hotelId}/bookings?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseOYOBookingsResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/bookings/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseOYOBookingDetail(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/bookings/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/bookings/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    // OYO webhook format
    const eventType = payload?.event_type || payload?.eventType || payload?.type || 'unknown';
    const bookingData = payload?.booking || payload?.data?.booking || payload?.data;

    return {
      success: true,
      eventType,
      data: bookingData ? this.parseOYOBookingDetail(bookingData) : payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/oyo';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const token = this.credentials?.accessToken || this.credentials?.apiKey || '';
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return super.getAuthHeaders();
  }

  // ---- Private helpers ----

  /**
   * OYO uses a flat room structure without traditional room type categories.
   * These helpers convert between the standard StaySuite room model and OYO's flat model.
   */

  /**
   * Convert OYO room ID to standard room type ID
   * OYO rooms are identified by hotelId + roomCategory combination
   */
  private convertOYORoomToStandard(oyoRoom: any): any {
    return {
      externalRoomId: oyoRoom.roomId || oyoRoom.room_id || `${oyoRoom.hotelId}_${oyoRoom.category}`,
      externalRatePlanId: 'default',
      roomName: oyoRoom.roomCategory || oyoRoom.category || oyoRoom.roomName || 'Standard',
      maxOccupancy: oyoRoom.maxOccupancy || oyoRoom.max_occupancy || 2,
    };
  }

  /**
   * Convert standard room type to OYO flat room format
   */
  private convertStandardToOYORoom(update: any): any {
    return {
      roomId: update.externalRoomId,
      date: update.date,
      availableRooms: update.availableRooms,
      price: update.baseRate,
      currency: update.currency || 'INR',
    };
  }

  private buildOYOInventoryPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId || '',
      rooms: updates.map(u => this.convertStandardToOYORoom(u)),
    };
  }

  private buildOYORatesPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId || '',
      rates: updates.map(u => ({
        roomId: u.externalRoomId,
        date: u.date,
        price: u.baseRate,
        currency: u.currency || 'INR',
      })),
    };
  }

  private buildOYORestrictionsPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId || '',
      restrictions: updates.map(u => ({
        roomId: u.externalRoomId,
        date: u.date,
        closedToArrival: u.closedToArrival || false,
        closedToDeparture: u.closedToDeparture || false,
        closed: u.closed || false,
        minStay: u.minStayThrough || u.minStay || 1,
        maxStay: u.maxStay || 99,
      })),
    };
  }

  private parseOYOInventoryResponse(response: any): any[] {
    const items = response?.rooms || response?.availability || response?.data || [];
    return items.map((r: any) => ({
      ...this.convertOYORoomToStandard(r),
      date: r.date,
      availableRooms: r.availableRooms || r.available || 0,
      totalRooms: r.totalRooms || r.total || r.availableRooms || 0,
    }));
  }

  private parseOYORatesResponse(response: any): any[] {
    const items = response?.rates || response?.data || [];
    return items.map((r: any) => ({
      externalRoomId: r.roomId || r.room_id || '',
      externalRatePlanId: 'default',
      date: r.date,
      baseRate: parseFloat(r.price || '0'),
      currency: r.currency || 'INR',
      available: r.available !== false,
    }));
  }

  private parseOYORestrictionsResponse(response: any): any[] {
    const items = response?.restrictions || response?.data || [];
    return items.map((r: any) => ({
      externalRoomId: r.roomId || r.room_id || '',
      date: r.date,
      closedToArrival: r.closedToArrival || false,
      closedToDeparture: r.closedToDeparture || false,
      closed: r.closed || false,
      minStay: r.minStay || 1,
      maxStay: r.maxStay || 99,
    }));
  }

  private parseOYOBookingsResponse(response: any): any[] {
    const items = response?.bookings || response?.data || [];
    return items.map((b: any) => this.parseOYOBookingDetail(b));
  }

  private parseOYOBookingDetail(b: any): any {
    return {
      guest: {
        firstName: b.guestFirstName || b.guest_first_name || '',
        lastName: b.guestLastName || b.guest_last_name || '',
        email: b.guestEmail || b.guest_email || '',
        phone: b.guestPhone || b.guest_phone || '',
        country: b.guestCountry || b.guest_country || 'IN',
      },
      room: {
        externalRoomId: b.roomId || b.room_id || '',
        externalRatePlanId: 'default',
      },
      dates: {
        checkIn: b.checkIn || b.check_in || '',
        checkOut: b.checkOut || b.check_out || '',
      },
      guests: {
        adults: b.adults || b.num_adults || 1,
        children: b.children || b.num_children || 0,
      },
      pricing: {
        roomRate: parseFloat(b.roomRate || b.room_rate || b.totalFare || '0'),
        taxes: parseFloat(b.taxes || b.gst || '0'),
        fees: parseFloat(b.fees || '0'),
        discount: parseFloat(b.discount || b.couponDiscount || '0'),
        totalAmount: parseFloat(b.totalAmount || b.total_amount || b.totalFare || '0'),
        currency: b.currency || 'INR',
        commission: parseFloat(b.commission || '0'),
        commissionType: 'percentage' as const,
      },
      payment: {
        method: b.paymentMethod || (b.prepaid ? 'prepaid' : 'collect'),
      },
      specialRequests: b.specialRequests || b.special_requests || '',
      createdAt: b.createdAt || b.created_at || b.bookingTime || '',
      source: 'oyo',
    };
  }
}

// ============================================
// TRIPADVISOR CLIENT
// ============================================

/**
 * TripAdvisor API Client
 * Uses REST API with API Key authentication (metasearch/referral model)
 * API: https://api.tripadvisor.com
 * Rate limit: 50 req/min
 */
class TripAdvisorClient extends BaseOTAClient {
  private static readonly RATE_LIMIT_REQUESTS = 50;
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/partner/status`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      if (response.status === 'active' || response.active === true) {
        return {
          success: true,
          message: 'Successfully connected to TripAdvisor',
          propertyInfo: {
            id: this.credentials?.hotelId || '',
            name: response.partner_name || 'Unknown',
          },
        };
      }

      return {
        success: false,
        message: 'TripAdvisor partner account is not active',
        errors: [this.createOTAError('AUTH_FAILED', 'Partner account inactive')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to TripAdvisor')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/partner/status`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to TripAdvisor',
        propertyInfo: {
          id: this.credentials?.hotelId || '',
          name: response.partner_name || 'Unknown',
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/availability?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseAvailabilityResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/availability/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildBulkAvailabilityPayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/rates?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRatesResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/rates/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildBulkRatesPayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/restrictions?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRestrictionsResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/restrictions/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildBulkRestrictionsPayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(_startDate: Date, _endDate: Date, _status?: string[]): Promise<any[]> {
    // TripAdvisor is a metasearch/referral platform - it does not receive bookings directly
    console.log('[TripAdvisor] getBookings called — TripAdvisor is a metasearch channel; no bookings to retrieve.');
    return [];
  }

  async getBooking(_externalId: string): Promise<any> {
    // TripAdvisor is a metasearch/referral platform - no booking lookup
    return null;
  }

  async confirmBooking(_externalId: string): Promise<boolean> {
    // No-op for metaseach channel
    console.log('[TripAdvisor] confirmBooking called — no-op for metasearch channel.');
    return true;
  }

  async cancelBooking(_externalId: string, _reason: string): Promise<boolean> {
    // No-op for metasearch channel
    console.log('[TripAdvisor] cancelBooking called — no-op for metasearch channel.');
    return true;
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const eventType = headers['X-TripAdvisor-Event'] || payload?.event_type || 'unknown';

    return {
      success: true,
      eventType,
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/tripadvisor';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) {
      return { 'X-TripAdvisor-API-Key': this.credentials.apiKey };
    }
    return super.getAuthHeaders();
  }

  // ---- Private helpers ----

  private buildDateRangeParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): string {
    const params = new URLSearchParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });
    if (roomTypeIds?.length) {
      params.append('roomTypeIds', roomTypeIds.join(','));
    }
    return params.toString();
  }

  private buildBulkAvailabilityPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId,
      availability: updates.map(u => ({
        roomId: u.externalRoomId,
        date: u.date,
        available: u.availableRooms,
      })),
    };
  }

  private buildBulkRatesPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId,
      rates: updates.map(u => ({
        roomId: u.externalRoomId,
        ratePlanId: u.externalRatePlanId,
        date: u.date,
        price: u.baseRate,
        currency: u.currency || 'USD',
      })),
    };
  }

  private buildBulkRestrictionsPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId,
      restrictions: updates.map(u => ({
        roomId: u.externalRoomId,
        date: u.date,
        closedToArrival: u.closedToArrival || false,
        closedToDeparture: u.closedToDeparture || false,
        closed: u.closed || false,
        minStay: u.minStay || 1,
        maxStay: u.maxStay || 99,
      })),
    };
  }

  private parseAvailabilityResponse(response: any): any[] {
    return response?.availability?.map((a: any) => ({
      externalRoomId: a.roomId || a.room_id,
      date: a.date,
      availableRooms: a.available ?? a.availableRooms,
      totalRooms: a.totalRooms || (a.available ?? a.availableRooms),
    })) || [];
  }

  private parseRatesResponse(response: any): any[] {
    return response?.rates?.map((r: any) => ({
      externalRoomId: r.roomId || r.room_id,
      externalRatePlanId: r.ratePlanId || r.rate_plan_id,
      date: r.date,
      baseRate: parseFloat(r.price || '0'),
      currency: r.currency || 'USD',
      available: r.available !== false,
    })) || [];
  }

  private parseRestrictionsResponse(response: any): any[] {
    return response?.restrictions?.map((r: any) => ({
      externalRoomId: r.roomId || r.room_id,
      date: r.date,
      closedToArrival: r.closedToArrival || false,
      closedToDeparture: r.closedToDeparture || false,
      closed: r.closed || false,
      minStay: r.minStay || 1,
      maxStay: r.maxStay || 99,
    })) || [];
  }
}

// ============================================
// HOTELS.COM CLIENT (EXPEDIA PARTNER NETWORK)
// ============================================

/**
 * Hotels.com API Client
 * Uses REST API with OAuth2 client credentials (Expedia Partner Network ecosystem)
 * API: https://api.hotels.com
 * Rate limit: 200 req/min
 */
class HotelsComClient extends BaseOTAClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private static readonly RATE_LIMIT_REQUESTS = 200;
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      const tokenResponse = await this.fetchWithRetry<any>(
        `${this.baseUrl}/oauth2/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: credentials.apiKey || '',
            client_secret: credentials.apiSecret || '',
          }).toString(),
        }
      );

      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
        return await this.testConnection();
      }

      return {
        success: false,
        message: 'Failed to authenticate with Hotels.com',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Hotels.com')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v2/properties/${this.credentials?.hotelId}`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Hotels.com',
        propertyInfo: {
          id: response.propertyId || this.credentials?.hotelId,
          name: response.name || 'Unknown',
          roomCount: response.roomCount || 0,
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v2/properties/${this.credentials?.hotelId}/inventory?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response?.inventory || [];
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v2/properties/${this.credentials?.hotelId}/inventory/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v2/properties/${this.credentials?.hotelId}/rates?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response?.rates || [];
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v2/properties/${this.credentials?.hotelId}/rates/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v2/properties/${this.credentials?.hotelId}/restrictions?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response?.restrictions || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v2/properties/${this.credentials?.hotelId}/restrictions/bulk`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({
      propertyId: this.credentials?.hotelId || '',
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });
    if (status?.length) {
      params.append('status', status.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v2/bookings?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseBookingsResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v2/bookings/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v2/bookings/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v2/bookings/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const eventType = headers['X-Hotels-Event'] || headers['X-Expedia-Event'] || payload?.event_type || 'unknown';

    return {
      success: true,
      eventType,
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/hotels_com';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) {
      // Auto-refresh if token is expired or about to expire (5 minute buffer)
      if (this.tokenExpiresAt && new Date(Date.now() + 5 * 60 * 1000) >= this.tokenExpiresAt) {
        this.refreshAccessToken();
      }
      return { 'Authorization': `Bearer ${this.accessToken}` };
    }
    return super.getAuthHeaders();
  }

  // ---- Private helpers ----

  private buildDateRangeParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): string {
    const params = new URLSearchParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });
    if (roomTypeIds?.length) {
      params.append('roomTypeIds', roomTypeIds.join(','));
    }
    return params.toString();
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.credentials) return;

    try {
      const tokenResponse = await this.fetchWithRetry<any>(
        `${this.baseUrl}/oauth2/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.credentials.apiKey || '',
            client_secret: this.credentials.apiSecret || '',
          }).toString(),
        }
      );

      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        this.tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
      }
    } catch (error) {
      console.error('Hotels.com token refresh failed:', error);
    }
  }

  private parseBookingsResponse(response: any): any[] {
    return response?.bookings?.map((b: any) => this.parseSingleBooking({ booking: b })) || [];
  }

  private parseSingleBooking(response: any): any {
    const b = response?.booking || response;
    if (!b) return null;

    return {
      externalId: b.id || b.bookingId || b.booking_id,
      guest: {
        firstName: b.guestFirstName || b.guest_first_name || '',
        lastName: b.guestLastName || b.guest_last_name || '',
        email: b.guestEmail || b.guest_email || '',
        phone: b.guestPhone || b.guest_phone || '',
      },
      room: {
        externalRoomId: b.roomId || b.room_id || '',
        externalRatePlanId: b.ratePlanId || b.rate_plan_id || '',
      },
      dates: {
        checkIn: b.checkIn || b.check_in || '',
        checkOut: b.checkOut || b.check_out || '',
      },
      guests: {
        adults: b.adults || b.num_adults || 1,
        children: b.children || b.num_children || 0,
      },
      pricing: {
        roomRate: parseFloat(b.roomRate || b.room_rate || '0'),
        taxes: parseFloat(b.taxes || '0'),
        fees: parseFloat(b.fees || '0'),
        totalAmount: parseFloat(b.totalAmount || b.total_amount || '0'),
        currency: b.currency || 'USD',
        commission: parseFloat(b.commission || '0'),
        commissionType: 'percentage' as const,
      },
      payment: {
        method: b.paymentMethod || (b.prepaid ? 'prepaid' : 'collect'),
      },
      specialRequests: b.specialRequests || b.special_requests || '',
      createdAt: b.createdAt || b.created_at || '',
      source: 'hotels_com',
    };
  }
}

// ============================================
// TRAVELOKA CLIENT
// ============================================

/**
 * Traveloka API Client
 * Uses REST API with API Key + HMAC signature authentication
 * Southeast Asia OTA with support for local currency and multi-language
 * API: https://api.traveloka.com/hotel-partner
 * Rate limit: 100 req/min
 */
class TravelokaClient extends BaseOTAClient {
  private static readonly RATE_LIMIT_REQUESTS = 100;
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/partner/info`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      if (response.partnerId || response.partner_id) {
        return {
          success: true,
          message: 'Successfully connected to Traveloka',
          propertyInfo: {
            id: this.credentials?.hotelId || '',
            name: response.hotelName || response.hotel_name || 'Unknown',
            partnerId: response.partnerId || response.partner_id,
          },
        };
      }

      return {
        success: false,
        message: 'Failed to verify Traveloka credentials',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Traveloka')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/partner/info`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Traveloka',
        propertyInfo: {
          id: this.credentials?.hotelId || '',
          name: response.hotelName || response.hotel_name || 'Unknown',
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/room/availability?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRoomAvailabilityResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/room/availability`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildRoomAvailabilityPayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/room/rate?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRoomRateResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/room/rate`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildRoomRatePayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/restriction?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRestrictionResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/restriction`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildRestrictionPayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({
      hotelId: this.credentials?.hotelId || '',
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });
    if (status?.length) {
      params.append('status', status.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/reservation?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseReservationsResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/reservation/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseSingleReservation(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/reservation/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/reservation/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const eventType = payload?.eventType || payload?.event_type || 'unknown';

    // Validate webhook signature if present
    if (headers['X-Signature'] && this.credentials?.apiSecret) {
      const valid = this.verifyWebhookSignature(payload, headers['X-Signature']);
      if (!valid) {
        return {
          success: false,
          eventType,
          error: 'Invalid webhook signature',
          response: { statusCode: 401, body: 'Unauthorized' },
        };
      }
    }

    return {
      success: true,
      eventType,
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/traveloka';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.credentials?.apiKey) {
      headers['X-API-Key'] = this.credentials.apiKey;
    }

    if (this.credentials?.apiSecret) {
      headers['X-Signature'] = this.credentials.apiSecret;
    }

    if (Object.keys(headers).length > 0) {
      return headers;
    }
    return super.getAuthHeaders();
  }

  // ---- Private helpers ----

  private buildDateRangeParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): string {
    const params = new URLSearchParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });
    if (roomTypeIds?.length) {
      params.append('roomTypeIds', roomTypeIds.join(','));
    }
    return params.toString();
  }

  private generateHmacSignature(body: string): string {
    if (!this.credentials?.apiSecret) return '';
    return crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(body)
      .digest('hex');
  }

  private verifyWebhookSignature(payload: any, signature: string): boolean {
    const expected = this.generateHmacSignature(JSON.stringify(payload));
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  }

  private buildRoomAvailabilityPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId,
      rooms: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        date: u.date,
        quota: u.availableRooms,
      })),
    };
  }

  private buildRoomRatePayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId,
      rates: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        ratePlanId: u.externalRatePlanId,
        date: u.date,
        baseRate: u.baseRate,
        currency: u.currency || 'IDR',
      })),
    };
  }

  private buildRestrictionPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId,
      restrictions: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        date: u.date,
        closedToArrival: u.closedToArrival || false,
        closedToDeparture: u.closedToDeparture || false,
        closed: u.closed || false,
        minStay: u.minStay || 1,
        maxStay: u.maxStay || 99,
      })),
    };
  }

  private parseRoomAvailabilityResponse(response: any): any[] {
    return response?.rooms?.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      date: r.date,
      availableRooms: r.quota ?? r.availableRooms ?? 0,
      totalRooms: r.totalRooms || r.quota || 0,
    })) || [];
  }

  private parseRoomRateResponse(response: any): any[] {
    return response?.rates?.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      externalRatePlanId: r.ratePlanId || r.rate_plan_id,
      date: r.date,
      baseRate: parseFloat(r.baseRate || r.base_rate || '0'),
      currency: r.currency || 'IDR',
      available: r.available !== false,
    })) || [];
  }

  private parseRestrictionResponse(response: any): any[] {
    return response?.restrictions?.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      date: r.date,
      closedToArrival: r.closedToArrival || false,
      closedToDeparture: r.closedToDeparture || false,
      closed: r.closed || false,
      minStay: r.minStay || 1,
      maxStay: r.maxStay || 99,
    })) || [];
  }

  private parseReservationsResponse(response: any): any[] {
    return response?.reservations?.map((r: any) => this.parseSingleReservation({ reservation: r })) || [];
  }

  private parseSingleReservation(response: any): any {
    const r = response?.reservation || response;
    if (!r) return null;

    return {
      externalId: r.reservationId || r.reservation_id || r.id,
      guest: {
        firstName: r.guestFirstName || r.guest_first_name || '',
        lastName: r.guestLastName || r.guest_last_name || '',
        email: r.guestEmail || r.guest_email || '',
        phone: r.guestPhone || r.guest_phone || '',
      },
      room: {
        externalRoomId: r.roomTypeId || r.room_type_id || '',
        externalRatePlanId: r.ratePlanId || r.rate_plan_id || '',
      },
      dates: {
        checkIn: r.checkIn || r.check_in || '',
        checkOut: r.checkOut || r.check_out || '',
      },
      guests: {
        adults: r.adults || r.num_adults || 1,
        children: r.children || r.num_children || 0,
      },
      pricing: {
        roomRate: parseFloat(r.roomRate || r.room_rate || r.totalFare || '0'),
        taxes: parseFloat(r.taxes || '0'),
        fees: parseFloat(r.fees || '0'),
        totalAmount: parseFloat(r.totalAmount || r.total_amount || r.totalFare || '0'),
        currency: r.currency || 'IDR',
        commission: parseFloat(r.commission || '0'),
        commissionType: 'percentage' as const,
      },
      payment: {
        method: r.paymentMethod || (r.prepaid ? 'prepaid' : 'collect'),
      },
      specialRequests: r.specialRequests || r.special_requests || '',
      createdAt: r.createdAt || r.created_at || r.bookingTime || '',
      source: 'traveloka',
    };
  }
}

// ============================================
// TRIP.COM CLIENT
// ============================================

/**
 * Trip.com API Client
 * Uses REST API with API Key authentication
 * Chinese OTA with support for CNY currency and Chinese market-specific fields
 * API: https://api.trip.com/hotel
 * Rate limit: 150 req/min
 */
class TripComClient extends BaseOTAClient {
  private static readonly RATE_LIMIT_REQUESTS = 150;
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/partner/hotel/list`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      if (response.hotels || response.data) {
        return {
          success: true,
          message: 'Successfully connected to Trip.com',
          propertyInfo: {
            id: this.credentials?.hotelId || '',
            name: response.hotels?.[0]?.hotelName || response.data?.[0]?.hotel_name || 'Unknown',
            hotelCount: response.hotels?.length || response.data?.length || 0,
          },
        };
      }

      return {
        success: false,
        message: 'Failed to verify Trip.com API key',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid API key')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Trip.com')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/partner/hotel/list`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Trip.com',
        propertyInfo: {
          id: this.credentials?.hotelId || '',
          name: response.hotels?.[0]?.hotelName || 'Unknown',
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/inventory?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseInventoryResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/inventory/batch`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildBatchInventoryPayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/rate?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRateResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/rate/batch`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildBatchRatePayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateRangeParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/restriction?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseRestrictionResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/restriction/batch`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify(this.buildBatchRestrictionPayload(updates)),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({
      hotelId: this.credentials?.hotelId || '',
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });
    if (status?.length) {
      params.append('status', status.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotel/${this.credentials?.hotelId}/order?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseOrdersResponse(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/order/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return this.parseSingleOrder(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/order/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/order/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const eventType = headers['X-TripCom-Event'] || payload?.eventType || payload?.event_type || 'unknown';

    return {
      success: true,
      eventType,
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/trip_com';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) {
      return { 'X-API-Key': this.credentials.apiKey };
    }
    return super.getAuthHeaders();
  }

  // ---- Private helpers ----

  private buildDateRangeParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): string {
    const params = new URLSearchParams({
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });
    if (roomTypeIds?.length) {
      params.append('roomTypeIds', roomTypeIds.join(','));
    }
    return params.toString();
  }

  private buildBatchInventoryPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId,
      inventoryList: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        date: u.date,
        availableRooms: u.availableRooms,
      })),
    };
  }

  private buildBatchRatePayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId,
      rateList: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        ratePlanId: u.externalRatePlanId,
        date: u.date,
        price: u.baseRate,
        currency: u.currency || 'CNY',
      })),
    };
  }

  private buildBatchRestrictionPayload(updates: any[]): Record<string, any> {
    return {
      hotelId: this.credentials?.hotelId,
      restrictionList: updates.map(u => ({
        roomTypeId: u.externalRoomId,
        date: u.date,
        closedToArrival: u.closedToArrival || false,
        closedToDeparture: u.closedToDeparture || false,
        closed: u.closed || false,
        minStay: u.minStay || 1,
        maxStay: u.maxStay || 99,
      })),
    };
  }

  private parseInventoryResponse(response: any): any[] {
    return response?.inventoryList?.map((i: any) => ({
      externalRoomId: i.roomTypeId || i.room_type_id,
      date: i.date,
      availableRooms: i.availableRooms ?? 0,
      totalRooms: i.totalRooms || i.availableRooms || 0,
    })) || [];
  }

  private parseRateResponse(response: any): any[] {
    return response?.rateList?.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      externalRatePlanId: r.ratePlanId || r.rate_plan_id,
      date: r.date,
      baseRate: parseFloat(r.price || '0'),
      currency: r.currency || 'CNY',
      available: r.available !== false,
    })) || [];
  }

  private parseRestrictionResponse(response: any): any[] {
    return response?.restrictionList?.map((r: any) => ({
      externalRoomId: r.roomTypeId || r.room_type_id,
      date: r.date,
      closedToArrival: r.closedToArrival || false,
      closedToDeparture: r.closedToDeparture || false,
      closed: r.closed || false,
      minStay: r.minStay || 1,
      maxStay: r.maxStay || 99,
    })) || [];
  }

  private parseOrdersResponse(response: any): any[] {
    return response?.orders?.map((o: any) => this.parseSingleOrder({ order: o })) || [];
  }

  private parseSingleOrder(response: any): any {
    const o = response?.order || response;
    if (!o) return null;

    return {
      externalId: o.orderId || o.order_id || o.id,
      guest: {
        firstName: o.guestFirstName || o.guest_first_name || '',
        lastName: o.guestLastName || o.guest_last_name || '',
        email: o.guestEmail || o.guest_email || '',
        phone: o.guestPhone || o.guest_phone || '',
      },
      room: {
        externalRoomId: o.roomTypeId || o.room_type_id || '',
        externalRatePlanId: o.ratePlanId || o.rate_plan_id || '',
      },
      dates: {
        checkIn: o.checkIn || o.check_in || '',
        checkOut: o.checkOut || o.check_out || '',
      },
      guests: {
        adults: o.adults || o.num_adults || 1,
        children: o.children || o.num_children || 0,
      },
      pricing: {
        roomRate: parseFloat(o.roomRate || o.room_rate || '0'),
        taxes: parseFloat(o.taxes || '0'),
        fees: parseFloat(o.fees || '0'),
        totalAmount: parseFloat(o.totalAmount || o.total_amount || '0'),
        currency: o.currency || 'CNY',
        commission: parseFloat(o.commission || '0'),
        commissionType: 'percentage' as const,
      },
      payment: {
        method: o.paymentMethod || (o.prepaid ? 'prepaid' : 'collect'),
      },
      specialRequests: o.specialRequests || o.special_requests || '',
      createdAt: o.createdAt || o.created_at || o.orderTime || '',
      source: 'trip_com',
    };
  }
}

// ============================================
// REGIONAL OTA CLIENT IMPLEMENTATIONS
// ============================================

/**
 * Hostelworld API Client
 * REST API with API Key authentication in X-Hostelworld-Key header
 * Hostel-specific: uses "beds" instead of "rooms", dormitory/private room types, per-bed pricing
 * API: https://api.hostelworld.com/v2
 * Rate limit: 30 req/min
 */
class HostelworldClient extends BaseOTAClient {
  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try {
      return await this.testConnection();
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Hostelworld')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/properties/${this.credentials?.hotelId}`,
        { method: 'GET', headers: this.getCommonHeaders() }
      );
      return {
        success: true,
        message: 'Successfully connected to Hostelworld',
        propertyInfo: {
          id: response.propertyId || this.credentials?.hotelId || '',
          name: response.propertyName || 'Unknown',
          roomCount: response.bedTypes?.length || 0,
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

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({
      start_date: this.formatDate(startDate),
      end_date: this.formatDate(endDate),
    });
    if (roomTypeIds?.length) params.append('bed_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/properties/${this.credentials?.hotelId}/beds/availability?${params}`,
      { method: 'GET', headers: this.getCommonHeaders() }
    );
    return this.parseBedsAvailability(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/properties/${this.credentials?.hotelId}/beds/availability`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ beds: this.buildBedsPayload(updates) }),
        }
      );
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('bed_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/rates?${params}`,
      { method: 'GET', headers: this.getCommonHeaders() }
    );
    return response.rates?.map((r: any) => ({
      externalRoomId: r.bedTypeId || r.bed_type_id,
      externalRatePlanId: r.ratePlanId || r.rate_plan_id,
      date: r.date,
      baseRate: r.pricePerBed || r.price_per_bed,
      currency: r.currency || 'EUR',
      available: r.available !== false,
    })) || [];
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/rates`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ rates: updates.map(u => ({
            bed_type_id: u.externalRoomId,
            rate_plan_id: u.externalRatePlanId,
            date: u.date,
            price_per_bed: u.baseRate,
            currency: u.currency || 'EUR',
          })) }),
        }
      );
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('bed_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/restrictions?${params}`,
      { method: 'GET', headers: this.getCommonHeaders() }
    );
    return response.restrictions?.map((r: any) => ({
      externalRoomId: r.bedTypeId || r.bed_type_id,
      date: r.date,
      closedToArrival: r.closedToArrival || false,
      closedToDeparture: r.closedToDeparture || false,
      closed: r.closed || false,
      minStay: r.minStay || 1,
      maxStay: r.maxStay || 99,
    })) || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/restrictions`,
        {
          method: 'PUT',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ restrictions: updates.map(u => ({
            bed_type_id: u.externalRoomId,
            date: u.date,
            closedToArrival: u.closedToArrival,
            closedToDeparture: u.closedToDeparture,
            closed: u.closed,
            minStay: u.minStay || 1,
            maxStay: u.maxStay || 99,
          })) }),
        }
      );
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ checkin_from: this.formatDate(startDate), checkin_to: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/reservations?${params}`,
      { method: 'GET', headers: this.getCommonHeaders() }
    );
    return this.parseBookingsList(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/reservations/${externalId}`,
      { method: 'GET', headers: this.getCommonHeaders() }
    );
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(`${this.baseUrl}/reservations/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() });
      return true;
    } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(`${this.baseUrl}/reservations/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) });
      return true;
    } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return {
      success: true,
      eventType: headers['X-Hostelworld-Event'] || payload?.event_type || 'unknown',
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/hostelworld'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; }
    catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) {
      return { 'X-Hostelworld-Key': this.credentials.apiKey };
    }
    return super.getAuthHeaders();
  }

  private parseBedsAvailability(response: any): any[] {
    const beds = response?.beds || response?.data || [];
    return beds.map((b: any) => ({
      externalRoomId: b.bedTypeId || b.bed_type_id,
      date: b.date,
      availableRooms: b.availableBeds || b.available_beds || 0,
      totalRooms: b.totalBeds || b.total_beds || 0,
      roomType: b.roomType === 'dormitory' ? 'dormitory' : 'private',
    }));
  }

  private buildBedsPayload(updates: any[]): any[] {
    return updates.map(u => ({
      bed_type_id: u.externalRoomId,
      date: u.date,
      available_beds: u.availableRooms,
    }));
  }

  private parseBookingsList(response: any): any[] {
    const reservations = response?.reservations || response?.data || [];
    return reservations.map((r: any) => this.parseSingleBooking({ reservation: r }));
  }

  private parseSingleBooking(response: any): any {
    const r = response?.reservation || response;
    if (!r) return null;
    return {
      externalId: r.id || r.reservationId || '',
      guest: { firstName: r.guestFirstName || r.guest?.first_name || '', lastName: r.guestLastName || r.guest?.last_name || '', email: r.guestEmail || r.guest?.email || '', phone: r.guestPhone || r.guest?.phone || '', country: r.guestCountry || '' },
      room: { externalRoomId: r.bedTypeId || r.bed_type_id || '', externalRatePlanId: r.ratePlanId || '' },
      dates: { checkIn: r.checkIn || r.checkin_date || '', checkOut: r.checkOut || r.checkout_date || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.pricePerBed || r.price_per_bed || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.totalPrice || r.total_price || 0, currency: r.currency || 'EUR', commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.paymentMethod || 'collect' },
      specialRequests: r.specialRequests || '', status: r.status || 'unknown', createdAt: r.createdAt || '', source: 'hostelworld',
    };
  }
}

/**
 * ZenHotels API Client
 * REST API with API Key authentication in X-API-Key header
 * Simple REST, no OAuth
 * API: https://api.zenhotels.com/v1
 * Rate limit: 100 req/min
 */
class ZenHotelsClient extends BaseOTAClient {
  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to ZenHotels')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to ZenHotels', propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseAvailabilityResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: this.buildInventoryPayload(updates) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return response.rates?.map((r: any) => ({ externalRoomId: r.roomId, externalRatePlanId: r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || 'USD', available: r.available !== false })) || [];
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || 'USD' })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return response.restrictions?.map((r: any) => ({ externalRoomId: r.roomId, date: r.date, closedToArrival: r.closedToArrival || false, closedToDeparture: r.closedToDeparture || false, closed: r.closed || false, minStay: r.minStay || 1, maxStay: r.maxStay || 99 })) || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closedToArrival: u.closedToArrival, closedToDeparture: u.closedToDeparture, closed: u.closed, minStay: u.minStay || 1, maxStay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBookingsList(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-ZenHotels-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/zenhotels'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-API-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseAvailabilityResponse(response: any): any[] {
    const rooms = response?.availability || response?.data || [];
    return rooms.map((r: any) => ({ externalRoomId: r.roomId, date: r.date, availableRooms: r.available, totalRooms: r.total || r.available }));
  }

  private buildInventoryPayload(updates: any[]): any[] {
    return updates.map(u => ({ room_type_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms }));
  }

  private parseBookingsList(response: any): any[] {
    const bookings = response?.bookings || response?.data || [];
    return bookings.map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.bookingId || '', guest: { firstName: r.guest?.firstName || '', lastName: r.guest?.lastName || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || '' },
      room: { externalRoomId: r.roomId || '', externalRatePlanId: r.ratePlanId || '' }, dates: { checkIn: r.checkIn || '', checkOut: r.checkOut || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.roomRate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.totalAmount || r.total || 0, currency: r.currency || 'USD', commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.paymentMethod || 'collect' }, specialRequests: r.specialRequests || '', status: r.status || 'unknown', createdAt: r.createdAt || '', source: 'zenhotels',
    };
  }
}

/**
 * Rakuten Travel API Client
 * REST API with API Key authentication in X-Rakuten-API-Key header
 * Japanese OTA: JPY currency, Japanese/Western room types
 * API: https://api.travel.rakuten.co.jp/hotel
 * Rate limit: 60 req/min
 */
class RakutenTravelClient extends BaseOTAClient {
  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Rakuten Travel')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to Rakuten Travel', propertyInfo: { id: response.hotelNo || this.credentials?.hotelId || '', name: response.hotelName || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ checkin_date: this.formatDate(startDate), checkout_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_class_codes', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/inventory?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseInventoryResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/inventory`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rooms: this.buildInventoryPayload(updates) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ checkin_date: this.formatDate(startDate), checkout_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_class_codes', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseRatesResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_class_code: u.externalRoomId, plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: 'JPY' })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ checkin_date: this.formatDate(startDate), checkout_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_class_codes', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return response.restrictions?.map((r: any) => ({ externalRoomId: r.roomClassCode, date: r.date, closedToArrival: r.closedToArrival || false, closedToDeparture: r.closedToDeparture || false, closed: r.closed || false, minStay: r.minStay || 1, maxStay: r.maxStay || 99 })) || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_class_code: u.externalRoomId, date: u.date, closedToArrival: u.closedToArrival, closedToDeparture: u.closedToDeparture, closed: u.closed, minStay: u.minStay || 1, maxStay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ checkin_from: this.formatDate(startDate), checkin_to: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/reservations?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBookingsList(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/reservations/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/reservations/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/reservations/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Rakuten-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/rakuten_travel'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Rakuten-API-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseInventoryResponse(response: any): any[] {
    const rooms = response?.rooms || response?.data || [];
    return rooms.map((r: any) => ({
      externalRoomId: r.roomClassCode || r.room_class_code,
      date: r.date,
      availableRooms: r.vacantCount || r.vacant_count || 0,
      totalRooms: r.totalCount || r.total_count || 0,
      roomStyle: r.roomStyle || r.room_style || 'western',
    }));
  }

  private buildInventoryPayload(updates: any[]): any[] {
    return updates.map(u => ({ room_class_code: u.externalRoomId, date: u.date, vacant_count: u.availableRooms, total_count: u.totalRooms || u.availableRooms }));
  }

  private parseRatesResponse(response: any): any[] {
    const rates = response?.rates || response?.data || [];
    return rates.map((r: any) => ({
      externalRoomId: r.roomClassCode || r.room_class_code,
      externalRatePlanId: r.planId || r.plan_id,
      date: r.date,
      baseRate: r.price || r.charge || 0,
      currency: 'JPY',
      available: r.vacant !== false,
    }));
  }

  private parseBookingsList(response: any): any[] {
    const reservations = response?.reservations || response?.data || [];
    return reservations.map((r: any) => this.parseSingleBooking({ reservation: r }));
  }

  private parseSingleBooking(response: any): any {
    const r = response?.reservation || response;
    if (!r) return null;
    return {
      externalId: r.reservationNo || r.id || '', guest: { firstName: r.guestName || r.guest_name || '', lastName: '', email: r.guestEmail || r.guest_email || '', phone: r.guestPhone || r.guest_phone || '', country: 'JP' },
      room: { externalRoomId: r.roomClassCode || r.room_class_code || '', externalRatePlanId: r.planId || r.plan_id || '' }, dates: { checkIn: r.checkinDate || r.checkin_date || '', checkOut: r.checkoutDate || r.checkout_date || '' },
      guests: { adults: r.adultCount || r.adult_count || 1, children: r.childCount || r.child_count || 0, total: (r.adultCount || 1) + (r.childCount || 0) },
      pricing: { roomRate: r.roomCharge || 0, taxes: r.tax || 0, fees: r.serviceCharge || 0, discount: r.discount || 0, totalAmount: r.totalCharge || r.total_charge || 0, currency: 'JPY', commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.paymentMethod || 'collect' }, specialRequests: r.specialRequests || '', status: r.status || 'unknown', createdAt: r.reserveDate || '', source: 'rakuten_travel',
    };
  }
}

/**
 * Jalan API Client (Recof')
 * REST API with API Key authentication in X-Jalan-API-Key header
 * Japanese OTA: Japanese-only language, JPY currency
 * API: https://api.jalan.net/hotel
 * Rate limit: 40 req/min
 */
class JalanClient extends BaseOTAClient {
  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Jalan')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to Jalan', propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.hotelName || 'Unknown', roomCount: response.planCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('plan_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/plans?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parsePlansResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/plans`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ plans: this.buildPlansPayload(updates) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('plan_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/plans?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parsePlansRates(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/plans`, { method: 'PATCH', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ plan_id: u.externalRoomId, rate_id: u.externalRatePlanId, date: u.date, price: u.baseRate })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('plan_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return response.availability?.map((a: any) => ({ externalRoomId: a.planId, date: a.date, closedToArrival: a.closedToArrival || false, closedToDeparture: a.closedToDeparture || false, closed: a.closed || false, minStay: a.minStay || 1, maxStay: a.maxStay || 99 })) || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ availability: updates.map(u => ({ plan_id: u.externalRoomId, date: u.date, closedToArrival: u.closedToArrival, closedToDeparture: u.closedToDeparture, closed: u.closed, minStay: u.minStay || 1, maxStay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ checkin_from: this.formatDate(startDate), checkin_to: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/reservations?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBookingsList(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/reservations/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/reservations/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/reservations/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Jalan-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/jalan'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Jalan-API-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parsePlansResponse(response: any): any[] {
    const plans = response?.plans || response?.data || [];
    return plans.map((p: any) => ({
      externalRoomId: p.planId || p.plan_id,
      date: p.date,
      availableRooms: p.vacant || p.stock || 0,
      totalRooms: p.stock || p.vacant || 0,
    }));
  }

  private buildPlansPayload(updates: any[]): any[] {
    return updates.map(u => ({ plan_id: u.externalRoomId, date: u.date, stock: u.availableRooms, vacant: u.availableRooms }));
  }

  private parsePlansRates(response: any): any[] {
    const plans = response?.plans || response?.data || [];
    const rates: any[] = [];
    for (const p of plans) {
      const planRates = p.rates || [];
      for (const r of planRates) {
        rates.push({ externalRoomId: p.planId || p.plan_id, externalRatePlanId: r.rateId || r.rate_id, date: p.date, baseRate: r.price || 0, currency: 'JPY', available: p.vacant > 0 });
      }
    }
    return rates;
  }

  private parseBookingsList(response: any): any[] {
    const reservations = response?.reservations || response?.data || [];
    return reservations.map((r: any) => this.parseSingleBooking({ reservation: r }));
  }

  private parseSingleBooking(response: any): any {
    const r = response?.reservation || response;
    if (!r) return null;
    return {
      externalId: r.reserveId || r.id || '', guest: { firstName: r.guestName || '', lastName: '', email: r.guestEmail || '', phone: r.guestPhone || '', country: 'JP' },
      room: { externalRoomId: r.planId || '', externalRatePlanId: r.rateId || '' }, dates: { checkIn: r.checkinDate || '', checkOut: r.checkoutDate || '' },
      guests: { adults: r.adultNum || 1, children: r.childNum || 0, total: (r.adultNum || 1) + (r.childNum || 0) },
      pricing: { roomRate: r.roomCharge || 0, taxes: r.tax || 0, fees: r.bathTax || 0, discount: 0, totalAmount: r.total || r.totalCharge || 0, currency: 'JPY', commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.paymentMethod || 'hotel' }, specialRequests: r.remarks || '', status: r.status || 'unknown', createdAt: r.reserveDatetime || '', source: 'jalan',
    };
  }
}

/**
 * Ostrovok API Client
 * REST API with Bearer token authentication
 * Russian/CIS OTA: RUB currency, Cyrillic support
 * API: https://partner.ostrovok.ru/api/v2
 * Rate limit: 100 req/min
 */
class OstrovokClient extends BaseOTAClient {
  private accessToken: string | null = null;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    this.accessToken = credentials.accessToken || null;
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Ostrovok')] };
    }
  }

  async disconnect(): Promise<void> { this.accessToken = null; this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotel/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to Ostrovok', propertyInfo: { id: response.hotel_id || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.room_types?.length || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ date_from: this.formatDate(startDate), date_to: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotel/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseAvailabilityResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotel/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ availability: this.buildAvailabilityPayload(updates) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ date_from: this.formatDate(startDate), date_to: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return response.rates?.map((r: any) => ({ externalRoomId: r.room_type_id, externalRatePlanId: r.rate_plan_id, date: r.date, baseRate: r.price, currency: 'RUB', available: r.quota > 0 })) || [];
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_type_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: 'RUB' })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ date_from: this.formatDate(startDate), date_to: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return response.restrictions?.map((r: any) => ({ externalRoomId: r.room_type_id, date: r.date, closedToArrival: r.closed_on_arrival || false, closedToDeparture: r.closed_on_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 })) || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_type_id: u.externalRoomId, date: u.date, closed_on_arrival: u.closedToArrival, closed_on_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ date_from: this.formatDate(startDate), date_to: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBookingsList(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Ostrovok-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/ostrovok'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) return { 'Authorization': `Bearer ${this.accessToken}` };
    return super.getAuthHeaders();
  }

  private parseAvailabilityResponse(response: any): any[] {
    const items = response?.availability || response?.data || [];
    return items.map((a: any) => ({
      externalRoomId: a.room_type_id,
      date: a.date,
      availableRooms: a.quota || a.available || 0,
      totalRooms: a.total || a.quota || 0,
    }));
  }

  private buildAvailabilityPayload(updates: any[]): any[] {
    return updates.map(u => ({ room_type_id: u.externalRoomId, date: u.date, quota: u.availableRooms }));
  }

  private parseBookingsList(response: any): any[] {
    const bookings = response?.bookings || response?.data || [];
    return bookings.map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest_first_name || r.guest?.first_name || '', lastName: r.guest_last_name || r.guest?.last_name || '', email: r.guest_email || r.guest?.email || '', phone: r.guest_phone || r.guest?.phone || '', country: r.guest_country || 'RU' },
      room: { externalRoomId: r.room_type_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.arrival_date || r.checkin || '', checkOut: r.departure_date || r.checkout || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.price || r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_price || r.total || 0, currency: 'RUB', commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_type || 'collect' }, specialRequests: r.wishes || r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: 'ostrovok',
    };
  }
}

/**
 * HRS (Hotel Reservation Service) API Client
 * REST API with API Key authentication in X-HRS-API-Key header
 * German OTA: EUR currency, supports German tax regulations (MwSt)
 * API: https://api.hrs.com/v2
 * Rate limit: 80 req/min
 */
class HRSClient extends BaseOTAClient {
  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to HRS')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to HRS', propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseInventoryResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ inventory: this.buildInventoryPayload(updates) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseRatesResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_type_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, gross_rate: u.baseRate, net_rate: this.calculateNetRate(u.baseRate), vat_rate: 0.07, currency: 'EUR' })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return response.restrictions?.map((r: any) => ({ externalRoomId: r.roomTypeId, date: r.date, closedToArrival: r.closedToArrival || false, closedToDeparture: r.closedToDeparture || false, closed: r.closed || false, minStay: r.minStay || 1, maxStay: r.maxStay || 99 })) || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_type_id: u.externalRoomId, date: u.date, closedToArrival: u.closedToArrival, closedToDeparture: u.closedToDeparture, closed: u.closed, minStay: u.minStay || 1, maxStay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/reservations?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBookingsList(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/reservations/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/reservations/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/reservations/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-HRS-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/hrs'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-HRS-API-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseInventoryResponse(response: any): any[] {
    const rooms = response?.inventory || response?.data || [];
    return rooms.map((r: any) => ({ externalRoomId: r.roomTypeId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  private buildInventoryPayload(updates: any[]): any[] {
    return updates.map(u => ({ room_type_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms }));
  }

  private parseRatesResponse(response: any): any[] {
    const rates = response?.rates || response?.data || [];
    return rates.map((r: any) => ({ externalRoomId: r.roomTypeId, externalRatePlanId: r.ratePlanId, date: r.date, baseRate: r.grossRate || r.gross_rate || 0, currency: 'EUR', available: r.available !== false }));
  }

  private calculateNetRate(grossRate: number): number {
    // German MwSt (VAT) at 7% for accommodation
    return Math.round(grossRate / 1.07 * 100) / 100;
  }

  private parseBookingsList(response: any): any[] {
    const reservations = response?.reservations || response?.data || [];
    return reservations.map((r: any) => this.parseSingleBooking({ reservation: r }));
  }

  private parseSingleBooking(response: any): any {
    const r = response?.reservation || response;
    if (!r) return null;
    return {
      externalId: r.id || r.reservationId || '', guest: { firstName: r.guestFirstName || r.guest?.first_name || '', lastName: r.guestLastName || r.guest?.last_name || '', email: r.guestEmail || r.guest?.email || '', phone: r.guestPhone || r.guest?.phone || '', country: r.guestCountry || r.guest?.country || 'DE' },
      room: { externalRoomId: r.roomTypeId || '', externalRatePlanId: r.ratePlanId || '' }, dates: { checkIn: r.arrivalDate || r.check_in || '', checkOut: r.departureDate || r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.grossRate || r.gross_rate || 0, taxes: r.vatAmount || r.vat_amount || 0, fees: r.serviceFee || 0, discount: r.discount || 0, totalAmount: r.totalAmount || r.total_amount || 0, currency: 'EUR', commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.paymentMethod || 'hotel' }, specialRequests: r.specialRequests || '', status: r.status || 'unknown', createdAt: r.createdAt || '', source: 'hrs',
    };
  }
}

// ============================================
// REGIONAL / SMALLER OTA CLIENTS
// ============================================

/**
 * Edreams API Client (ODIGEO Group)
 * REST API with API Key in X-ODIGEO-Key header
 * Spanish/European OTA: EUR currency, serves ES/IT/PT/FR markets
 * API: https://api.edreams.com/partner/v1
 * Rate limit: 60 req/min
 */
class EdreamsClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'EUR';
  protected readonly otaName = 'edreams';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseAvailabilityResponse(response);
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: this.buildInventoryPayload(updates) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseRatesResponse(response);
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseRestrictionsResponse(response);
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBookingsList(response);
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-ODIGEO-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-ODIGEO-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseAvailabilityResponse(response: any): any[] {
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || r.available_rooms || 0, totalRooms: r.total || r.available || 0 }));
  }

  private parseRatesResponse(response: any): any[] {
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  private parseRestrictionsResponse(response: any): any[] {
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  private buildInventoryPayload(updates: any[]): any[] {
    return updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms }));
  }

  private parseBookingsList(response: any): any[] {
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || r.guest_first_name || '', lastName: r.guest?.last_name || r.guest_last_name || '', email: r.guest?.email || r.guest_email || '', phone: r.guest?.phone || r.guest_phone || '', country: r.guest?.country || r.guest_country || 'ES' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || r.arrival_date || '', checkOut: r.check_out || r.departure_date || '' },
      guests: { adults: r.adults || r.num_adults || 1, children: r.children || r.num_children || 0, total: (r.adults || r.num_adults || 1) + (r.children || r.num_children || 0) },
      pricing: { roomRate: r.room_rate || r.gross_rate || 0, taxes: r.taxes || r.vat_amount || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || r.total_price || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.prepaid ? 'prepaid' : 'hotel' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Lastminute API Client (ODIGEO Group)
 * REST API with API Key in X-ODIGEO-Key header
 * European OTA: EUR/GBP currency, flash deals support
 * API: https://api.lastminute.com/partner/v1
 * Rate limit: 60 req/min
 * NOTE: Shares ODIGEO group API patterns with Edreams but is a separate brand.
 */
class LastminuteClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'EUR';
  protected readonly otaName = 'lastminute';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0, flashDeals: response.flashDeals || false } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false, flashDeal: r.flash_deal || false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-ODIGEO-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-ODIGEO-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'GB' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.prepaid ? 'prepaid' : 'hotel' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Jumia Travel API Client
 * REST API with API Key in X-Jumia-API-Key header
 * African OTA: Serves Africa/Middle East, NGN/KES/ZAR/EUR currencies
 * API: https://api.jumia.travel/v1
 * Rate limit: 40 req/min
 */
class JumiaTravelClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'NGN';
  protected readonly otaName = 'jumia_travel';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Jumia-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Jumia-API-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'NG' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Trivago API Client (Metasearch)
 * REST API with API Key in X-Trivago-API-Key header
 * Metasearch: Primarily pushes rates, no booking management
 * API: https://api.trivago.com/partner/v2
 * Rate limit: 80 req/min
 */
class TrivagoClient extends BaseOTAClient {
  protected readonly otaName = 'trivago';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'GET', headers: this.getCommonHeaders(), body: null });
      return { success: true, message: `Successfully connected to ${this.otaName} (metasearch)`, propertyInfo: { id: this.credentials?.hotelId || '', name: 'Metasearch Channel', roomCount: 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    // Metasearch: availability is read-only
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || []).map((r: any) => ({ externalRoomId: r.room_id || '', date: r.date, availableRooms: r.available || 0, totalRooms: r.total || 0 }));
  }

  async updateInventory(_updates: any[]): Promise<any> {
    // Metasearch: inventory not managed via push
    const correlationId = this.generateCorrelationId();
    return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', 0, correlationId);
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || 'EUR', available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || 'EUR' })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(_startDate: Date, _endDate: Date, _roomTypeIds?: string[]): Promise<any[]> {
    // Metasearch: restrictions not applicable
    return [];
  }

  async updateRestrictions(_updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', 0, correlationId);
  }

  async getBookings(_startDate: Date, _endDate: Date, _status?: string[]): Promise<any[]> {
    // Metasearch: no booking management
    return [];
  }

  async getBooking(_externalId: string): Promise<any> {
    // Metasearch: no booking management
    return null;
  }

  async confirmBooking(_externalId: string): Promise<boolean> {
    // Metasearch: no-op
    return true;
  }

  async cancelBooking(_externalId: string, _reason: string): Promise<boolean> {
    // Metasearch: no-op
    return true;
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Trivago-Event'] || payload?.event_type || 'rate_update', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Trivago-API-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }
}

/**
 * Skyscanner API Client (Metasearch / Flights+Hotels)
 * REST API with API Key in X-Skyscanner-Key header
 * Metasearch: Similar to Trivago, rate pushes only, no booking management
 * API: https://api.skyscanner.net/partner/v1
 * Rate limit: 100 req/min
 */
class SkyscannerClient extends BaseOTAClient {
  protected readonly otaName = 'skyscanner';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      await this.fetchWithRetry<any>(`${this.baseUrl}/availability?hotel_id=${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName} (metasearch)`, propertyInfo: { id: this.credentials?.hotelId || '', name: 'Metasearch Channel', roomCount: 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate), hotel_id: this.credentials?.hotelId || '' });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || []).map((r: any) => ({ externalRoomId: r.room_id || '', date: r.date, availableRooms: r.available || 0, totalRooms: r.total || 0 }));
  }

  async updateInventory(_updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', 0, correlationId);
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate), hotel_id: this.credentials?.hotelId || '' });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || 'EUR', available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || 'EUR' })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(_startDate: Date, _endDate: Date, _roomTypeIds?: string[]): Promise<any[]> { return []; }

  async updateRestrictions(_updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', 0, correlationId);
  }

  async getBookings(_startDate: Date, _endDate: Date, _status?: string[]): Promise<any[]> { return []; }

  async getBooking(_externalId: string): Promise<any> { return null; }

  async confirmBooking(_externalId: string): Promise<boolean> { return true; }

  async cancelBooking(_externalId: string, _reason: string): Promise<boolean> { return true; }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Skyscanner-Event'] || payload?.event_type || 'rate_update', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Skyscanner-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }
}

/**
 * Priceline API Client
 * REST API with API Key in X-Priceline-Key header
 * US OTA: USD currency, Name Your Own Price / Express Deals support
 * API: https://api.priceline.com/partner/v2
 * Rate limit: 120 req/min
 */
class PricelineClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'USD';
  protected readonly otaName = 'priceline';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0, expressDeals: response.expressDeals || false } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.inventory || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false, expressDeal: r.express_deal || false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Priceline-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Priceline-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'US' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Hotwire API Client (Expedia Group)
 * REST API with API Key in X-Hotwire-Key header
 * US OTA: USD currency, Hot Rate deals
 * API: https://api.hotwire.com/partner/v1
 * Rate limit: 100 req/min
 */
class HotwireClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'USD';
  protected readonly otaName = 'hotwire';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0, hotRates: response.hotRates || false } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false, hotRate: r.hot_rate || false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Hotwire-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Hotwire-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'US' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Wego API Client (Metasearch - Middle East focused)
 * REST API with API Key in X-Wego-Key header
 * Metasearch: Rate pushes, no booking management
 * Serves Middle East/Asia-Pacific, AED/SAR/INR currencies
 * API: https://api.wego.com/v1
 * Rate limit: 60 req/min
 */
class WegoClient extends BaseOTAClient {
  protected readonly otaName = 'wego';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName} (metasearch)`, propertyInfo: { id: this.credentials?.hotelId || '', name: 'Metasearch Channel', roomCount: 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || []).map((r: any) => ({ externalRoomId: r.room_id || '', date: r.date, availableRooms: r.available || 0, totalRooms: r.total || 0 }));
  }

  async updateInventory(_updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', 0, correlationId);
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || 'AED', available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || 'AED' })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(_startDate: Date, _endDate: Date, _roomTypeIds?: string[]): Promise<any[]> { return []; }

  async updateRestrictions(_updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', 0, correlationId);
  }

  async getBookings(_startDate: Date, _endDate: Date, _status?: string[]): Promise<any[]> { return []; }

  async getBooking(_externalId: string): Promise<any> { return null; }

  async confirmBooking(_externalId: string): Promise<boolean> { return true; }

  async cancelBooking(_externalId: string, _reason: string): Promise<boolean> { return true; }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Wego-Event'] || payload?.event_type || 'rate_update', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Wego-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }
}

// ============================================
// ADDITIONAL OTA CLIENT IMPLEMENTATIONS
// ============================================

/**
 * FlipKey API Client (TripAdvisor Vacation Rentals)
 * REST API with API Key in X-FlipKey-Key header
 * Vacation rental platform, EUR currency
 * API: https://api.flipkey.com/v1
 */
class FlipKeyClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'EUR';
  protected readonly otaName = 'flipkey';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.propertyId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.listingCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ property_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-FlipKey-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-FlipKey-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || '' },
      room: { externalRoomId: r.property_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Yatra API Client (Indian OTA)
 * REST API with API Key in X-Yatra-Key header
 * Indian market, INR currency
 * API: https://api.yatra.com/hotel-partner/v1
 */
class YatraClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'INR';
  protected readonly otaName = 'yatra';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Yatra-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Yatra-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'IN' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Cleartrip API Client (Indian OTA, Flipkart Group)
 * REST API with API Key in X-Cleartrip-Key header
 * Indian market, INR currency
 * API: https://api.cleartrip.com/partner/v1
 */
class CleartripClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'INR';
  protected readonly otaName = 'cleartrip';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Cleartrip-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Cleartrip-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'IN' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * EaseMyTrip API Client (Indian OTA)
 * REST API with API Key in X-EMT-Key header
 * Indian market, INR currency
 * API: https://api.easemytrip.com/partner/v1
 */
class EaseMyTripClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'INR';
  protected readonly otaName = 'easemytrip';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-EMT-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-EMT-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'IN' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * FabHotels API Client (Indian Budget Hotel Chain)
 * REST API with Bearer token authentication
 * Indian budget hotel chain, INR currency
 * API: https://api.fabhotels.com/partner/v1
 */
class FabHotelsClient extends BaseOTAClient {
  private accessToken: string | null = null;
  protected readonly defaultCurrency = 'INR';
  protected readonly otaName = 'fabhotels';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try {
      const tokenResponse = await this.fetchWithRetry<any>(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: credentials.apiKey || '', client_secret: credentials.apiSecret || '' }),
      });
      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        return await this.testConnection();
      }
      return { success: false, message: `Failed to authenticate with ${this.otaName}`, errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')] };
    } catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.accessToken = null; this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-FabHotels-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) return { 'Authorization': `Bearer ${this.accessToken}` };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'IN' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Treebo API Client (Indian Budget Hotel Chain)
 * REST API with Bearer token authentication
 * Indian budget hotel chain, INR currency
 * API: https://api.treebo.com/partner/v1
 */
class TreeboClient extends BaseOTAClient {
  private accessToken: string | null = null;
  protected readonly defaultCurrency = 'INR';
  protected readonly otaName = 'treebo';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try {
      const tokenResponse = await this.fetchWithRetry<any>(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: credentials.apiKey || '', client_secret: credentials.apiSecret || '' }),
      });
      if (tokenResponse.access_token) {
        this.accessToken = tokenResponse.access_token;
        return await this.testConnection();
      }
      return { success: false, message: `Failed to authenticate with ${this.otaName}`, errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')] };
    } catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.accessToken = null; this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms, total: u.totalRooms || u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, externalRatePlanId: r.rate_plan_id || r.ratePlanId, date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Treebo-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.accessToken) return { 'Authorization': `Bearer ${this.accessToken}` };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'IN' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Stayz API Client (Australian Vacation Rental)
 * REST API with API Key in X-Stayz-Key header
 * Australian market, AUD currency
 * API: https://api.stayz.com.au/v1
 */
class StayzClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'AUD';
  protected readonly otaName = 'stayz';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName}`, propertyInfo: { id: response.propertyId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.listingCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || response?.data || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ property_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = this.buildDateParams(startDate, endDate, roomTypeIds);
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || response?.data || []).map((r: any) => this.parseSingleBooking({ booking: r }));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseSingleBooking(response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Stayz-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Stayz-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private buildDateParams(startDate: Date, endDate: Date, roomTypeIds?: string[]): URLSearchParams {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    return params;
  }

  private parseSingleBooking(response: any): any {
    const r = response?.booking || response;
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'AU' },
      room: { externalRoomId: r.property_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

// ============================================
// NINEFLATS CLIENT
// ============================================

/**
 * 9flats API Client
 * European vacation rental platform
 * REST API with API Key in X-9Flats-Key header
 * Currency: EUR
 * API: https://api.9flats.com/v1
 */
class NineFlatsClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'EUR';
  protected readonly otaName = '9flats';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to 9flats`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to 9flats', propertyInfo: { id: response.propertyId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.listingCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ property_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || []).map((r: any) => this.parseBooking(r));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBooking(response?.booking || response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-9Flats-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/9flats'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-9Flats-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseBooking(r: any): any {
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'DE' },
      room: { externalRoomId: r.property_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

// ============================================
// BOOKABACH CLIENT
// ============================================

/**
 * Bookabach API Client
 * NZ vacation rental platform (owned by HomeAway/Expedia group)
 * REST API with API Key in X-Bookabach-Key header
 * Currency: NZD
 * API: https://api.bookabach.co.nz/v1
 */
class BookabachClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'NZD';
  protected readonly otaName = 'bookabach';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Bookabach')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to Bookabach', propertyInfo: { id: response.propertyId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.listingCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ property_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || []).map((r: any) => this.parseBooking(r));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBooking(response?.booking || response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Bookabach-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/bookabach'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Bookabach-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseBooking(r: any): any {
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'NZ' },
      room: { externalRoomId: r.property_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

// ============================================
// HOTELPLAN CLIENT
// ============================================

/**
 * Hotelplan API Client
 * Swiss OTA and tour operator
 * REST API with API Key in X-Hotelplan-Key header
 * Currency: CHF
 * API: https://api.hotelplan.com/v1
 */
class HotelplanClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'CHF';
  protected readonly otaName = 'hotelplan';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Hotelplan')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to Hotelplan', propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.inventory || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || []).map((r: any) => this.parseBooking(r));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBooking(response?.booking || response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Hotelplan-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/hotelplan'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Hotelplan-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseBooking(r: any): any {
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'CH' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

// ============================================
// HOUSTRIP CLIENT
// ============================================

/**
 * Housetrip API Client
 * European vacation rental platform
 * REST API with API Key in X-Housetrip-Key header
 * Currency: EUR
 * API: https://api.housetrip.com/v1
 */
class HousetripClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'EUR';
  protected readonly otaName = 'housetrip';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Housetrip')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to Housetrip', propertyInfo: { id: response.propertyId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.listingCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ property_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || []).map((r: any) => this.parseBooking(r));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBooking(response?.booking || response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Housetrip-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/housetrip'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Housetrip-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseBooking(r: any): any {
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'GB' },
      room: { externalRoomId: r.property_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

// ============================================
// IXIGO CLIENT
// ============================================

/**
 * ixigo API Client
 * Indian travel meta-search and OTA platform
 * REST API with API Key in X-IXIGO-Key header
 * Currency: INR
 * API: https://api.ixigo.com/partner/v1
 */
class IXIGIClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'INR';
  protected readonly otaName = 'ixigo';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to ixigo')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to ixigo', propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.inventory || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || []).map((r: any) => this.parseBooking(r));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBooking(response?.booking || response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-IXIGO-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/ixigo'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-IXIGO-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseBooking(r: any): any {
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'IN' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

// ============================================
// KAYAK CLIENT (METASEARCH)
// ============================================

/**
 * Kayak API Client
 * Metasearch engine - bookings not directly managed
 * REST API with API Key in X-Kayak-Key header
 * Currency: USD
 * API: https://api.kayak.com/partner/v1
 */
class KayakClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'USD';
  protected readonly otaName = 'kayak';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', `Unable to connect to ${this.otaName}`)] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      await this.fetchWithRetry<any>(`${this.baseUrl}/availability?hotel_id=${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: `Successfully connected to ${this.otaName} (metasearch)`, propertyInfo: { id: this.credentials?.hotelId || '', name: 'Metasearch Channel', roomCount: 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate), hotel_id: this.credentials?.hotelId || '' });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || []).map((r: any) => ({ externalRoomId: r.room_id || '', date: r.date, availableRooms: r.available || 0, totalRooms: r.total || 0 }));
  }

  async updateInventory(_updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', 0, correlationId);
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate), hotel_id: this.credentials?.hotelId || '' });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(_startDate: Date, _endDate: Date, _roomTypeIds?: string[]): Promise<any[]> { return []; }

  async updateRestrictions(_updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', 0, correlationId);
  }

  async getBookings(_startDate: Date, _endDate: Date, _status?: string[]): Promise<any[]> { return []; }

  async getBooking(_externalId: string): Promise<any> { return null; }

  async confirmBooking(_externalId: string): Promise<boolean> { return true; }

  async cancelBooking(_externalId: string, _reason: string): Promise<boolean> { return true; }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Kayak-Event'] || payload?.event_type || 'rate_update', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return `/api/ota/webhooks/${this.otaName}`; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Kayak-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }
}

// ============================================
// MUSAFIR CLIENT
// ============================================

/**
 * Musafir API Client
 * UAE-based travel agency and OTA
 * REST API with API Key in X-Musafir-Key header
 * Currency: AED
 * API: https://api.musafir.com/v1
 */
class MusafirClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'AED';
  protected readonly otaName = 'musafir';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Musafir')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to Musafir', propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.inventory || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || []).map((r: any) => this.parseBooking(r));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBooking(response?.booking || response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-Musafir-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/musafir'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-Musafir-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseBooking(r: any): any {
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'AE' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

// ============================================
// PLUMGUIDE CLIENT
// ============================================

/**
 * Plum Guide API Client
 * Curated vacation rental platform
 * REST API with API Key in X-PlumGuide-Key header
 * Currency: GBP
 * API: https://api.plumguide.com/v1
 */
class PlumGuideClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'GBP';
  protected readonly otaName = 'plum_guide';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Plum Guide')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to Plum Guide', propertyInfo: { id: response.propertyId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.listingCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.availability || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/availability`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ property_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.property_id || r.roomId, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/properties/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ property_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || []).map((r: any) => this.parseBooking(r));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBooking(response?.booking || response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-PlumGuide-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/plum_guide'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-PlumGuide-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseBooking(r: any): any {
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'GB' },
      room: { externalRoomId: r.property_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

// ============================================
// TRAVELGURU CLIENT
// ============================================

/**
 * TravelGuru API Client
 * Indian OTA platform
 * REST API with API Key in X-TravelGuru-Key header
 * Currency: INR
 * API: https://api.travelguru.com/v1
 */
class TravelGuruClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'INR';
  protected readonly otaName = 'travelguru';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to TravelGuru')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to TravelGuru', propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.inventory || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || []).map((r: any) => this.parseBooking(r));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBooking(response?.booking || response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-TravelGuru-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/travelguru'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-TravelGuru-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseBooking(r: any): any {
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'IN' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

// ============================================
// TUI CLIENT
// ============================================

/**
 * TUI API Client
 * European tour operator and OTA
 * REST API with API Key in X-TUI-Key header
 * Currency: EUR
 * API: https://api.tui.com/partner/v1
 */
class TUIClient extends BaseOTAClient {
  protected readonly defaultCurrency = 'EUR';
  protected readonly otaName = 'tui';

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    try { return await this.testConnection(); }
    catch (error) {
      return { success: false, message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to TUI')] };
    }
  }

  async disconnect(): Promise<void> { this.clearCredentials(); }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}`, { method: 'GET', headers: this.getCommonHeaders() });
      return { success: true, message: 'Successfully connected to TUI', propertyInfo: { id: response.hotelId || this.credentials?.hotelId || '', name: response.name || 'Unknown', roomCount: response.roomCount || 0 } };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, errors: [this.createOTAError('TEST_FAILED', 'Connection test failed')] };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.inventory || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, availableRooms: r.available || 0, totalRooms: r.total || r.available || 0 }));
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/inventory`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ updates: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, available: u.availableRooms })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'inventory', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    if (ratePlanIds?.length) params.append('rate_plan_ids', ratePlanIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.rates || []).map((r: any) => ({ externalRoomId: r.room_id, externalRatePlanId: r.rate_plan_id || '', date: r.date, baseRate: r.price, currency: r.currency || this.defaultCurrency, available: r.available !== false }));
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/rates`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ rates: updates.map(u => ({ room_id: u.externalRoomId, rate_plan_id: u.externalRatePlanId, date: u.date, price: u.baseRate, currency: u.currency || this.defaultCurrency })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'rates', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'rates', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (roomTypeIds?.length) params.append('room_type_ids', roomTypeIds.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.restrictions || []).map((r: any) => ({ externalRoomId: r.room_id, date: r.date, closedToArrival: r.closed_to_arrival || false, closedToDeparture: r.closed_to_departure || false, closed: r.closed || false, minStay: r.min_stay || 1, maxStay: r.max_stay || 99 }));
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    try {
      await this.fetchWithRetry(`${this.baseUrl}/hotels/${this.credentials?.hotelId}/restrictions`, { method: 'PUT', headers: this.getCommonHeaders(), body: JSON.stringify({ restrictions: updates.map(u => ({ room_id: u.externalRoomId, date: u.date, closed_to_arrival: u.closedToArrival, closed_to_departure: u.closedToDeparture, closed: u.closed, min_stay: u.minStay || 1, max_stay: u.maxStay || 99 })) }) });
      return this.createSuccessResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', updates.length, correlationId);
    } catch (error) {
      return this.createErrorResponse(this.credentials?.hotelId || '', 'restrictions', 'outbound', error instanceof Error ? error.message : 'Unknown error', correlationId, updates.length);
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({ start_date: this.formatDate(startDate), end_date: this.formatDate(endDate) });
    if (status?.length) params.append('status', status.join(','));
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings?${params}`, { method: 'GET', headers: this.getCommonHeaders() });
    return (response?.bookings || []).map((r: any) => this.parseBooking(r));
  }

  async getBooking(externalId: string): Promise<any> {
    const response = await this.fetchWithRetry<any>(`${this.baseUrl}/bookings/${externalId}`, { method: 'GET', headers: this.getCommonHeaders() });
    return this.parseBooking(response?.booking || response);
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/confirm`, { method: 'POST', headers: this.getCommonHeaders() }); return true; } catch { return false; }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try { await this.fetchWithRetry(`${this.baseUrl}/bookings/${externalId}/cancel`, { method: 'POST', headers: this.getCommonHeaders(), body: JSON.stringify({ reason }) }); return true; } catch { return false; }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return { success: true, eventType: headers['X-TUI-Event'] || payload?.event_type || 'unknown', data: payload, response: { statusCode: 200, body: 'OK' } };
  }

  getWebhookUrl(): string { return '/api/ota/webhooks/tui'; }

  async getHealthStatus(): Promise<any> {
    try { const r = await this.testConnection(); return r.success ? 'healthy' : 'unhealthy'; } catch { return 'unhealthy'; }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (this.credentials?.apiKey) return { 'X-TUI-Key': this.credentials.apiKey };
    return super.getAuthHeaders();
  }

  private parseBooking(r: any): any {
    if (!r) return null;
    return {
      externalId: r.id || r.booking_id || '', guest: { firstName: r.guest?.first_name || '', lastName: r.guest?.last_name || '', email: r.guest?.email || '', phone: r.guest?.phone || '', country: r.guest?.country || 'DE' },
      room: { externalRoomId: r.room_id || '', externalRatePlanId: r.rate_plan_id || '' }, dates: { checkIn: r.check_in || '', checkOut: r.check_out || '' },
      guests: { adults: r.adults || 1, children: r.children || 0, total: (r.adults || 1) + (r.children || 0) },
      pricing: { roomRate: r.room_rate || 0, taxes: r.taxes || 0, fees: r.fees || 0, discount: r.discount || 0, totalAmount: r.total_amount || 0, currency: r.currency || this.defaultCurrency, commission: r.commission || 0, commissionType: 'percentage' as const },
      payment: { method: r.payment_method || 'collect' }, specialRequests: r.special_requests || '', status: r.status || 'unknown', createdAt: r.created_at || '', source: this.otaName,
    };
  }
}

/**
 * Generic REST API Client
 * Used for OTAs with similar REST API structures
 */
class GenericRestClient extends BaseOTAClient {
  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    return await this.testConnection();
  }

  async disconnect(): Promise<void> {
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/properties/${this.credentials?.hotelId}`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: `Successfully connected to ${this.config.name}`,
        propertyInfo: {
          id: response.id || this.credentials?.hotelId,
          name: response.name || 'Unknown',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/inventory?` +
      `propertyId=${this.credentials?.hotelId}&` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.data || response.inventory || [];
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/inventory/bulk`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ propertyId: this.credentials?.hotelId, updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'inventory',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRates(startDate: Date, endDate: Date, roomTypeIds?: string[], ratePlanIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/rates?` +
      `propertyId=${this.credentials?.hotelId}&` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.data || response.rates || [];
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/rates/bulk`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ propertyId: this.credentials?.hotelId, updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'rates',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getRestrictions(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/restrictions?` +
      `propertyId=${this.credentials?.hotelId}&` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.data || response.restrictions || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/restrictions/bulk`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ propertyId: this.credentials?.hotelId, updates }),
        }
      );

      return this.createSuccessResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        updates.length,
        correlationId
      );
    } catch (error) {
      return this.createErrorResponse(
        this.credentials?.hotelId || '',
        'restrictions',
        'outbound',
        error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        updates.length
      );
    }
  }

  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    const params = new URLSearchParams({
      propertyId: this.credentials?.hotelId || '',
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
    });
    
    if (status?.length) {
      params.append('status', status.join(','));
    }

    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/bookings?${params}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.data || response.bookings || [];
  }

  async getBooking(externalId: string): Promise<any> {
    return await this.fetchWithRetry<any>(
      `${this.baseUrl}/bookings/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
  }

  async confirmBooking(externalId: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/bookings/${externalId}/confirm`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/bookings/${externalId}/cancel`,
        {
          method: 'POST',
          headers: this.getCommonHeaders(),
          body: JSON.stringify({ reason }),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    return {
      success: true,
      eventType: headers['X-Event-Type'] || 'unknown',
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return `/api/ota/webhooks/${this.config.id}`;
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }
}

// ============================================
// CLIENT FACTORY
// ============================================

export class OTAClientFactory {
  private static clients: Map<string, OTAAPIClient> = new Map();

  /**
   * Create or get an OTA client instance
   */
  static createClient(channelId: string): OTAAPIClient | null {
    // Check if we already have a cached client
    if (this.clients.has(channelId)) {
      return this.clients.get(channelId)!;
    }

    const config = getOTAById(channelId);
    if (!config) {
      console.error(`Unknown OTA channel: ${channelId}`);
      return null;
    }

    let client: OTAAPIClient;

    // Select the appropriate client based on channel
    switch (channelId) {
      case 'booking_com':
        client = new BookingComClient(config);
        break;
      
      case 'expedia':
        client = new ExpediaClient(config);
        break;

      case 'hotels_com':
        client = new HotelsComClient(config);
        break;

      case 'tripadvisor':
        client = new TripAdvisorClient(config);
        break;

      case 'traveloka':
        client = new TravelokaClient(config);
        break;

      case 'trip_com':
        client = new TripComClient(config);
        break;

      case 'airbnb':
        client = new AirbnbClient(config);
        break;

      case 'hostelworld':
        client = new HostelworldClient(config);
        break;

      case 'zenhotels':
        client = new ZenHotelsClient(config);
        break;

      case 'rakuten_travel':
        client = new RakutenTravelClient(config);
        break;

      case 'jalan':
        client = new JalanClient(config);
        break;

      case 'ostrovok':
        client = new OstrovokClient(config);
        break;

      case 'hrs':
        client = new HRSClient(config);
        break;
      
      case 'vrbo':
      case 'homeaway':
        client = new VrboClient(config);
        break;
      
      case 'google_hotels':
        client = new GoogleHotelsClient(config);
        break;
      
      case 'agoda':
        client = new AgodaClient(config);
        break;
      
      case 'makemytrip':
      case 'goibibo':
        client = new MakeMyTripClient(config);
        break;
      
      case 'oyo':
        client = new OYOClient(config);
        break;

      case 'edreams':
      case 'opodo':
        client = new EdreamsClient(config);
        break;

      case 'lastminute':
        client = new LastminuteClient(config);
        break;

      case 'jumia_travel':
        client = new JumiaTravelClient(config);
        break;

      case 'trivago':
        client = new TrivagoClient(config);
        break;

      case 'skyscanner':
        client = new SkyscannerClient(config);
        break;

      case 'priceline':
        client = new PricelineClient(config);
        break;

      case 'hotwire':
        client = new HotwireClient(config);
        break;

      case 'wego':
        client = new WegoClient(config);
        break;

      case 'flipkey':
        client = new FlipKeyClient(config);
        break;

      case 'yatra':
        client = new YatraClient(config);
        break;

      case 'cleartrip':
        client = new CleartripClient(config);
        break;

      case 'easemytrip':
        client = new EaseMyTripClient(config);
        break;

      case 'fabhotels':
        client = new FabHotelsClient(config);
        break;

      case 'treebo':
        client = new TreeboClient(config);
        break;

      case 'stayz':
        client = new StayzClient(config);
        break;

      case '9flats':
        client = new NineFlatsClient(config);
        break;

      case 'bookabach':
        client = new BookabachClient(config);
        break;

      case 'hotelplan':
        client = new HotelplanClient(config);
        break;

      case 'housetrip':
        client = new HousetripClient(config);
        break;

      case 'ixigo':
        client = new IXIGIClient(config);
        break;

      case 'kayak':
        client = new KayakClient(config);
        break;

      case 'musafir':
        client = new MusafirClient(config);
        break;

      case 'plum_guide':
        client = new PlumGuideClient(config);
        break;

      case 'travelguru':
        client = new TravelGuruClient(config);
        break;

      case 'tui':
        client = new TUIClient(config);
        break;

      default:
        console.warn(`No specific client for channel: ${channelId}, using GenericRestClient. Implement a dedicated client for production use.`);
        client = new GenericRestClient(config);
    }

    this.clients.set(channelId, client);
    return client;
  }

  /**
   * Get a client with credentials set
   */
  static async getAuthenticatedClient(
    channelId: string,
    credentials: OTACredentials
  ): Promise<OTAAPIClient | null> {
    this.clients.delete(channelId);
    const client = this.createClient(channelId);
    if (!client) return null;

    const result = await client.connect(credentials);
    if (!result.success) {
      console.error(`Failed to authenticate ${channelId}:`, result.message);
      return null;
    }

    return client;
  }

  /**
   * Clear cached client
   */
  static clearClient(channelId: string): void {
    this.clients.delete(channelId);
  }

  /**
   * Clear all cached clients
   */
  static clearAll(): void {
    this.clients.clear();
  }
}

/**
 * Get all available OTA configurations
 */
export function getAllOTAs(): OTAConfig[] {
  return ALL_OTAS;
}

/**
 * Get OTA configuration by ID
 */
export function getOTAConfig(channelId: string): OTAConfig | undefined {
  return getOTAById(channelId);
}
