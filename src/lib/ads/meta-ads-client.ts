/**
 * Meta Ads API Client
 *
 * Full Meta (Facebook/Instagram) Marketing API integration following
 * the same gateway pattern as Stripe and Google Ads.
 * Handles OAuth token management, campaign CRUD via Marketing API,
 * audience/ad set management, performance data, and Pixel tracking.
 *
 * Meta Marketing API Docs: https://developers.facebook.com/docs/marketing-api
 */

import { encrypt, decrypt } from '@/lib/encryption';

// ─── Configuration Types ─────────────────────────────────────────────────────

export interface MetaAdsConfig {
  appId: string;
  appSecret: string;
  accessToken: string;
  accountId: string;
  pixelId?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MetaError {
  code: number;
  message: string;
  type: string;
  error_subcode?: number;
}

interface MetaResponse<T> {
  success: boolean;
  data?: T;
  error?: MetaError;
  paging?: { cursors: { before: string; after: string }; next?: string };
}

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  budget: number | null;
  dailyBudget: number | null;
  bidStrategy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaignId: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
  budget: number | null;
  dailyBudget: number | null;
  targeting: MetaTargeting;
  optimizationGoal: string;
  billingEvent: string;
}

export interface MetaTargeting {
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  geoLocations?: { countries?: string[]; regions?: Array<{ key: string }>; cities?: Array<{ key: string }> };
  interests?: Array<{ id: string; name: string }>;
  behaviors?: Array<{ id: string; name: string }>;
  devicePlatforms?: string[];
}

export interface MetaAd {
  id: string;
  name: string;
  adSetId: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
  creative: MetaCreative;
}

export interface MetaCreative {
  id: string;
  name: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  linkUrl?: string;
  callToActionType?: string;
}

export interface MetaAudience {
  id: string;
  name: string;
  description?: string;
  size?: number;
  approximateCountUpperBound?: number;
  approximateCountLowerBound?: number;
  targeting?: MetaTargeting;
}

export interface MetaPerformanceMetrics {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  spend: number;
  conversions: number;
  conversionValue: number;
  reach: number;
  frequency: number;
  costPerConversion: number;
  roas: number;
}

export interface MetaCampaignCreateParams {
  name: string;
  objective: string;
  budget?: number;
  dailyBudget?: number;
  bidStrategy?: string;
  status?: 'ACTIVE' | 'PAUSED';
}

export interface MetaAdSetCreateParams {
  name: string;
  campaignId: string;
  budget?: number;
  dailyBudget?: number;
  targeting?: MetaTargeting;
  optimizationGoal?: string;
  billingEvent?: string;
  status?: 'ACTIVE' | 'PAUSED';
}

export interface MetaPixelEvent {
  eventName: string;
  eventTime: number;
  userData: Record<string, string>;
  customData: Record<string, string | number>;
  actionSource: string;
  eventSourceUrl?: string;
}

// ─── Rate Limiter ────────────────────────────────────────────────────────────

