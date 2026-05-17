/**
 * OYO API Client
 * Uses REST API with Bearer token authentication
 * API: https://api.oyorooms.com/partner
 * Rate limit: 200 req/min
 * OYO uses a flat room structure (no room types in the same way)
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class OYOClient extends BaseOTAClient {
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
