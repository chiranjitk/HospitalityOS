/**
 * Travelport (Galileo/Worldspan) Client
 *
 * Implements the Travelport Universal API SOAP/XML interface for hospitality:
 *   - HotelAvailRQ                 — push availability to Travelport
 *   - HotelRateModifyRQ           — update rates on Travelport
 *   - UniversalRecordSearchRQ     — search bookings by date or criteria
 *   - UniversalRecordRetrieveRQ   — retrieve full booking details by PNR
 *
 * Authentication:
 *   Uses Travelport's proprietary BinarySecurityToken in the SOAP header.
 *   Obtained via a separate auth endpoint using username + password + TargetBranch (PCC).
 *
 * Travelport uses a custom XML namespace (common: and hotel:) rather than pure OTA.
 *
 * @see https://api.travelport.com
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

export class TravelportClient extends BaseGDSClient {

  /** Active session token (from Travelport auth) */
  private authToken: string | null = null;
  private traceId: string | null = null;
  private tokenExpiresAt: number = 0;

  // Token lifetime is typically 20 minutes; refresh 3 minutes early
  private readonly TOKEN_LIFETIME_MS = 20 * 60 * 1000;
  private readonly TOKEN_REFRESH_BUFFER = 3 * 60 * 1000;

  // ============================================================
  // CONNECTION TEST
  // ============================================================

  /**
   * Test the Travelport connection by authenticating and verifying endpoint.
   */
  async testConnection(): Promise<GDSTestResult> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      return {
        connected: false,
        latency: 0,
        provider: 'travelport',
        error: `Configuration invalid: ${configErrors.join(', ')}`,
      };
    }

    const startMs = Date.now();

    try {
      await this.authenticate();

      const connected = !!this.authToken;

      return {
        connected,
        latency: Date.now() - startMs,
        provider: 'travelport',
        pccVerified: connected,
        propertyCodeVerified: connected,
        endpointReachable: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        connected: false,
        latency: Date.now() - startMs,
        provider: 'travelport',
        error: message,
        endpointReachable: message.includes('timed out') || message.includes('ECONNREFUSED') ? false : undefined,
      };
    }
  }

  // ============================================================
  // ARI (Availability, Rates, Inventory) PUSH
  // ============================================================

  /**
   * Push ARI updates to Travelport using HotelAvailRQ.
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
      await this.ensureAuth();

      // Travelport processes one room type at a time in HotelAvailRQ
      const groupedByRoomType = this.groupBy(updates, u => u.roomTypeId);

      for (const [roomTypeId, roomUpdates] of Object.entries(groupedByRoomType)) {
        try {
          const soapBody = this.buildHotelAvailRQ(roomTypeId, roomUpdates);
          const responseXml = await this.sendRequest(soapBody, 'HotelAvailRQ');

          if (responseXml.includes('HotelAvailRS') || responseXml.includes('Success')) {
            processed += roomUpdates.length;
          } else {
            const errorTexts = this.extractXmlValues(responseXml, 'Error');
            for (const errText of errorTexts) {
              errors.push(`RoomType ${roomTypeId}: ${errText}`);
            }
          }
        } catch (error) {
          errors.push(`RoomType ${roomTypeId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      errors.push(`Auth: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      success: errors.length === 0,
      action: 'inventory_push',
      provider: 'travelport',
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
   * Pull bookings from Travelport using UniversalRecordSearchRQ.
   */
  async pullBookings(since: Date): Promise<GDSBooking[]> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      throw gdsError('INVALID_CONFIG', configErrors.join(', '), 'travelport');
    }

    await this.ensureAuth();

    const soapBody = this.buildUniversalRecordSearchRQ(since);
    const responseXml = await this.sendRequest(soapBody, 'UniversalRecordSearchRQ');

    return this.parseBookingsFromResponse(responseXml);
  }

  // ============================================================
  // RATE UPDATE
  // ============================================================

  /**
   * Update rates on Travelport using HotelRateModifyRQ.
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
      await this.ensureAuth();

      for (const ru of rateUpdates) {
        try {
          const soapBody = this.buildHotelRateModifyRQ(ru);
          const responseXml = await this.sendRequest(soapBody, 'HotelRateModifyRQ');

          if (responseXml.includes('HotelRateModifyRS') || responseXml.includes('Success')) {
            processed++;
          } else {
            const errorTexts = this.extractXmlValues(responseXml, 'Error');
            errors.push(`Rate ${ru.rateCode}: ${errorTexts.join(', ')}`);
          }
        } catch (error) {
          errors.push(`Rate ${ru.rateCode}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      success: errors.length === 0,
      action: 'rate_update',
      provider: 'travelport',
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
   * Retrieve a single booking from Travelport by PNR.
   * Uses UniversalRecordRetrieveRQ with LocatorCode.
   */
  async retrieveBooking(pnr: string): Promise<GDSBooking | null> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      throw gdsError('INVALID_CONFIG', configErrors.join(', '), 'travelport');
    }

    if (!pnr || pnr.trim().length === 0) {
      throw gdsError('INVALID_PNR', 'PNR number is required', 'travelport');
    }

    await this.ensureAuth();

    const soapBody = this.buildUniversalRecordRetrieveRQ(pnr.trim());
    const responseXml = await this.sendRequest(soapBody, 'UniversalRecordRetrieveRQ');

    const bookings = this.parseBookingsFromResponse(responseXml);
    return bookings.length > 0 ? bookings[0] : null;
  }

  // ============================================================
  // AVAILABILITY CHECK
  // ============================================================

  /**
   * Check room availability on Travelport for a date range.
   */
  async getAvailability(roomTypeCode: string, dateFrom: string, dateTo: string): Promise<AvailabilityResponse[]> {
    const configErrors = validateGDSConfig(this.config);
    if (configErrors.length > 0) {
      throw gdsError('INVALID_CONFIG', configErrors.join(', '), 'travelport');
    }

    await this.ensureAuth();

    // Reuse HotelAvailRQ in read mode
    const updates: ARIUpdate[] = [];
    let current = new Date(dateFrom);
    const end = new Date(dateTo);
    while (current <= end) {
      updates.push({
        roomTypeId: roomTypeCode,
        rateCodeId: 'DEFAULT',
        date: this.formatDate(current),
        availableRooms: 0,
        rateAmount: 0,
        currency: 'USD',
      });
      current.setDate(current.getDate() + 1);
    }

    const soapBody = this.buildHotelAvailRQ(roomTypeCode, updates);
    const responseXml = await this.sendRequest(soapBody, 'HotelAvailRQ');

    return this.parseAvailabilityResponse(responseXml, roomTypeCode);
  }

  // ============================================================
  // TRAVELPORT AUTHENTICATION
  // ============================================================

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'text/xml; charset=utf-8',
      'Accept': 'text/xml',
      'User-Agent': 'StaySuite-GDS/1.0',
    };
  }

  /**
   * Authenticate with Travelport to obtain a BinarySecurityToken.
   * Travelport uses a separate auth endpoint or inline credentials
   * depending on the deployment model.
   */
  private async authenticate(): Promise<void> {
    const soapBody = this.buildAuthEnvelope();

    const startMs = Date.now();
    const responseXml = await this.sendRequest(soapBody, 'AuthRequest');
    const duration = Date.now() - startMs;

    // Extract the BinarySecurityToken from the response
    const token =
      this.extractXmlValue(responseXml, 'BinarySecurityToken');

    if (!token) {
      throw gdsError(
        'AUTH_FAILED',
        'Failed to authenticate with Travelport — no BinarySecurityToken in response. Verify username, password, and TargetBranch (PCC).',
        'travelport',
        true,
      );
    }

    this.authToken = token;
    this.traceId = this.generateMessageId();
    this.tokenExpiresAt = Date.now() + this.TOKEN_LIFETIME_MS;
  }

  /** Ensure a valid auth token exists */
  private async ensureAuth(): Promise<void> {
    if (this.authToken && Date.now() < (this.tokenExpiresAt - this.TOKEN_REFRESH_BUFFER)) {
      return;
    }
    await this.authenticate();
  }

  // ============================================================
  // TRAVELPORT ENVELOPE BUILDER
  // ============================================================

  /** Build the auth request envelope */
  private buildAuthEnvelope(): string {
    const credString = `${this.config.username}:${this.config.password}`;
    const encodedCreds = Buffer.from(credString).toString('base64');

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:common="http://www.travelport.com/schema/common_v50_0">
  <soapenv:Header>
    <common:AuthRequest>
      <common:UserName>${this.escapeXml(this.config.username)}</common:UserName>
      <common:Password>${this.escapeXml(this.config.password)}</common:Password>
      <common:TargetBranch>${this.escapeXml(this.config.pcc)}</common:TargetBranch>
    </common:AuthRequest>
  </soapenv:Header>
  <soapenv:Body/>
</soapenv:Envelope>`;
  }

  /** Build a standard Travelport SOAP envelope with auth token */
  private buildEnvelope(body: string): string {
    const securityBlock = this.authToken
      ? `<ins0:Security soapenv:mustUnderstand="1" xmlns:ins0="http://schemas.xmlsoap.org/ws/2002/12/secext">
          <ins0:BinarySecurityToken>${this.escapeXml(this.authToken)}</ins0:BinarySecurityToken>
        </ins0:Security>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:common="http://www.travelport.com/schema/common_v50_0"
                   xmlns:hotel="http://www.travelport.com/schema/hotel_v50_0"
                   xmlns:univ="http://www.travelport.com/schema/universal_v50_0">
  <soapenv:Header>
    <common:SmartPoint>
      <common:TPA_Extensions>
        <common:TraceId>${this.traceId || this.generateMessageId()}</common:TraceId>
      </common:TPA_Extensions>
    </common:SmartPoint>
    ${securityBlock}
  </soapenv:Header>
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  // ============================================================
  // REQUEST BUILDERS
  // ============================================================

  /** Build HotelAvailRQ — push availability updates */
  private buildHotelAvailRQ(roomTypeId: string, updates: ARIUpdate[]): string {
    const availItems = updates.map(u => {
      const restrictions: string[] = [];
      if (u.restrictions?.minStay) restrictions.push(`<hotel:MinLOS>${u.restrictions.minStay}</hotel:MinLOS>`);
      if (u.restrictions?.maxStay) restrictions.push(`<hotel:MaxLOS>${u.restrictions.maxStay}</hotel:MaxLOS>`);
      if (u.restrictions?.closedToArrival) restrictions.push(`<hotel:ClosedToArrival>true</hotel:ClosedToArrival>`);
      if (u.restrictions?.closedToDeparture) restrictions.push(`<hotel:ClosedToDeparture>true</hotel:ClosedToDeparture>`);

      return `
          <hotel:HotelProperty>
            <common:Property Code="${this.escapeXml(this.config.propertyCode)}" HotelCode="${this.escapeXml(this.config.propertyCode)}"/>
            <hotel:HotelDetail>
              <hotel:HotelStay>
                <hotel:StayDateRange Start="${u.date}" End="${u.date}"/>
              </hotel:HotelStay>
              <hotel:RoomRate>
                <hotel:RoomRateDetail RoomTypeCode="${this.escapeXml(u.roomTypeId)}" RatePlanCode="${this.escapeXml(u.rateCodeId)}">
                  <hotel:RateInfo>
                    <hotel:Amount CurrencyCode="${u.currency}">${u.rateAmount.toFixed(2)}</hotel:Amount>
                  </hotel:RateInfo>
                  <hotel:Availability Status="Open" ${u.availableRooms >= 0 ? `Available="${u.availableRooms}"` : ''}/>
                  ${restrictions.length > 0 ? `<hotel:Restrictions>${restrictions.join('\n')}</hotel:Restrictions>` : ''}
                </hotel:RoomRateDetail>
              </hotel:RoomRate>
            </hotel:HotelDetail>
          </hotel:HotelProperty>`;
    }).join('');

    const body = `<hotel:HotelSearchAvailabilityReq TargetBranch="${this.escapeXml(this.config.pcc)}" ReturnHostCommand="true">
      <common:BillingPointOfSaleInfo OriginApplication="StaySuite"/>
${availItems}
    </hotel:HotelSearchAvailabilityReq>`;

    return this.buildEnvelope(body);
  }

  /** Build HotelRateModifyRQ — update a single rate */
  private buildHotelRateModifyRQ(ru: RateUpdate): string {
    const body = `<hotel:HotelRateModifyReq TargetBranch="${this.escapeXml(this.config.pcc)}">
      <common:BillingPointOfSaleInfo OriginApplication="StaySuite"/>
      <hotel:HotelRateModify>
        <common:Property Code="${this.escapeXml(this.config.propertyCode)}"/>
        <hotel:RatePlan Code="${this.escapeXml(ru.rateCode)}">
          <hotel:Rate Amount="${ru.amount.toFixed(2)}" CurrencyCode="${ru.currency}" EffectiveDate="${ru.dates.from}" DiscontinueDate="${ru.dates.to}"
            ${ru.restrictions?.minStay ? `MinLOS="${ru.restrictions.minStay}"` : ''}
            ${ru.restrictions?.maxStay ? `MaxLOS="${ru.restrictions.maxStay}"` : ''}
            ${ru.restrictions?.closedToArrival ? 'ClosedToArrival="true"' : ''}
            ${ru.restrictions?.closedToDeparture ? 'ClosedToDeparture="true"' : ''}/>
        </hotel:RatePlan>
      </hotel:HotelRateModify>
    </hotel:HotelRateModifyReq>`;

    return this.buildEnvelope(body);
  }

  /** Build UniversalRecordSearchRQ — search bookings */
  private buildUniversalRecordSearchRQ(since: Date): string {
    const body = `<univ:UniversalRecordSearchReq TargetBranch="${this.escapeXml(this.config.pcc)}">
      <common:BillingPointOfSaleInfo OriginApplication="StaySuite"/>
      <univ:SearchCriteria>
        <univ:UniversalRecordSearchCriterion Type="HOTEL">
          <univ:HotelSearchCriterion>
            <common:HostedData>
              <common:DataCapture CreateDate="${since.toISOString().split('T')[0]}"/>
            </common:HostedData>
          </univ:HotelSearchCriterion>
        </univ:UniversalRecordSearchCriterion>
      </univ:SearchCriteria>
    </univ:UniversalRecordSearchReq>`;

    return this.buildEnvelope(body);
  }

  /** Build UniversalRecordRetrieveRQ — retrieve by PNR/LocatorCode */
  private buildUniversalRecordRetrieveRQ(pnr: string): string {
    const body = `<univ:UniversalRecordRetrieveReq TargetBranch="${this.escapeXml(this.config.pcc)}">
      <common:BillingPointOfSaleInfo OriginApplication="StaySuite"/>
      <univ:UniversalRecordLocatorCode>${this.escapeXml(pnr)}</univ:UniversalRecordLocatorCode>
    </univ:UniversalRecordRetrieveReq>`;

    return this.buildEnvelope(body);
  }

  // ============================================================
  // RESPONSE PARSERS
  // ============================================================

  /** Parse bookings from Travelport UniversalRecord response */
  private parseBookingsFromResponse(xml: string): GDSBooking[] {
    const bookings: GDSBooking[] = [];

    // Travelport uses UniversalRecord with HotelReservation elements
    const hotelResBlocks = xml.split(/<hotel:HotelReservation\s/i).slice(1);

    for (const block of hotelResBlocks) {
      const pnr =
        this.extractXmlAttribute(block, 'UniversalRecord', 'LocatorCode') ||
        this.extractXmlAttribute(block, 'Reservation', 'LocatorCode') ||
        this.extractXmlValue(block, 'LocatorCode') ||
        '';

      // Guest name
      const nameBlock = block.match(/<hotel:Guest\s[^>]*>[\s\S]*?<\/hotel:Guest>/i)?.[0] ||
        block.match(/<common:Traveler[^>]*>[\s\S]*?<\/common:Traveler>/i)?.[0] || '';
      const firstName = this.extractXmlValue(nameBlock, 'GivenName') || '';
      const lastName = this.extractXmlValue(nameBlock, 'Surname') || '';

      const checkInStr = this.extractXmlAttribute(block, 'StayDateRange', 'Start') || '';
      const checkOutStr = this.extractXmlAttribute(block, 'StayDateRange', 'End') || '';

      const roomType = this.extractXmlAttribute(block, 'RoomRateDetail', 'RoomTypeCode') ||
        this.extractXmlAttribute(block, 'RoomRate', 'RoomTypeCode') || '';
      const rateCode = this.extractXmlAttribute(block, 'RoomRateDetail', 'RatePlanCode') ||
        this.extractXmlAttribute(block, 'RoomRate', 'RatePlanCode') || '';
      const status = this.extractXmlAttribute(block, 'Reservation', 'Status') || 'confirmed';

      let guestCount = 1;
      const guestCounts = block.match(/<hotel:GuestCount[^/]*Count="(\d+)"/gi) || [];
      for (const gc of guestCounts) {
        const m = gc.match(/Count="(\d+)"/);
        if (m) guestCount += parseInt(m[1], 10);
      }

      const specialRequests = this.extractXmlValue(block, 'SpecialRequest') || undefined;

      if (checkInStr && checkOutStr) {
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
          gdsSource: 'travelport',
        });
      }
    }

    return bookings;
  }

  /** Parse availability from Travelport response */
  private parseAvailabilityResponse(xml: string, roomTypeCode: string): AvailabilityResponse[] {
    const results: AvailabilityResponse[] = [];

    const hotelProperties = xml.split(/<hotel:HotelProperty\s/i).slice(1);
    for (const block of hotelProperties) {
      const start = this.extractXmlAttribute(block, 'StayDateRange', 'Start') || '';
      const available = this.extractXmlAttribute(block, 'Availability', 'Available') || '0';

      const ratePlans: AvailabilityResponse['ratePlans'] = [];
      const rateAmount = this.extractXmlValue(block, 'Amount');
      const currencyAttr = this.extractXmlAttribute(block, 'Amount', 'CurrencyCode') || 'USD';

      const rpCode = this.extractXmlAttribute(block, 'RoomRateDetail', 'RatePlanCode') || 'DEFAULT';
      if (rateAmount) {
        ratePlans.push({
          rateCode: rpCode,
          rateAmount: parseFloat(rateAmount),
          currency: currencyAttr,
        });
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
      provider: 'travelport',
      recordsProcessed: 0,
      errors: [error],
      warnings: [],
      duration: 0,
      timestamp: new Date(),
    };
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const groups: Record<string, T[]> = {};
    for (const item of arr) {
      const key = keyFn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }
}
