import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { encrypt } from '@/lib/encryption';

// ---------------------------------------------------------------------------
// Provider constants
// ---------------------------------------------------------------------------

const VALID_PROVIDERS = [
  'twilio',
  'vonage',
  'messagebird',
  'aws_sns',
  'msg91',
  'gupshup',
  'textlocal',
  'kaleyra',
  'exotel',
  'fast2sms',
  'plivo',
  'route_mobile',
  'valuefirst',
  'msgclub',
  'airtel_iq',
  'bulk_sms',
  'custom_http',
  'mock',
] as const;

type SmsProvider = (typeof VALID_PROVIDERS)[number];

// Fields that must be encrypted before storage
const SENSITIVE_FIELDS: Record<SmsProvider, string[]> = {
  twilio: ['authToken'],
  vonage: ['apiSecret'],
  messagebird: ['accessKey'],
  aws_sns: ['awsSecretAccessKey'],
  msg91: ['authKey'],
  gupshup: ['password'],
  textlocal: ['apiKey'],
  kaleyra: ['apiKey'],
  exotel: ['apiToken'],
  fast2sms: ['apiKey'],
  plivo: ['authToken'],
  route_mobile: ['apiKey'],
  valuefirst: ['apiKey'],
  msgclub: ['apiKey'],
  airtel_iq: ['clientSecret'],
  bulk_sms: ['apiKey'],
  custom_http: ['apiKey'],
  mock: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSmsProvider(v: string): v is SmsProvider {
  return (VALID_PROVIDERS as readonly string[]).includes(v);
}

function encryptSensitiveFields(
  provider: SmsProvider,
  config: Record<string, unknown>,
) {
  const sensitive = SENSITIVE_FIELDS[provider] ?? [];
  const encrypted = { ...config };
  for (const field of sensitive) {
    if (typeof config[field] === 'string' && config[field] !== '') {
      encrypted[field] = encrypt(config[field] as string);
    }
  }
  return encrypted;
}

/** Mask sensitive values when returning config to the frontend */
function maskSensitiveFields(
  provider: SmsProvider,
  config: Record<string, unknown>,
) {
  const sensitive = SENSITIVE_FIELDS[provider] ?? [];
  const masked = { ...config };
  for (const field of sensitive) {
    if (typeof config[field] === 'string' && config[field] !== '') {
      masked[field] = '••••••••';
    }
  }
  return masked;
}

function providerDisplayName(p: SmsProvider): string {
  const map: Record<SmsProvider, string> = {
    twilio: 'Twilio',
    vonage: 'Vonage / Nexmo',
    messagebird: 'MessageBird',
    aws_sns: 'AWS SNS',
    msg91: 'MSG91',
    gupshup: 'Gupshup',
    textlocal: 'Textlocal',
    kaleyra: 'Kaleyra',
    exotel: 'Exotel',
    fast2sms: 'Fast2SMS',
    plivo: 'Plivo',
    route_mobile: 'Route Mobile',
    valuefirst: 'ValueFirst',
    msgclub: 'MSGCLUB',
    airtel_iq: 'Airtel IQ',
    bulk_sms: 'BulkSMS India',
    custom_http: 'Custom HTTP',
    mock: 'Mock (Dev)',
  };
  return map[p];
}

function providerRegion(p: SmsProvider): string {
  const india = ['msg91', 'gupshup', 'textlocal', 'kaleyra', 'exotel', 'fast2sms', 'plivo', 'route_mobile', 'valuefirst', 'msgclub', 'airtel_iq', 'bulk_sms'];
  if (p === 'mock') return 'dev';
  return india.includes(p) ? 'india' : 'global';
}

// ---------------------------------------------------------------------------
// GET – list all SMS gateway integrations for the tenant
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'integrations.view') && !hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 },
      );
    }

    const integrations = await db.integration.findMany({
      where: { tenantId: user.tenantId, type: { startsWith: 'sms_' } },
      orderBy: { createdAt: 'desc' },
    });

    const gateways = integrations.map((row) => {
      const rawConfig = (() => {
        try {
          return JSON.parse(row.config) as Record<string, unknown>;
        } catch {
          return {};
        }
      })();

      const prov = row.provider as SmsProvider;
      return {
        id: row.id,
        provider: prov,
        name: row.name || providerDisplayName(prov),
        displayName: providerDisplayName(prov),
        region: providerRegion(prov),
        status: row.status,
        isDefault: (rawConfig.isDefault as boolean) ?? false,
        otpEnabled: (rawConfig.otpEnabled as boolean) ?? false,
        senderId: rawConfig.senderId ?? rawConfig.senderName ?? rawConfig.fromPhone ?? rawConfig.senderMask ?? rawConfig.sender ?? '',
        config: maskSensitiveFields(prov, rawConfig),
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        lastError: row.lastError ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    });

    const activeCount = gateways.filter((g) => g.status === 'active').length;
    const defaultGateway = gateways.find((g) => g.isDefault);
    const anyOtp = gateways.some((g) => g.otpEnabled);

    const stats = {
      configured: gateways.length,
      active: activeCount,
      defaultProvider: defaultGateway ? defaultGateway.displayName : 'None',
      otpEnabled: anyOtp,
      totalProviders: gateways.length,
    };

    return NextResponse.json({ success: true, data: { gateways, stats } });
  } catch (error) {
    console.error('Error fetching SMS gateways:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SMS gateways' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST – create a new SMS gateway integration
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'integrations.create') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { provider: rawProvider, config: rawConfig, isDefault, otpEnabled, test, to } = body;

    // ── Test mode: POST { test: true, to: '<phone>', provider, config } ──
    if (test) {
      return handleTestSms(user.tenantId, rawProvider, rawConfig, to);
    }

    // ── Normal create ──
    if (!rawProvider || !isSmsProvider(rawProvider)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid provider. Valid: ${VALID_PROVIDERS.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    const provider = rawProvider as SmsProvider;
    const config = encryptSensitiveFields(provider, rawConfig ?? {});

    // If this provider is being set as default, unset any existing defaults
    if (isDefault) {
      const allGateways = await db.integration.findMany({
        where: {
          tenantId: user.tenantId,
          type: { startsWith: 'sms_' },
        },
      });
      for (const gw of allGateways) {
        try {
          const existing = JSON.parse(gw.config) as Record<string, unknown>;
          if (existing.isDefault) {
            existing.isDefault = false;
            await db.integration.update({
              where: { id: gw.id },
              data: { config: JSON.stringify(existing) },
            });
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    const integration = await db.integration.create({
      data: {
        tenantId: user.tenantId,
        type: `sms_${provider}`,
        provider,
        name: providerDisplayName(provider),
        config: JSON.stringify({
          ...config,
          isDefault: !!isDefault,
          otpEnabled: !!otpEnabled,
        }),
        status: 'active',
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: integration,
        message: `${providerDisplayName(provider)} gateway added successfully`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating SMS gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create SMS gateway' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT – update an existing SMS gateway
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'integrations.edit') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { id, config: rawConfig, isDefault, otpEnabled, status: newStatus } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Integration ID is required' } },
        { status: 400 },
      );
    }

    const existing = await db.integration.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'SMS gateway not found' } },
        { status: 404 },
      );
    }

    const existingConfig = (() => {
      try {
        return JSON.parse(existing.config) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();

    const provider = existing.provider as SmsProvider;

    // Build merged config
    const mergedConfig = { ...existingConfig };

    if (rawConfig && typeof rawConfig === 'object') {
      Object.assign(mergedConfig, rawConfig);
      // Re-encrypt any newly provided sensitive fields
      const encrypted = encryptSensitiveFields(provider, rawConfig as Record<string, unknown>);
      Object.assign(mergedConfig, encrypted);
    }

    if (typeof isDefault === 'boolean') {
      // Unset previous default
      if (isDefault && !existingConfig.isDefault) {
        const allGateways = await db.integration.findMany({
          where: { tenantId: user.tenantId, type: { startsWith: 'sms_' } },
        });
        for (const gw of allGateways) {
          try {
            const gwCfg = JSON.parse(gw.config) as Record<string, unknown>;
            if (gwCfg.isDefault) {
              gwCfg.isDefault = false;
              await db.integration.update({
                where: { id: gw.id },
                data: { config: JSON.stringify(gwCfg) },
              });
            }
          } catch {
            // ignore
          }
        }
      }
      mergedConfig.isDefault = isDefault;
    }

    if (typeof otpEnabled === 'boolean') {
      mergedConfig.otpEnabled = otpEnabled;
    }

    const updateData: Record<string, unknown> = {
      config: JSON.stringify(mergedConfig),
    };

    if (typeof newStatus === 'string') {
      const validStatuses = ['active', 'inactive', 'error', 'pending'];
      updateData.status = validStatuses.includes(newStatus) ? newStatus : existing.status;
    }

    const integration = await db.integration.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: integration,
      message: 'SMS gateway updated successfully',
    });
  } catch (error) {
    console.error('Error updating SMS gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update SMS gateway' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE – remove an SMS gateway
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(user, 'integrations.delete') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Integration ID is required' } },
        { status: 400 },
      );
    }

    const existing = await db.integration.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'SMS gateway not found' } },
        { status: 404 },
      );
    }

    await db.integration.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'SMS gateway deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting SMS gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete SMS gateway' } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Test SMS handler
