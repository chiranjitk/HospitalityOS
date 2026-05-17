/**
 * Google Ads API Client
 *
 * Full Google Ads integration following the Stripe gateway pattern.
 * Handles OAuth token management, campaign CRUD, performance data retrieval,
 * ad group/keyword management, with proper error handling and rate limiting.
 *
 * Google Ads API Docs: https://developers.google.com/google-ads/api/docs/start
 */

import { encrypt, decrypt } from '@/lib/encryption';

// ─── Configuration Types ─────────────────────────────────────────────────────

export interface GoogleAdsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  accountId: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface GoogleAdsError {
  code: string;
  message: string;
  status: number;
}

interface GoogleAdsResponse<T> {
  success: boolean;
  data?: T;
  error?: GoogleAdsError;
}

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface GoogleCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  budgetMicros: number;
  biddingStrategyType: string;
  advertisingChannelType: string;
  startDate: string;
  endDate?: string;
}

export interface GoogleAdGroup {
  id: string;
  name: string;
  campaignId: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  type: string;
  cpcBidMicros?: number;
}

export interface GoogleKeyword {
  id: string;
  text: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  adGroupId: string;
}

export interface GooglePerformanceMetrics {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  costMicros: number;
  conversionValueMicros: number;
  ctr: number;
  cpcMicros: number;
  conversionsValuePerCost: number; // ROAS
  averagePosition: number;
}

export interface GoogleCampaignCreateParams {
  name: string;
  budgetMicros: number;
  biddingStrategyType?: string;
  startDate?: string;
  endDate?: string;
  advertisingChannelType?: string;
}

export interface GoogleAdGroupCreateParams {
  name: string;
  campaignId: string;
  type?: string;
  cpcBidMicros?: number;
}

export interface GoogleKeywordCreateParams {
  text: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  adGroupId: string;
}

// ─── Rate Limiter ────────────────────────────────────────────────────────────

class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;
  private readonly minIntervalMs: number;
  private lastRequestTime = 0;

  constructor(maxConcurrent = 5, minIntervalMs = 100) {
    this.maxConcurrent = maxConcurrent;
    this.minIntervalMs = minIntervalMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          const now = Date.now();
          const elapsed = now - this.lastRequestTime;
          if (elapsed < this.minIntervalMs) {
            await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
          }
          this.lastRequestTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeCount--;
          this.processQueue();
        }
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  private processQueue() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.activeCount++;
        task();
      }
    }
  }
}

// ─── Google Ads Client ───────────────────────────────────────────────────────

export class GoogleAdsClient {
  readonly name = 'Google Ads';
  private config: GoogleAdsConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private rateLimiter: RateLimiter;
  private readonly baseUrl = 'https://googleads.googleapis.com/v17';
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private readonly apiVersion = 'v17';

  constructor(config: GoogleAdsConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter();
  }

  // ─── OAuth Token Management ─────────────────────────────────────────────

