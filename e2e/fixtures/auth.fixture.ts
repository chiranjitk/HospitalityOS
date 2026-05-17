// e2e/fixtures/auth.fixture.ts
// Shared authentication fixtures for all E2E tests
// Module tests use stored storageState (from globalSetup) — no re-login needed
// Login tests use the auth-setup project which clears storageState

import { test as base, Page, expect } from '@playwright/test';

// ─── Seed Credentials ───────────────────────────────────────────
export const CREDENTIALS = {
  admin: { email: 'admin@royalstay.in', password: 'admin123', role: 'admin' },
  frontdesk: { email: 'frontdesk@royalstay.in', password: 'staff123', role: 'frontdesk' },
  housekeeping: { email: 'housekeeping@royalstay.in', password: 'staff123', role: 'housekeeping' },
  platformAdmin: { email: 'platform@staysuite.com', password: 'admin123', role: 'platformAdmin' },
} as const;

type CredentialKey = keyof typeof CREDENTIALS;

// ─── Navigation Helper ──────────────────────────────────────────
// The app is a SPA with Zustand state.
// We access the store via window.__UI_STORE__ (exposed in src/store/index.ts)
// and call setActiveSection() directly — same as clicking a sidebar link.
export async function navigateToSection(page: Page, sectionId: string) {
  // Remove leading # if present
  const section = sectionId.replace(/^#/, '');

  // Use the exposed Zustand store to set active section directly
  await page.evaluate((hash) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__UI_STORE__;
    if (store && store.getState) {
      store.getState().setActiveSection(hash);
    }
  }, section);
}

// ─── Auth Fixture Types ─────────────────────────────────────────
type AuthFixture = {
  authedPage: Page;
  login: (key?: CredentialKey) => Promise<void>;
};

// ─── Extended Test Fixtures ─────────────────────────────────────
export const test = base.extend<AuthFixture>({
  authedPage: async ({ page }, use) => {
    // Module tests already have storageState from globalSetup
    // Navigate to main page and wait for full hydration
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for auth state, feature flags, sidebar, and main content to load
    await waitForSidebarLoad(page);
    // Wait for the main content area to render (not just loading spinner)
    try {
      await page.waitForSelector('main, [role="main"]', { timeout: 15000 });
    } catch {
      // SPA may not use semantic main element
      await page.waitForTimeout(3000);
    }
    await use(page);
  },
  login: async ({ page }, use) => {
    const loginFn = async (key: CredentialKey = 'admin') => {
      await performLogin(page, key);
    };
    await use(loginFn);
  },
});

export { expect };

// ─── Login Implementation ───────────────────────────────────────
async function performLogin(page: Page, key: CredentialKey) {
  const creds = CREDENTIALS[key];

  // Navigate to login
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for auth state to resolve
  await page.waitForTimeout(2000);

  // If already on main page (already logged in), skip
  if (page.url().endsWith('/') && !page.url().includes('login')) {
    return;
  }

  // Fill login form
  await page.getByLabel('email', { exact: false }).fill(creds.email);
  await page.getByLabel('password', { exact: false }).fill(creds.password);

  // Submit
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to main page
  await page.waitForURL('http://localhost:3000/', { timeout: 20000 });

  // Wait for feature flags and sidebar to load
  await page.waitForTimeout(2000);
}

// ─── Common UI Helpers ──────────────────────────────────────────
export async function waitForSidebarLoad(page: Page) {
  // Wait for sidebar to be fully loaded (not showing loading state)
  try {
    await page.waitForSelector('aside', { timeout: 10000 });
  } catch {
    // Sidebar may be hidden on mobile viewports — not a failure
  }
  // Wait for at least one nav link to appear (menu loaded)
  try {
    await page.waitForSelector('nav a[href*="#"]', { timeout: 8000 });
  } catch {
    // Nav links may use hash routing without explicit href="#"
    await page.waitForTimeout(2000);
  }
}

export async function clickSidebarMenu(page: Page, label: string) {
  // First try clicking the exact link
  const link = page.getByRole('link', { name: new RegExp(label, 'i') });
  const count = await link.count();
  if (count > 0) {
    await link.first().click();
    await page.waitForTimeout(500);
    return;
  }
  // Fallback: expand parent section first if collapsed
  await page.getByText(label, { exact: false }).first().click();
  await page.waitForTimeout(500);
}

export async function openSection(page: Page, sectionHash: string) {
  // Ensure we're on the main app page (not about:blank or /login)
  const currentUrl = page.url();
  if (!currentUrl.includes('localhost:3000') || currentUrl.includes('login')) {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForSidebarLoad(page);
    await page.waitForTimeout(2000);
  }

  // Navigate to the target section via Zustand store
  await navigateToSection(page, sectionHash);
  // Wait for dynamic section import and render
  await page.waitForTimeout(2000);
}

export async function clickButton(page: Page, label: string) {
  await page.getByRole('button', { name: new RegExp(label, 'i') }).click();
}

export async function fillInput(page: Page, label: string, value: string) {
  const input = page.getByLabel(label, { exact: false });
  await input.fill(value);
  await input.press('Tab'); // Trigger blur/validation
}

export async function submitForm(page: Page) {
  // Try common submit button patterns
  const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create"), button:has-text("Submit"), button:has-text("Add")').first();
  await submitBtn.click();
  await page.waitForTimeout(1000); // Wait for form submission
}

export async function waitForToast(page: Page, text?: string) {
  if (text) {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10000 });
  } else {
    // Wait for any toast notification
    await page.locator('[data-sonner-toast], [role="alert"], [data-state="open"]').first().waitFor({ timeout: 10000 });
  }
}

export async function closeDialog(page: Page) {
  // Try multiple dialog close patterns
  const closeBtn = page.locator('button[aria-label="Close"], button[aria-label="close"], [data-radix-collection-item] button:has(svg)').first();
  const count = await closeBtn.count();
  if (count > 0) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  }
}

export async function selectOption(page: Page, label: string, value: string) {
  // Handle shadcn Select component
  const trigger = page.locator(`[aria-label="${label}"], [placeholder="${label}"]`).first();
  await trigger.click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: new RegExp(value, 'i') }).click();
}

export async function checkCheckbox(page: Page, label: string) {
  await page.getByLabel(label, { exact: false }).check();
}

export async function getTableRows(page: Page) {
  const rows = page.locator('table tbody tr, [role="table"] [role="row"]');
  return rows.count();
}
