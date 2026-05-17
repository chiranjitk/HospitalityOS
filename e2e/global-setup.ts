// e2e/global-setup.ts
// Authenticates once and saves browser state for all tests to reuse.

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Retry loop for server availability
    let loggedIn = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Login attempt ${attempt}/3...`);
        
        // Navigate to login page
        await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait for the login form to be fully rendered
        await page.waitForSelector('#email', { timeout: 20000 });
        await page.waitForTimeout(2000);

        // Fill and submit login form
        await page.locator('#email').fill('admin@royalstay.in');
        await page.locator('#password').fill('admin123');
        await page.locator('button[type="submit"]').click();

        // Wait for successful redirect (away from /login)
        await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 30000 });
        loggedIn = true;
        break;
      } catch (err) {
        console.log(`Attempt ${attempt} failed: ${(err as Error).message}`);
        if (attempt < 3) {
          await page.waitForTimeout(5000);
        }
      }
    }

    if (!loggedIn) {
      throw new Error('Failed to login after 3 attempts');
    }

    // Wait for app to fully hydrate
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`✅ Logged in successfully, URL: ${currentUrl}`);

    // Save authenticated state
    await page.context().storageState({ path: 'e2e/.auth/admin.json' });
    console.log('✅ Admin session saved to e2e/.auth/admin.json');
  } catch (error) {
    console.error('❌ Failed in global setup:', error);
    await page.screenshot({ path: 'e2e/.auth/global-setup-failure.png' });
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
