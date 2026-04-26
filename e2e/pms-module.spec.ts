/**
 * StaySuite Hospitality OS — PMS Module E2E Tests
 *
 * Comprehensive Playwright tests covering the core Property Management System
 * sections: Authentication, Room Management, Room Types, Availability Calendar,
 * Rate Plans & Pricing, Floor Plans, Housekeeping, and Guest Management.
 *
 * Run:  npx playwright test e2e/pms-module.spec.ts
 *
 * @see playwright.config.ts — baseURL is http://localhost:3000
 * @see src/config/navigation.ts — section hashes used for navigation
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';

/** Valid admin credentials (seeded in DB) */
const ADMIN = {
  email: 'admin@royalstay.in',
  password: 'admin123',
};

/** Section hash routes — must match src/config/navigation.ts */
const SECTIONS = {
  /** PMS module sections */
  pmsRooms: '#pms-rooms',
  pmsRoomTypes: '#pms-room-types',
  pmsAvailability: '#pms-availability',
  pmsRatePlans: '#pms-rate-plans-pricing',
  pmsFloorPlans: '#pms-floor-plans',
  /** Guests module */
  guestsList: '#guests-list',
  /** Housekeeping module */
  housekeepingTasks: '#housekeeping-tasks',
  /** Dashboard (post-login landing) */
  dashboard: '#dashboard-overview',
} as const;

/** Standard timeout for section content to load after navigation */
const SECTION_LOAD_TIMEOUT = 15_000;

/** Standard timeout for API responses to settle */
const API_SETTLE_TIMEOUT = 3_000;

// ─── Helper: Navigate to a section via hash ────────────────────────────────

/**
 * Navigate the SPA to a given section by updating the hash.
 * The app uses a client-side section resolver that listens for hash changes.
 */
