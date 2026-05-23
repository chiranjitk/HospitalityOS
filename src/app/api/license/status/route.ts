import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getLicenseStatus } from '@/lib/license/license-manager';
import { getHostingMode, getHostingModeDescription, getFingerprintPolicy } from '@/lib/license/hosting-config';
import { getServerFingerprint } from '@/lib/license/server-fingerprint';

// GET /api/license/status — returns current license status for the authenticated tenant
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const licenseStatus = await getLicenseStatus(tenantId);

    // Add hosting mode context
    const hostingMode = getHostingMode();
    const policy = getFingerprintPolicy();

    return NextResponse.json({
      success: true,
      data: {
        ...licenseStatus,
        hostingMode: {
          mode: hostingMode,
          description: getHostingModeDescription(),
          fingerprintPolicy: policy,
          serverFingerprint: getServerFingerprint().slice(0, 12) + '...',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching license status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch license status' },
      { status: 500 }
    );
  }
}
