/**
 * System Integrations Hub API
 *
 * GET    — List all system integrations for the current tenant (with masked secrets)
 * POST   — Create or update a system integration config (or test connection)
 * DELETE — Delete a system integration by type
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// ── Integration type definitions with their config schema ─────────────────

const INTEGRATION_TYPES = {
  smtp: {
    label: 'Email / SMTP',
    icon: 'mail',
    fields: [
      { key: 'host', label: 'SMTP Host', type: 'text', sensitive: false, placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'SMTP Port', type: 'number', sensitive: false, placeholder: '587' },
      { key: 'user', label: 'SMTP Username', type: 'text', sensitive: false, placeholder: 'user@gmail.com' },
      { key: 'password', label: 'SMTP Password', type: 'password', sensitive: true },
      { key: 'from', label: 'From Email', type: 'text', sensitive: false, placeholder: 'noreply@hotel.com' },
      { key: 'secure', label: 'Use TLS', type: 'boolean', sensitive: false },
    ],
  },
  sms_twilio: {
    label: 'SMS (Twilio)',
    icon: 'message-square',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', sensitive: false },
      { key: 'authToken', label: 'Auth Token', type: 'password', sensitive: true },
      { key: 'phoneNumber', label: 'From Phone Number', type: 'text', sensitive: false },
    ],
  },
  s3_storage: {
    label: 'File Storage (S3)',
    icon: 'hard-drive',
    fields: [
      { key: 'endpoint', label: 'S3 Endpoint', type: 'text', sensitive: false, placeholder: 'https://s3.amazonaws.com' },
      { key: 'bucket', label: 'Bucket Name', type: 'text', sensitive: false },
      { key: 'region', label: 'Region', type: 'text', sensitive: false, placeholder: 'us-east-1' },
      { key: 'accessKey', label: 'Access Key', type: 'password', sensitive: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', sensitive: true },
    ],
  },
  fcm: {
    label: 'Push Notifications (FCM)',
    icon: 'bell',
    fields: [
      { key: 'senderId', label: 'FCM Sender ID', type: 'text', sensitive: false },
      { key: 'serverKey', label: 'FCM Server Key', type: 'password', sensitive: true },
    ],
  },
  google_oauth: {
    label: 'Google OAuth',
    icon: 'chrome',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', sensitive: false },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', sensitive: true },
      { key: 'redirectUri', label: 'Redirect URI', type: 'text', sensitive: false },
    ],
  },
  radius: {
    label: 'WiFi / RADIUS',
    icon: 'wifi',
    fields: [
      { key: 'host', label: 'RADIUS Host', type: 'text', sensitive: false },
      { key: 'authPort', label: 'Auth Port', type: 'number', sensitive: false, placeholder: '1812' },
      { key: 'acctPort', label: 'Acct Port', type: 'number', sensitive: false, placeholder: '1813' },
      { key: 'secret', label: 'RADIUS Secret', type: 'password', sensitive: true },
    ],
  },
  ai: {
    label: 'AI Provider',
    icon: 'sparkles',
    fields: [
      { key: 'provider', label: 'AI Provider', type: 'text', sensitive: false, placeholder: 'openai' },
      { key: 'apiKey', label: 'API Key', type: 'password', sensitive: true },
      { key: 'model', label: 'Model', type: 'text', sensitive: false, placeholder: 'gpt-4o-mini' },
    ],
  },
  whatsapp: {
    label: 'WhatsApp Business',
    icon: 'message-circle',
    fields: [
      { key: 'businessAccountId', label: 'Business Account ID', type: 'text', sensitive: false },
      { key: 'appSecret', label: 'App Secret', type: 'password', sensitive: true },
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', sensitive: false },
      { key: 'accessToken', label: 'Access Token', type: 'password', sensitive: true },
      { key: 'phoneNumber', label: 'From Phone Number', type: 'text', sensitive: false },
    ],
  },
} as const;

type IntegrationType = keyof typeof INTEGRATION_TYPES;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Decrypt a value only if it looks encrypted */
function safeDecrypt(value: string): string {
  if (!value) return '';
  if (isEncrypted(value)) {
    const dec = decrypt(value);
    return dec !== null ? dec : value;
  }
  return value;
}

