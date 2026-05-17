/**
 * TripAdvisor API Client
 * Uses REST API with API Key authentication (metasearch/referral model)
 * API: https://api.tripadvisor.com
 * Rate limit: 50 req/min
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class TripAdvisorClient extends BaseOTAClient {
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