// ---------------------------------------------------------------------------

async function handleTestSms(
  tenantId: string,
  rawProvider: string,
  rawConfig: Record<string, unknown> | undefined,
  to: string | undefined,
) {
  if (!to) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Test phone number is required' } },
      { status: 400 },
    );
  }

  if (!rawProvider || !isSmsProvider(rawProvider)) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid provider for test' } },
      { status: 400 },
    );
  }

  const provider = rawProvider as SmsProvider;
  const config = rawConfig ?? {};

  // Real SMS gateway integration needed
  // Attempt to send via the configured provider; fall back to mock if no gateway configured
  console.log(`[SMS TEST] Sending test SMS via ${provider} to ${to}`);

  // For mock provider, always succeed without real sending
  if (provider === 'mock') {
    return NextResponse.json({
      success: true,
      data: {
        provider,
        to,
        messageId: `mock_${Date.now()}`,
        status: 'delivered',
        message: 'Test SMS sent successfully (Mock mode)',
      },
    });
  }

  // Check if credentials are configured
  const hasConfig = Object.values(config).some(
    (v) => typeof v === 'string' && v.trim() !== '' && v !== '••••••••',
  );

  if (!hasConfig) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'CONFIG_MISSING',
        message: 'Please provide configuration credentials before testing',
      },
    });
  }

  // TODO: Real SMS gateway integration needed — replace this mock response
  // with actual provider API calls (e.g., Twilio, Vonage, MSG91)
  // For now, simulate a small network delay and return a mock delivery result
  await new Promise((resolve) => setTimeout(resolve, 500));

  return NextResponse.json({
    success: true,
    data: {
      provider,
      to,
      messageId: `test_${provider}_${Date.now()}`,
      status: 'delivered',
      message: `Test SMS sent successfully via ${providerDisplayName(provider)} (mock delivery — real gateway integration pending)`,
    },
  });
}