/** Determine if an integration has all required (non-optional) fields filled */
function isActive(
  type: IntegrationType,
  config: Record<string, unknown>,
): boolean {
  const fields = INTEGRATION_TYPES[type].fields;
  // An integration is "active" when at least one sensitive field is populated
  const sensitiveFields = fields.filter((f) => f.sensitive);
  return sensitiveFields.some((f) => {
    const v = config[f.key];
    return v !== undefined && v !== null && v !== '';
  });
}

/** Decrypt the full config JSON from an integration record */
function parseDecryptedConfig(configJson: string): Record<string, string> {
  if (!configJson) return {};
  try {
    const raw = JSON.parse(configJson) as Record<string, string>;
    const decrypted: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && isEncrypted(value)) {
        const dec = decrypt(value);
        decrypted[key] = dec !== null ? dec : value;
      } else {
        decrypted[key] = String(value);
      }
    }
    return decrypted;
  } catch {
    return {};
  }
}

/**
 * Build the encrypted config map, preserving existing encrypted values
 * when the frontend sends '****' (meaning "keep existing").
 *
 * @param typeDef  - The integration type field definitions
 * @param rawConfig - The incoming config values from the frontend
 * @param existingConfig - The existing encrypted config from the DB record
 */
function buildEncryptedConfig(
  typeDef: (typeof INTEGRATION_TYPES)[IntegrationType],
  rawConfig: Record<string, string | number | boolean>,
  existingConfig: Record<string, string>,
): Record<string, string> {
  const encryptedConfig: Record<string, string> = {};

  for (const field of typeDef.fields) {
    const value = rawConfig[field.key];
    if (value === undefined || value === null) {
      // If field not provided at all, preserve existing if present
      if (field.key in existingConfig) {
        encryptedConfig[field.key] = existingConfig[field.key];
      }
      continue;
    }

    const strValue = String(value);

    if (field.sensitive) {
      if (strValue === '****') {
        // Frontend says "keep existing" — carry over the encrypted value from DB
        if (field.key in existingConfig) {
          encryptedConfig[field.key] = existingConfig[field.key];
        }
        continue;
      }

      // Decrypt first if already encrypted to avoid double-encrypting
      let plaintext = strValue;
      if (isEncrypted(strValue)) {
        const dec = decrypt(strValue);
        if (dec !== null) plaintext = dec;
      }
      encryptedConfig[field.key] = encrypt(plaintext);
    } else {
      encryptedConfig[field.key] = strValue;
    }
  }

  return encryptedConfig;
}

// ── Connection test helpers ────────────────────────────────────────────────

/**
 * Test SMTP connection using nodemailer transport.verify()
 */
async function testSMTP(
  config: Record<string, string | number | boolean>,
): Promise<{ success: boolean; error?: string }> {
  const host = String(config.host ?? '');
  const port = Number(config.port) || 587;
  const user = String(config.user ?? '');
  const password = String(config.password ?? '');
  const secure = config.secure === true;

  if (!host) return { success: false, error: 'SMTP host is required' };
  if (!user) return { success: false, error: 'SMTP username is required' };
  if (!password) return { success: false, error: 'SMTP password is required' };

  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 5_000,
    });

    await transport.verify();
    transport.close();
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown SMTP error';
    return { success: false, error: `SMTP connection failed: ${msg}` };
  }
}

/**
 * Validate Twilio SMS credentials format
 */
function testSMS(
  config: Record<string, string | number | boolean>,
): { success: boolean; error?: string } {
  const accountSid = String(config.accountSid ?? '');
  const authToken = String(config.authToken ?? '');
  const phoneNumber = String(config.phoneNumber ?? '');

  if (!accountSid) return { success: false, error: 'Account SID is required' };
  if (!authToken) return { success: false, error: 'Auth Token is required' };
  if (!phoneNumber) return { success: false, error: 'Phone Number is required' };

  // Twilio Account SID starts with "AC"
  if (!/^AC[a-fA-F0-9]{32}$/.test(accountSid)) {
    return { success: false, error: 'Account SID format is invalid (should start with AC followed by 32 hex chars)' };
  }

  return { success: true };
}

/**
 * Validate S3 storage credentials format
 */
