/**
 * Google Hotels (Hotel Price API) Client
 * Uses XML-based API with HMAC signature authentication
 * This is a metasearch channel - primarily pushes rates, does not pull bookings.
 * API: https://www.google.com/travel/hotels (Google Hotel Price API / Hotel Center)
 */

import crypto from 'crypto';

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

// XML escape helper used by GoogleHotelsClient
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class GoogleHotelsClient extends BaseOTAClient {
  private hmacKey: string | null = null;
  private partnerKey: string | null = null;
  private static readonly RATE_LIMIT_REQUESTS = 1000;
  private static readonly RATE_LIMIT_WINDOW_MS = 3_600_000;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);

    try {
      // Verify the API key by making a lightweight request
      this.hmacKey = credentials.apiSecret || credentials.signature || '';
      this.partnerKey = credentials.apiKey || credentials.hotelId || '';

      if (!this.hmacKey || !this.partnerKey) {
        return {
          success: false,
          message: 'Missing HMAC key or partner key for Google Hotels',
          errors: [this.createOTAError('AUTH_FAILED', 'HMAC key and partner key are required')],
        };
      }

      return await this.testConnection();
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Google Hotels')],
      };
    }
  }

  async disconnect(): Promise<void> {
    this.hmacKey = null;
    this.partnerKey = null;
    this.clearCredentials();
  }

  async testConnection(): Promise<any> {
    try {
      const xml = this.buildPingRequestXML();
      const signedHeaders = this.getSignedHeaders('/ping', xml);

      await this.fetchWithRetry<any>(
        `${this.baseUrl}/ping`,
        {
          method: 'POST',
          headers: signedHeaders,
          body: xml,
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Google Hotels',
        propertyInfo: {
          id: this.credentials?.hotelId || '',
          name: 'Google Hotel Price API',
          roomCount: 0,
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
    try {
      const xml = this.buildHotelPriceRequestXML('HotelPrice', startDate, endDate, roomTypeIds);
      const signedHeaders = this.getSignedHeaders('/v1/hotelprices', xml);

      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotelprices`,
        {
          method: 'POST',
          headers: signedHeaders,
          body: xml,
        }
      );
      return this.parseHotelPriceResponse(response);
    } catch (error) {
      console.error('Google Hotels getInventory error:', error);
      return [];
    }
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const xml = this.buildRatePlanInventoryXML(updates);
      const signedHeaders = this.getSignedHeaders('/v1/rateplans', xml);

      await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/rateplans`,
        {
          method: 'POST',
          headers: signedHeaders,
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
    try {
      const xml = this.buildHotelPriceRequestXML('HotelRatePlan', startDate, endDate, roomTypeIds);
      const signedHeaders = this.getSignedHeaders('/v1/hotelrateplans', xml);

      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/hotelrateplans`,
        {
          method: 'POST',
          headers: signedHeaders,
          body: xml,
        }
      );
      return this.parseHotelRatePlanResponse(response);
    } catch (error) {
      console.error('Google Hotels getRates error:', error);
      return [];
    }
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const xml = this.buildRateUpdateXML(updates);
      const signedHeaders = this.getSignedHeaders('/v1/rateplans', xml);

      await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/rateplans`,
        {
          method: 'POST',
          headers: signedHeaders,
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
    try {
      const params = new URLSearchParams({
        partnerKey: this.partnerKey || '',
        hotelId: this.credentials?.hotelId || '',
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
      });

      const signature = this.signQuerystring(params.toString());
      const headers = this.getCommonHeaders();
      headers['X-Signature'] = signature;

      const response = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/restrictions?${params}`,
        {
          method: 'GET',
          headers,
        }
      );
      return this.parseRestrictionsResponse(response);
    } catch (error) {
      console.error('Google Hotels getRestrictions error:', error);
      return [];
    }
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();

    try {
      const xml = this.buildRestrictionsUpdateXML(updates);
      const signedHeaders = this.getSignedHeaders('/v1/restrictions', xml);

      await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/restrictions`,
        {
          method: 'POST',
          headers: signedHeaders,
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

  /**
   * Google Hotels is a metasearch channel - it does not receive bookings directly.
   * Bookings are made through Google's search result links redirecting to the
   * hotel's booking page. This method returns an empty array.
   */
  async getBookings(startDate: Date, endDate: Date, status?: string[]): Promise<any[]> {
    return [];
  }

  /**
   * Google Hotels is a metasearch channel - no booking lookup available.
   */
  async getBooking(externalId: string): Promise<any> {
    return null;
  }

  /**
   * No-op for metasearch: Google Hotels does not support booking confirmation
   * as it does not manage bookings directly.
   */
  async confirmBooking(externalId: string): Promise<boolean> {
    return true;
  }

  /**
   * No-op for metasearch: Google Hotels does not support booking cancellation
   * as it does not manage bookings directly.
   */
  async cancelBooking(externalId: string, reason: string): Promise<boolean> {
    return true;
  }

  async processWebhook(payload: any, headers: Record<string, string>): Promise<any> {
    const eventType = payload?.event?.type || payload?.event_type || 'unknown';

    return {
      success: true,
      eventType,
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return '/api/ota/webhooks/google_hotels';
  }

  async getHealthStatus(): Promise<any> {
    try {
      const result = await this.testConnection();
      return result.success ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }

  /**
   * Override to include HMAC signature headers on all requests
   */
  protected getCommonHeaders(): Record<string, string> {
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/xml',
      'Accept': 'application/xml',
      'User-Agent': 'StaySuite-ChannelManager/1.0',
      'X-Partner-Key': this.partnerKey || '',
      'X-Request-ID': this.generateCorrelationId(),
    };
    return baseHeaders;
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'X-Partner-Key': this.partnerKey || '',
    };
  }

  // ---- Private helpers ----

  /**
   * Generate HMAC-SHA256 signature for a request path + body
   */
  private signPayload(path: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}|${path}|${body}`;
    const signature = crypto
      .createHmac('sha256', this.hmacKey || '')
      .update(payload)
      .digest('hex');
    return `${timestamp}.${signature}`;
  }

  /**
   * Generate HMAC-SHA256 signature for a query string
   */
  private signQuerystring(queryString: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}|${queryString}`;
    const signature = crypto
      .createHmac('sha256', this.hmacKey || '')
      .update(payload)
      .digest('hex');
    return `${timestamp}.${signature}`;
  }

  /**
   * Build full signed headers map for a POST request
   */
  private getSignedHeaders(path: string, body: string): Record<string, string> {
    const headers = this.getCommonHeaders();
    headers['X-HMAC-Signature'] = this.signPayload(path, body);
    return headers;
  }

  // ---- XML Builders ----

  private buildPingRequestXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <Ping partnerKey="${escapeXml(this.partnerKey || '')}" />
</Request>`;
  }

  private buildHotelPriceRequestXML(
    transactionType: string,
    startDate: Date,
    endDate: Date,
    roomTypeIds?: string[]
  ): string {
    const roomsXml = roomTypeIds?.map(id =>
      `<RoomID>${escapeXml(id)}</RoomID>`
    ).join('') || '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <${escapeXml(transactionType)} timestamp="${new Date().toISOString()}">
    <HotelInfo>
      <HotelID>${escapeXml(this.credentials?.hotelId || '')}</HotelID>
    </HotelInfo>
    <DateRange>
      <StartDate>${this.formatDate(startDate)}</StartDate>
      <EndDate>${this.formatDate(endDate)}</EndDate>
    </DateRange>
    ${roomsXml}
  </${escapeXml(transactionType)}>
</Request>`;
  }

  private buildRatePlanInventoryXML(updates: any[]): string {
    const roomUpdates = updates.map(u => `
      <RoomData>
        <RoomID>${escapeXml(u.externalRoomId)}</RoomID>
        <Date>${escapeXml(u.date)}</Date>
        <Available>${u.availableRooms > 0}</Available>
      </RoomData>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <HotelRatePlan timestamp="${new Date().toISOString()}">
    <HotelInfo>
      <HotelID>${escapeXml(this.credentials?.hotelId || '')}</HotelID>
    </HotelInfo>
    <RoomDataList>${roomUpdates}
    </RoomDataList>
  </HotelRatePlan>
</Request>`;
  }

  private buildRateUpdateXML(updates: any[]): string {
    const rateUpdates = updates.map(u => `
      <Rate>
        <RoomID>${escapeXml(u.externalRoomId)}</RoomID>
        <RatePlanID>${escapeXml(u.externalRatePlanId)}</RatePlanID>
        <Date>${escapeXml(u.date)}</Date>
        <BaseRate currency="${escapeXml(u.currency || 'USD')}">${u.baseRate}</BaseRate>
      </Rate>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <HotelRatePlan timestamp="${new Date().toISOString()}">
    <HotelInfo>
      <HotelID>${escapeXml(this.credentials?.hotelId || '')}</HotelID>
    </HotelInfo>
    <RateList>${rateUpdates}
    </RateList>
  </HotelRatePlan>
</Request>`;
  }

  private buildRestrictionsUpdateXML(updates: any[]): string {
    const restrictionUpdates = updates.map(u => `
      <Restriction>
        <RoomID>${escapeXml(u.externalRoomId)}</RoomID>
        <Date>${escapeXml(u.date)}</Date>
        <ClosedToArrival>${u.closedToArrival ? 'true' : 'false'}</ClosedToArrival>
        <ClosedToDeparture>${u.closedToDeparture ? 'true' : 'false'}</ClosedToDeparture>
        <Closed>${u.closed ? 'true' : 'false'}</Closed>
        <MinStay>${u.minStay || 1}</MinStay>
        <MaxStay>${u.maxStay || 99}</MaxStay>
      </Restriction>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <HotelRestrictions timestamp="${new Date().toISOString()}">
    <HotelInfo>
      <HotelID>${escapeXml(this.credentials?.hotelId || '')}</HotelID>
    </HotelInfo>
    <RestrictionList>${restrictionUpdates}
    </RestrictionList>
  </HotelRestrictions>
</Request>`;
  }

  // ---- XML Response Parsers ----

  private parseHotelPriceResponse(response: any): any[] {
    // Response may be XML string or already-parsed object
    if (typeof response === 'string') {
      return this.extractInventoryFromXml(response);
    }
    const rooms = response?.RoomDataList?.RoomData || response?.data || [];
    return (Array.isArray(rooms) ? rooms : [rooms]).map((r: any) => ({
      externalRoomId: r.RoomID || r.roomId || '',
      date: r.Date || r.date || '',
      availableRooms: r.Available === 'true' || r.Available === true ? 1 : 0,
      totalRooms: 1,
    }));
  }

  private parseHotelRatePlanResponse(response: any): any[] {
    if (typeof response === 'string') {
      return this.extractRatesFromXml(response);
    }
    const rates = response?.RateList?.Rate || response?.data || [];
    return (Array.isArray(rates) ? rates : [rates]).map((r: any) => ({
      externalRoomId: r.RoomID || r.roomId || '',
      externalRatePlanId: r.RatePlanID || r.ratePlanId || 'default',
      date: r.Date || r.date || '',
      baseRate: parseFloat(r.BaseRate || r.baseRate || '0'),
      currency: r.BaseRate?.$?.currency || r.currency || 'USD',
      available: true,
    }));
  }

  private parseRestrictionsResponse(response: any): any[] {
    if (typeof response === 'string') {
      return this.extractRestrictionsFromXml(response);
    }
    const restrictions = response?.RestrictionList?.Restriction || response?.data || [];
    return (Array.isArray(restrictions) ? restrictions : [restrictions]).map((r: any) => ({
      externalRoomId: r.RoomID || r.roomId || '',
      date: r.Date || r.date || '',
      closedToArrival: r.ClosedToArrival === 'true' || r.ClosedToArrival === true,
      closedToDeparture: r.ClosedToDeparture === 'true' || r.ClosedToDeparture === true,
      closed: r.Closed === 'true' || r.Closed === true,
      minStay: parseInt(r.MinStay || '1', 10),
      maxStay: parseInt(r.MaxStay || '99', 10),
    }));
  }

  /**
   * Minimal XML extraction helpers for string responses.
   * In production, a proper XML parser (e.g., fast-xml-parser) should be used.
   */
  private extractInventoryFromXml(xml: string): any[] {
    const results: any[] = [];
    const roomRegex = /<RoomData[^>]*>([\s\S]*?)<\/RoomData>/g;
    let match;
    while ((match = roomRegex.exec(xml)) !== null) {
      const block = match[1];
      const roomId = this.extractXmlValue(block, 'RoomID');
      const date = this.extractXmlValue(block, 'Date');
      const available = this.extractXmlValue(block, 'Available');
      if (roomId && date) {
        results.push({
          externalRoomId: roomId,
          date,
          availableRooms: available === 'true' ? 1 : 0,
          totalRooms: 1,
        });
      }
    }
    return results;
  }

  private extractRatesFromXml(xml: string): any[] {
    const results: any[] = [];
    const rateRegex = /<Rate[^>]*>([\s\S]*?)<\/Rate>/g;
    let match;
    while ((match = rateRegex.exec(xml)) !== null) {
      const block = match[1];
      const roomId = this.extractXmlValue(block, 'RoomID');
      const ratePlanId = this.extractXmlValue(block, 'RatePlanID');
      const date = this.extractXmlValue(block, 'Date');
      const baseRate = this.extractXmlValue(block, 'BaseRate');
      if (roomId && date) {
        results.push({
          externalRoomId: roomId,
          externalRatePlanId: ratePlanId || 'default',
          date,
          baseRate: parseFloat(baseRate || '0'),
          currency: 'USD',
          available: true,
        });
      }
    }
    return results;
  }

  private extractRestrictionsFromXml(xml: string): any[] {
    const results: any[] = [];
    const restrictionRegex = /<Restriction[^>]*>([\s\S]*?)<\/Restriction>/g;
    let match;
    while ((match = restrictionRegex.exec(xml)) !== null) {
      const block = match[1];
      const roomId = this.extractXmlValue(block, 'RoomID');
      const date = this.extractXmlValue(block, 'Date');
      if (roomId && date) {
        results.push({
          externalRoomId: roomId,
          date,
          closedToArrival: this.extractXmlValue(block, 'ClosedToArrival') === 'true',
          closedToDeparture: this.extractXmlValue(block, 'ClosedToDeparture') === 'true',
          closed: this.extractXmlValue(block, 'Closed') === 'true',
          minStay: parseInt(this.extractXmlValue(block, 'MinStay') || '1', 10),
          maxStay: parseInt(this.extractXmlValue(block, 'MaxStay') || '99', 10),
        });
      }
    }
    return results;
  }

  private extractXmlValue(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
    const match = regex.exec(xml);
    return match ? match[1].trim() : '';
  }
}
