/**
 * PMS API Integration Test - Setup & Helpers
 *
 * Provides authentication, HTTP helpers, shared state, and test utilities
 * for running real API integration tests against localhost:3000.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// ─────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────

export const BASE_URL = 'http://localhost:3000';

// Default credentials (should match your seed data or admin user)
const DEFAULT_EMAIL = 'admin@royalstay.in';
const DEFAULT_PASSWORD = 'admin123';

// ─────────────────────────────────────────────────────────────────────
// Shared State — persisted to disk so sequential test files can share IDs
// ─────────────────────────────────────────────────────────────────────

export interface TestState {
  sessionCookie: string;
  tenantId: string;
  userId: string;
  propertyId?: string;
  propertySlug?: string;
  roomType1Id?: string;
  roomType2Id?: string;
  room1Id?: string;
  room2Id?: string;
  room3Id?: string;
  room4Id?: string;
  room5Id?: string;
  ratePlanBarId?: string;
  ratePlanCorpId?: string;
  ratePlanOtaId?: string;
  guestId?: string;
  bookingId?: string;
  confirmationCode?: string;
  folioId?: string;
  inventoryLockId?: string;
  maintenanceBlockId?: string;
  floorPlan1Id?: string;
  floorPlan2Id?: string;
  packageId?: string;
  roomTypeChangeId?: string;
  priceOverrideIds?: string[];
  createdAt: string;
}

const STATE_DIR = join(dirname(new URL(import.meta.url).pathname));
const STATE_FILE = join(STATE_DIR, '.test-state.json');

export function loadState(): TestState {
  if (existsSync(STATE_FILE)) {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    return raw as TestState;
  }
  throw new Error(
    'Test state not found. Run setup.ts authentication first or ensure tests run sequentially.'
  );
}

export function saveState(state: Partial<TestState>): TestState {
  const existing = existsSync(STATE_FILE)
    ? (JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as TestState)
    : ({} as TestState);
  const merged = { ...existing, ...state };
  writeFileSync(STATE_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

export function clearState(currentAuth?: { sessionCookie: string; tenantId: string; userId: string; createdAt: string }): void {
  if (existsSync(STATE_FILE)) {
    // Use currentAuth if provided (fresh login), otherwise keep existing auth
    const existing = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as TestState;
    const authOnly = {
      sessionCookie: currentAuth?.sessionCookie || existing.sessionCookie,
      tenantId: currentAuth?.tenantId || existing.tenantId,
      userId: currentAuth?.userId || existing.userId,
      createdAt: currentAuth?.createdAt || existing.createdAt,
    };
    writeFileSync(STATE_FILE, JSON.stringify(authOnly, null, 2), 'utf-8');
  }
}

// ─────────────────────────────────────────────────────────────────────
// Test Logging
// ─────────────────────────────────────────────────────────────────────

let testSuiteName = '';
let testCount = 0;
let passCount = 0;
let failCount = 0;

export function setTestSuite(name: string) {
  testSuiteName = name;
  testCount = 0;
  passCount = 0;
  failCount = 0;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  TEST SUITE: ${name}`);
  console.log(`${'='.repeat(70)}`);
}

export function test(name: string, fn: () => Promise<void>) {
  testCount++;
  const id = String(testCount).padStart(2, '0');
  const prefix = `[${testSuiteName}::${id}]`;
  process.stdout.write(`  ${prefix} ${name} ... `);

  const start = Date.now();
  fn()
    .then(() => {
      passCount++;
      const ms = Date.now() - start;
      console.log(`✅ PASS (${ms}ms)`);
    })
    .catch((err) => {
      failCount++;
      const ms = Date.now() - start;
      console.log(`❌ FAIL (${ms}ms)`);
      console.log(`      Error: ${err.message}`);
      if (err.response) {
        console.log(`      Response: ${JSON.stringify(err.response).slice(0, 300)}`);
      }
    });
}

export function printSuiteSummary() {
  console.log(`\n  Results: ${passCount}/${testCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.log(`  ⚠️  ${failCount} test(s) FAILED`);
  }
  console.log(`${'='.repeat(70)}\n`);
}

export async function waitForTests() {
  // Give time for async test() calls to complete
  // In practice, we use a different approach — see runSequentially below
}

// ─────────────────────────────────────────────────────────────────────
// Sequential Test Runner
// ─────────────────────────────────────────────────────────────────────

export type TestCase = {
  name: string;
  fn: () => Promise<void>;
};

export async function runSequentially(suiteName: string, tests: TestCase[]) {
  setTestSuite(suiteName);
  for (const t of tests) {
    testCount++;
    const id = String(testCount).padStart(2, '0');
    const prefix = `[${suiteName}::${id}]`;
    process.stdout.write(`  ${prefix} ${t.name} ... `);
    const start = Date.now();
    try {
      await t.fn();
      passCount++;
      const ms = Date.now() - start;
      console.log(`✅ PASS (${ms}ms)`);
    } catch (err: any) {
      failCount++;
      const ms = Date.now() - start;
      console.log(`❌ FAIL (${ms}ms)`);
      console.log(`      Error: ${err.message}`);
      if (err.response) {
        console.log(`      Response: ${JSON.stringify(err.response).slice(0, 500)}`);
      }
      // For critical tests, stop on first failure
      if (err.fatal) {
        console.log('\n  ⛔ Stopping on critical failure.');
        break;
      }
    }
  }
  printSuiteSummary();
  if (failCount > 0) {
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────
// HTTP Helpers
// ─────────────────────────────────────────────────────────────────────

class ApiError extends Error {
  status: number;
  response: any;
  constructor(status: number, response: any) {
    const msg =
      response?.error?.message ||
      response?.error?.code ||
      (typeof response === 'string' ? response : JSON.stringify(response).slice(0, 200));
    super(msg);
    this.status = status;
    this.response = response;
    this.name = 'ApiError';
  }
}

export { ApiError };

async function request(
  method: string,
  path: string,
  body?: any,
  cookie?: string
): Promise<{ data: any; status: number; headers: Headers }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return { data, status: res.status, headers: res.headers };
}

export const api = {
  get: (path: string, cookie?: string) => request('GET', path, undefined, cookie),
  post: (path: string, body: any, cookie?: string) => request('POST', path, body, cookie),
  put: (path: string, body: any, cookie?: string) => request('PUT', path, body, cookie),
  patch: (path: string, body: any, cookie?: string) => request('PATCH', path, body, cookie),
  del: (path: string, cookie?: string) => request('DELETE', path, undefined, cookie),
};

// ─────────────────────────────────────────────────────────────────────
// Assertions
// ─────────────────────────────────────────────────────────────────────

export function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function assertEqual<T>(actual: T, expected: T, label?: string) {
  if (actual !== expected) {
    const prefix = label ? `${label}: ` : '';
    throw new Error(`${prefix}Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

export function assertIncludes(actual: string, substring: string, label?: string) {
  const prefix = label ? `${label}: ` : '';
  if (!actual.includes(substring)) {
    throw new Error(`${prefix}Expected string to include "${substring}" but got "${actual}"`);
  }
}

export function assertMatch(actual: string, pattern: RegExp, label?: string) {
  const prefix = label ? `${label}: ` : '';
  if (!pattern.test(actual)) {
    throw new Error(`${prefix}Expected string to match ${pattern} but got "${actual}"`);
  }
}

export function assertNotNull<T>(value: T | null | undefined, label?: string) {
  const prefix = label ? `${label}: ` : '';
  if (value === null || value === undefined) {
    throw new Error(`${prefix}Expected non-null value but got ${value}`);
  }
}

export function assertGt(actual: number, threshold: number, label?: string) {
  const prefix = label ? `${label}: ` : '';
  if (actual <= threshold) {
    throw new Error(`${prefix}Expected ${actual} to be greater than ${threshold}`);
  }
}

export function assertLt(actual: number, threshold: number, label?: string) {
  const prefix = label ? `${label}: ` : '';
  if (actual >= threshold) {
    throw new Error(`${prefix}Expected ${actual} to be less than ${threshold}`);
  }
}

export function assertStatus(response: { data: any; status: number }, expectedStatus: number, label?: string) {
  const prefix = label ? `${label}: ` : '';
  if (response.status !== expectedStatus) {
    throw new Error(
      `${prefix}Expected status ${expectedStatus} but got ${response.status} — ${JSON.stringify(response.data).slice(0, 200)}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────────────

export async function authenticate(email?: string, password?: string): Promise<TestState> {
  const loginEmail = email || DEFAULT_EMAIL;
  const loginPassword = password || DEFAULT_PASSWORD;

  console.log(`  Authenticating as ${loginEmail}...`);

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      `Login failed (${res.status}): ${errBody?.error || JSON.stringify(errBody).slice(0, 300)}`
    );
  }

  // Extract session cookie
  const setCookieHeader = res.headers.get('set-cookie') || '';
  const sessionMatch = setCookieHeader.match(/session_token=([^;]+)/);
  if (!sessionMatch) {
    throw new Error('No session_token cookie returned from login');
  }

  const sessionCookie = `session_token=${sessionMatch[1]}`;
  const body = await res.json();

  if (!body.success || !body.user) {
    throw new Error('Login response missing user data');
  }

  const state = saveState({
    sessionCookie,
    tenantId: body.user.tenantId,
    userId: body.user.id,
    createdAt: new Date().toISOString(),
  });

  console.log(`  ✅ Authenticated as ${body.user.name} (tenant: ${body.user.tenant?.name})`);
  return state;
}

export function cookie(state?: TestState): string {
  const s = state || loadState();
  return s.sessionCookie;
}

// ─────────────────────────────────────────────────────────────────────
// Date Helpers
// ─────────────────────────────────────────────────────────────────────

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatISO(date: Date): string {
  return date.toISOString();
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function tomorrow(): Date {
  return addDays(today(), 1);
}

export function futureDate(days: number): Date {
  return addDays(today(), days);
}

// ─────────────────────────────────────────────────────────────────────
// Cleanup Helpers
// ─────────────────────────────────────────────────────────────────────

export async function deleteTestProperty(state: TestState) {
  if (state.propertyId) {
    try {
      await api.del(`/api/properties/${state.propertyId}`, cookie(state));
    } catch {
      // Ignore errors during cleanup
    }
  }
}

export async function deleteTestBooking(state: TestState) {
  if (state.bookingId) {
    try {
      await api.put(
        `/api/bookings/${state.bookingId}`,
        { status: 'cancelled', cancelledAt: new Date().toISOString(), cancellationReason: 'test cleanup' },
        cookie(state)
      );
    } catch {
      // Ignore errors during cleanup
    }
  }
}
