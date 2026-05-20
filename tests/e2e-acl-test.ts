/**
 * E2E ACL Test Suite — StaySuite HospitalityOS
 * Tests ALL user types against ALL key API endpoints for correct permission enforcement.
 * 
 * Run: DATABASE_URL="..." bunx tsx tests/e2e-acl-test.ts
 */
const BASE_URL = 'http://localhost:3000';

interface TestUser {
  email: string;
  password: string;
  label: string;
  isPlatformAdmin: boolean;
  tenantName: string;
  roleName: string;
}

interface TestCase {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  description: string;
  // Which user types should get 200 (others should get 401/403)
  allow: string[];   // user labels that should succeed
  deny: string[];    // user labels that should get 403
  denyAll?: boolean; // deny all non-authenticated (401 for no cookie)
}

const TEST_USERS: TestUser[] = [
  { email: 'platform@staysuite.com', password: 'admin123', label: 'platform_admin', isPlatformAdmin: true, tenantName: 'Royal Stay Hotels', roleName: 'admin' },
  { email: 'admin@royalstay.in', password: 'admin123', label: 'tenant_admin', isPlatformAdmin: false, tenantName: 'Royal Stay Hotels', roleName: 'admin' },
  { email: 'admin@oceanview.com', password: 'admin123', label: 'tenant2_admin', isPlatformAdmin: false, tenantName: 'Ocean View Resorts', roleName: 'admin' },
  { email: 'manager@oceanview.com', password: 'staff123', label: 'manager', isPlatformAdmin: false, tenantName: 'Ocean View Resorts', roleName: 'manager' },
  { email: 'frontdesk@royalstay.in', password: 'staff123', label: 'front_desk', isPlatformAdmin: false, tenantName: 'Royal Stay Hotels', roleName: 'front_desk' },
  { email: 'housekeeping@royalstay.in', password: 'staff123', label: 'housekeeping', isPlatformAdmin: false, tenantName: 'Royal Stay Hotels', roleName: 'housekeeping' },
];

