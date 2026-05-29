/**
 * Sabre Web Services Client
 *
 * Implements the Sabre SOAP/XML API for hospitality:
 *   - SessionCreateRQ / SessionCloseRQ — session token management
 *   - OTA_HotelAvailNotifRQ          — push availability changes
 *   - OTA_HotelRateAmountNotifRQ    — push rate updates
 *   - TravelItineraryReadRQ         — retrieve booking by PNR
 *   - HotelAvailRQ                   — check availability
 *
 * Authentication:
 *   1. Send SessionCreateRQ with HTTP Basic Auth (username:password)
 *   2. Receive binary security token in response
 *   3. Include token in subsequent requests
 *   4. Release session with SessionCloseRQ
 *
 * Sabre uses ebXML MessageHeader + WSSE security headers.
 *
 * @see https://webservices.sabre.com
 */

import { BaseGDSClient, gdsError, validateGDSConfig } from './base-client';
import type {
  GDSConfig,
  GDSTestResult,
  GDSSyncResult,
  GDSBooking,
  ARIUpdate,
  RateUpdate,
  AvailabilityResponse,
} from './types';

export class SabreClient extends BaseGDSClient {

  /** Active session token (from SessionCreateRQ) */
  private sessionToken: string | null = null;
  private sessionConversationId: string | null = null;
  private sessionExpiresAt: number = 0;

  // Session is valid for 15 minutes; refresh 2 minutes early
  private readonly SESSION_LIFETIME_MS = 15 * 60 * 1000;
  private readonly SESSION_REFRESH_BUFFER = 2 * 60 * 1000;

  // ============================================================
  // CONNECTION TEST
  // ============================================================

