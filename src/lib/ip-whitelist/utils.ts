/**
 * IP Whitelist Utility Functions
 *
 * Pure utility functions for IPv4 address validation, CIDR matching,
 * and client IP extraction. Uses only Node.js built-ins.
 */

import { NextRequest } from 'next/server';

/**
 * Convert a dotted-decimal IPv4 address to a 32-bit unsigned integer.
 * e.g. "192.168.1.100" → 3232235876
 */
export function parseIpToInt(ip: string): number {
  const parts = ip.trim().split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255 || !Number.isInteger(p))) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Validate a single IPv4 address.
 * e.g. "192.168.1.1" → true
 */
export function isValidIp(ip: string): boolean {
  if (typeof ip !== 'string' || ip.trim().length === 0) return false;
  return parseIpToInt(ip) !== -1;
}

/**
 * Validate CIDR notation.
 * e.g. "192.168.1.0/24" → true, "10.0.0.0/0" → true, "256.1.1.0/24" → false
 */
export function isValidCidr(cidr: string): boolean {
  if (typeof cidr !== 'string') return false;

  const slashIndex = cidr.indexOf('/');
  if (slashIndex === -1) return false;

  const ipPart = cidr.substring(0, slashIndex).trim();
  const prefixPart = cidr.substring(slashIndex + 1).trim();

  if (!isValidIp(ipPart)) return false;

  const prefix = parseInt(prefixPart, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32 || !Number.isInteger(prefix)) return false;

  return true;
}

/**
 * Validate either a single IPv4 address or a CIDR range.
 * e.g. "10.0.0.5" → true, "192.168.1.0/24" → true, "foo" → false
 */
export function isValidIpOrCidr(input: string): boolean {
  if (typeof input !== 'string' || input.trim().length === 0) return false;
  return isValidIp(input) || isValidCidr(input);
}

/**
 * Check if a single IPv4 address falls within a CIDR range.
 * e.g. isIpInCidr("192.168.1.50", "192.168.1.0/24") → true
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  if (!isValidIp(ip) || !isValidCidr(cidr)) return false;

  const slashIndex = cidr.indexOf('/');
  const networkIp = cidr.substring(0, slashIndex).trim();
  const prefixLength = parseInt(cidr.substring(slashIndex + 1).trim(), 10);

  const ipInt = parseIpToInt(ip);
  const netInt = parseIpToInt(networkIp);

  if (ipInt === -1 || netInt === -1) return false;

  if (prefixLength === 0) return true;
  if (prefixLength === 32) return ipInt === netInt;

  // Create a mask with `prefixLength` leading 1-bits
  const mask = prefixLength === 0
    ? 0
    : (~0 << (32 - prefixLength)) >>> 0;

  return (ipInt & mask) === (netInt & mask);
}

/**
 * Check if a given IP matches a rule entry (which can be a single IP or CIDR).
 */
export function isIpMatch(ip: string, ruleAddress: string): boolean {
  if (ruleAddress.includes('/')) {
    return isIpInCidr(ip, ruleAddress);
  }
  return ip.trim() === ruleAddress.trim();
}

/**
 * Extract the client IP address from a NextRequest.
 * Checks (in order): x-forwarded-for, x-real-ip, then falls back to 127.0.0.1.
 */
export function getClientIp(request: NextRequest): string {
  // Check x-forwarded-for first (comma-separated, leftmost is original client)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp && isValidIp(firstIp)) {
      return firstIp;
    }
  }

  // Check x-real-ip
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    const trimmed = realIp.trim();
    if (isValidIp(trimmed)) {
      return trimmed;
    }
  }

  // Fallback
  return '127.0.0.1';
}
