import { requirePlatformAdmin } from "@/lib/auth/tenant-context";
import {
  getServerFingerprint,
  getFingerprintDebugInfo,
  resetFingerprintCache,
  FINGERPRINT_PREFIX,
} from "@/lib/license/server-fingerprint";
import {
  getHostingMode,
  getHostingModeDescription,
  getFingerprintPolicy,
} from "@/lib/license/hosting-config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authResponse = requirePlatformAdmin(request);
    if (authResponse) return authResponse;

    const fingerprint = getServerFingerprint();
    const signals = getFingerprintDebugInfo();
    const hostingMode = getHostingMode();
    const hostingModeDescription = getHostingModeDescription();
    const fingerprintPolicy = getFingerprintPolicy();

    // Mask the hash part only (after CRY- prefix)
    const hashPart = fingerprint.replace(`${FINGERPRINT_PREFIX}-`, '');
    const fingerprintMasked = `${FINGERPRINT_PREFIX}-${hashPart.slice(0, 8)}${'*'.repeat(28)}${hashPart.slice(-4)}`;

    return NextResponse.json({
      success: true,
      data: {
        fingerprint,
        fingerprintMasked,
        hostingMode,
        hostingModeDescription,
        fingerprintPolicy,
        signals,
      },
    });
  } catch (error) {
    console.error("[fingerprint] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResponse = requirePlatformAdmin(request);
    if (authResponse) return authResponse;

    resetFingerprintCache();
    const fingerprint = getServerFingerprint();
    const signals = getFingerprintDebugInfo();
    const hostingMode = getHostingMode();
    const hostingModeDescription = getHostingModeDescription();
    const fingerprintPolicy = getFingerprintPolicy();

    const hashPart = fingerprint.replace(`${FINGERPRINT_PREFIX}-`, '');
    const fingerprintMasked = `${FINGERPRINT_PREFIX}-${hashPart.slice(0, 8)}${'*'.repeat(28)}${hashPart.slice(-4)}`;

    return NextResponse.json({
      success: true,
      data: {
        fingerprint,
        fingerprintMasked,
        hostingMode,
        hostingModeDescription,
        fingerprintPolicy,
        signals,
        refreshed: true,
      },
    });
  } catch (error) {
    console.error("[fingerprint] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
