import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';

// GET /api/wifi/aaa-config - Get WiFi AAA config including credential policy
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const field = searchParams.get('field'); // Support fetching a single field

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) {
      where.propertyId = propertyId;
    }

    const config = await db.wiFiAAAConfig.findFirst({
      where,
      include: { defaultPlan: true },
    });

    const responseData: Record<string, unknown> = config ? (config as unknown as Record<string, unknown>) : {
      id: null,
      propertyId: propertyId || user.propertyId || null,
      defaultPlanId: null,
      defaultDownloadSpeed: 10,
      defaultUploadSpeed: 10,
      defaultSessionLimit: null,
      defaultDataLimit: null,
      autoProvisionOnCheckin: true,
      autoDeprovisionOnCheckout: true,
      autoDeprovisionDelay: 0,
      authMethod: 'pap',
      allowMacAuth: false,
      accountingSyncInterval: 5,
      maxConcurrentSessions: 3,
      sessionTimeoutPolicy: 'hard',
      portalEnabled: true,
      portalTitle: null,
      portalLogo: null,
      portalBrandColor: '#0d9488',
      voucherPortalUrl: null,
      usernameFormat: 'room_random',
      usernamePrefix: null,
      usernameCase: 'lowercase',
      usernameMinLength: 4,
      usernameMaxLength: 32,
      passwordFormat: 'random_alphanumeric',
      passwordFixedValue: null,
      passwordLength: 8,
      passwordIncludeUppercase: true,
      passwordIncludeNumbers: true,
      passwordIncludeSymbols: false,
      credentialSeparator: '_',
      credentialPrintOnVoucher: true,
      credentialShowInPortal: true,
      duplicateUsernameAction: 'append_random',
    };

    // If a specific field is requested, return only that field's value
    if (field && responseData) {
      return NextResponse.json({ success: true, data: responseData[field] ?? null });
    }

    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    console.error('Error fetching AAA config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch AAA config' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/aaa-config - Update WiFi AAA config
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const propertyId = await resolvePropertyId(user, body.propertyId);

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No property found. Please create a property first.' } },
        { status: 400 }
      );
    }

    // Upsert
    const existing = await db.wiFiAAAConfig.findUnique({
      where: { propertyId },
    });

    if (existing) {
      const updated = await db.wiFiAAAConfig.update({
        where: { propertyId },
        data: {
          // Default plan — use !== undefined to allow clearing to null
          defaultPlanId: body.defaultPlanId !== undefined ? body.defaultPlanId : existing.defaultPlanId,
          defaultDownloadSpeed: body.defaultDownloadSpeed ?? existing.defaultDownloadSpeed,
          defaultUploadSpeed: body.defaultUploadSpeed ?? existing.defaultUploadSpeed,
          defaultSessionLimit: body.defaultSessionLimit !== undefined ? body.defaultSessionLimit : existing.defaultSessionLimit,
          defaultDataLimit: body.defaultDataLimit !== undefined ? body.defaultDataLimit : existing.defaultDataLimit,
          autoProvisionOnCheckin: body.autoProvisionOnCheckin ?? existing.autoProvisionOnCheckin,
          autoDeprovisionOnCheckout: body.autoDeprovisionOnCheckout ?? existing.autoDeprovisionOnCheckout,
          autoDeprovisionDelay: body.autoDeprovisionDelay ?? existing.autoDeprovisionDelay,
          authMethod: body.authMethod ?? existing.authMethod,
          allowMacAuth: body.allowMacAuth ?? existing.allowMacAuth,
          accountingSyncInterval: body.accountingSyncInterval ?? existing.accountingSyncInterval,
          maxConcurrentSessions: body.maxConcurrentSessions ?? existing.maxConcurrentSessions,
          sessionTimeoutPolicy: body.sessionTimeoutPolicy ?? existing.sessionTimeoutPolicy,
          portalEnabled: body.portalEnabled ?? existing.portalEnabled,
          portalTitle: body.portalTitle ?? existing.portalTitle,
          portalLogo: body.portalLogo ?? existing.portalLogo,
          portalTerms: body.portalTerms ?? existing.portalTerms,
          portalRedirectUrl: body.portalRedirectUrl ?? existing.portalRedirectUrl,
          portalBrandColor: body.portalBrandColor ?? existing.portalBrandColor,
          voucherPortalUrl: body.voucherPortalUrl ?? existing.voucherPortalUrl,
          // Credential Policy
          usernameFormat: body.usernameFormat ?? existing.usernameFormat,
          usernamePrefix: body.usernamePrefix ?? existing.usernamePrefix,
          usernameCase: body.usernameCase ?? existing.usernameCase,
          usernameMinLength: body.usernameMinLength ?? existing.usernameMinLength,
          usernameMaxLength: body.usernameMaxLength ?? existing.usernameMaxLength,
          passwordFormat: body.passwordFormat ?? existing.passwordFormat,
          passwordFixedValue: body.passwordFixedValue ?? existing.passwordFixedValue,
          passwordLength: body.passwordLength ?? existing.passwordLength,
          passwordIncludeUppercase: body.passwordIncludeUppercase ?? existing.passwordIncludeUppercase,
          passwordIncludeNumbers: body.passwordIncludeNumbers ?? existing.passwordIncludeNumbers,
          passwordIncludeSymbols: body.passwordIncludeSymbols ?? existing.passwordIncludeSymbols,
          credentialSeparator: body.credentialSeparator ?? existing.credentialSeparator,
          credentialPrintOnVoucher: body.credentialPrintOnVoucher ?? existing.credentialPrintOnVoucher,
          credentialShowInPortal: body.credentialShowInPortal ?? existing.credentialShowInPortal,
          duplicateUsernameAction: body.duplicateUsernameAction ?? existing.duplicateUsernameAction,
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // Create new
    const created = await db.wiFiAAAConfig.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        defaultPlanId: body.defaultPlanId || null,
        defaultDownloadSpeed: body.defaultDownloadSpeed ?? 10,
        defaultUploadSpeed: body.defaultUploadSpeed ?? 10,
        defaultSessionLimit: body.defaultSessionLimit ?? null,
        defaultDataLimit: body.defaultDataLimit ?? null,
        autoProvisionOnCheckin: body.autoProvisionOnCheckin ?? true,
        autoDeprovisionOnCheckout: body.autoDeprovisionOnCheckout ?? true,
        autoDeprovisionDelay: body.autoDeprovisionDelay ?? 0,
        authMethod: body.authMethod ?? 'pap',
        allowMacAuth: body.allowMacAuth ?? false,
        accountingSyncInterval: body.accountingSyncInterval ?? 5,
        maxConcurrentSessions: body.maxConcurrentSessions ?? 3,
        sessionTimeoutPolicy: body.sessionTimeoutPolicy ?? 'hard',
        portalEnabled: body.portalEnabled ?? true,
        portalTitle: body.portalTitle ?? null,
        portalLogo: body.portalLogo ?? null,
        portalBrandColor: body.portalBrandColor ?? '#0d9488',
        voucherPortalUrl: body.voucherPortalUrl ?? null,
        usernameFormat: body.usernameFormat ?? 'room_random',
        usernamePrefix: body.usernamePrefix ?? null,
        usernameCase: body.usernameCase ?? 'lowercase',
        usernameMinLength: body.usernameMinLength ?? 4,
        usernameMaxLength: body.usernameMaxLength ?? 32,
        passwordFormat: body.passwordFormat ?? 'random_alphanumeric',
        passwordFixedValue: body.passwordFixedValue ?? null,
        passwordLength: body.passwordLength ?? 8,
        passwordIncludeUppercase: body.passwordIncludeUppercase ?? true,
        passwordIncludeNumbers: body.passwordIncludeNumbers ?? true,
        passwordIncludeSymbols: body.passwordIncludeSymbols ?? false,
        credentialSeparator: body.credentialSeparator ?? '_',
        credentialPrintOnVoucher: body.credentialPrintOnVoucher ?? true,
        credentialShowInPortal: body.credentialShowInPortal ?? true,
        duplicateUsernameAction: body.duplicateUsernameAction ?? 'append_random',
      },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('Error updating AAA config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update AAA config' } },
      { status: 500 }
    );
  }
}
