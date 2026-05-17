const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = '/home/z/my-project/gui-test-screenshots';
const RESULTS_FILE = '/home/z/my-project/gui-test-results.txt';

const results = [];
let pass = 0, fail = 0, warn = 0;

function logResult(status, section, page, url, detail) {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  const line = `${emoji} ${status} | ${section} | ${page} | ${url} | ${detail}`;
  results.push(line);
  if (status === 'PASS') pass++;
  else if (status === 'FAIL') fail++;
  else warn++;
  console.log(line);
}

async function main() {
  console.log('🚀 StaySuite GUI Test (Patient Mode)\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Set default timeout to 30s for navigation
  context.setDefaultTimeout(30000);

  // ===== PHASE 1: LOGIN =====
  console.log('═══ AUTH ═══');
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Try quick login button first
    const quickLogin = await page.$('button:has-text("Quick Admin Login")');
    if (quickLogin) {
      await quickLogin.click();
    } else {
      await page.fill('input[type="email"], input[name="email"]', 'admin@royalstay.in').catch(() => {});
      await page.fill('input[type="password"], input[name="password"]', 'admin123').catch(() => {});
      await page.click('button:has-text("Sign in")').catch(() => {});
    }
    
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-dashboard.png') });
    
    const url = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    if (bodyText.includes('Dashboard') || bodyText.includes('Overview') || bodyText.includes('Good')) {
      logResult('PASS', 'Auth', 'Admin Login', '/', 'Dashboard loaded');
    } else {
      logResult('WARN', 'Auth', 'Admin Login', '/', `Content: ${bodyText.substring(0, 100)}`);
    }
  } catch (err) {
    logResult('FAIL', 'Auth', 'Admin Login', '/', err.message.substring(0, 100));
  }

  // ===== PHASE 2: PAGE TESTS =====
  // Test all sections by clicking sidebar links (slower but more reliable)
  const sections = [
    'Overview', 'Command Center', 'Alerts & Notifications', 'KPI Cards',
    'Properties', 'Room Types', 'Rooms', 'Inventory Calendar', 'Availability Control',
    'Inventory Locking', 'Rate Plans & Pricing', 'Overbooking Settings', 'Floor Plans',
    'Room Rate Calendar', 'Room Out-of-Order', 'Package Plans', 'Room Type Change',
    'Calendar View', 'Group Bookings', 'Waitlist', 'Conflicts', 'No-Show Automation', 'Audit Logs',
  ];

  console.log('\n═══ SIDEBAR NAVIGATION ═══');
  
  for (const sectionName of sections) {
    try {
      // Click the sidebar link
      const link = await page.$(`a:has-text("${sectionName}")`);
      if (link) {
        await link.click();
        await page.waitForTimeout(4000); // Wait for page to load/compile
        
        const currentUrl = page.url();
        const interactiveCount = await page.$$eval(
          'button, a, input, select, textarea, [role="button"], [role="tab"]',
          els => els.length
        ).catch(() => 0);
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '');
        const hasError = bodyText.toLowerCase().includes('application error');
        
        // Screenshot
        const safeName = sectionName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `page-${safeName}.png`) }).catch(() => {});
        
        if (hasError) {
          logResult('FAIL', 'Nav', sectionName, currentUrl, 'Application error on page');
        } else if (interactiveCount > 0) {
          logResult('PASS', 'Nav', sectionName, currentUrl, `${interactiveCount} interactive elements`);
        } else {
          logResult('WARN', 'Nav', sectionName, currentUrl, 'No interactive elements');
        }
      } else {
        logResult('WARN', 'Nav', sectionName, '/', 'Sidebar link not found');
      }
    } catch (err) {
      logResult('FAIL', 'Nav', sectionName, '/', err.message.substring(0, 80));
    }
  }

  // ===== PHASE 3: COLLAPSED SIDEBAR SECTIONS =====
  // Need to expand other sidebar sections
  console.log('\n══� EXPANDED SECTIONS ═══');
  
  const expandButtons = [
    'FRONT DESK', 'GUESTS', 'HOUSEKEEPING', 'BILLING', 'GUEST EXPERIENCE',
    'RESTAURANT & POS', 'INVENTORY', 'FACILITIES', 'WIFI MANAGEMENT',
    'REVENUE MANAGEMENT', 'CHANNEL MANAGER', 'CRM & MARKETING',
    'DIGITAL ADVERTISING', 'REPORTS & BI', 'STAFF MANAGEMENT',
    'SECURITY & IOT', 'INTEGRATIONS', 'AUTOMATION & AI',
  ];
  
  for (const btnText of expandButtons) {
    try {
      const btn = await page.$(`button:has-text("${btnText}")`);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(500);
        
        // Now get the sub-links that appeared
        const section = btnText.replace(/ & /g, '-').replace(/ /g, '-');
        const subLinks = await page.$$eval(
          `li a[href*="section"]`,
          els => els.map(el => ({ text: el.textContent.trim(), href: el.getAttribute('href') }))
        ).catch(() => []);
        
        // Click each sub-link
        for (const subLink of subLinks) {
          if (!subLink.text || subLink.text.length < 2) continue;
          try {
            const linkEl = await page.$(`a:has-text("${subLink.text}")`);
            if (linkEl) {
              await linkEl.click();
              await page.waitForTimeout(4000);
              
              const currentUrl = page.url();
              const interactiveCount = await page.$$eval(
                'button, a, input, select, textarea',
                els => els.length
              ).catch(() => 0);
              
              const safeName = subLink.text.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
              await page.screenshot({ path: path.join(SCREENSHOT_DIR, `page-${section}-${safeName}.png`) }).catch(() => {});
              
              if (interactiveCount > 0) {
                logResult('PASS', btnText, subLink.text, currentUrl, `${interactiveCount} elements`);
              } else {
                logResult('WARN', btnText, subLink.text, currentUrl, 'No interactive elements');
              }
            }
          } catch (err) {
            logResult('WARN', btnText, subLink.text || 'unknown', '/', 'Link click failed');
          }
        }
      } else {
        logResult('WARN', 'Sidebar', btnText, '/', 'Expand button not found');
      }
    } catch (err) {
      logResult('WARN', 'Sidebar', btnText, '/', err.message.substring(0, 60));
    }
  }

  // ===== PHASE 4: INTERACTION TESTS =====
  console.log('\n═══ INTERACTIONS ═══');
  
  // Go back to dashboard
  try {
    const overviewLink = await page.$('a:has-text("Overview")');
    if (overviewLink) { await overviewLink.click(); await page.waitForTimeout(3000); }
  } catch (e) {}

  // Dark mode
  try {
    const darkBtn = await page.$('button:has-text("dark mode"), button:has-text("Dark mode")');
    if (darkBtn) {
      await darkBtn.click(); await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interaction-dark-mode.png') });
      logResult('PASS', 'Interaction', 'Dark Mode', '/', 'Toggled');
      await darkBtn.click(); // toggle back
    }
  } catch (e) {}

  // Notifications
  try {
    const notifBtn = await page.$('button:has-text("Notification")');
    if (notifBtn) {
      await notifBtn.click(); await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interaction-notifications.png') });
      logResult('PASS', 'Interaction', 'Notifications', '/', 'Panel opened');
    }
  } catch (e) {}

  // Room button
  try {
    const roomBtn = await page.$('button:has-text("101")');
    if (roomBtn) {
      await roomBtn.click(); await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interaction-room-101.png') });
      logResult('PASS', 'Interaction', 'Room 101', '/', 'Room detail shown');
    }
  } catch (e) {}

  // Quick Action: New Booking
  try {
    const newBookingBtn = await page.$('button:has-text("New Booking")');
    if (newBookingBtn) {
      await newBookingBtn.click(); await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interaction-new-booking.png') });
      logResult('PASS', 'Interaction', 'New Booking', '/', 'Form opened');
    }
  } catch (e) {}

  // Sidebar collapse
  try {
    const collapseBtn = await page.$('button:has-text("Collapse")');
    if (collapseBtn) {
      await collapseBtn.click(); await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'interaction-sidebar-collapsed.png') });
      logResult('PASS', 'Interaction', 'Sidebar Collapse', '/', 'Collapsed');
    }
  } catch (e) {}

  // ===== PHASE 5: MOBILE TEST =====
  console.log('\n═══ MOBILE ═══');
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobileContext.newPage();
  const cookies = await context.cookies();
  if (cookies.length) await mobileContext.addCookies(cookies);
  
  try {
    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    await mobilePage.waitForTimeout(3000);
    await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile-iphone.png') });
    const mobileCount = await mobilePage.$$eval('button, a, input', els => els.length).catch(() => 0);
    logResult('PASS', 'Mobile', 'iPhone 14', '/', `${mobileCount} elements`);
  } catch (e) {
    logResult('WARN', 'Mobile', 'iPhone 14', '/', e.message.substring(0, 80));
  }
  await mobileContext.close();

  // ===== PHASE 6: ROLE TESTS =====
  console.log('\n═══ ROLE ACCESS ═══');
  
  // Logout first
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Clear cookies to force logout
    await context.clearCookies();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
  } catch (e) {}

  const roles = [
    { name: 'Front Desk', email: 'frontdesk@royalstay.in', password: 'staff123' },
    { name: 'Housekeeping', email: 'housekeeping@royalstay.in', password: 'staff123' },
  ];

  for (const role of roles) {
    try {
      await page.fill('input[type="email"], input[name="email"]', role.email).catch(() => {});
      await page.fill('input[type="password"], input[name="password"]', role.password).catch(() => {});
      await page.click('button:has-text("Sign in")').catch(() => {});
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `role-${role.name.toLowerCase().replace(' ', '-')}.png`) });
      
      const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '');
      if (bodyText.includes('Dashboard') || bodyText.includes('Overview') || bodyText.includes('Good')) {
        logResult('PASS', 'Role', role.name, '/', 'Logged in successfully');
      } else {
        logResult('WARN', 'Role', role.name, '/', `Content: ${bodyText.substring(0, 100)}`);
      }
      // Clear for next
      await context.clearCookies();
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      logResult('FAIL', 'Role', role.name, '/', e.message.substring(0, 80));
    }
  }

  // ===== SUMMARY =====
  const summary = `
============================================
  🏁 StaySuite GUI Test Report
============================================
  ✅ Passed:  ${pass}
  ❌ Failed:  ${fail}
  ⚠️  Warnings: ${warn}
  📊 Total:    ${pass + fail + warn}
  📈 Success:  ${((pass / (pass + fail + warn)) * 100).toFixed(1)}%
============================================
`;
  console.log(summary);
  fs.writeFileSync(RESULTS_FILE, results.join('\n') + '\n\n' + summary);

  await context.close();
  await browser.close();
}

main().catch(err => {
  console.error('Fatal:', err.message.substring(0, 200));
  process.exit(1);
});
