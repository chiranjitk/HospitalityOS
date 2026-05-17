/**
 * MakeMyTrip API Client
 * Uses REST API with HMAC-SHA256 signature authentication
 * API: https://developer.makemytrip.com/api
 * Rate limit: 50 req/min (India OTA, stricter limits)
 */

import crypto from 'crypto';

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class MakeMyTripClient extends BaseOTAClient {
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