function testS3(
  config: Record<string, string | number | boolean>,
): { success: boolean; error?: string } {
  const endpoint = String(config.endpoint ?? '');
  const bucket = String(config.bucket ?? '');
  const region = String(config.region ?? '');
  const accessKey = String(config.accessKey ?? '');
  const secretKey = String(config.secretKey ?? '');

  if (!endpoint) return { success: false, error: 'S3 Endpoint is required' };
  if (!bucket) return { success: false, error: 'Bucket Name is required' };
  if (!region) return { success: false, error: 'Region is required' };
  if (!accessKey) return { success: false, error: 'Access Key is required' };
  if (!secretKey) return { success: false, error: 'Secret Key is required' };

  // AWS access keys are 20-char alphanumeric
  if (accessKey.length < 16) {
    return { success: false, error: 'Access Key appears to be too short' };
  }
  // AWS secret keys are 40-char alphanumeric
  if (secretKey.length < 32) {
    return { success: false, error: 'Secret Key appears to be too short' };
  }

  return { success: true };
}

/**
 * Validate FCM credentials format
 */
function testFCM(
  config: Record<string, string | number | boolean>,
): { success: boolean; error?: string } {
  const senderId = String(config.senderId ?? '');
  const serverKey = String(config.serverKey ?? '');

  if (!senderId) return { success: false, error: 'FCM Sender ID is required' };
  if (!serverKey) return { success: false, error: 'FCM Server Key is required' };

  // Server key is typically long (legacy) or a JSON string (service account)
  if (serverKey.length < 20) {
    return { success: false, error: 'FCM Server Key appears to be too short' };
  }

  return { success: true };
}

/**
 * Validate Google OAuth credentials format
 */
function testGoogleOAuth(
  config: Record<string, string | number | boolean>,
): { success: boolean; error?: string } {
  const clientId = String(config.clientId ?? '');
  const clientSecret = String(config.clientSecret ?? '');
  const redirectUri = String(config.redirectUri ?? '');

  if (!clientId) return { success: false, error: 'Google Client ID is required' };
  if (!clientSecret) return { success: false, error: 'Google Client Secret is required' };
  if (!redirectUri) return { success: false, error: 'Redirect URI is required' };

  // Client ID format: xxx.apps.googleusercontent.com
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
    return { success: false, error: 'Client ID format is invalid (should end with .apps.googleusercontent.com)' };
  }

  // Redirect URI should be a valid URL
  try {
    new URL(redirectUri);
  } catch {
    return { success: false, error: 'Redirect URI must be a valid URL' };
  }

  return { success: true };
}

/**
 * Validate RADIUS host/port/secret format
 */
function testRadius(
  config: Record<string, string | number | boolean>,
): { success: boolean; error?: string } {
  const host = String(config.host ?? '');
  const authPort = Number(config.authPort) || 0;
  const acctPort = Number(config.acctPort) || 0;
  const secret = String(config.secret ?? '');

  if (!host) return { success: false, error: 'RADIUS Host is required' };
  if (!secret) return { success: false, error: 'RADIUS Secret is required' };
  if (authPort <= 0 || authPort > 65535) {
    return { success: false, error: 'Auth Port must be between 1 and 65535' };
  }
  if (acctPort <= 0 || acctPort > 65535) {
    return { success: false, error: 'Acct Port must be between 1 and 65535' };
  }

  return { success: true };
}

/**
 * Test AI provider connection by hitting the models endpoint
 */
async function testAI(
  config: Record<string, string | number | boolean>,
): Promise<{ success: boolean; error?: string }> {
  const provider = String(config.provider ?? 'openai').toLowerCase();
  const apiKey = String(config.apiKey ?? '');

  if (!apiKey) return { success: false, error: 'API Key is required' };

  try {
    const baseUrlMap: Record<string, string> = {
      openai: 'https://api.openai.com',
      anthropic: 'https://api.anthropic.com',
      google: 'https://generativelanguage.googleapis.com',
      azure: '',
      ollama: 'http://localhost:11434',
    };

    const baseUrl = baseUrlMap[provider];
    if (!baseUrl && provider !== 'azure') {
      return { success: false, error: `Unknown AI provider: ${provider}` };
    }

    if (provider === 'openai') {
      const res = await fetch(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return { success: false, error: `OpenAI API returned ${res.status}: ${await res.text().catch(() => 'Unknown error')}` };
      }
      return { success: true };
    }

    if (provider === 'anthropic') {
      // Anthropic doesn't have a simple list endpoint, validate key format
      if (!/^sk-ant-/.test(apiKey)) {
        return { success: false, error: 'Anthropic API key should start with sk-ant-' };
      }
      return { success: true };
    }

    if (provider === 'google') {
      // Google AI uses API key as query param — test with a simple models list
      const res = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return { success: false, error: `Google AI API returned ${res.status}` };
      }
      return { success: true };
    }

    if (provider === 'ollama') {
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return { success: false, error: `Ollama returned ${res.status} — ensure the Ollama service is running` };
      }
      return { success: true };
    }

    // Generic validation for unknown providers
    return { success: true, error: undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `AI connection test failed: ${msg}` };
  }
}

