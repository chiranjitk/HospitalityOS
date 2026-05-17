/**
 * Trip.com API Client
 * Uses REST API with API Key authentication
 * Chinese OTA with support for CNY currency and Chinese market-specific fields
 * API: https://api.trip.com/hotel
 * Rate limit: 150 req/min
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class TripComClient extends BaseOTAClient {
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
