/**
 * Vrbo / HomeAway API Client
 * Uses REST API with OAuth2 client-credentials grant (Expedia Group ecosystem)
 * API: https://api.vrbo.com
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class VrboClient extends BaseOTAClient {
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