  /**
   * Test the Sabre connection by creating a session and then closing it.
   * Measures actual round-trip latency including session creation.
   */
  async testConnection(): Promise<GDSTestResult> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      return {
        connected: false,
        latency: 0,
        provider: 'sabre',
        error: `Configuration invalid: ${configErrors.join(', ')}`,
      };
    }

    const startMs = Date.now();

    try {
      await this.createSession();

      const connected = !!this.sessionToken;

      // Clean up session
      try { await this.closeSession(); } catch { /* ignore cleanup errors */ }

      return {
        connected,
        latency: Date.now() - startMs,
        provider: 'sabre',
        pccVerified: connected,
        propertyCodeVerified: connected,
        endpointReachable: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        connected: false,
        latency: Date.now() - startMs,
        provider: 'sabre',
        error: message,
        endpointReachable: message.includes('timed out') || message.includes('ECONNREFUSED') ? false : undefined,
      };
    }
  }

  // ============================================================
  // ARI (Availability, Rates, Inventory) PUSH
  // ============================================================

  /**
   * Push ARI updates to Sabre using OTA_HotelAvailNotifRQ.
   */
  async pushARI(updates: ARIUpdate[]): Promise<GDSSyncResult> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      return this.errorResult('inventory_push', `Configuration invalid: ${configErrors.join(', ')}`);
    }

    if (updates.length === 0) {
      return this.errorResult('inventory_push', 'No updates provided');
    }

    const startMs = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let processed = 0;

    try {
      await this.ensureSession();

      const chunks = this.chunkArray(updates, 25);

      for (let i = 0; i < chunks.length; i++) {
        try {
          const soapBody = this.buildOTAHotelAvailNotifRQ(chunks[i]);
          const responseXml = await this.sendRequest(soapBody, 'OTA_HotelAvailNotifRQ');

          if (responseXml.includes('Success') || responseXml.includes('OTA_HotelAvailNotifRS')) {
            processed += chunks[i].length;
          } else {
            const errorTexts = this.extractXmlValues(responseXml, 'Error');
            for (const errText of errorTexts) {
              errors.push(`Chunk ${i + 1}: ${errText}`);
            }
            warnings.push(`Chunk ${i + 1} had errors`);
          }
        } catch (error) {
          errors.push(`Chunk ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      errors.push(`Session management: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      try { await this.closeSession(); } catch { /* ignore */ }
    }

    return {
      success: errors.length === 0,
      action: 'inventory_push',
      provider: 'sabre',
      recordsProcessed: processed,
      errors,
      warnings,
      duration: Date.now() - startMs,
      timestamp: new Date(),
    };
  }

  // ============================================================
  // BOOKING PULL
  // ============================================================

  /**
   * Pull bookings from Sabre since a given date.
   * Uses TravelItineraryReadRQ.
   */
  async pullBookings(since: Date): Promise<GDSBooking[]> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      throw gdsError('INVALID_CONFIG', configErrors.join(', '), 'sabre');
    }

    try {
      await this.ensureSession();

      const soapBody = this.buildTravelItineraryReadRQ();
      const responseXml = await this.sendRequest(soapBody, 'TravelItineraryReadRQ_PullBookings');

      return this.parseBookingsFromResponse(responseXml);
    } finally {
      try { await this.closeSession(); } catch { /* ignore */ }
    }
  }

  // ============================================================
  // RATE UPDATE
  // ============================================================

  /**
   * Push rate updates to Sabre using OTA_HotelRateAmountNotifRQ.
   */
  async updateRates(rateUpdates: RateUpdate[]): Promise<GDSSyncResult> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      return this.errorResult('rate_update', `Configuration invalid: ${configErrors.join(', ')}`);
    }

    if (rateUpdates.length === 0) {
      return this.errorResult('rate_update', 'No rate updates provided');
    }

    const startMs = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let processed = 0;

    try {
      await this.ensureSession();

      const soapBody = this.buildOTAHotelRateAmountNotifRQ(rateUpdates);
      const responseXml = await this.sendRequest(soapBody, 'OTA_HotelRateAmountNotifRQ');

      if (responseXml.includes('Success')) {
        processed = rateUpdates.length;
      } else if (responseXml.includes('Errors') || responseXml.includes('Error')) {
        const errorTexts = this.extractXmlValues(responseXml, 'Error');
        for (const errText of errorTexts) {
          errors.push(errText);
        }
      } else {
        warnings.push('Unexpected response');
        processed = rateUpdates.length;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      try { await this.closeSession(); } catch { /* ignore */ }
    }

    return {
      success: errors.length === 0,
      action: 'rate_update',
      provider: 'sabre',
      recordsProcessed: processed,
      errors,
      warnings,
      duration: Date.now() - startMs,
      timestamp: new Date(),
    };
  }

  // ============================================================
  // BOOKING RETRIEVAL BY PNR
  // ============================================================

  /**
   * Retrieve a single booking from Sabre by PNR number.
   * Uses TravelItineraryReadRQ with Locator element.
   */
  async retrieveBooking(pnr: string): Promise<GDSBooking | null> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      throw gdsError('INVALID_CONFIG', configErrors.join(', '), 'sabre');
    }

    if (!pnr || pnr.trim().length === 0) {
      throw gdsError('INVALID_PNR', 'PNR number is required', 'sabre');
    }

    try {
      await this.ensureSession();

      const soapBody = this.buildPNRRetrieveRQ(pnr.trim());
      const responseXml = await this.sendRequest(soapBody, 'TravelItineraryReadRQ_PNR');

      const bookings = this.parseBookingsFromResponse(responseXml);
      return bookings.length > 0 ? bookings[0] : null;
    } finally {
      try { await this.closeSession(); } catch { /* ignore */ }
    }
  }

  // ============================================================
  // AVAILABILITY CHECK
  // ============================================================

  /**
   * Check availability for a room type across a date range.
   */
  async getAvailability(roomTypeCode: string, dateFrom: string, dateTo: string): Promise<AvailabilityResponse[]> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      throw gdsError('INVALID_CONFIG', configErrors.join(', '), 'sabre');
    }

    try {
      await this.ensureSession();

      const soapBody = this.buildHotelAvailRQ(roomTypeCode, dateFrom, dateTo);
      const responseXml = await this.sendRequest(soapBody, 'OTA_HotelAvailRQ');

      return this.parseAvailabilityResponse(responseXml, roomTypeCode);
    } finally {
      try { await this.closeSession(); } catch { /* ignore */ }
    }
  }

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'text/xml; charset=utf-8',
      'Accept': 'text/xml',
      'User-Agent': 'StaySuite-GDS/1.0',
    };

    // Use HTTP Basic Auth for session creation
    const creds = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    headers['Authorization'] = `Basic ${creds}`;

    return headers;
  }

  /** Create a new Sabre session via SessionCreateRQ */
  private async createSession(): Promise<void> {
    const timestamp = new Date().toISOString();
    const conversationId = this.generateMessageId();

    const body = `<SessionCreateRQ>
      <POS>
        <Source PseudoCityCode="${this.escapeXml(this.config.pcc)}"/>
      </POS>
    </SessionCreateRQ>`;

    const envelope = this.buildSabreEnvelope(body, conversationId, timestamp);
    const responseXml = await this.sendRequest(envelope, 'SessionCreateRQ');

    // Extract session token from BinarySecurityToken
    const token =
      this.extractXmlValue(responseXml, 'BinarySecurityToken');

    if (!token) {
      throw gdsError('SESSION_CREATE_FAILED', 'Failed to create Sabre session — no BinarySecurityToken in response', 'sabre', true);
    }

    this.sessionToken = token;
    this.sessionConversationId = conversationId;
    this.sessionExpiresAt = Date.now() + this.SESSION_LIFETIME_MS;
  }

  /** Ensure a valid session exists; create or refresh as needed */
  private async ensureSession(): Promise<void> {
    if (this.sessionToken && Date.now() < (this.sessionExpiresAt - this.SESSION_REFRESH_BUFFER)) {
      return; // session still valid
    }
    // Close old session if exists
    try { await this.closeSession(); } catch { /* ignore */ }
    await this.createSession();
  }

  /** Close the active Sabre session */
  private async closeSession(): Promise<void> {
    if (!this.sessionToken || !this.sessionConversationId) return;

    const timestamp = new Date().toISOString();
    const body = `<SessionCloseRQ/>`;
    const envelope = this.buildSabreEnvelope(body, this.sessionConversationId, timestamp);

    try {
      await this.sendRequest(envelope, 'SessionCloseRQ');
    } finally {
      this.sessionToken = null;
      this.sessionConversationId = null;
      this.sessionExpiresAt = 0;
    }
  }

  // ============================================================
  // SABRE ENVELOPE BUILDER
  // ============================================================

  /** Build the full Sabre SOAP envelope with ebXML MessageHeader and WSSE security */
  private buildSabreEnvelope(body: string, conversationId: string, timestamp: string): string {
    // For SessionCreateRQ: no session token yet
    // For subsequent requests: include BinarySecurityToken

    const securityHeader = this.sessionToken
      ? `<wsse:Security xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/12/secext">
          <wsse:BinarySecurityToken>${this.escapeXml(this.sessionToken)}</wsse:BinarySecurityToken>
        </wsse:Security>`
      : `<wsse:Security xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/12/secext"/>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:mes="http://www.ebxml.org/namespaces/messageHeader"
                   xmlns:sec="http://schemas.xmlsoap.org/ws/2002/12/secext">
  <soapenv:Header>
    <mes:MessageHeader mes:version="1.0.0" soapenv:mustUnderstand="1">
      <mes:From>
        <mes:PartyId type="urn:x-ebxml:csid:sabre.com:party-type:AIRLINE">StaySuite</mes:PartyId>
      </mes:From>
      <mes:To>
        <mes:PartyId type="urn:x-ebxml:csid:sabre.com:party-type:AIRLINE">Sabre</mes:PartyId>
      </mes:To>
      <mes:CPAId>${this.escapeXml(this.config.pcc)}</mes:CPAId>
      <mes:ConversationId>${conversationId}</mes:ConversationId>
      <mes:Service>${this.getServiceForBody(body)}</mes:Service>
      <mes:Action>${this.getActionForBody(body)}</mes:Action>
      <mes:MessageData>
        <mes:MessageId>mid:${this.generateMessageId()}</mes:MessageId>
        <mes:Timestamp>${timestamp}</mes:Timestamp>
        <mes:TimeToLive>${timestamp}</mes:TimeToLive>
      </mes:MessageData>
    </mes:MessageHeader>
    ${securityHeader}
  </soapenv:Header>
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  /** Build a session-aware envelope (includes session token) */
  private buildSessionEnvelope(body: string): string {
    return this.buildSabreEnvelope(body, this.sessionConversationId || this.generateMessageId(), new Date().toISOString());
  }

  // ============================================================
  // REQUEST BUILDERS
  // ============================================================

  /** Build OTA_HotelAvailNotifRQ for Sabre */
  private buildOTAHotelAvailNotifRQ(updates: ARIUpdate[]): string {
    const inventoryRows = updates.map(u => {
      return `          <AvailStatusMessage BookingLimit="${u.availableRooms}">
            <StatusApplicationControl Start="${u.date}" End="${u.date}"
              InvTypeCode="${u.roomTypeId}" RatePlanCode="${u.rateCodeId}"/>
            <Rates>
              <Rate>${u.rateAmount.toFixed(2)}</Rate>
              <CurrencyCode>${u.currency}</CurrencyCode>
            </Rates>
            <Restrictions Status="Open">
              <MinLOS>${u.restrictions?.minStay ?? 1}</MinLOS>
              <MaxLOS>${u.restrictions?.maxStay ?? 30}</MaxLOS>
              ${u.restrictions?.closedToArrival ? '<ClosedToArrival>true</ClosedToArrival>' : ''}
              ${u.restrictions?.closedToDeparture ? '<ClosedToDeparture>true</ClosedToDeparture>' : ''}
            </Restrictions>
          </AvailStatusMessage>`;
    }).join('\n');

    const body = `<OTA_HotelAvailNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05"
        Version="4.000" TimeStamp="${new Date().toISOString()}">
      <AvailStatusMessages HotelCode="${this.escapeXml(this.config.propertyCode)}">
${inventoryRows}
      </AvailStatusMessages>
    </OTA_HotelAvailNotifRQ>`;

    return this.buildSessionEnvelope(body);
  }

  /** Build OTA_HotelRateAmountNotifRQ for Sabre */
  private buildOTAHotelRateAmountNotifRQ(rateUpdates: RateUpdate[]): string {
    const rateMessages = rateUpdates.map(ru => `
        <RateAmountMessage HotelCode="${this.escapeXml(this.config.propertyCode)}">
          <StatusApplicationControl Start="${ru.dates.from}" End="${ru.dates.to}"
            InvTypeCode="${ru.roomTypeCode}" RatePlanCode="${ru.rateCode}"
            ${ru.restrictions?.minStay ? `MinLOS="${ru.restrictions.minStay}"` : ''}
            ${ru.restrictions?.maxStay ? `MaxLOS="${ru.restrictions.maxStay}"` : ''}
            ${ru.restrictions?.closedToArrival ? 'ClosedToArrival="true"' : ''}
            ${ru.restrictions?.closedToDeparture ? 'ClosedToDeparture="true"' : ''}/>
          <Rates>
            <Rate>
              <BaseByGuestAmts>
                <BaseByGuestAmt AmountAfterTax="${ru.amount.toFixed(2)}" CurrencyCode="${ru.currency}" NumberOfGuests="1"/>
              </BaseByGuestAmts>
            </Rate>
          </Rates>
        </RateAmountMessage>`).join('');

    const body = `<OTA_HotelRateAmountNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05"
        Version="7.000" TimeStamp="${new Date().toISOString()}">
      <RateAmountMessages>
${rateMessages}
      </RateAmountMessages>
    </OTA_HotelRateAmountNotifRQ>`;

    return this.buildSessionEnvelope(body);
  }

  /** Build TravelItineraryReadRQ — pull bookings (list) */
  private buildTravelItineraryReadRQ(): string {
    const body = `<TravelItineraryReadRQ>
      <Locator/>
    </TravelItineraryReadRQ>`;

    return this.buildSessionEnvelope(body);
  }

  /** Build TravelItineraryReadRQ for a specific PNR */
  private buildPNRRetrieveRQ(pnr: string): string {
    const body = `<TravelItineraryReadRQ>
      <Locator>${this.escapeXml(pnr)}</Locator>
    </TravelItineraryReadRQ>`;

    return this.buildSessionEnvelope(body);
  }

  /** Build OTA_HotelAvailRQ for Sabre */
  private buildHotelAvailRQ(roomTypeCode: string, dateFrom: string, dateTo: string): string {
    const body = `<OTA_HotelAvailRQ xmlns="http://www.opentravel.org/OTA/2003/05"
        Version="6.000" TimeStamp="${new Date().toISOString()}">
      <AvailRequestSegments>
        <AvailRequestSegment>
          <HotelSearchCriteria>
            <Criterion>
              <HotelRef HotelCode="${this.escapeXml(this.config.propertyCode)}"/>
              <StayDateRange Start="${dateFrom}" End="${dateTo}"/>
              <RoomStayCandidates>
                <RoomStayCandidate RoomTypeCode="${this.escapeXml(roomTypeCode)}" NumberOfGuests="1"/>
              </RoomStayCandidates>
            </Criterion>
          </HotelSearchCriteria>
        </AvailRequestSegment>
      </AvailRequestSegments>
    </OTA_HotelAvailRQ>`;

    return this.buildSessionEnvelope(body);
  }

  // ============================================================
  // RESPONSE PARSERS
  // ============================================================

  /** Parse bookings from Sabre TravelItinerary response */
  private parseBookingsFromResponse(xml: string): GDSBooking[] {
    const bookings: GDSBooking[] = [];

    // Sabre uses TravelItinerary with CustomerInfo and ItineraryInfo
    const itineraryBlocks = xml.split(/<TravelItinerary\s/i).slice(1);

    for (const block of itineraryBlocks) {
      const pnr = this.extractXmlValue(block, 'Locator') || '';

      // Guest info from CustomerInfo
      const personNameBlock = block.match(/<PersonName[^>]*>[\s\S]*?<\/PersonName>/i)?.[0] || '';
      const firstName = this.extractXmlValue(personNameBlock, 'GivenName') || '';
      const lastName = this.extractXmlValue(personNameBlock, 'Surname') || '';

      // Dates from HotelReservation segment
      const checkInStr = this.extractXmlAttribute(block, 'StayDateRange', 'Start') || '';
      const checkOutStr = this.extractXmlAttribute(block, 'StayDateRange', 'End') || '';

      const roomType = this.extractXmlAttribute(block, 'RoomType', 'RoomTypeCode') || '';
      const rateCode = this.extractXmlAttribute(block, 'RatePlan', 'RatePlanCode') || '';
      const status = this.extractXmlAttribute(block, 'Reservation', 'Status') || 'confirmed';

      let guestCount = 1;
      const guestCounts = block.match(/<GuestCount[^/]*Count="(\d+)"[^/]*/gi) || [];
      for (const gc of guestCounts) {
        const m = gc.match(/Count="(\d+)"/);
        if (m) guestCount += parseInt(m[1], 10);
      }

      const specialRequests = this.extractXmlValue(block, 'SpecialRequests') || undefined;

      if (pnr && checkInStr && checkOutStr) {
        bookings.push({
          pnr,
          firstName,
          lastName,
          checkIn: new Date(checkInStr),
          checkOut: new Date(checkOutStr),
          roomType,
          rateCode,
          status,
          guestCount,
          specialRequests,
          gdsSource: 'sabre',
        });
      }
    }

    return bookings;
  }

  /** Parse availability from OTA_HotelAvailRS */
  private parseAvailabilityResponse(xml: string, roomTypeCode: string): AvailabilityResponse[] {
    const results: AvailabilityResponse[] = [];
    const roomStays = xml.split(/<RoomStay\s/i).slice(1);

    for (const block of roomStays) {
      const start = this.extractXmlAttribute(block, 'StayDateRange', 'Start') || '';
      const available = this.extractXmlValue(block, 'TotalInventory') || '0';
      const currency = 'USD';

      const ratePlans: AvailabilityResponse['ratePlans'] = [];
      const rateBlocks = block.match(/<RatePlan[^>]*>[\s\S]*?<\/RatePlan>/gi) || [];
      for (const rp of rateBlocks) {
        const rpCode = this.extractXmlAttribute(rp, 'RatePlan', 'RatePlanCode') || '';
        const amount = this.extractXmlValue(rp, 'AmountAfterTax') || '0';
        if (rpCode) {
          ratePlans.push({
            rateCode: rpCode,
            rateAmount: parseFloat(amount),
            currency,
          });
        }
      }

      if (start) {
        results.push({
          roomTypeCode,
          date: start,
          availableRooms: parseInt(available, 10),
          ratePlans,
        });
      }
    }

    return results;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private errorResult(action: 'inventory_push' | 'rate_update' | 'booking_pull' | 'full_sync', error: string): GDSSyncResult {
    return {
      success: false,
      action,
      provider: 'sabre',
      recordsProcessed: 0,
      errors: [error],
      warnings: [],
      duration: 0,
      timestamp: new Date(),
    };
  }

  private getServiceForBody(body: string): string {
    if (body.includes('SessionCreateRQ')) return 'SessionCreateRQ';
    if (body.includes('SessionCloseRQ')) return 'SessionCloseRQ';
    if (body.includes('OTA_HotelAvailNotifRQ')) return 'OTA_HotelAvailNotifRQ';
    if (body.includes('OTA_HotelRateAmountNotifRQ')) return 'OTA_HotelRateAmountNotifRQ';
    if (body.includes('TravelItineraryReadRQ')) return 'TravelItineraryReadRQ';
    if (body.includes('OTA_HotelAvailRQ')) return 'OTA_HotelAvailRQ';
    return 'GenericRequest';
  }

  private getActionForBody(body: string): string {
    if (body.includes('SessionCreateRQ')) return 'SessionCreateRQ';
    if (body.includes('SessionCloseRQ')) return 'SessionCloseRQ';
    if (body.includes('OTA_HotelAvailNotifRQ')) return 'OTA_HotelAvailNotifRQ';
    if (body.includes('OTA_HotelRateAmountNotifRQ')) return 'OTA_HotelRateAmountNotifRQ';
    if (body.includes('TravelItineraryReadRQ')) return 'TravelItineraryReadRQ';
    if (body.includes('OTA_HotelAvailRQ')) return 'OTA_HotelAvailRQ';
    return 'Process';
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
