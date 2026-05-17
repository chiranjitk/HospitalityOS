/**
 * Booking.com API Client
 * Uses XML-based API with Basic authentication
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

// ============================================
// XML ESCAPE HELPER (BookingComClient only)
// ============================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class BookingComClient extends BaseOTAClient {
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

  // ============================================
  // XML RESPONSE PARSING HELPERS
  // ============================================

  /**
   * Parse raw XML string response into a structured object with helper methods.
   * Booking.com returns XML, so we extract tags using regex-based parsing.
   * Falls back to treating the response as already-parsed JSON.
   */
  private parseXmlResponse(xml: string | object): { extractTag: (tag: string, xmlStr: string) => Record<string, string>[]; parseInnerTags: (inner: string) => Record<string, string> } {
    // If the response is already a parsed object (not a string), return passthrough helpers
    if (typeof xml !== 'string') {
      return {
        extractTag: (_tag: string, _xmlStr: string) => [],
        parseInnerTags: (_inner: string) => ({}),
      };
    }

    // Extract all occurrences of a given XML tag and return array of inner tag objects
    const extractTag = (tag: string, xmlStr: string): Record<string, string>[] => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      const results: Record<string, string>[] = [];
      let match;
      while ((match = regex.exec(xmlStr)) !== null) {
        results.push(parseInnerTags(match[1]));
      }
      return results;
    };

    // Parse inner XML tags of an element into a flat key-value object
    const parseInnerTags = (inner: string): Record<string, string> => {
      const obj: Record<string, string> = {};
      const tagRegex = /<(\w+)[^>]*>([\s\S]*?)<\/\1>/g;
      let m;
      while ((m = tagRegex.exec(inner)) !== null) {
        obj[m[1]] = m[2].trim();
      }
      return obj;
    };

    return { extractTag, parseInnerTags };
  }

  // Response parsers
  private parseInventoryResponse(response: any): any[] {
    // If response is already parsed JSON with a rooms array, use it directly
    if (response && typeof response === 'object' && !Array.isArray(response) && response.rooms) {
      return response.rooms.map((r: any) => ({
        externalRoomId: r.room_id,
        date: r.date,
        availableRooms: parseInt(r.availability, 10) || 0,
        totalRooms: parseInt(r.total, 10) || parseInt(r.availability, 10) || 0,
      }));
    }

    // Parse raw XML response
    const xml = typeof response === 'string' ? response : JSON.stringify(response);
    const { extractTag } = this.parseXmlResponse(xml);
    const rooms = extractTag('room', xml);

    if (rooms.length === 0) return [];

    return rooms.map((r) => ({
      externalRoomId: r.room_id || '',
      date: r.date || '',
      availableRooms: parseInt(r.availability, 10) || 0,
      totalRooms: parseInt(r.total, 10) || parseInt(r.availability, 10) || 0,
    }));
  }

  private parseRateResponse(response: any): any[] {
    // If response is already parsed JSON with a rates array, use it directly
    if (response && typeof response === 'object' && !Array.isArray(response) && response.rates) {
      return response.rates.map((r: any) => ({
        externalRoomId: r.room_id,
        externalRatePlanId: r.rate_plan_id,
        date: r.date,
        baseRate: parseFloat(r.price) || 0,
        currency: r.currency || 'USD',
        available: r.available !== '0' && r.available !== 0,
      }));
    }

    // Parse raw XML response
    const xml = typeof response === 'string' ? response : JSON.stringify(response);
    const { extractTag } = this.parseXmlResponse(xml);
    const rates = extractTag('rate', xml);

    if (rates.length === 0) return [];

    return rates.map((r) => ({
      externalRoomId: r.room_id || '',
      externalRatePlanId: r.rate_plan_id || '',
      date: r.date || '',
      baseRate: parseFloat(r.price) || 0,
      currency: r.currency || 'USD',
      available: r.available !== '0' && r.available !== 0,
    }));
  }

  private parseRestrictionsResponse(response: any): any[] {
    // If response is already parsed JSON with a restrictions array, use it directly
    if (response && typeof response === 'object' && !Array.isArray(response) && response.restrictions) {
      return response.restrictions.map((r: any) => ({
        externalRoomId: r.room_id,
        date: r.date,
        closedToArrival: r.closed_to_arrival === 1 || r.closed_to_arrival === '1',
        closedToDeparture: r.closed_to_departure === 1 || r.closed_to_departure === '1',
        closed: r.closed === 1 || r.closed === '1',
        minStay: parseInt(r.min_stay, 10) || 1,
        maxStay: parseInt(r.max_stay, 10) || 99,
      }));
    }

    // Parse raw XML response
    const xml = typeof response === 'string' ? response : JSON.stringify(response);
    const { extractTag } = this.parseXmlResponse(xml);
    const restrictions = extractTag('restriction', xml);

    if (restrictions.length === 0) return [];

    return restrictions.map((r) => ({
      externalRoomId: r.room_id || '',
      date: r.date || '',
      closedToArrival: r.closed_to_arrival === '1',
      closedToDeparture: r.closed_to_departure === '1',
      closed: r.closed === '1',
      minStay: parseInt(r.min_stay, 10) || 1,
      maxStay: parseInt(r.max_stay, 10) || 99,
    }));
  }

  private parseBookingsResponse(response: any): any[] {
    // If response is already parsed JSON with a reservations array, use it directly
    if (response && typeof response === 'object' && !Array.isArray(response) && response.reservations) {
      const reservations = Array.isArray(response.reservations) ? response.reservations : [response.reservations];
      return reservations.map((r: any) => this.parseBooking(r));
    }

    // Parse raw XML response
    const xml = typeof response === 'string' ? response : JSON.stringify(response);
    const { extractTag } = this.parseXmlResponse(xml);
    const reservations = extractTag('reservation', xml);

    if (reservations.length === 0) return [];

    return reservations.map((r) => this.parseBooking(r));
  }

  private parseSingleBookingResponse(response: any): any {
    // If response is already parsed JSON with a reservation object, use it directly
    if (response && typeof response === 'object' && response.reservation) {
      return this.parseBooking(response.reservation);
    }

    // Parse raw XML response
    const xml = typeof response === 'string' ? response : JSON.stringify(response);
    const { extractTag } = this.parseXmlResponse(xml);
    const reservations = extractTag('reservation', xml);
    return reservations.length > 0 ? this.parseBooking(reservations[0]) : null;
  }

  private parseBooking(r: any): any {
    return {
      guest: {
        firstName: r.guest_first_name || '',
        lastName: r.guest_last_name || '',
        email: r.guest_email || '',
        phone: r.guest_phone || '',
        country: r.guest_country || '',
      },
      room: {
        externalRoomId: r.room_id || '',
        externalRatePlanId: r.rate_plan_id || '',
      },
      dates: {
        checkIn: r.checkin_date || '',
        checkOut: r.checkout_date || '',
      },
      guests: {
        adults: parseInt(r.num_adults, 10) || 1,
        children: parseInt(r.num_children, 10) || 0,
      },
      pricing: {
        roomRate: parseFloat(r.room_rate) || 0,
        taxes: parseFloat(r.taxes) || 0,
        fees: parseFloat(r.fees) || 0,
        discount: parseFloat(r.discount) || 0,
        totalAmount: parseFloat(r.total_price) || 0,
        currency: r.currency || 'USD',
        commission: parseFloat(r.commission) || 0,
        commissionType: 'percentage' as const,
      },
      payment: {
        method: r.prepaid === 'true' || r.prepaid === true ? 'prepaid' : 'collect',
      },
      specialRequests: r.special_requests || '',
      createdAt: r.created_at || '',
      source: 'booking_com',
    };
  }
}
