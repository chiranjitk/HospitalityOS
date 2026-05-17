/**
 * Traveloka API Client
 * Uses REST API with API Key + HMAC signature authentication
 * Southeast Asia OTA with support for local currency and multi-language
 * API: https://api.traveloka.com/hotel-partner
 * Rate limit: 100 req/min
 */

import crypto from 'crypto';

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class TravelokaClient extends BaseOTAClient {
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
