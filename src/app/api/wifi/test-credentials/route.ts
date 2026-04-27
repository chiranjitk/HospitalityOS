/**
 * Test Credential Generation API
 * 
 * POST /api/wifi/test-credentials
 * 
 * Allows the admin to test what credentials would be generated for a given property
 * WITHOUT actually creating a WiFi user or provisioning. This helps verify that
 * the AAA credential policy is configured correctly before real check-ins.
 * 
 * Usage:
 *   POST with { propertyId, guestName, guestPhone, roomNumber, ... }
 *   Returns { username, password, policy, diagnostics }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';
import {
  generateCredentials,
  getDefaultCredentialPolicy,
  type CredentialPolicy,
} from '@/lib/wifi/services/credential-engine';

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId: rawPropertyId,
      guestName = 'John Smith',
      guestPhone,
      guestEmail,
      roomNumber = '101',
    } = body;

    const propertyId = await resolvePropertyId(user, rawPropertyId);
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found. Please create a property first.' },
        { status: 400 },
      );
    }

    const tenantId = user.tenantId;

    // ─── Diagnostics: Load credential policy exactly like provisioning-service does ───
    const diagnostics: Record<string, string> = {};

    // Step 1: Check property-specific config
    let config = await db.wiFiAAAConfig.findUnique({
      where: { propertyId },
    });

    if (config) {
      diagnostics['step1_propertyLookup'] = `FOUND config for propertyId=${propertyId}, id=${config.id}, usernameFormat=${JSON.stringify(config.usernameFormat)}`;
    } else {
      diagnostics['step1_propertyLookup'] = `NOT FOUND for propertyId=${propertyId}`;

      // Step 2: Tenant fallback
      const tenantConfigs = await db.wiFiAAAConfig.findMany({
        where: { tenantId },
        select: { id: true, propertyId: true, usernameFormat: true },
      });
      diagnostics['step2_tenantConfigs'] = `Found ${tenantConfigs.length} config(s) for tenant: ${JSON.stringify(tenantConfigs)}`;

      config = tenantConfigs.length > 0
        ? await db.wiFiAAAConfig.findFirst({ where: { tenantId } })
        : null;

      if (config) {
        diagnostics['step2_tenantFallback'] = `Using config from propertyId=${config.propertyId} (usernameFormat=${JSON.stringify(config.usernameFormat)})`;
      }
    }

    // Step 3: Resolve the credential policy
    let credentialPolicy: CredentialPolicy;
    let configSource: string;

    if (config) {
      const rawFormat = config.usernameFormat;
      const resolvedFormat = rawFormat || 'room_random';

      if (!rawFormat) {
        diagnostics['step3_formatWarning'] = `⚠ usernameFormat is NULL/EMPTY in DB! Falling back to 'room_random'. The save may not have worked.`;
      }

      credentialPolicy = {
        usernameFormat: resolvedFormat,
        usernamePrefix: config.usernamePrefix,
        usernameCase: (config.usernameCase as 'lowercase' | 'uppercase' | 'as_is') || 'lowercase',
        usernameMinLength: config.usernameMinLength || 4,
        usernameMaxLength: config.usernameMaxLength || 32,
        passwordFormat: config.passwordFormat || 'random_alphanumeric',
        passwordFixedValue: config.passwordFixedValue,
        passwordLength: config.passwordLength || 8,
        passwordIncludeUppercase: config.passwordIncludeUppercase !== false,
        passwordIncludeNumbers: config.passwordIncludeNumbers !== false,
        passwordIncludeSymbols: config.passwordIncludeSymbols || false,
        credentialSeparator: config.credentialSeparator || '_',
        duplicateUsernameAction: (config.duplicateUsernameAction as 'append_random' | 'reject' | 'overwrite') || 'append_random',
      };
      configSource = `property: ${config.propertyId} (id: ${config.id})`;
    } else {
      credentialPolicy = getDefaultCredentialPolicy();
      configSource = 'HARDCODED DEFAULT (no DB config found)';
      diagnostics['step3_formatWarning'] = `✗ NO config found at all. Using hardcoded default. Admin must save AAA settings first!`;
    }

    // Step 4: Generate credentials
    const firstName = guestName.split(' ')[0] || '';
    const lastName = guestName.split(' ').slice(1).join(' ') || '';
    const { username, password } = generateCredentials(credentialPolicy, {
      firstName,
      lastName,
      mobile: guestPhone,
      email: guestEmail,
      roomNumber,
      bookingId: 'test-booking-id',
      checkIn: new Date(),
      checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    }, 'test-booking-id');

    diagnostics['step4_generated'] = `username=${username}, password=${password}`;

    console.log(`[Test Credentials] For propertyId=${propertyId}: format=${credentialPolicy.usernameFormat}, generated username=${username}`);

    return NextResponse.json({
      success: true,
      data: {
        username,
        password,
        guest: {
          name: guestName,
          phone: guestPhone || '(none)',
          email: guestEmail || '(none)',
          roomNumber,
        },
        policy: {
          usernameFormat: credentialPolicy.usernameFormat,
          passwordFormat: credentialPolicy.passwordFormat,
          credentialSeparator: credentialPolicy.credentialSeparator,
          usernameCase: credentialPolicy.usernameCase,
        },
        configSource,
        diagnostics,
      },
    });
  } catch (error) {
    console.error('[Test Credentials] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test credential generation' },
      { status: 500 },
    );
  }
}