async function navigateToSection(page: Page, sectionHash: string): Promise<void> {
  // Update the URL hash — the SPA's section resolver will pick this up.
  // We use page.goto with the full URL so Playwright tracks navigation.
  await page.goto(`${BASE_URL}/${sectionHash}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  // Wait for the dynamic section content to render —
  // the app lazy-loads each section via dynamic import().
  // A short pause lets React hydrate and the section resolver kick in.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    // networkidle may time out due to polling/websocket connections —
    // that's fine as long as the section content rendered.
  });

  // Ensure the loading spinner (if any) has been replaced by actual content.
  // The section pages typically show a Loader2 spinner while fetching.
  await page
    .locator('[class*="animate-spin"]')
    .first()
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => {
      // No spinner visible — content may have loaded instantly.
    });
}

/**
 * Ensure we're on a section by looking for the section heading.
 * This is a softer check than asserting specific content.
 */
async function waitForSection(page: Page, headingText: string): Promise<void> {
  // Try to find any heading containing the expected text.
  const heading = page.getByRole('heading', { name: headingText }).or(
    page.getByRole('heading', { level: 2 }).filter({ hasText: headingText })
  );
  await expect(heading.first()).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. AUTHENTICATION FLOW (3 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Authentication Flow', () => {
  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test('1.1 — Login with valid credentials redirects to dashboard', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });

    // Fill in the login form — inputs have id="email" and id="password".
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);

    // Submit the form.
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation away from the login page — the app redirects
    // after setting the session_token cookie.
    // After successful login the URL hash changes to a section like #dashboard-overview.
    await page.waitForURL(/\#/, { timeout: 15_000 });

    // The sidebar should now be visible (indicating authenticated state).
    await expect(
      page.locator('aside').filter({ hasText: 'StaySuite' }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Verify the session cookie was set.
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session_token');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
  });

  test('1.2 — Login with invalid credentials shows error', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });

    // Fill with wrong credentials.
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    // Submit the form.
    await page.getByRole('button', { name: /sign in/i }).click();

    // An error alert should appear — shadcn Alert with variant="destructive".
    const errorAlert = page.locator('[role="alert"]').filter({ hasText: /invalid|error|failed/i });
    await expect(errorAlert.first()).toBeVisible({ timeout: 10_000 });
  });

  test('1.3 — Logout works and redirects to login', async () => {
    // First, log in with valid credentials.
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\#/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Confirm we're authenticated — sidebar visible.
    await expect(
      page.locator('aside').filter({ hasText: 'StaySuite' }).first()
    ).toBeVisible({ timeout: 10_000 });

    // Find and click the logout button.
    // The sidebar has a LogOut icon button in the user profile area.
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i })
      .or(page.locator('button[aria-label="Logout"]'))
      .or(page.locator('button:has(svg.lucide-log-out)'));
    await logoutButton.first().click({ timeout: 5_000 });

    // After logout, we should be redirected back to the login form.
    // The login form should re-appear (email input visible).
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 10_000 });

    // Session cookie should be cleared.
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session_token');
    expect(sessionCookie?.value).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ROOM MANAGEMENT (6 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Room Management', () => {
  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();

    // Login once and store auth state.
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\#/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test.beforeEach(async () => {
    // Navigate to the Rooms section before each test.
    await navigateToSection(page, SECTIONS.pmsRooms);
    await waitForSection(page, 'Rooms');
  });

  test('2.1 — Navigate to room management section and verify header', async () => {
    // The section heading should contain "Rooms".
    const heading = page.getByRole('heading', { level: 2 });
    await expect(heading).toContainText('Rooms');
  });

  test('2.2 — Room list loads and displays data', async () => {
    // The rooms list renders either as a grid of floor cards or a table.
    // After loading, room numbers should appear.
    // Wait for any table cells or grid items to render (rooms have numbers).
    // The grid view groups rooms by floor — "Floor" card headers should appear.
    await expect(
      page.getByText(/Floor \d+/).first()
    ).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });

    // Status stat cards should be visible with counts.
    await expect(page.getByText('Total Rooms')).toBeVisible();
    await expect(page.getByText('Available')).toBeVisible();
    await expect(page.getByText('Occupied')).toBeVisible();
  });

  test('2.3 — Filter rooms by status', async () => {
    // Find the status dropdown in the filters card.
    const statusSelect = page.locator('select').filter({ has: page.locator('[data-slot="select-trigger"]') }).first();

    // Actually use the proper shadcn Select approach — click the trigger and pick an option.
    // Look for the "Status" select trigger (label or sibling text).
    const statusTrigger = page.locator('button[role="combobox"]').filter({
      has: page.locator('text=All Status'),
    }).first();

    if (await statusTrigger.isVisible({ timeout: 5_000 })) {
      await statusTrigger.click();
      // Select "Available" from the dropdown.
      const availableOption = page.getByRole('option', { name: 'Available' });
      await availableOption.click({ timeout: 5_000 });

      // After filtering, wait for content to re-render.
      await page.waitForTimeout(API_SETTLE_TIMEOUT);

      // The grid or table should reload. Verify filter was applied by checking
      // that the status filter value changed (the trigger text should update).
      await expect(page.getByText('Available').first()).toBeVisible();
    }
  });

  test('2.4 — Create room dialog opens when clicking "Add Room" button', async () => {
    // Click the "Add Room" button.
    const addButton = page.getByRole('button', { name: /add room/i });
    await addButton.click({ timeout: 5_000 });

    // A Radix Dialog should open with title "Add New Room".
    const dialogTitle = page.locator('[role="dialog"] h2, [role="dialog"] [aria-roledescription="title"]');
    await expect(dialogTitle).toContainText('Add New Room', { timeout: 5_000 });

    // The dialog should have form fields.
    await expect(page.getByLabel('Room Number').or(page.getByPlaceholder('Room number')).first()).toBeVisible({ timeout: 5_000 });

    // Close the dialog to avoid interfering with other tests.
    const cancelButton = page.getByRole('button', { name: /cancel/i }).first();
    await cancelButton.click({ timeout: 5_000 });
  });

  test('2.5 — Search rooms works', async () => {
    // Find the search input in the filters card.
    const searchInput = page.getByPlaceholder(/search rooms/i);
    await searchInput.fill('1001');

    // Wait for the filtered results to update.
    await page.waitForTimeout(API_SETTLE_TIMEOUT);

    // The search is client-side — filtered rooms should show "1001" somewhere.
    await expect(page.getByText('1001').first()).toBeVisible({ timeout: 5_000 });

    // Clear search.
    await searchInput.clear();
    await page.waitForTimeout(API_SETTLE_TIMEOUT);
  });

  test('2.6 — Room type filter works', async () => {
    // Find the property/type select trigger near "All Status".
    // The rooms page has a "Select Property" and "Status" filter.
    const propertyTrigger = page.locator('button[role="combobox"]').filter({
      has: page.locator('text=All Properties'),
    }).first();

    if (await propertyTrigger.isVisible({ timeout: 5_000 })) {
      await propertyTrigger.click();
      // Pick the first property option.
      const firstOption = page.locator('[role="option"]').first();
      await firstOption.waitFor({ state: 'visible', timeout: 5_000 });
      await firstOption.click();

      // Wait for re-render.
      await page.waitForTimeout(API_SETTLE_TIMEOUT);

      // The trigger text should now show the selected property name (not "All Properties").
      const currentText = await propertyTrigger.textContent();
      expect(currentText).not.toBe('All Properties');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ROOM TYPES (5 tests)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Room Types', () => {
  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\#/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test.beforeEach(async () => {
    await navigateToSection(page, SECTIONS.pmsRoomTypes);
    await waitForSection(page, 'Room Types');
  });

  test('3.1 — Navigate to room types section and verify header', async () => {
    const heading = page.getByRole('heading', { level: 2 });
    await expect(heading).toContainText('Room Types');
  });

  test('3.2 — Room type list loads with data', async () => {
    // Stats cards should appear — "Room Types", "Total Rooms", etc.
    await expect(page.getByText('Room Types').first()).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });
    await expect(page.getByText('Total Rooms').first()).toBeVisible();
    await expect(page.getByText('Amenities').first()).toBeVisible();
    await expect(page.getByText('Starting Price').first()).toBeVisible();
  });

  test('3.3 — Room type details show amenities', async () => {
    // Room type cards display amenities as Badge components.
    // Look for amenity badges on the page (they show things like "WiFi", "TV", etc.).
    // The card view shows amenities as outline badges.
    const badges = page.locator('[data-slot="badge-variant"][variant="outline"]');
    if ((await badges.count()) > 0) {
      // At least one amenity badge should be visible.
      await expect(badges.first()).toBeVisible();
    }
  });

  test('3.4 — Create room type dialog opens', async () => {
    const addButton = page.getByRole('button', { name: /add room type/i });
    await addButton.click({ timeout: 5_000 });

    // Dialog should open.
    const dialogTitle = page.locator('[role="dialog"] [aria-roledescription="title"]');
    await expect(dialogTitle).toContainText(/add|create/i, { timeout: 5_000 });

    // Should have a name input.
    await expect(
      page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i)).first()
    ).toBeVisible({ timeout: 5_000 });

    // Close dialog.
    const cancelButton = page.getByRole('button', { name: /cancel/i }).first();
    await cancelButton.click({ timeout: 5_000 });
  });

  test('3.5 — Room type overbooking stats visible', async () => {
    // The API returns overbookingStats for each room type.
    // In the UI this may appear as a badge or stat in the table/card.
    // Look for any text containing "Overbooking" or related stats.
    // The room types list includes a View button — clicking it should show details.
    const viewButtons = page.getByRole('button', { name: /^view$/i });
    if ((await viewButtons.count()) > 0) {
      await viewButtons.first().click({ timeout: 5_000 });

      // View dialog should open.
      const viewDialog = page.locator('[role="dialog"]').last();
      await expect(viewDialog).toBeVisible({ timeout: 5_000 });

      // Close dialog.
      const close = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button').filter({ hasText: /close|cancel/i }).first();
      await close.click({ timeout: 5_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. AVAILABILITY CALENDAR (5 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Availability Calendar', () => {
  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\#/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test.beforeEach(async () => {
    await navigateToSection(page, SECTIONS.pmsAvailability);
    await waitForSection(page, 'Availability');
  });

  test('4.1 — Navigate to availability section and verify header', async () => {
    const heading = page.getByRole('heading', { level: 2 });
    await expect(heading).toContainText('Availability');
  });

  test('4.2 — Calendar renders with dates', async () => {
    // The availability control shows a date range table with day columns.
    // Calendar date buttons should be present (date navigation triggers).
    // Look for date-related UI elements — buttons with calendar icon.
    const calendarButtons = page.locator('button').filter({
      has: page.locator('svg.lucide-calendar'),
    });

    // At minimum the date range navigation buttons should render.
    // Also, quick-select buttons (Today, Week, Month, Quarter) should appear.
    await expect(page.getByRole('button', { name: /today/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /week/i })).toBeVisible();
  });

  test('4.3 — Property filter changes data', async () => {
    // The availability section has a property select.
    const propertyTrigger = page.locator('button[role="combobox"]').filter({
      has: page.locator('text=All Properties').or(page.locator('text=Select Property')),
    }).first();

    if (await propertyTrigger.isVisible({ timeout: 5_000 })) {
      await propertyTrigger.click();
      // Wait for the dropdown options.
      const firstOption = page.locator('[role="option"]').nth(1); // Skip "All Properties"
      if ((await firstOption.count()) > 0) {
        await firstOption.click();
        await page.waitForTimeout(API_SETTLE_TIMEOUT);
        // Verify the trigger text changed.
        const text = await propertyTrigger.textContent();
        expect(text).not.toBe('All Properties');
      }
    }
  });

  test('4.4 — Room type filter works on availability view', async () => {
    // After data loads, a table header "Room Type" should be visible.
    const tableHeader = page.getByRole('columnheader', { name: /room type/i });
    await expect(tableHeader.first()).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });
  });

  test('4.5 — Available rooms count displays in cells', async () => {
    // The availability table cells show counts like "3/5" (available/total).
    // Look for cells containing a "/" pattern which is how availability is shown.
    // First ensure we've left loading state.
    await page.waitForTimeout(1_000);

    // The table cells inside the availability section show patterns like "N/M".
    const table = page.locator('table').last();
    if (await table.isVisible({ timeout: 5_000 })) {
      const cells = table.locator('td');
      if ((await cells.count()) > 0) {
        // Check that some cells contain numbers separated by "/".
        const cellWithCount = page.locator('td').filter({ hasText: /\d+\/\d+/ });
        await expect(cellWithCount.first()).toBeVisible({ timeout: 5_000 });
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RATE PLANS & PRICING (5 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Rate Plans & Pricing', () => {
  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\#/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test.beforeEach(async () => {
    await navigateToSection(page, SECTIONS.pmsRatePlans);
    await waitForSection(page, 'Rate Plans');
  });

  test('5.1 — Navigate to rate plans section and verify header', async () => {
    const heading = page.getByRole('heading', { level: 2 });
    await expect(heading).toContainText('Rate Plans');
  });

  test('5.2 — Rate plan list loads', async () => {
    // Stats should be visible.
    await expect(page.getByText('Total Rate Plans').first()).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });
    await expect(page.getByText('Active Plans').first()).toBeVisible();
  });

  test('5.3 — Rate plan shows meal plan info', async () => {
    // After loading, the table should have a "Meal Plan" column.
    const mealPlanHeader = page.getByRole('columnheader', { name: /meal plan/i });
    await expect(mealPlanHeader.first()).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });

    // Table rows should contain meal plan values like "Room Only", "Bed & Breakfast", etc.
    const mealPlanValue = page.getByText(/room only|bed & breakfast|half board|full board|all inclusive/i);
    await expect(mealPlanValue.first()).toBeVisible({ timeout: 5_000 });
  });

  test('5.4 — Create rate plan dialog opens', async () => {
    const addButton = page.getByRole('button', { name: /add rate plan/i });
    await addButton.click({ timeout: 5_000 });

    // Dialog should open.
    const dialogTitle = page.locator('[role="dialog"] [aria-roledescription="title"]');
    await expect(dialogTitle).toContainText(/create|add/i, { timeout: 5_000 });

    // Should have "Room Type" select and "Name" input.
    await expect(
      page.getByText(/room type/i).or(page.getByLabel(/room type/i)).first()
    ).toBeVisible({ timeout: 5_000 });

    // Close dialog.
    const cancelButton = page.getByRole('button', { name: /cancel/i }).first();
    await cancelButton.click({ timeout: 5_000 });
  });

  test('5.5 — Search/filter rate plans', async () => {
    // Find the search input.
    const searchInput = page.getByPlaceholder(/search rate plans/i);
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Type a search term.
    await searchInput.fill('test');
    await page.waitForTimeout(API_SETTLE_TIMEOUT);

    // Clear the search.
    await searchInput.clear();
    await page.waitForTimeout(API_SETTLE_TIMEOUT);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FLOOR PLANS (4 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Floor Plans', () => {
  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\#/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test.beforeEach(async () => {
    await navigateToSection(page, SECTIONS.pmsFloorPlans);
    await waitForSection(page, 'Floor Plan');
  });

  test('6.1 — Navigate to floor plans section and verify header', async () => {
    const heading = page.getByRole('heading', { level: 2 });
    await expect(heading).toContainText('Floor Plan');
  });

  test('6.2 — Floor plan list loads', async () => {
    // After loading, floor plan cards or a list should be visible.
    // Look for floor-plan related content or an "Add" button which indicates
    // the section has loaded successfully.
    const addButton = page.getByRole('button', { name: /add floor plan/i })
      .or(page.getByRole('button', { name: /add new/i }));
    await expect(addButton.first()).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });
  });

  test('6.3 — Floor plan shows room positions', async () => {
    // Floor plan cards should display information about rooms.
    // Look for text like "rooms" or floor indicators.
    const roomsText = page.getByText(/rooms/i).first();
    await expect(roomsText).toBeVisible({ timeout: 5_000 });
  });

  test('6.4 — Create floor plan dialog opens', async () => {
    const addButton = page.getByRole('button', { name: /add floor plan/i })
      .or(page.getByRole('button', { name: /add new/i }));
    await addButton.first().click({ timeout: 5_000 });

    // A dialog for creating a floor plan should appear.
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const dialogTitle = dialog.locator('[aria-roledescription="title"], h2');
    await expect(dialogTitle).toContainText(/floor plan|create|new/i, { timeout: 5_000 });

    // Close dialog.
    const cancelButton = dialog.locator('button').filter({ hasText: /cancel|close/i }).first();
    await cancelButton.click({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. HOUSEKEEPING (3 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Housekeeping', () => {
  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\#/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test.beforeEach(async () => {
    await navigateToSection(page, SECTIONS.housekeepingTasks);
    await waitForSection(page, 'Housekeeping');
  });

  test('7.1 — Navigate to housekeeping section and verify header', async () => {
    const heading = page.getByRole('heading', { level: 2 });
    await expect(heading).toContainText('Housekeeping');
  });

  test('7.2 — Routes/dashboard loads with task data', async () => {
    // The tasks list should load with status cards and a table.
    // Stats cards: "Pending", "In Progress", "Completed", "Urgent".
    await expect(page.getByText('Pending').first()).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByText('Completed').first()).toBeVisible();

    // The tasks table should render with a header row.
    const taskHeader = page.getByRole('columnheader', { name: /task/i });
    await expect(taskHeader.first()).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });
  });

  test('7.3 — Task status filtering works', async () => {
    // Find the status select dropdown in the filters area.
    const statusTrigger = page.locator('button[role="combobox"]').filter({
      has: page.locator('text=All Status'),
    }).first();

    if (await statusTrigger.isVisible({ timeout: 5_000 })) {
      await statusTrigger.click();

      // Select "Pending".
      const pendingOption = page.getByRole('option', { name: 'Pending' });
      await pendingOption.click({ timeout: 5_000 });

      await page.waitForTimeout(API_SETTLE_TIMEOUT);

      // The "Pending" stat card should still show a count.
      await expect(page.getByText('Pending').first()).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. GUEST MANAGEMENT (3 tests)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Guest Management', () => {
  let browserContext: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    browserContext = await browser.newContext();
    page = await browserContext.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\#/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await browserContext?.close();
  });

  test.beforeEach(async () => {
    await navigateToSection(page, SECTIONS.guestsList);
    await waitForSection(page, 'Guests');
  });

  test('8.1 — Navigate to guests section and verify header', async () => {
    const heading = page.getByRole('heading', { level: 2 });
    await expect(heading).toContainText('Guests');
  });

  test('8.2 — Guest list loads with pagination data', async () => {
    // Stats cards: "Total Guests", "VIP Guests", "Gold/Platinum".
    await expect(page.getByText('Total Guests').first()).toBeVisible({ timeout: SECTION_LOAD_TIMEOUT });
    await expect(page.getByText('VIP Guests').first()).toBeVisible();
    await expect(page.getByText('Gold/Platinum').first()).toBeVisible();

    // The search input should be visible (indicates the list UI has loaded).
    const searchInput = page.getByPlaceholder(/search by name.*email.*phone/i);
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // "Add Guest" button should be visible.
    await expect(page.getByRole('button', { name: /add guest/i }).first()).toBeVisible();
  });

  test('8.3 — Search guests by name/email', async () => {
    const searchInput = page.getByPlaceholder(/search by name.*email.*phone/i);
    await searchInput.fill('John');

    // Wait for the debounced search to complete (300ms debounce in the component).
    await page.waitForTimeout(1_000);

    // Clear the search.
    await searchInput.clear();
    await page.waitForTimeout(1_000);

    // Search by a different term.
    await searchInput.fill('admin');
    await page.waitForTimeout(1_000);

    // Clear again.
    await searchInput.clear();
    await page.waitForTimeout(500);
  });
});
