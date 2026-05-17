/**
 * Hotels.com API Client
 * Uses REST API with OAuth2 client credentials (Expedia Partner Network ecosystem)
 * API: https://api.hotels.com
 * Rate limit: 200 req/min
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class HotelsComClient extends BaseOTAClient {
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