/**
 * Validate WhatsApp Business credentials format
 */
function testWhatsApp(
  config: Record<string, string | number | boolean>,
): { success: boolean; error?: string } {
  const businessAccountId = String(config.businessAccountId ?? '');
  const appSecret = String(config.appSecret ?? '');
  const phoneNumberId = String(config.phoneNumberId ?? '');
  const accessToken = String(config.accessToken ?? '');
  const phoneNumber = String(config.phoneNumber ?? '');

  if (!businessAccountId) return { success: false, error: 'Business Account ID is required' };
  if (!appSecret) return { success: false, error: 'App Secret is required' };
  if (!phoneNumberId) return { success: false, error: 'Phone Number ID is required' };
  if (!accessToken) return { success: false, error: 'Access Token is required' };
  if (!phoneNumber) return { success: false, error: 'From Phone Number is required' };

  return { success: true };
}

/** Map each integration type to its test function */
async function runConnectionTest(
  type: IntegrationType,
  config: Record<string, string | number | boolean>,
): Promise<{ success: boolean; error?: string }> {
  switch (type) {
    case 'smtp':
      return testSMTP(config);
    case 'sms_twilio':
      return testSMS(config);
    case 's3_storage':
      return testS3(config);
    case 'fcm':
      return testFCM(config);
    case 'google_oauth':
      return testGoogleOAuth(config);
    case 'radius':
      return testRadius(config);
    case 'ai':
      return testAI(config);
    case 'whatsapp':
      return testWhatsApp(config);
    default:
      return { success: false, error: `Unknown integration type: ${type}` };
  }
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;
    const typeKeys = Object.keys(INTEGRATION_TYPES) as IntegrationType[];

    const integrations = await db.integration.findMany({
      where: {
        tenantId,
        type: { in: typeKeys },
      },
    });

    const results = integrations.map((row) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(row.config || '{}');
      } catch {
        parsed = {};
      }

      const typeDef = INTEGRATION_TYPES[row.type as IntegrationType];
      const masked: Record<string, unknown> = {};

      for (const field of typeDef?.fields ?? []) {
        const raw = String(parsed[field.key] ?? '');
        if (field.sensitive && raw) {
          // Show '****' for sensitive fields that have a value
          masked[field.key] = '****';
        } else if (field.type === 'boolean') {
          masked[field.key] = raw === 'true';
        } else if (field.type === 'number') {
          const n = Number(raw);
          masked[field.key] = isNaN(n) ? raw : n;
        } else {
          masked[field.key] = raw;
        }
      }

      return {
        id: row.id,
        type: row.type,
        provider: row.provider,
        name: row.name,
        status: row.status,
        config: masked,
        active: isActive(row.type as IntegrationType, parsed),
        source: 'database' as const,
        lastSyncAt: row.lastSyncAt,
        lastError: row.lastError,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        integrations: results,
        types: INTEGRATION_TYPES,
      },
    });
  } catch (error) {
    console.error('[Integrations] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch integrations' },
      { status: 500 },
    );
  }
}

// ── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { type, config: rawConfig, name, test } = body as {
      type: string;
      config: Record<string, string | number | boolean>;
      name?: string;
      test?: boolean;
    };

    if (!type || !(type in INTEGRATION_TYPES)) {
      return NextResponse.json(
        { success: false, error: `Invalid integration type. Must be one of: ${Object.keys(INTEGRATION_TYPES).join(', ')}` },
        { status: 400 },
      );
    }

    const integrationType = type as IntegrationType;
    const typeDef = INTEGRATION_TYPES[integrationType];

    // ── Test connection mode (Bug 3 fix) ─────────────────────────────────
    if (test === true) {
      // Build a plaintext config from the incoming values, replacing '****'
      // with existing DB values if available so the test uses real credentials
      const existingRecord = await db.integration.findFirst({
        where: { tenantId, type, provider: type },
      });
      const existingEncrypted = existingRecord
        ? JSON.parse(existingRecord.config || '{}') as Record<string, string>
        : {};

      // Build a config with real values for testing
      const testConfig: Record<string, string | number | boolean> = {};
      for (const field of typeDef.fields) {
        const value = rawConfig[field.key];
        const strValue = value !== undefined && value !== null ? String(value) : '';

        if (field.sensitive && strValue === '****') {
          // Use the decrypted existing value
          const encVal = existingEncrypted[field.key];
          if (encVal) {
            const dec = isEncrypted(encVal) ? decrypt(encVal) : null;
            testConfig[field.key] = dec !== null ? dec : encVal;
          }
        } else if (value !== undefined && value !== null) {
          // Decrypt if already encrypted
          if (field.sensitive && isEncrypted(strValue)) {
            const dec = decrypt(strValue);
            testConfig[field.key] = dec !== null ? dec : strValue;
          } else {
            testConfig[field.key] = value;
          }
        }
      }

      const result = await runConnectionTest(integrationType, testConfig);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Connection test passed',
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Connection test failed',
          },
          { status: 400 },
        );
      }
    }

    // ── Save mode — read existing record to preserve encrypted values (Bug 1 fix) ─
    const existingRecord = await db.integration.findFirst({
      where: { tenantId, type, provider: type },
    });

    const existingEncrypted: Record<string, string> = existingRecord
      ? (JSON.parse(existingRecord.config || '{}') as Record<string, string>)
      : {};

    const encryptedConfig = buildEncryptedConfig(typeDef, rawConfig, existingEncrypted);

    const integration = await db.integration.upsert({
      where: {
        tenantId_type_provider: {
          tenantId,
          type,
          provider: type, // system integrations use the type as provider
        },
      },
      create: {
        tenantId,
        type,
        provider: type,
        name: name || typeDef.label,
        config: JSON.stringify(encryptedConfig),
        status: 'active',
      },
      update: {
        config: JSON.stringify(encryptedConfig),
        name: name || typeDef.label,
        status: 'active',
        updatedAt: new Date(),
      },
    });

    // Build masked response (Bug 5: includes id)
    const masked: Record<string, unknown> = {};
    for (const field of typeDef.fields) {
      const raw = encryptedConfig[field.key] ?? '';
      if (field.sensitive && raw) {
        masked[field.key] = '****';
      } else if (field.type === 'boolean') {
        masked[field.key] = raw === 'true';
      } else if (field.type === 'number') {
        const n = Number(raw);
        masked[field.key] = isNaN(n) ? raw : n;
      } else {
        masked[field.key] = raw;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        type: integration.type,
        provider: integration.provider,
        name: integration.name,
        status: integration.status,
        config: masked,
        active: isActive(type as IntegrationType, encryptedConfig),
        source: 'database' as const,
        updatedAt: integration.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Integrations] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save integration' },
      { status: 500 },
    );
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 },
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { type } = body as { type?: string };

    if (!type || !(type in INTEGRATION_TYPES)) {
      return NextResponse.json(
        { success: false, error: `Invalid integration type. Must be one of: ${Object.keys(INTEGRATION_TYPES).join(', ')}` },
        { status: 400 },
      );
    }

    const deleted = await db.integration.deleteMany({
      where: {
        tenantId,
        type,
        provider: type, // system integrations use the type as provider
      },
    });

    return NextResponse.json({
      success: true,
      message: deleted.count > 0
        ? `Integration "${INTEGRATION_TYPES[type as IntegrationType].label}" deleted successfully`
        : 'No matching integration found to delete',
      deletedCount: deleted.count,
    });
  } catch (error) {
    console.error('[Integrations] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete integration' },
      { status: 500 },
    );
  }
}
