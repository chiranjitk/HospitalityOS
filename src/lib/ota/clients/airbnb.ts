/**
 * Airbnb API Client
 * Uses REST API with OAuth2 authentication and calendar-based inventory sync
 * API: https://api.airbnb.com/v2
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class AirbnbClient extends BaseOTAClient {
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
