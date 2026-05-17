/**
 * Agoda API Client
 * Uses REST API with API Key (X-Api-Key header) authentication
 * API: https://api.agoda.com
 * Rate limit: 100 req/min
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class AgodaClient extends BaseOTAClient {
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