// Key API endpoints to test with expected permission matrix
const TEST_CASES: TestCase[] = [
  // === DASHBOARD ===
  { method: 'GET', path: '/api/dashboard', description: 'Dashboard data', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin', 'manager'], deny: ['front_desk', 'housekeeping'] },
  
  // === BOOKINGS ===
  { method: 'GET', path: '/api/bookings', description: 'List bookings', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin', 'manager', 'front_desk'], deny: ['housekeeping'] },
  // Note: POST /api/bookings is a valid test but requires complex body - skip due to validation
  // { method: 'POST', path: '/api/bookings', description: 'Create booking', allow: [...], deny: [...] },
  
  // === GUESTS ===
  { method: 'GET', path: '/api/guests', description: 'List guests', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin', 'manager', 'front_desk'], deny: ['housekeeping'] },
  
  // === ROOMS ===
  { method: 'GET', path: '/api/rooms', description: 'List rooms', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin', 'manager', 'front_desk', 'housekeeping'], deny: [] },
  
  // === HOUSEKEEPING ===
  { method: 'GET', path: '/api/tasks', description: 'List tasks (housekeeping)', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin', 'manager', 'housekeeping'], deny: ['front_desk'] },
  
  // === BILLING ===
  { method: 'GET', path: '/api/folios', description: 'List folios', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin', 'manager', 'front_desk'], deny: ['housekeeping'] },
  
  // === USERS (staff-users / user management) ===
  { method: 'GET', path: '/api/users', description: 'List users (staff management)', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin'], deny: ['manager', 'front_desk', 'housekeeping'] },
  
  // === ROLES ===
  { method: 'GET', path: '/api/roles', description: 'List roles', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin'], deny: ['manager', 'front_desk', 'housekeeping'] },
  
  // === WIFI ===
  { method: 'GET', path: '/api/wifi/sessions', description: 'WiFi sessions', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin'], deny: ['manager', 'front_desk', 'housekeeping'] },
  
  // === PROPERTIES ===
  { method: 'GET', path: '/api/properties', description: 'List properties', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin'], deny: ['manager', 'front_desk', 'housekeeping'] },
  
  // === REPORTS (route at /api/analytics not /api/reports) ===
  // { method: 'GET', path: '/api/reports', description: 'Reports', allow: [...], deny: [...] },
  
  // === INVENTORY ===
  { method: 'GET', path: '/api/inventory/stock', description: 'Inventory stock', allow: ['platform_admin', 'tenant_admin', 'tenant2_admin', 'manager'], deny: ['front_desk', 'housekeeping'] },
  
  // === PLATFORM ADMIN (should be denied for all non-platform users) ===
  { method: 'GET', path: '/api/tenants', description: 'Tenant management (platform only)', allow: ['platform_admin'], deny: ['tenant_admin', 'tenant2_admin', 'manager', 'front_desk', 'housekeeping'] },
  
  // === SETTINGS (route may differ) ===
  // { method: 'GET', path: '/api/settings', description: 'Settings', allow: [...], deny: [...] },
];

interface TestResult {
  user: string;
  testCase: string;
  method: string;
  path: string;
  expected: 'allow' | 'deny';
  actualStatus: number;
  pass: boolean;
  details: string;
}

// Cache login sessions
const sessionCache = new Map<string, string>();

async function login(email: string, password: string): Promise<string> {
  const cacheKey = `${email}:${password}`;
  if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey)!;
  
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  
  const setCookie = res.headers.get('set-cookie') || '';
  const sessionMatch = setCookie.match(/session_token=([^;]+)/);
  const token = sessionMatch?.[1];
  
  if (token) {
    sessionCache.set(cacheKey, token);
  }
  
  return token || '';
}

async function runTest(user: TestUser, testCase: TestCase): Promise<TestResult> {
  const token = await login(user.email, user.password);
  const shouldAllow = testCase.allow.includes(user.label);
  const expectedStatus = shouldAllow ? [200, 201] : [401, 403];
  
  const headers: Record<string, string> = {};
  if (token) {
    headers['Cookie'] = `session_token=${token}`;
  }
  
  let status = 0;
  let details = '';
  
  try {
    const opts: RequestInit = {
      method: testCase.method,
      headers: { ...headers, 'Content-Type': 'application/json' },
    };
    
    if (testCase.body && testCase.method !== 'GET') {
      opts.body = JSON.stringify(testCase.body);
    }
    
    const res = await fetch(`${BASE_URL}${testCase.path}`, opts);
    status = res.status;
    
    // Read response for details
    try {
      const data = await res.json();
      details = data.error || data.message || JSON.stringify(data).substring(0, 80);
    } catch {
      details = res.statusText;
    }
  } catch (err: any) {
    status = 0;
    details = err.message || 'Network error';
  }
  
  const pass = expectedStatus.includes(status);
  
  return {
    user: user.label,
    testCase: testCase.description,
    method: testCase.method,
    path: testCase.path,
    expected: shouldAllow ? 'allow' : 'deny',
    actualStatus: status,
    pass,
    details,
  };
}

// Tenant isolation tests
async function testTenantIsolation(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Login as tenant2_admin and try to access tenant1 resources
  const token = await login('admin@oceanview.com', 'admin123');
  
  // Try to access tenant1 users
  const res = await fetch(`${BASE_URL}/api/users`, {
    headers: { 'Cookie': `session_token=${token}` },
  });
  
  const data = await res.json();
  const users = data.users || data.data || [];
  
  // All returned users should belong to Ocean View Resorts (tenant2)
  const hasTenant1User = users.some((u: any) => u.tenantId && u.tenant?.name === 'Royal Stay Hotels');
  
  results.push({
    user: 'tenant2_admin',
    testCase: 'Tenant isolation - cannot see tenant1 users',
    method: 'GET',
    path: '/api/users',
    expected: 'deny',
    actualStatus: hasTenant1User ? 403 : 200,
    pass: !hasTenant1User,
    details: hasTenant1User ? 'LEAK: tenant2 admin can see tenant1 users!' : 'Correctly scoped to own tenant',
  });
  
  // Platform admin should see users from both tenants
  const platToken = await login('platform@staysuite.com', 'admin123');
  const platRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { 'Cookie': `session_token=${platToken}` },
  });
  const platData = await platRes.json();
  const platUsers = platData.users || platData.data || [];
  const hasTenant1 = platUsers.some((u: any) => u.tenant?.name === 'Royal Stay Hotels');
  const hasTenant2 = platUsers.some((u: any) => u.tenant?.name === 'Ocean View Resorts');
  
  results.push({
    user: 'platform_admin',
    testCase: 'Platform admin sees all tenants',
    method: 'GET',
    path: '/api/users',
    expected: 'allow',
    actualStatus: (hasTenant1 && hasTenant2) ? 200 : 403,
    pass: hasTenant1 && hasTenant2,
    details: `Tenant1: ${hasTenant1}, Tenant2: ${hasTenant2} (expected both)`,
  });
  
  // Platform admin user should NOT appear in tenant admin's user list
  const tenant1Token = await login('admin@royalstay.in', 'admin123');
  const tenant1Res = await fetch(`${BASE_URL}/api/users`, {
    headers: { 'Cookie': `session_token=${tenant1Token}` },
  });
  const tenant1Data = await tenant1Res.json();
  const tenant1Users = tenant1Data.users || tenant1Data.data || [];
  const hasPlatformAdminUser = tenant1Users.some((u: any) => u.isPlatformAdmin === true);
  
  results.push({
    user: 'tenant_admin',
    testCase: 'Platform admin hidden from tenant user list',
    method: 'GET',
    path: '/api/users',
    expected: 'deny',
    actualStatus: hasPlatformAdminUser ? 403 : 200,
    pass: !hasPlatformAdminUser,
    details: hasPlatformAdminUser ? 'LEAK: Platform admin user visible to tenant admin!' : 'Platform admin correctly hidden',
  });
  
  return results;
}

// Unauthenticated access test
async function testUnauthenticated(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  const protectedEndpoints = [
    '/api/users', '/api/bookings', '/api/roles', '/api/dashboard', '/api/guests',
    '/api/rooms', '/api/properties', '/api/folios', '/api/wifi/sessions',
    '/api/tenants', '/api/tasks', '/api/reports',
  ];
  
  for (const path of protectedEndpoints) {
    const res = await fetch(`${BASE_URL}${path}`);
    const pass = res.status === 401;
    results.push({
      user: 'unauthenticated',
      testCase: `No auth → ${path}`,
      method: 'GET',
      path,
      expected: 'deny',
      actualStatus: res.status,
      pass,
      details: pass ? 'Correctly returns 401' : `Expected 401, got ${res.status}`,
    });
  }
  
  return results;
}

async function main() {
  console.log('═'.repeat(80));
  console.log('  StaySuite HospitalityOS — E2E ACL Test Suite');
  console.log('═'.repeat(80));
  console.log();
  
  let totalPassed = 0;
  let totalFailed = 0;
  const allResults: TestResult[] = [];
  
  // Phase 1: Unauthenticated access tests
  console.log('📋 Phase 1: Unauthenticated Access Tests');
  console.log('─'.repeat(60));
  const unauthResults = await testUnauthenticated();
  for (const r of unauthResults) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`  ${icon} ${r.testCase} → ${r.actualStatus} (${r.details})`);
    if (r.pass) totalPassed++; else totalFailed++;
    allResults.push(r);
  }
  console.log();
  
  // Phase 2: Per-user ACL tests
  console.log('📋 Phase 2: Role-Based Access Control Tests');
  console.log('─'.repeat(60));
  
  for (const user of TEST_USERS) {
    console.log(`\n  🔐 User: ${user.label} (${user.email}) [${user.roleName}]`);
    console.log(`     Tenant: ${user.tenantName} | Platform Admin: ${user.isPlatformAdmin}`);
    
    for (const testCase of TEST_CASES) {
      const result = await runTest(user, testCase);
      const icon = result.pass ? '✅' : '❌';
      const expectedLabel = result.expected === 'allow' ? 'ALLOW' : 'DENY';
      const actualLabel = result.actualStatus < 400 ? 'ALLOWED' : 'BLOCKED';
      console.log(`    ${icon} ${result.method} ${result.path} → ${result.actualStatus} (expected ${expectedLabel}, got ${actualLabel})`);
      if (!result.pass && result.actualStatus !== 0) {
        console.log(`       └─ ${result.details}`);
      }
      if (result.pass) totalPassed++; else totalFailed++;
      allResults.push(result);
    }
  }
  
  // Phase 3: Tenant isolation tests
  console.log('\n📋 Phase 3: Tenant Isolation Tests');
  console.log('─'.repeat(60));
  const isolationResults = await testTenantIsolation();
  for (const r of isolationResults) {
    const icon = r.pass ? '✅' : '🚨';
    console.log(`  ${icon} [${r.user}] ${r.testCase}`);
    console.log(`     └─ ${r.details}`);
    if (r.pass) totalPassed++; else totalFailed++;
    allResults.push(r);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('  TEST RESULTS SUMMARY');
  console.log('═'.repeat(80));
  console.log(`  Total Tests:  ${allResults.length}`);
  console.log(`  ✅ Passed:    ${totalPassed}`);
  console.log(`  ❌ Failed:    ${totalFailed}`);
  console.log(`  Pass Rate:   ${((totalPassed / allResults.length) * 100).toFixed(1)}%`);
  
  if (totalFailed > 0) {
    console.log('\n  🚨 FAILURES:');
    const failures = allResults.filter(r => !r.pass);
    for (const f of failures) {
      console.log(`    ❌ [${f.user}] ${f.method} ${f.path} → ${f.actualStatus} (expected ${f.expected})`);
      console.log(`       └─ ${f.details}`);
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  
  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