  /**
   * Refresh the OAuth access token using the stored refresh token.
   * Implements proper token caching with automatic refresh before expiry.
   */
  async refreshAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          `Token refresh failed: ${err.error_description || err.error || 'Unknown error'}`
        );
      }

      const data: TokenResponse = (await response.json()) as TokenResponse;
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('[GoogleAds] Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Validate the current configuration by attempting a token refresh.
   */
  async validateConnection(): Promise<GoogleAdsResponse<{ customerId: string; accountId: string }>> {
    try {
      const token = await this.refreshAccessToken();
      return {
        success: !!token,
        data: { customerId: this.config.customerId, accountId: this.config.accountId },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: error instanceof Error ? error.message : 'Authentication failed',
          status: 401,
        },
      };
    }
  }

  // ─── Campaign CRUD ──────────────────────────────────────────────────────

  /**
   * List all campaigns for the configured customer.
   */
  async listCampaigns(status?: string): Promise<GoogleAdsResponse<GoogleCampaign[]>> {
    try {
      const query = this.buildCampaignQuery(status);
      const result = await this.executeGaqlQuery<{ campaign: GoogleCampaign }>(query);

      const campaigns = result.map((r) => r.campaign);
      return { success: true, data: campaigns };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Create a new campaign in Google Ads.
   */
  async createCampaign(params: GoogleCampaignCreateParams): Promise<GoogleAdsResponse<GoogleCampaign>> {
    try {
      const mutation = this.buildCampaignMutation(params);
      const result = await this.executeMutation('createCampaign', mutation);
      return { success: true, data: result as GoogleCampaign };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update an existing campaign status (pause/resume).
   */
  async updateCampaignStatus(campaignResourceName: string, status: 'ENABLED' | 'PAUSED'): Promise<GoogleAdsResponse<void>> {
    try {
      const mutation = {
        update: {
          resource_name: campaignResourceName,
          status,
        },
        update_mask: 'status',
      };

      const result = await this.executeMutation('updateCampaigns', [mutation]);
      return { success: true };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Pause a campaign.
   */
  async pauseCampaign(campaignResourceName: string): Promise<GoogleAdsResponse<void>> {
    return this.updateCampaignStatus(campaignResourceName, 'PAUSED');
  }

  /**
   * Resume a paused campaign.
   */
  async resumeCampaign(campaignResourceName: string): Promise<GoogleAdsResponse<void>> {
    return this.updateCampaignStatus(campaignResourceName, 'ENABLED');
  }

  /**
   * Remove (archive) a campaign.
   */
  async removeCampaign(campaignResourceName: string): Promise<GoogleAdsResponse<void>> {
    try {
      const result = await this.executeMutation('removeCampaigns', [campaignResourceName]);
      return { success: true };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Ad Group Management ────────────────────────────────────────────────

  /**
   * List ad groups for a campaign.
   */
  async listAdGroups(campaignResourceName: string): Promise<GoogleAdsResponse<GoogleAdGroup[]>> {
    try {
      const query = `
        SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros
        FROM ad_group
        WHERE campaign = '${campaignResourceName}'
      `;
      const result = await this.executeGaqlQuery<{ ad_group: GoogleAdGroup }>(query);
      return { success: true, data: result.map((r) => r.ad_group) };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Create an ad group within a campaign.
   */
  async createAdGroup(params: GoogleAdGroupCreateParams): Promise<GoogleAdsResponse<GoogleAdGroup>> {
    try {
      const mutation = this.buildAdGroupMutation(params);
      const result = await this.executeMutation('createAdGroup', mutation);
      return { success: true, data: result as GoogleAdGroup };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Keyword Management ─────────────────────────────────────────────────

  /**
   * List keywords for an ad group.
   */
  async listKeywords(adGroupResourceName: string): Promise<GoogleAdsResponse<GoogleKeyword[]>> {
    try {
      const query = `
        SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
               ad_group_criterion.keyword.match_type, ad_group_criterion.status
        FROM ad_group_criterion
        WHERE ad_group = '${adGroupResourceName}'
          AND ad_group_criterion.type = 'KEYWORD'
      `;
      const result = await this.executeGaqlQuery<{ ad_group_criterion: GoogleKeyword & { criterion_id: string } }>(query);
      return {
        success: true,
        data: result.map((r) => ({ ...r.ad_group_criterion, id: r.ad_group_criterion.criterion_id })),
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Add a keyword to an ad group.
   */
  async createKeyword(params: GoogleKeywordCreateParams): Promise<GoogleAdsResponse<GoogleKeyword>> {
    try {
      const mutation = this.buildKeywordMutation(params);
      const result = await this.executeMutation('createAdGroupCriterion', mutation);
      return { success: true, data: result as GoogleKeyword };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Remove a keyword.
   */
  async removeKeyword(criterionResourceName: string): Promise<GoogleAdsResponse<void>> {
    try {
      await this.executeMutation('removeAdGroupCriteria', [criterionResourceName]);
      return { success: true };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Performance Data ───────────────────────────────────────────────────

  /**
   * Pull performance metrics for a date range.
   */
  async getPerformanceMetrics(
    startDate: string,
    endDate: string,
    campaignResourceName?: string
  ): Promise<GoogleAdsResponse<GooglePerformanceMetrics[]>> {
    try {
      const campaignFilter = campaignResourceName
        ? `AND campaign = '${campaignResourceName}'`
        : '';

      const query = `
        SELECT
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.cost_micros,
          metrics.conversions_value,
          metrics.ctr,
          metrics.average_cpc,
          metrics.average_position
        FROM campaign
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ${campaignFilter}
        ORDER BY segments.date ASC
      `;

      const result = await this.executeGaqlQuery<{
        segments: { date: string };
        metrics: {
          impressions: number;
          clicks: number;
          conversions: number;
          cost_micros: number;
          conversions_value: number;
          ctr: number;
          average_cpc: number;
          average_position: number;
        };
      }>(query);

      const metrics: GooglePerformanceMetrics[] = result.map((r) => ({
        date: r.segments.date,
        impressions: Number(r.metrics.impressions) || 0,
        clicks: Number(r.metrics.clicks) || 0,
        conversions: Number(r.metrics.conversions) || 0,
        costMicros: Number(r.metrics.cost_micros) || 0,
        conversionValueMicros: Number(r.metrics.conversions_value) || 0,
        ctr: Number(r.metrics.ctr) || 0,
        cpcMicros: Number(r.metrics.average_cpc) || 0,
        conversionsValuePerCost:
          Number(r.metrics.cost_micros) > 0
            ? Number(r.metrics.conversions_value) / Number(r.metrics.cost_micros)
            : 0,
        averagePosition: Number(r.metrics.average_position) || 0,
      }));

      return { success: true, data: metrics };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Health Check ───────────────────────────────────────────────────────

  /**
   * Check if the Google Ads API connection is healthy.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.validateConnection();
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Get current configuration (with secrets redacted).
   */
  getConfig(): Omit<GoogleAdsConfig, 'clientSecret' | 'refreshToken'> & {
    hasClientSecret: boolean;
    hasRefreshToken: boolean;
  } {
    return {
      developerToken: this.config.developerToken ? '***configured***' : '',
      clientId: this.config.clientId,
      customerId: this.config.customerId,
      accountId: this.config.accountId,
      hasClientSecret: !!this.config.clientSecret,
      hasRefreshToken: !!this.config.refreshToken,
    };
  }

  // ─── Private Methods ────────────────────────────────────────────────────

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.refreshAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'developer-token': this.config.developerToken,
      'Content-Type': 'application/json',
    };
  }

  private async executeGaqlQuery<T>(query: string): Promise<T[]> {
    return this.rateLimiter.execute(async () => {
      const headers = await this.getAuthHeaders();
      const url = `${this.baseUrl}/customers/${this.config.customerId}/googleAds:search`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          `GAQL query failed (${response.status}): ${err.error?.message || JSON.stringify(err)}`
        );
      }

      const data = await response.json();
      return (data.results || []) as T[];
    });
  }

  private async executeMutation<T>(operation: string, params: unknown): Promise<T> {
    return this.rateLimiter.execute(async () => {
      const headers = await this.getAuthHeaders();
      const url = `${this.baseUrl}/customers/${this.config.customerId}/googleAds:mutate`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mutateOperations: [
            {
              operation,
              ...params,
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(
          `Mutation failed (${response.status}): ${err.error?.message || JSON.stringify(err)}`
        );
      }

      const data = await response.json();
      return data as T;
    });
  }

  private buildCampaignQuery(status?: string): string {
    const statusFilter = status ? `AND campaign.status = '${status.toUpperCase()}'` : '';
    return `
      SELECT
        campaign.id, campaign.name, campaign.status,
        campaign.budget_amount_micros, campaign.bidding_strategy_type,
        campaign.advertising_channel_type, campaign.start_date, campaign.end_date
      FROM campaign
      WHERE campaign.status != 'REMOVED'
        ${statusFilter}
      ORDER BY campaign.name
    `;
  }

  private buildCampaignMutation(params: GoogleCampaignCreateParams) {
    return {
      create: {
        name: params.name,
        status: 'PAUSED',
        advertising_channel_type: params.advertisingChannelType || 'SEARCH',
        budget: {
          type: 'STANDARD',
          amount_micros: params.budgetMicros,
        },
        bidding_strategy_type: params.biddingStrategyType || 'MAXIMIZE_CLICKS',
        start_date: params.startDate || new Date().toISOString().split('T')[0].replace(/-/g, ''),
        end_date: params.endDate || undefined,
      },
    };
  }

  private buildAdGroupMutation(params: GoogleAdGroupCreateParams) {
    return {
      create: {
        name: params.name,
        status: 'ENABLED',
        campaign: params.campaignId,
        type: params.type || 'SEARCH_STANDARD',
        cpc_bid_micros: params.cpcBidMicros || 1000000, // $1.00
      },
    };
  }

  private buildKeywordMutation(params: GoogleKeywordCreateParams) {
    return {
      create: {
        ad_group: params.adGroupId,
        status: 'ENABLED',
        keyword: {
          text: params.text,
          match_type: params.matchType,
        },
      },
    };
  }

  private handleError(error: unknown): GoogleAdsResponse<never> {
    console.error('[GoogleAds] Error:', error);
    return {
      success: false,
      error: {
        code: 'API_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 500,
      },
    };
  }
}

// ─── Factory + Credential Encryption ─────────────────────────────────────────

/**
 * Encrypt Google Ads credentials for storage.
 */
export function encryptGoogleAdsCredentials(config: GoogleAdsConfig): {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  accountId: string;
} {
  return {
    developerToken: encrypt(config.developerToken),
    clientId: config.clientId, // non-sensitive, stored plain
    clientSecret: encrypt(config.clientSecret),
    refreshToken: encrypt(config.refreshToken),
    customerId: config.customerId, // non-sensitive, stored plain
    accountId: config.accountId, // non-sensitive, stored plain
  };
}

/**
 * Decrypt Google Ads credentials from storage.
 */
export function decryptGoogleAdsCredentials(encrypted: {
  developerToken?: string | null;
  clientSecret?: string | null;
  refreshToken?: string | null;
  clientId?: string | null;
  customerId?: string | null;
  accountId?: string | null;
}): GoogleAdsConfig | null {
  const developerToken = decrypt(encrypted.developerToken || '');
  const clientSecret = decrypt(encrypted.clientSecret || '');
  const refreshToken = decrypt(encrypted.refreshToken || '');

  if (!developerToken || !clientSecret || !refreshToken) {
    return null;
  }

  return {
    developerToken,
    clientId: encrypted.clientId || '',
    clientSecret,
    refreshToken,
    customerId: encrypted.customerId || '',
    accountId: encrypted.accountId || '',
  };
}

/**
 * Create a configured Google Ads client instance from encrypted credentials.
 */
export function createGoogleAdsClient(encryptedCredentials: Record<string, string | null>): GoogleAdsClient | null {
  const config = decryptGoogleAdsCredentials(encryptedCredentials);
  if (!config) return null;
  return new GoogleAdsClient(config);
}
