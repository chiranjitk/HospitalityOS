/**
 * Expedia API Client
 * Uses REST API with OAuth2 authentication
 */

import { BaseOTAClient } from '../base-client';
import type { OTACredentials, OTAConfig } from '../types';

export class ExpediaClient extends BaseOTAClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  async connect(credentials: OTACredentials) {
    this.setCredentials(credentials);
    
    try {
      const tokenResponse = await this.fetchWithRetry<any>(
        `${this.baseUrl}/v1/auth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            username: credentials.username || '',
            password: credentials.password || '',
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
        message: 'Failed to authenticate with Expedia',
        errors: [this.createOTAError('AUTH_FAILED', 'Invalid credentials')],
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errors: [this.createOTAError('CONNECTION_ERROR', 'Unable to connect to Expedia')],
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
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}`,
        {
          method: 'GET',
          headers: this.getCommonHeaders(),
        }
      );

      return {
        success: true,
        message: 'Successfully connected to Expedia',
        propertyInfo: {
          id: response.hotelId,
          name: response.name,
          roomCount: response.roomCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getInventory(startDate: Date, endDate: Date, roomTypeIds?: string[]): Promise<any[]> {
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/inventory?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}` +
      (roomTypeIds ? `&roomTypeIds=${roomTypeIds.join(',')}` : ''),
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.inventory || [];
  }

  async updateInventory(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/inventory`,
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
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/rates?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.rates || [];
  }

  async updateRates(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/rates`,
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
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/restrictions?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.restrictions || [];
  }

  async updateRestrictions(updates: any[]): Promise<any> {
    const correlationId = this.generateCorrelationId();
    
    try {
      await this.fetchWithRetry(
        `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/restrictions`,
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
    const response = await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/hotels/${this.credentials?.hotelId}/bookings?` +
      `startDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}` +
      (status ? `&status=${status.join(',')}` : ''),
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
    return response.bookings || [];
  }

  async getBooking(externalId: string): Promise<any> {
    return await this.fetchWithRetry<any>(
      `${this.baseUrl}/v1/bookings/${externalId}`,
      {
        method: 'GET',
        headers: this.getCommonHeaders(),
      }
    );
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
    return {
      success: true,
      eventType: headers['X-Expedia-Event'] || 'unknown',
      data: payload,
      response: { statusCode: 200, body: 'OK' },
    };
  }

  getWebhookUrl(): string {
    return `/api/ota/webhooks/expedia`;
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
      return { 'Authorization': `Bearer ${this.accessToken}` };
    }
    return super.getAuthHeaders();
  }
}
