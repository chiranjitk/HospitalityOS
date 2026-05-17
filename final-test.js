const http = require('http');
const BASE = 'http://localhost:3000';
const fs = require('fs');
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function httpReq(method, url, body, cookie) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname, port: urlObj.port, path: urlObj.pathname + urlObj.search,
      method, headers: { 'Content-Type': 'application/json', Cookie: cookie || '' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, cookies: res.headers['set-cookie'] || [] }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  let pass=0, fail=0, warn=0;
  const out = [];
  function log(s, c, n, d) {
    const e = s==='PASS'?'✅':s==='FAIL'?'❌':'⚠️';
    if(s==='PASS')pass++;else if(s==='FAIL')fail++;else warn++;
    const line = e+' '+s+' | '+c+' | '+n+' | '+d;
    out.push(line);
    console.log(line);
  }

  // Login
  console.log('═══ AUTH ═══');
  let cookie = '';
  const login = await httpReq('POST', BASE+'/api/auth/login', {email:'admin@royalstay.in',password:'admin123'});
  if (login.status===200 && JSON.parse(login.body).success) {
    log('PASS','Auth','Admin Login','Logged in');
    const sc = login.cookies.find(c=>c.includes('session_token'));
    if(sc) cookie = sc.split(';')[0];
  } else { log('FAIL','Auth','Admin Login','Failed'); process.exit(1); }

  await delay(2000);
  let propId = '';
  try {
    const pr = await httpReq('GET', BASE+'/api/properties', null, cookie);
    if (pr.status===200) propId = JSON.parse(pr.body).data?.[0]?.id || '';
  } catch(e) {}

  // API tests with 2s delay
  console.log('\n═══ API ENDPOINTS ═══');
  const eps = [
    '/api/properties','/api/room-types','/api/rooms','/api/bookings','/api/guests',
    '/api/housekeeping/tasks','/api/billing/folios','/api/billing/payments',
    '/api/accounting/cash-book?propertyId='+propId,'/api/revenue/dashboard',
    '/api/channel-manager/channels','/api/crm/dashboard','/api/reports/overview',
    '/api/staff','/api/wifi/sessions','/api/inventory/items','/api/facilities',
    '/api/service-requests','/api/notifications','/api/ota/connections',
    '/api/website-builder/sites','/api/energy/metrics','/api/iot/smart-locks',
    '/api/tax/tds','/api/ads/connections','/api/rate-plans',
    '/api/maintenance/requests','/api/pos/orders','/api/crm/campaigns',
    '/api/crm/loyalty','/api/audit/logs',
    '/api/financials/cash-flow?propertyId='+propId,
    '/api/financials/budgets?propertyId='+propId,
    '/api/revenue/hourly-pricing?propertyId='+propId,
    '/api/automation/rules','/api/integrations','/api/iot/access-schedules',
    '/api/guests/vip','/api/guests/vip-rules','/api/website-builder/sync',
    '/api/ads/connections/test','/api/dashboard/stats',
  ];

  for (const ep of eps) {
    await delay(2000);
    try {
      const r = await httpReq('GET', BASE+ep, null, cookie);
      try {
        const d = JSON.parse(r.body);
        if (d.success) {
          const items = d.data?.length ?? d.pagination?.total ?? '?';
          log('PASS','API',ep,'HTTP '+r.status+' | '+items+' items');
        } else {
          log('WARN','API',ep,'HTTP '+r.status+' | '+(d.error?.code||'unknown'));
        }
      } catch {
        log('WARN','API',ep,'HTTP '+r.status+' | Non-JSON (404?)');
      }
    } catch(e) {
      log('FAIL','API',ep,'Error: '+e.message.substring(0,50));
      await delay(5000);
    }
  }

  // Role tests
  console.log('\n═══ ROLE ACCESS ═══');
  const roles = [
    ['Front Desk','frontdesk@royalstay.in','staff123'],
    ['Housekeeping','housekeeping@royalstay.in','staff123'],
    ['Platform Admin','platform@staysuite.com','admin123'],
    ['Tenant2 Admin','admin@oceanview.com','admin123'],
  ];
  for (const [name,email,pw] of roles) {
    await delay(2000);
    try {
      const r = await httpReq('POST', BASE+'/api/auth/login', {email,password:pw});
      const d = JSON.parse(r.body);
      log(d.success?'PASS':'FAIL','Role',name, d.success?'Logged in as '+d.user?.roleName:'Failed: '+d.error?.message);
    } catch(e) { log('FAIL','Role',name,e.message.substring(0,50)); }
  }

  // Security
  console.log('\n═══ SECURITY ═══');
  await delay(2000);
  try {
    const r = await httpReq('GET', BASE+'/api/properties');
    log(r.status===401?'PASS':'FAIL','Security','Unauth API','HTTP '+r.status+(r.status===401?' (correct)':' (should be 401)'));
  } catch(e) { log('FAIL','Security','Unauth API',e.message); }

  await delay(2000);
  try {
    const r = await httpReq('POST', BASE+'/api/auth/login', {email:'admin@royalstay.in',password:'wrong'});
    const d = JSON.parse(r.body);
    log(!d.success?'PASS':'FAIL','Security','Bad Password',!d.success?'Correctly rejected':'Should reject!');
  } catch(e) { log('FAIL','Security','Bad Password',e.message); }

  // Page load tests
  console.log('\n═══ PAGE LOAD TESTS ═══');
  const pages = [
    'Login Page|/',
    'Dashboard|/',
    'Properties|/?section=properties',
    'Rooms|/?section=rooms',
    'Bookings|/?section=booking-calendar',
    'Check-In|/?section=checkin',
    'Guests|/?section=guests',
    'Housekeeping|/?section=housekeeping',
    'Billing|/?section=folios',
    'Cash Book|/?section=cash-book',
    'WiFi|/?section=wifi',
    'Revenue|/?section=revenue',
    'Channel Manager|/?section=channel-manager',
    'CRM|/?section=crm',
    'Reports|/?section=reports',
    'Security|/?section=security',
    'Website Builder|/?section=website-builder',
    'Settings|/?section=settings',
  ];
  
  for (const entry of pages) {
    const [name, path] = entry.split('|');
    await delay(3000);
    try {
      const r = await httpReq('GET', BASE+path, null, cookie);
      if (r.status === 200) {
        const hasReact = r.body.includes('__next') || r.body.includes('StaySuite');
        const hasError = r.body.includes('Application error');
        if (hasError) log('FAIL','Page',name,'Page shows error');
        else if (hasReact) log('PASS','Page',name,'HTTP 200 | React content present');
        else log('WARN','Page',name,'HTTP 200 | No React content');
      } else {
        log('FAIL','Page',name,'HTTP '+r.status);
      }
    } catch(e) {
      log('FAIL','Page',name,'Error: '+e.message.substring(0,50));
      await delay(5000);
    }
  }

  // Summary
  const total = pass+fail+warn;
  const rate = total>0?((pass/total)*100).toFixed(1):0;
  const summary = '\n============================================\n  🏁 StaySuite Test Report\n============================================\n  ✅ Passed:  '+pass+'\n  ❌ Failed:  '+fail+'\n  ⚠️  Warnings: '+warn+'\n  📊 Total:    '+total+'\n  📈 Success:  '+rate+'%\n============================================';
  console.log(summary);
  fs.writeFileSync('/home/z/my-project/gui-test-results.txt', out.join('\n')+'\n'+summary);
}
main().catch(e=>console.error(e.message));
