import { requirePlatformAdmin } from "@/lib/auth/tenant-context";
import {
  getServerFingerprint,
  getFingerprintDebugInfo,
  resetFingerprintCache,
} from "@/lib/license/server-fingerprint";
import {
  getHostingMode,
  getHostingModeDescription,
  getFingerprintPolicy,
  isSaasMode,
  isOnPremiseMode,
} from "@/lib/license/hosting-config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Auth check — if requirePlatformAdmin returns a response, auth failed
    const authResponse = requirePlatformAdmin(request);
    if (authResponse) return authResponse;

    const fingerprint = getServerFingerprint();
    const signals = getFingerprintDebugInfo();

    const hostingMode = getHostingMode();
    const hostingModeDescription = getHostingModeDescription();
    const fingerprintPolicy = getFingerprintPolicy();

    const fingerprintMasked = `${fingerprint.slice(0, 8)}...${fingerprint.slice(-4)}`;

    return NextResponse.json({
      success: true,
      data: {
        fingerprint,
        fingerprintMasked,
        hostingMode,
        hostingModeDescription,
        fingerprintPolicy,
        signals: {
          hostname: signals.hostname,
          platform: signals.platform,
          arch: signals.arch,
          cpuModel: signals.cpuModel,
          cpuCount: signals.cpuCount,
          totalMemoryBytes: signals.totalMemoryBytes,
          totalMemoryGB: Number(
            (signals.totalMemoryBytes / 1024 / 1024 / 1024).toFixed(2)
          ),
          macAddresses: signals.macAddresses,
        },
        algorithm: "SHA-256",
        inputFormula:
          "cpu_model|cpu_count|totalmem|hostname|mac1,mac2|platform-arch",
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
    // Auth check — if requirePlatformAdmin returns a response, auth failed
    const authResponse = requirePlatformAdmin(request);
    if (authResponse) return authResponse;

    resetFingerprintCache();
    const fingerprint = getServerFingerprint();
    const signals = getFingerprintDebugInfo();

    const hostingMode = getHostingMode();
    const hostingModeDescription = getHostingModeDescription();
    const fingerprintPolicy = getFingerprintPolicy();

    const fingerprintMasked = `${fingerprint.slice(0, 8)}...${fingerprint.slice(-4)}`;

    return NextResponse.json({
      success: true,
      data: {
        fingerprint,
        fingerprintMasked,
        hostingMode,
        hostingModeDescription,
        fingerprintPolicy,
        signals: {
          hostname: signals.hostname,
          platform: signals.platform,
          arch: signals.arch,
          cpuModel: signals.cpuModel,
          cpuCount: signals.cpuCount,
          totalMemoryBytes: signals.totalMemoryBytes,
          totalMemoryGB: Number(
            (signals.totalMemoryBytes / 1024 / 1024 / 1024).toFixed(2)
          ),
          macAddresses: signals.macAddresses,
        },
        algorithm: "SHA-256",
        inputFormula:
          "cpu_model|cpu_count|totalmem|hostname|mac1,mac2|platform-arch",
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
