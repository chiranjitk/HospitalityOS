/**
 * Standalone E2E LDAP integration test for StaySuite-HospitalityOS
 * Tests the same LDAP operations the StaySuite API uses (ldapjs)
 */
import ldapjs from 'ldapjs';

const LDAP_URL = 'ldap://localhost:1389';
const BASE_DN = 'dc=staysuite,dc=local';
const ADMIN_DN = 'cn=admin,dc=staysuite,dc=local';
const ADMIN_PW = 'Admin123';
const TIMEOUT = 10;

const results = [];

function log(phase, passed, message, details = null) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  results.push({ phase, passed, message, details });
  console.log(`${status} [${phase}] ${message}`);
  if (details) console.log(`   Details: ${JSON.stringify(details)}`);
}

async function testConnection() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 1: LDAP Server Connection & Admin Bind');
  console.log('═══════════════════════════════════════════');

  let client;
  const startMs = Date.now();
  try {
    client = ldapjs.createClient({
      url: LDAP_URL,
      connectTimeout: TIMEOUT * 1000,
      timeout: TIMEOUT * 1000,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Connection timeout after ${TIMEOUT}s`)), TIMEOUT * 1000);

      client!.on('connectError', (err) => { clearTimeout(timer); reject(err); });
      client!.on('error', (err) => { clearTimeout(timer); reject(err); });
      client!.on('connect', () => {
        client!.bind(ADMIN_DN, ADMIN_PW, (bindErr) => {
          clearTimeout(timer);
          if (bindErr) reject(new Error(`Bind failed: ${bindErr.message}`));
          else resolve();
        });
      });
    });

    const latencyMs = Date.now() - startMs;
    log('Connection', true, `Connected and bound successfully in ${latencyMs}ms`, { latencyMs, url: LDAP_URL });
    return { client, latencyMs };
  } catch (err) {
    log('Connection', false, `Connection/bind failed: ${err.message}`);
    throw err;
  }
}

async function testSearch(client) {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 2: LDAP Search — inetOrgPerson');
  console.log('═══════════════════════════════════════════');

  const filter = '(objectClass=inetOrgPerson)';
  const entries = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Search timeout')), TIMEOUT * 1000);

      client.search(BASE_DN, { filter, scope: 'sub', attributes: ['*'], sizeLimit: 50 }, (err, res) => {
        if (err) { clearTimeout(timer); reject(err); return; }
        res.on('searchEntry', (entry) => entries.push(entry));
        res.on('error', (err) => { clearTimeout(timer); reject(err); });
        res.on('end', () => { clearTimeout(timer); resolve(); });
      });
    });

    log('Search', true, `Found ${entries.length} inetOrgPerson entries`, {
      filter,
      userCount: entries.length,
      dns: entries.map(e => e.dn.toString())
    });
    return entries;
  } catch (err) {
    log('Search', false, `Search failed: ${err.message}`);
    return [];
  }
}

async function testUserSearch(client, searchTerm) {
  console.log('\n═══════════════════════════════════════════');
  console.log(`TEST 3: User Search — searchTerm="${searchTerm}"`);
  console.log('═══════════════════════════════════════════');

  // This matches the filter used in the StaySuite API search-users action
  const safeTerm = searchTerm.replace(/[()\\]/g, '\\$&');
  const filter = `(|(cn=*${safeTerm}*)(mail=*${safeTerm}*)(sAMAccountName=*${safeTerm}*)(userPrincipalName=*${safeTerm}*)(displayName=*${safeTerm}*))`;
  const entries = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Search timeout')), TIMEOUT * 1000);

      client.search(BASE_DN, {
        filter,
        scope: 'sub',
        attributes: ['dn', 'cn', 'sn', 'givenName', 'displayName', 'mail', 'sAMAccountName', 'userPrincipalName', 'memberOf', 'department', 'title', 'telephoneNumber', 'objectClass'],
        sizeLimit: 50,
      }, (err, res) => {
        if (err) { clearTimeout(timer); reject(err); return; }
        res.on('searchEntry', (entry) => entries.push(entry));
        res.on('error', (err) => { clearTimeout(timer); reject(err); });
        res.on('end', () => { clearTimeout(timer); resolve(); });
      });
    });

    const users = entries.map(entry => {
      const attrs = {};
      for (const attr of entry.attributes) {
        const vals = attr.vals.map(v => v.toString('utf8'));
        attrs[attr.type] = vals.length === 1 ? vals[0] : vals;
      }
      return { dn: entry.dn.toString(), ...attrs };
    });

    log('User Search', true, `Found ${users.length} user(s) matching "${searchTerm}"`, { filter, users });
    return users;
  } catch (err) {
    log('User Search', false, `User search failed: ${err.message}`);
    return [];
  }
}

async function testUserBind(dn, password) {
  console.log('\n═══════════════════════════════════════════');
  console.log(`TEST 4: User Bind Authentication — ${dn}`);
  console.log('═══════════════════════════════════════════');

  let userClient;
  try {
    userClient = ldapjs.createClient({
      url: LDAP_URL,
      connectTimeout: TIMEOUT * 1000,
      timeout: TIMEOUT * 1000,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Bind timeout')), TIMEOUT * 1000);
      userClient.bind(dn, password, (err) => {
        clearTimeout(timer);
        if (err) reject(new Error(`Bind failed: ${err.message}`));
        else resolve();
      });
    });

    log('User Bind', true, `User authenticated successfully`, { dn });
    return true;
  } catch (err) {
    log('User Bind', false, `User authentication failed: ${err.message}`, { dn });
    return false;
  } finally {
    if (userClient) {
      try { await new Promise<void>((r) => userClient.unbind(() => r())); } catch {}
      try { userClient.destroy(); } catch {}
    }
  }
}

async function testNegativeBind() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 5: Negative Bind (wrong password)');
  console.log('═══════════════════════════════════════════');

  let userClient;
  try {
    userClient = ldapjs.createClient({
      url: LDAP_URL,
      connectTimeout: TIMEOUT * 1000,
      timeout: TIMEOUT * 1000,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Bind timeout')), TIMEOUT * 1000);
      userClient.bind('cn=John Doe,ou=People,dc=staysuite,dc=local', 'WrongPassword', (err) => {
        clearTimeout(timer);
        if (err) resolve(); // Expected to fail
        else reject(new Error('Bind should have failed with wrong password!'));
      });
    });

    log('Negative Bind', true, 'Correctly rejected wrong password');
  } catch (err) {
    log('Negative Bind', false, err.message);
  } finally {
    if (userClient) {
      try { await new Promise<void>((r) => userClient.unbind(() => r())); } catch {}
      try { userClient.destroy(); } catch {}
    }
  }
}

async function testGroupSearch(client) {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 6: Group Search');
  console.log('═══════════════════════════════════════════');

  const filter = '(objectClass=groupOfNames)';
  const entries = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Search timeout')), TIMEOUT * 1000);

      client.search('ou=Groups,dc=staysuite,dc=local', {
        filter,
        scope: 'sub',
        attributes: ['dn', 'cn', 'member'],
        sizeLimit: 50,
      }, (err, res) => {
        if (err) { clearTimeout(timer); reject(err); return; }
        res.on('searchEntry', (entry) => entries.push(entry));
        res.on('error', (err) => { clearTimeout(timer); reject(err); });
        res.on('end', () => { clearTimeout(timer); resolve(); });
      });
    });

    const groups = entries.map(entry => {
      const attrs = {};
      for (const attr of entry.attributes) {
        const vals = attr.vals.map(v => v.toString('utf8'));
        attrs[attr.type] = vals.length === 1 ? vals[0] : vals;
      }
      return { dn: entry.dn.toString(), ...attrs };
    });

    log('Group Search', true, `Found ${groups.length} group(s)`, { groups });
    return groups;
  } catch (err) {
    log('Group Search', false, `Group search failed: ${err.message}`);
    return [];
  }
}

async function testRadiusFilterSearch(client) {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 7: RADIUS searchFilter simulation');
  console.log('═══════════════════════════════════════════');

  // Simulate the searchFilter from the test action - replaces %{User-Name} with wildcard
  const rawFilter = '(objectClass=inetOrgPerson)';
  const testFilter = rawFilter
    .replace(/%{User-Name}/g, '*')
    .replace(/%{Stripped-User-Name}/g, '*')
    .replace(/%{User-Password}/g, '*');

  const entries = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Search timeout')), TIMEOUT * 1000);

      client.search(BASE_DN, {
        filter: testFilter,
        scope: 'sub',
        attributes: ['dn'],
        sizeLimit: 1,
      }, (err, res) => {
        if (err) { clearTimeout(timer); reject(err); return; }
        res.on('searchEntry', (entry) => entries.push(entry));
        res.on('error', (err) => { clearTimeout(timer); reject(err); });
        res.on('end', () => { clearTimeout(timer); resolve(); });
      });
    });

    log('RADIUS Filter', true, `RADIUS-style searchFilter returned ${entries.length} result(s)`, {
      rawFilter,
      testFilter,
      resultCount: entries.length,
    });
  } catch (err) {
    log('RADIUS Filter', false, `RADIUS filter search failed: ${err.message}`);
  }
}

async function testStaySuiteAPI() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 8: StaySuite Next.js API (port 3000)');
  console.log('═══════════════════════════════════════════');

  try {
    const res = await fetch('http://localhost:3000/api/wifi/radius-ldap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'test',
        serverUrl: LDAP_URL,
        baseDn: BASE_DN,
        bindDn: ADMIN_DN,
        bindPassword: ADMIN_PW,
        searchFilter: '(objectClass=inetOrgPerson)',
        useTls: false,
        timeout: TIMEOUT,
      }),
    });

    const data = await res.json();
    log('API Test', res.status === 200 && data.success, 
      `API returned status ${res.status}`, data);
  } catch (err) {
    log('API Test', false, `API call failed: ${err.message}`);
  }
}

async function testMiniServiceHealth() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 9: Mini-Service Health (port 3010)');
  console.log('═══════════════════════════════════════════');

  try {
    const res = await fetch('http://localhost:3010/health');
    const data = await res.json();
    log('Mini-Service Health', res.status === 200, 
      `Mini-service health: ${data.status}`, data);
  } catch (err) {
    log('Mini-Service Health', false, `Mini-service unreachable: ${err.message}`);
  }
}

// Main
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  StaySuite LDAP E2E Integration Test Suite   ║');
  console.log('║  Target: OpenLDAP @ ldap://localhost:1389    ║');
  console.log('║  Base DN: dc=staysuite,dc=local              ║');
  console.log('╚══════════════════════════════════════════════╝');

  // Check LDAP server is reachable
  console.log('\nPre-flight: Checking if slapd is running on port 1389...');
  try {
    const res = await fetch('http://localhost:1389'); // Will fail but confirms port is open
  } catch (e) {
    if (e.code === 'ECONNREFUSED') {
      console.log('❌ LDAP server is NOT running on port 1389');
      process.exit(1);
    }
    // Connection was made (HTTP doesn't work on LDAP but port is open)
  }

  // Test 1: Connection
  const { client } = await testConnection();

  // Test 2: Search
  await testSearch(client);

  // Test 3: User search (matches StaySuite API)
  await testUserSearch(client, 'john');

  // Test 4: User authentication (bind)
  await testUserBind('cn=John Doe,ou=People,dc=staysuite,dc=local', 'Welcome123');

  // Test 5: Negative bind test
  await testNegativeBind();

  // Test 6: Group search
  await testGroupSearch(client);

  // Test 7: RADIUS filter simulation
  await testRadiusFilterSearch(client);

  // Cleanup
  try { await new Promise<void>((r) => client.unbind(() => r())); } catch {}
  try { client.destroy(); } catch {}

  // Test 8: StaySuite API
  await testStaySuiteAPI();

  // Test 9: Mini-service
  await testMiniServiceHealth();

  // Summary
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║              TEST SUMMARY                    ║');
  console.log('╚══════════════════════════════════════════════╝');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nTotal: ${results.length} tests, ${passed} passed, ${failed} failed\n`);

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`  ${icon} ${r.phase}: ${r.message}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
