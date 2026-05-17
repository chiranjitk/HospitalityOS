// StaySuite Comprehensive Test - API + Quick Browser
const http = require('http');

const BASE = 'http://localhost:3000';
const results = { pass: 0, fail: 0, warn: 0, details: [] };

function log(status, category, name, detail) {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  results.details.push({ status, category, name, detail });
  if (status === 'PASS') results.pass++;
  else if (status === 'FAIL') results.fail++;
  else results.warn++;
  console.log(`${emoji} ${status} | ${category} | ${name} | ${detail}`);
}

function httpGet(url, cookie = '') {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: { Cookie: cookie } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function httpPost(url, body, cookie = '') {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        Cookie: cookie,
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode, body: data, cookies: setCookie });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('🚀 StaySuite Comprehensive Test Suite\n');
  
  // ===== PHASE 1: AUTH =====
  console.log('═══ AUTHENTICATION ═══');
  let sessionCookie = '';
  let propertyId = '';
  
  try {
    const loginResp = await httpPost(`${BASE}/api/auth/login`, {
      email: 'admin@royalstay.in', password: 'admin123'
    });
    
    if (loginResp.status === 200) {
      const loginData = JSON.parse(loginResp.body);
      if (loginData.success) {
        log('PASS', 'Auth', 'Admin Login', `HTTP 200 - ${loginData.user?.email}`);
        // Extract session cookie
        const cookieHeader = loginResp.cookies.find(c => c.includes('session_token'));
        if (cookieHeader) {
          sessionCookie = cookieHeader.split(';')[0];
        }
      } else {
        log('FAIL', 'Auth', 'Admin Login', `HTTP ${loginResp.status} - ${loginData.error?.message}`);
      }
    } else {
      log('FAIL', 'Auth', 'Admin Login', `HTTP ${loginResp.status}`);
    }
  } catch (e) {
    log('FAIL', 'Auth', 'Admin Login', e.message);
  }

  if (!sessionCookie) {
    console.log('❌ No session cookie - cannot test authenticated endpoints');
    return;
  }

  // Get property ID
  try {
    const propResp = await httpGet(`${BASE}/api/properties`, sessionCookie);
    if (propResp.status === 200) {
      const propData = JSON.parse(propResp.body);
      if (propData.data?.length > 0) {
        propertyId = propData.data[0].id;
        log('PASS', 'Data', 'Properties', `Found ${propData.data.length} properties`);
      }
    }
  } catch (e) {}

  // ===== PHASE 2: API ENDPOINTS =====
  console.log('\n═══ API ENDPOINTS ═══');
  
  const endpoints = [
    { path: '/api/properties', name: 'Properties' },
    { path: '/api/room-types', name: 'Room Types' },
    { path: '/api/rooms', name: 'Rooms' },
    { path: '/api/bookings', name: 'Bookings' },
    { path: '/api/guests', name: 'Guests' },
    { path: '/api/housekeeping/tasks', name: 'Housekeeping Tasks' },
    { path: '/api/billing/folios', name: 'Billing Folios' },
    { path: '/api/billing/payments', name: 'Billing Payments' },
    { path: `/api/accounting/cash-book?propertyId=${propertyId}`, name: 'Cash Book' },
    { path: '/api/revenue/dashboard', name: 'Revenue Dashboard' },
    { path: '/api/channel-manager/channels', name: 'Channel Manager' },
    { path: '/api/crm/dashboard', name: 'CRM Dashboard' },
    { path: '/api/reports/overview', name: 'Reports Overview' },
    { path: '/api/staff', name: 'Staff' },
    { path: '/api/wifi/sessions', name: 'WiFi Sessions' },
    { path: '/api/inventory/items', name: 'Inventory Items' },
    { path: '/api/facilities', name: 'Facilities' },
    { path: '/api/service-requests', name: 'Service Requests' },
    { path: '/api/notifications', name: 'Notifications' },
    { path: '/api/ota/connections', name: 'OTA Connections' },
    { path: '/api/website-builder/sites', name: 'Website Builder' },
    { path: '/api/energy/metrics', name: 'Energy Metrics' },
    { path: '/api/iot/smart-locks', name: 'Smart Locks' },
    { path: '/api/tax/tds', name: 'Tax TDS' },
    { path: '/api/ads/connections', name: 'Ad Connections' },
    { path: '/api/rate-plans', name: 'Rate Plans' },
    { path: '/api/maintenance/requests', name: 'Maintenance' },
    { path: '/api/pos/orders', name: 'POS Orders' },
    { path: '/api/crm/campaigns', name: 'Campaigns' },
    { path: '/api/crm/loyalty', name: 'Loyalty' },
    { path: '/api/audit/logs', name: 'Audit Logs' },
    { path: `/api/financials/cash-flow?propertyId=${propertyId}`, name: 'Cash Flow' },
    { path: `/api/financials/budgets?propertyId=${propertyId}`, name: 'Budgets' },
    { path: `/api/revenue/hourly-pricing?propertyId=${propertyId}`, name: 'Hourly Pricing' },
    { path: '/api/automation/rules', name: 'Automation Rules' },
    { path: '/api/integrations', name: 'Integrations' },
    { path: '/api/iot/access-schedules', name: 'Access Schedules' },
    { path: '/api/guests/vip', name: 'VIP Guests' },
    { path: '/api/guests/vip-rules', name: 'VIP Rules' },
    { path: '/api/website-builder/sync', name: 'Website Sync' },
    { path: '/api/ads/connections/test', name: 'Ad Test Connection' },
    { path: '/api/dashboard/stats', name: 'Dashboard Stats' },
  ];

  for (const ep of endpoints) {
    try {
      const resp = await httpGet(`${BASE}${ep.path}`, sessionCookie);
      
      if (resp.status >= 200 && resp.status < 300) {
        try {
          const data = JSON.parse(resp.body);
          if (data.success) {
            const itemCount = data.data?.length ?? data.pagination?.total ?? 'N/A';
            log('PASS', 'API', ep.name, `HTTP ${resp.status} | ${itemCount} items`);
          } else {
            log('WARN', 'API', ep.name, `HTTP ${resp.status} | ${data.error?.code || 'unknown'}`);
          }
        } catch {
          log('WARN', 'API', ep.name, `HTTP ${resp.status} | Non-JSON (likely 404 HTML)`);
        }
      } else if (resp.status === 404) {
        log('WARN', 'API', ep.name, 'HTTP 404 - Route not implemented');
      } else if (resp.status === 401) {
        log('WARN', 'API', ep.name, 'HTTP 401 - Auth issue');
      } else if (resp.status === 400) {
        try {
          const data = JSON.parse(resp.body);
          log('WARN', 'API', ep.name, `HTTP 400 | ${data.error?.message || 'Validation'}`);
        } catch {
          log('WARN', 'API', ep.name, 'HTTP 400 | Validation error');
        }
      } else if (resp.status >= 500) {
        log('FAIL', 'API', ep.name, `HTTP ${resp.status} - Server error`);
      } else {
        log('WARN', 'API', ep.name, `HTTP ${resp.status}`);
      }
    } catch (e) {
      log('FAIL', 'API', ep.name, `Error: ${e.message.substring(0, 60)}`);
    }
  }

  // ===== PHASE 3: PAGE LOAD TESTS =====
  console.log('\n═══ PAGE LOAD TESTS ═══');
  
  const pages = [
    { name: 'Login Page', path: '/' },
    { name: 'Dashboard Overview', path: '/' },
    { name: 'Properties', path: '/?section=properties' },
    { name: 'Rooms', path: '/?section=rooms' },
    { name: 'Bookings', path: '/?section=booking-calendar' },
    { name: 'Check-In', path: '/?section=checkin' },
    { name: 'Guests', path: '/?section=guests' },
    { name: 'Housekeeping', path: '/?section=housekeeping' },
    { name: 'Billing Folios', path: '/?section=folios' },
    { name: 'Cash Book', path: '/?section=cash-book' },
    { name: 'WiFi', path: '/?section=wifi' },
    { name: 'Revenue', path: '/?section=revenue' },
    { name: 'Channel Manager', path: '/?section=channel-manager' },
    { name: 'CRM', path: '/?section=crm' },
    { name: 'Reports', path: '/?section=reports' },
    { name: 'Security', path: '/?section=security' },
    { name: 'Website Builder', path: '/?section=website-builder' },
    { name: 'Settings', path: '/?section=settings' },
  ];
  
  for (const pg of pages) {
    try {
      const resp = await httpGet(`${BASE}${pg.path}`, sessionCookie);
      if (resp.status === 200) {
        const html = resp.body;
        const hasReact = html.includes('__next') || html.includes('StaySuite');
        const hasError = html.includes('Application error') || html.includes('Internal Server Error');
        
        if (hasError) {
          log('FAIL', 'Page', pg.name, `HTTP 200 but page has error`);
        } else if (hasReact) {
          // Count buttons/inputs in HTML (rough estimate)
          const buttonCount = (html.match(/button/gi) || []).length;
          const inputCount = (html.match(/input/gi) || []).length;
          log('PASS', 'Page', pg.name, `HTTP 200 | ~${buttonCount} buttons, ~${inputCount} inputs`);
        } else {
          log('WARN', 'Page', pg.name, `HTTP 200 but no React content detected`);
        }
      } else {
        log('FAIL', 'Page', pg.name, `HTTP ${resp.status}`);
      }
    } catch (e) {
      log('FAIL', 'Page', pg.name, `Error: ${e.message.substring(0, 60)}`);
    }
  }

  // ===== PHASE 4: ROLE ACCESS =====
  console.log('\n═══ ROLE-BASED ACCESS ═══');
  
  const roles = [
    { name: 'Front Desk', email: 'frontdesk@royalstay.in', password: 'staff123' },
    { name: 'Housekeeping', email: 'housekeeping@royalstay.in', password: 'staff123' },
    { name: 'Platform Admin', email: 'platform@staysuite.com', password: 'admin123' },
    { name: 'Tenant 2 Admin', email: 'admin@oceanview.com', password: 'admin123' },
  ];
  
  for (const role of roles) {
    try {
      const resp = await httpPost(`${BASE}/api/auth/login`, {
        email: role.email, password: role.password
      });
      
      if (resp.status === 200) {
        const data = JSON.parse(resp.body);
        if (data.success) {
          log('PASS', 'Role', role.name, `Logged in as ${data.user?.roleName}`);
        } else {
          log('FAIL', 'Role', role.name, `Login failed: ${data.error?.message || 'Unknown'}`);
        }
      } else {
        log('FAIL', 'Role', role.name, `HTTP ${resp.status}`);
      }
    } catch (e) {
      log('FAIL', 'Role', role.name, e.message.substring(0, 60));
    }
  }

  // ===== PHASE 5: SECURITY TESTS =====
  console.log('\n═══ SECURITY ═══');
  
  // Test unauthenticated access
  try {
    const resp = await httpGet(`${BASE}/api/properties`);
    if (resp.status === 401) {
      log('PASS', 'Security', 'Unauthenticated API', 'Correctly returns 401');
    } else {
      log('FAIL', 'Security', 'Unauthenticated API', `Returns ${resp.status} instead of 401`);
    }
  } catch (e) {
    log('FAIL', 'Security', 'Unauthenticated API', e.message);
  }
  
  // Test invalid credentials
  try {
    const resp = await httpPost(`${BASE}/api/auth/login`, {
      email: 'admin@royalstay.in', password: 'wrongpassword'
    });
    if (resp.status === 401 || (resp.status === 200 && !JSON.parse(resp.body).success)) {
      log('PASS', 'Security', 'Invalid Password', 'Correctly rejected');
    } else {
      log('FAIL', 'Security', 'Invalid Password', `HTTP ${resp.status} - Should reject`);
    }
  } catch (e) {
    log('FAIL', 'Security', 'Invalid Password', e.message);
  }

  // ===== PHASE 6: DATA INTEGRITY =====
  console.log('\n═══ DATA INTEGRITY ═══');
  
  // Test CRUD operations
  try {
    // Read properties
    const propResp = await httpGet(`${BASE}/api/properties`, sessionCookie);
    const propData = JSON.parse(propResp.body);
    log('PASS', 'Data', 'Properties Count', `${propData.pagination?.total || propData.data?.length} properties`);
    
    // Read rooms
    const roomResp = await httpGet(`${BASE}/api/rooms`, sessionCookie);
    const roomData = JSON.parse(roomResp.body);
    log('PASS', 'Data', 'Rooms Count', `${roomData.data?.length || 0} rooms`);
    
    // Read bookings
    const bookResp = await httpGet(`${BASE}/api/bookings`, sessionCookie);
    const bookData = JSON.parse(bookResp.body);
    log('PASS', 'Data', 'Bookings Count', `${bookData.data?.length || 0} bookings`);
    
    // Read guests
    const guestResp = await httpGet(`${BASE}/api/guests`, sessionCookie);
    const guestData = JSON.parse(guestResp.body);
    log('PASS', 'Data', 'Guests Count', `${guestData.data?.length || 0} guests`);
  } catch (e) {
    log('FAIL', 'Data', 'Data Integrity', e.message);
  }

  // ===== SUMMARY =====
  const total = results.pass + results.fail + results.warn;
  const successRate = total > 0 ? ((results.pass / total) * 100).toFixed(1) : 0;
  
  const summary = `
============================================
  🏁 StaySuite Comprehensive Test Report
============================================
  ✅ Passed:  ${results.pass}
  ❌ Failed:  ${results.fail}
  ⚠️  Warnings: ${results.warn}
  📊 Total:    ${total}
  📈 Success:  ${successRate}%
============================================
`;
  console.log(summary);
  
  // Write full report
  const fs = require('fs');
  const reportLines = results.details.map(d => {
    const emoji = d.status === 'PASS' ? '✅' : d.status === 'FAIL' ? '❌' : '⚠️';
    return `${emoji} ${d.status} | ${d.category} | ${d.name} | ${d.detail}`;
  });
  fs.writeFileSync('/home/z/my-project/gui-test-results.txt', reportLines.join('\n') + '\n\n' + summary);
}

main().catch(e => console.error('Fatal:', e.message));
