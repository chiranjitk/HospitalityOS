/**
 * StaySuite-HospitalityOS — Hardware Abstraction Layer (HAL)
 * Audit logger — persists every hardware adapter operation to
 * `HardwareOperationLog` via Prisma.
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Credential sanitisation
// ---------------------------------------------------------------------------

const CREDENTIAL_KEY_PATTERN = /secret|token|password|key|credential/i;

/**
 * Walks a JSON-stringified object (or any string) and redacts values whose
 * keys match the credential pattern.  Returns the sanitised string or `null`
 * when the input is falsy.
 */
function sanitizeCredentials(jsonStr: string | null | undefined): string | null {
  if (!jsonStr) return null;

  try {
    const parsed: unknown = JSON.parse(jsonStr);

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const cleaned: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        if (CREDENTIAL_KEY_PATTERN.test(key)) {
          cleaned[key] = '***REDACTED***';
        } else if (typeof value === 'object' && value !== null) {
          // Recursively sanitise nested objects
          cleaned[key] = JSON.parse(sanitizeCredentials(JSON.stringify(value)) || 'null');
        } else {
          cleaned[key] = value;
        }
      }

      return JSON.stringify(cleaned);
    }

    // Not a JSON object — return as-is (nothing to sanitise)
    return jsonStr;
  } catch {
    // Not valid JSON — return as-is
    return jsonStr;
  }
}

// ---------------------------------------------------------------------------
// logHardwareOperation
// ---------------------------------------------------------------------------

export interface LogOperationParams {
  propertyId: string;
  tenantId: string;
  adapterId?: string;
  providerId: string;
  category: string; // "lock" | "terminal"
  operation: string;
  targetId?: string;
  vendorTargetId?: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  initiatedBy?: string;
  requestJson?: string;
  responseJson?: string;
  durationMs?: number;
  correlationId?: string;
}

/**
 * Write a single hardware operation audit record.
 *
 * Credentials are automatically redacted from `requestJson` before persisting.
 */
export async function logHardwareOperation(
  params: LogOperationParams,
): Promise<void> {
  const sanitizedRequest = sanitizeCredentials(params.requestJson);

  await db.hardwareOperationLog.create({
    data: {
      tenantId: params.tenantId,
      propertyId: params.propertyId,
      adapterId: params.adapterId,
      providerId: params.providerId,
      category: params.category,
      operation: params.operation,
      targetId: params.targetId,
      vendorTargetId: params.vendorTargetId,
      success: params.success,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      initiatedBy: params.initiatedBy,
      requestJson: sanitizedRequest,
      responseJson: params.responseJson,
      durationMs: params.durationMs,
      correlationId: params.correlationId,
    },
  });
}