class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;
  private readonly minIntervalMs: number;
  private lastRequestTime = 0;

  constructor(maxConcurrent = 10, minIntervalMs = 50) {
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

// ─── Meta Ads Client ─────────────────────────────────────────────────────────

export class MetaAdsClient {
  readonly name = 'Meta Ads';
  private config: MetaAdsConfig;
  private longLivedToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private rateLimiter: RateLimiter;
  private readonly graphUrl = 'https://graph.facebook.com/v19.0';

  constructor(config: MetaAdsConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter();
  }

  // ─── OAuth Token Management ─────────────────────────────────────────────

  /**
   * Exchange a short-lived access token for a long-lived one.
   */
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaResponse<TokenResponse>> {
    try {
      const url = `${this.graphUrl}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: this.config.appId,
          client_secret: this.config.appSecret,
          fb_exchange_token: shortLivedToken,
        });

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      const tokenData = data as TokenResponse;
      this.longLivedToken = tokenData.access_token;
      this.tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;

      return { success: true, data: tokenData };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Validate the current configuration by querying the ad account.
   */
  async validateConnection(): Promise<MetaResponse<{ accountId: string; accountName: string }>> {
    try {
      const url = `${this.graphUrl}/${this.config.accountId}?fields=name,account_id&access_token=${this.config.accessToken}`;
      const result = await this.rateLimiter.execute(async () => {
        const response = await fetch(url);
        return response.json();
      });

      if (result.error) {
        return {
          success: false,
          error: { code: result.error.code, message: result.error.message, type: result.error.type },
        };
      }

      return {
        success: true,
        data: {
          accountId: result.account_id || this.config.accountId,
          accountName: result.name || 'Unknown',
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Campaign CRUD ──────────────────────────────────────────────────────

  /**
   * List all campaigns for the ad account.
   */
  async listCampaigns(fields?: string[], status?: string): Promise<MetaResponse<MetaCampaign[]>> {
    try {
      const defaultFields = 'id,name,status,objective,daily_budget,lifetime_budget,bid_strategy,created_time,updated_time';
      const url = `${this.graphUrl}/act_${this.config.accountId}/campaigns?` +
        new URLSearchParams({
          fields: fields?.join(',') || defaultFields,
          access_token: this.config.accessToken,
          limit: '100',
          ...(status ? { effective_status: [status] } as Record<string, unknown> : {}),
        });

      const data = await this.rateLimiter.execute(async () => {
        const response = await fetch(url);
        return response.json();
      });

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      const campaigns: MetaCampaign[] = (data.data || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        status: (c.status as string) || 'PAUSED',
        objective: (c.objective as string) || '',
        budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
        dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        bidStrategy: (c.bid_strategy as string) || 'LOWEST_COST_WITHOUT_CAP',
        createdAt: (c.created_time as string) || '',
        updatedAt: (c.updated_time as string) || '',
      }));

      return { success: true, data: campaigns };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Create a new campaign in Meta Ads.
   */
  async createCampaign(params: MetaCampaignCreateParams): Promise<MetaResponse<MetaCampaign>> {
    try {
      const payload: Record<string, string> = {
        name: params.name,
        objective: params.objective,
        access_token: this.config.accessToken,
        status: params.status || 'PAUSED',
      };

      if (params.dailyBudget) {
        payload.daily_budget = String(Math.round(params.dailyBudget * 100));
      } else if (params.budget) {
        payload.lifetime_budget = String(Math.round(params.budget * 100));
      }

      if (params.bidStrategy) {
        payload.bid_strategy = params.bidStrategy;
      }

      const url = `${this.graphUrl}/act_${this.config.accountId}/campaigns`;
      const data = await this.rateLimiter.execute(async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(payload),
        });
        return response.json();
      });

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      const campaign: MetaCampaign = {
        id: data.id,
        name: params.name,
        status: params.status || 'PAUSED',
        objective: params.objective,
        budget: params.budget || null,
        dailyBudget: params.dailyBudget || null,
        bidStrategy: params.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return { success: true, data: campaign };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update a campaign (change status, budget, etc.).
   */
  async updateCampaign(campaignId: string, updates: Partial<Pick<MetaCampaign, 'name' | 'status' | 'dailyBudget' | 'budget'>>): Promise<MetaResponse<{ success: boolean }>> {
    try {
      const payload: Record<string, string> = {
        access_token: this.config.accessToken,
      };

      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.dailyBudget !== undefined) payload.daily_budget = String(Math.round(updates.dailyBudget * 100));
      if (updates.budget !== undefined) payload.lifetime_budget = String(Math.round(updates.budget * 100));

      const url = `${this.graphUrl}/${campaignId}`;
      const data = await this.rateLimiter.execute(async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(payload),
        });
        return response.json();
      });

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      return { success: true, data: { success: data.success === true } };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Pause a campaign.
   */
  async pauseCampaign(campaignId: string): Promise<MetaResponse<{ success: boolean }>> {
    return this.updateCampaign(campaignId, { status: 'PAUSED' });
  }

  /**
   * Resume a paused campaign.
   */
  async resumeCampaign(campaignId: string): Promise<MetaResponse<{ success: boolean }>> {
    return this.updateCampaign(campaignId, { status: 'ACTIVE' });
  }

  // ─── Ad Set Management ─────────────────────────────────────────────────

  /**
   * List ad sets for a campaign.
   */
  async listAdSets(campaignId: string): Promise<MetaResponse<MetaAdSet[]>> {
    try {
      const fields = 'id,name,campaign_id,status,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event';
      const url = `${this.graphUrl}/${campaignId}/adsets?` +
        new URLSearchParams({
          fields,
          access_token: this.config.accessToken,
          limit: '100',
        });

      const data = await this.rateLimiter.execute(async () => {
        const response = await fetch(url);
        return response.json();
      });

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      const adSets: MetaAdSet[] = (data.data || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        name: a.name as string,
        campaignId: (a.campaign_id as string) || campaignId,
        status: (a.status as string) || 'PAUSED',
        budget: a.lifetime_budget ? Number(a.lifetime_budget) / 100 : null,
        dailyBudget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
        targeting: (a.targeting as MetaTargeting) || {},
        optimizationGoal: (a.optimization_goal as string) || 'OFFSITE_CONVERSIONS',
        billingEvent: (a.billing_event as string) || 'IMPRESSIONS',
      }));

      return { success: true, data: adSets };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Create an ad set within a campaign.
   */
  async createAdSet(params: MetaAdSetCreateParams): Promise<MetaResponse<MetaAdSet>> {
    try {
      const payload: Record<string, string | Record<string, unknown>> = {
        name: params.name,
        campaign_id: params.campaignId,
        access_token: this.config.accessToken,
        status: params.status || 'PAUSED',
        optimization_goal: params.optimizationGoal || 'OFFSITE_CONVERSIONS',
        billing_event: params.billingEvent || 'IMPRESSIONS',
        targeting: JSON.stringify(params.targeting || {}),
      };

      if (params.dailyBudget) {
        payload.daily_budget = String(Math.round(params.dailyBudget * 100));
      } else if (params.budget) {
        payload.lifetime_budget = String(Math.round(params.budget * 100));
      }

      const url = `${this.graphUrl}/act_${this.config.accountId}/adsets`;
      const data = await this.rateLimiter.execute(async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(payload as Record<string, string>),
        });
        return response.json();
      });

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      const adSet: MetaAdSet = {
        id: data.id,
        name: params.name,
        campaignId: params.campaignId,
        status: params.status || 'PAUSED',
        budget: params.budget || null,
        dailyBudget: params.dailyBudget || null,
        targeting: params.targeting || {},
        optimizationGoal: params.optimizationGoal || 'OFFSITE_CONVERSIONS',
        billingEvent: params.billingEvent || 'IMPRESSIONS',
      };

      return { success: true, data: adSet };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Audience Management ────────────────────────────────────────────────

  /**
   * List saved audiences for the ad account.
   */
  async listAudiences(): Promise<MetaResponse<MetaAudience[]>> {
    try {
      const fields = 'id,name,description,approximate_count_lower_bound,approximate_count_upper_bound,targeting';
      const url = `${this.graphUrl}/act_${this.config.accountId}/customaudiences?` +
        new URLSearchParams({
          fields,
          access_token: this.config.accessToken,
          limit: '100',
        });

      const data = await this.rateLimiter.execute(async () => {
        const response = await fetch(url);
        return response.json();
      });

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      const audiences: MetaAudience[] = (data.data || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        name: a.name as string,
        description: (a.description as string) || undefined,
        size: (a.approximate_count_lower_bound as number) || 0,
        approximateCountUpperBound: (a.approximate_count_upper_bound as number) || 0,
        approximateCountLowerBound: (a.approximate_count_lower_bound as number) || 0,
        targeting: (a.targeting as MetaTargeting) || undefined,
      }));

      return { success: true, data: audiences };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Performance Data ───────────────────────────────────────────────────

  /**
   * Pull performance metrics for a campaign over a date range.
   */
  async getCampaignPerformance(
    campaignId: string,
    startDate: string,
    endDate: string,
  ): Promise<MetaResponse<MetaPerformanceMetrics[]>> {
    try {
      const fields = 'date_start,date_stop,impressions,clicks,ctr,cpc,cpm,spend,actions,reach,frequency,adset_name,campaign_name';
      const url = `${this.graphUrl}/${campaignId}/insights?` +
        new URLSearchParams({
          fields,
          time_range: JSON.stringify({ since: startDate, until: endDate }),
          time_increment: '1',
          access_token: this.config.accessToken,
          limit: '100',
          default_summary: 'false',
        });

      const data = await this.rateLimiter.execute(async () => {
        const response = await fetch(url);
        return response.json();
      });

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      const metrics: MetaPerformanceMetrics[] = (data.data || []).map((r: Record<string, unknown>) => {
        const actions = (r.actions as Array<{ action_type: string; value: number }>) || [];
        const conversionsAction = actions.find((a) => a.action_type === 'offsite_conversion' || a.action_type === 'purchase');
        const conversionValueAction = actions.find((a) => a.action_type === 'offsite_conversion_value' || a.action_type === 'purchase_value');
        const spend = Number(r.spend) || 0;

        return {
          date: (r.date_start as string) || '',
          impressions: Number(r.impressions) || 0,
          clicks: Number(r.clicks) || 0,
          ctr: Number(r.ctr) || 0,
          cpc: Number(r.cpc) || 0,
          cpm: Number(r.cpm) || 0,
          spend,
          conversions: conversionsAction?.value || 0,
          conversionValue: conversionValueAction?.value || 0,
          reach: Number(r.reach) || 0,
          frequency: Number(r.frequency) || 0,
          costPerConversion: conversionsAction?.value ? spend / conversionsAction.value : 0,
          roas: spend > 0 && conversionValueAction ? (conversionValueAction.value || 0) / spend : 0,
        };
      });

      return { success: true, data: metrics };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Pull account-level performance metrics.
   */
  async getAccountPerformance(
    startDate: string,
    endDate: string,
  ): Promise<MetaResponse<MetaPerformanceMetrics[]>> {
    try {
      const fields = 'date_start,date_stop,impressions,clicks,ctr,cpc,cpm,spend,actions,reach,frequency';
      const url = `${this.graphUrl}/act_${this.config.accountId}/insights?` +
        new URLSearchParams({
          fields,
          time_range: JSON.stringify({ since: startDate, until: endDate }),
          time_increment: '1',
          access_token: this.config.accessToken,
          limit: '100',
          default_summary: 'false',
        });

      const data = await this.rateLimiter.execute(async () => {
        const response = await fetch(url);
        return response.json();
      });

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      const metrics: MetaPerformanceMetrics[] = (data.data || []).map((r: Record<string, unknown>) => {
        const actions = (r.actions as Array<{ action_type: string; value: number }>) || [];
        const conversionsAction = actions.find((a) => a.action_type === 'offsite_conversion' || a.action_type === 'purchase');
        const conversionValueAction = actions.find((a) => a.action_type === 'offsite_conversion_value');
        const spend = Number(r.spend) || 0;

        return {
          date: (r.date_start as string) || '',
          impressions: Number(r.impressions) || 0,
          clicks: Number(r.clicks) || 0,
          ctr: Number(r.ctr) || 0,
          cpc: Number(r.cpc) || 0,
          cpm: Number(r.cpm) || 0,
          spend,
          conversions: conversionsAction?.value || 0,
          conversionValue: conversionValueAction?.value || 0,
          reach: Number(r.reach) || 0,
          frequency: Number(r.frequency) || 0,
          costPerConversion: conversionsAction?.value ? spend / conversionsAction.value : 0,
          roas: spend > 0 && conversionValueAction ? (conversionValueAction.value || 0) / spend : 0,
        };
      });

      return { success: true, data: metrics };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Pixel / Conversion Tracking ────────────────────────────────────────

  /**
   * Send a server-side conversion event to the Meta Pixel.
   */
  async trackPixelEvent(event: MetaPixelEvent): Promise<MetaResponse<{ eventId: string }>> {
    if (!this.config.pixelId) {
      return { success: false, error: { code: 400, message: 'Pixel ID not configured', type: 'ConfigurationError' } };
    }

    try {
      const url = `${this.graphUrl}/${this.config.pixelId}/events`;
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const body = {
        data: [{
          event_name: event.eventName,
          event_time: event.eventTime,
          event_id: eventId,
          event_source_url: event.eventSourceUrl || '',
          action_source: event.actionSource,
          user_data: event.userData,
          custom_data: event.customData,
        }],
        access_token: this.config.accessToken,
      };

      const data = await this.rateLimiter.execute(async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return response.json();
      });

      if (data.error) {
        return {
          success: false,
          error: { code: data.error.code, message: data.error.message, type: data.error.type },
        };
      }

      return { success: true, data: { eventId } };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Health Check ───────────────────────────────────────────────────────

  /**
   * Check if the Meta Ads API connection is healthy.
   */
  async isHealthy(): Promise<boolean> {
    const result = await this.validateConnection();
    return result.success;
  }

  /**
   * Get current configuration (with secrets redacted).
   */
  getConfig(): Omit<MetaAdsConfig, 'appSecret' | 'accessToken'> & {
    hasAppSecret: boolean;
    hasAccessToken: boolean;
  } {
    return {
      appId: this.config.appId,
      accountId: this.config.accountId,
      pixelId: this.config.pixelId || null,
      hasAppSecret: !!this.config.appSecret,
      hasAccessToken: !!this.config.accessToken,
    };
  }

  // ─── Private Methods ────────────────────────────────────────────────────

  private handleError(error: unknown): MetaResponse<never> {
    console.error('[MetaAds] Error:', error);
    return {
      success: false,
      error: {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        type: 'ClientError',
      },
    };
  }
}

// ─── Factory + Credential Encryption ─────────────────────────────────────────

/**
 * Encrypt Meta Ads credentials for storage.
 */
export function encryptMetaAdsCredentials(config: MetaAdsConfig): {
  appId: string;
  appSecret: string;
  accessToken: string;
  accountId: string;
  pixelId: string | null;
} {
  return {
    appId: config.appId, // non-sensitive, stored plain
    appSecret: encrypt(config.appSecret),
    accessToken: encrypt(config.accessToken),
    accountId: config.accountId, // non-sensitive, stored plain
    pixelId: config.pixelId || null,
  };
}

/**
 * Decrypt Meta Ads credentials from storage.
 */
export function decryptMetaAdsCredentials(encrypted: {
  appSecret?: string | null;
  accessToken?: string | null;
  appId?: string | null;
  accountId?: string | null;
  pixelId?: string | null;
}): MetaAdsConfig | null {
  const appSecret = decrypt(encrypted.appSecret || '');
  const accessToken = decrypt(encrypted.accessToken || '');

  if (!appSecret || !accessToken) {
    return null;
  }

  return {
    appId: encrypted.appId || '',
    appSecret,
    accessToken,
    accountId: encrypted.accountId || '',
    pixelId: encrypted.pixelId || undefined,
  };
}

/**
 * Create a configured Meta Ads client instance from encrypted credentials.
 */
export function createMetaAdsClient(encryptedCredentials: Record<string, string | null>): MetaAdsClient | null {
  const config = decryptMetaAdsCredentials(encryptedCredentials);
  if (!config) return null;
  return new MetaAdsClient(config);
}
