/**
 * Shared number generation utilities for folios and invoices.
 *
 * M-20/M-21: Consolidated from multiple files that had duplicate implementations.
 * All generateFolioNumber and generateInvoiceNumber calls should use these
 * shared functions to ensure consistent formatting and collision safety.
 */

import crypto from 'crypto';

/**
 * Generate a unique folio number.
 * Format: FOL-{timestamp36}-{random_hex}
 *
 * @param prefix - Optional prefix override (e.g., 'WIFI' for FOL-WIFI-...)
 */
export function generateFolioNumber(prefix?: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  if (prefix) {
    return `FOL-${prefix}-${timestamp}-${random}`;
  }
  return `FOL-${timestamp}-${random}`;
}

/**
 * Generate a unique invoice number with UUID prefix for collision safety.
 * Format: INV-{YYMM}-{uuid8}-{random4}
 *
 * @param accountType - Optional account type suffix (used by auto-invoice)
 */
export function generateInvoiceNumber(accountType?: string): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const uuid = crypto.randomUUID().slice(0, 8);
  const random = crypto.randomBytes(2).toString('hex').slice(0, 4);
  if (accountType) {
    return `INV-${accountType}-${uuid}${random}`;
  }
  return `INV-${year}${month}-${uuid}${random}`;
}
