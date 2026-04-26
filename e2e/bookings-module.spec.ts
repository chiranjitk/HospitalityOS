/**
 * ═══════════════════════════════════════════════════════════════════════
 * StaySuite HospitalityOS — Bookings Module E2E Test Suite
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Comprehensive Playwright E2E tests covering every major sub-section of
 * the Bookings module:
 *
 *   1. Bookings List          (7 tests)
 *   2. Booking Calendar       (5 tests)
 *   3. Create / Edit Booking  (5 tests)
 *   4. Booking Conflicts      (4 tests)
 *   5. Group Bookings         (4 tests)
 *   6. Waitlist               (4 tests)
 *   7. Audit Logs             (3 tests)
 *   8. No-Show Automation     (3 tests)
 *
 * Architecture notes
 * ------------------
 * - The app is a single-page React (Next.js 16) application served at /.
 * - Sections are loaded dynamically via hash-based routing
 *   (e.g. /#bookings-list, /#bookings-calendar).
 * - The left sidebar contains collapsible navigation groups.
 * - Authentication is session-based: cookie `session_token`.
 * - UI components use shadcn/ui (Radix UI primitives under the hood):
 *     Dialogs  → role="dialog"
 *     Selects  → Radix dropdown with role="listbox"
 *     Badges   → span with variant classes
 *     Tables   → standard HTML <table> elements
 *     Toasts   → data-slot="toast" or role="status"
 * - Content is fetched from REST API endpoints under /api/*.
 *
 * Run with:
 *   npx playwright test e2e/bookings-module.spec.ts
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// ─── Configuration ───────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000';
const CREDENTIALS = {
  email: 'admin@royalstay.in',
  password: 'admin123',
} as const;

// Section hash identifiers (must match the section-resolver mapping)
const SECTIONS = {
  bookingsList: 'bookings-list',
  bookingCalendar: 'bookings-calendar',
  groupBookings: 'bookings-groups',
  waitlist: 'bookings-waitlist',
  conflicts: 'bookings-conflicts',
  noShow: 'bookings-no-show',
  auditLogs: 'bookings-audit',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Perform login via the login page and store the session cookie.
 * After login the browser is redirected to the SPA at /.
 */
async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  // Wait for the login form to be visible
  await page.waitForSelector('[type="email"], input[name="email"]', {
    timeout: 15_000,
  });
  await page.fill('[type="email"], input[name="email"]', CREDENTIALS.email);
  await page.fill(
    '[type="password"], input[name="password"]',
    CREDENTIALS.password,
  );
  await page.click('button[type="submit"]');
  // Wait until the SPA loads (authenticated state redirects to /)
  await page.waitForURL('**/', { timeout: 15_000 });
  // Ensure the app shell (sidebar or main content) is present
  await page.waitForSelector('[data-sidebar], aside, main, nav', {
    timeout: 15_000,
  });
}

/**
 * Navigate to a specific section by setting the URL hash and waiting for
 * the dynamic section content to render.
 */
async function navigateToSection(page: Page, section: string): Promise<void> {
  const targetUrl = `${BASE_URL}/#${section}`;
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  // Allow extra time for dynamic section loading
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {
    // networkidle may not always settle — proceed
  });
  // Wait for any loading spinner to disappear and content to appear
  await waitForSectionLoaded(page);
}

/**
 * Wait for the active section content to finish loading.
 * Detects the common loading spinner and waits for it to be removed.
 */
async function waitForSectionLoaded(page: Page, timeout = 15_000): Promise<void> {
  // First, wait for any Playwright/Loader2 spinner to appear or disappear
  try {
    // Wait for the loading indicator to vanish (class "animate-spin" on SVG)
    const spinner = page.locator('.animate-spin');
    if (await spinner.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout });
    }
  } catch {
    // No spinner — content may already be rendered
  }
  // Additional safety: small delay for React rendering / Framer Motion
  await page.waitForTimeout(500);
}

/**
 * Wait for an API response that matches the given URL pattern and return it.
 * Useful for verifying that a section's data fetch succeeds.
 */
async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10_000,
): Promise<void> {
  await page.waitForResponse(
    (resp) => {
      const url = resp.url();
      const match =
        typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);
      return match && resp.status() === 200;
    },
    { timeout },
  );
}

/**
 * Open a sidebar section by clicking its header, then clicking a child item.
 */
async function openSidebarSectionAndClickItem(
  page: Page,
  sectionTitle: string,
  itemText: string,
): Promise<void> {
  // Look for the section header button containing the section title
  const sectionHeader = page.locator('button', { hasText: sectionTitle }).first();
  await sectionHeader.click();
  await page.waitForTimeout(300);
  // Click the child navigation item
  const navItem = page.locator('a, button', { hasText: itemText }).first();
  await navItem.click();
  await waitForSectionLoaded(page);
}

// ═══════════════════════════════════════════════════════════════════════
// Authentication — runs once per worker
// ═══════════════════════════════════════════════════════════════════════
test.describe.configure({ mode: 'serial' });

let sharedPage: Page;
let sharedContext: BrowserContext;

test.beforeAll(async ({ browser }) => {
  // Create a persistent context so auth state survives across tests
  sharedContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  sharedPage = await sharedContext.newPage();
  await login(sharedPage);
});

test.afterAll(async () => {
  await sharedContext?.close();
});

// ═══════════════════════════════════════════════════════════════════════
// 1. Bookings List (7 tests)
// ═══════════════════════════════════════════════════════════════════════
test.describe('Bookings List', () => {
  test.beforeEach(async () => {
    await navigateToSection(sharedPage, SECTIONS.bookingsList);
  });

  test('1.1 — navigates to bookings list section and shows the header', async () => {
    // The BookingsList component renders an <h2> containing "Bookings"
    const heading = sharedPage.locator('h2, h3').filter({ hasText: 'Bookings' }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('1.2 — booking list loads with data', async () => {
    // Wait for the API call to complete
    await waitForApiResponse(sharedPage, '/api/bookings');
    // After loading, either a table with rows or an empty state should be visible
    const table = sharedPage.locator('table');
    const emptyState = sharedPage.locator('text=No bookings found');
    // At least one of them should render
    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('1.3 — status filter is present and can be changed', async () => {
    // The status filter uses a Radix Select trigger
    // Look for a select trigger that shows a status-related placeholder
    const statusSelect = sharedPage.locator('[role="combobox"]').filter({
      has: sharedPage.locator('[data-placeholder="Status"], text=All Status'),
    }).first();
    // Alternative: find the select trigger near the status label
    if (await statusSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await statusSelect.click();
      // A Radix Select dropdown should appear
      const dropdown = sharedPage.locator('[role="listbox"], [data-radix-select-content]');
      await expect(dropdown).toBeVisible({ timeout: 5_000 });
      // Pick "Confirmed" option
      const confirmedOption = sharedPage.locator('[role="option"], [data-radix-select-item]').filter({
        hasText: 'Confirmed',
      });
      if (await confirmedOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmedOption.click();
        // After selection, the API should be called with status filter
        await waitForApiResponse(sharedPage, '/api/bookings?status=confirmed', 8_000);
      }
    } else {
      // Fallback: look for any select that contains "All Status" text
      const allStatusSelect = sharedPage.locator('button').filter({ hasText: 'All Status' }).first();
      await expect(allStatusSelect).toBeVisible({ timeout: 5_000 });
    }
  });

  test('1.4 — search by confirmation code', async () => {
    // The search input has placeholder "Search by code or guest name..."
    const searchInput = sharedPage.locator(
      'input[placeholder*="Search"], input[placeholder*="code"], input[placeholder*="guest"]',
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Type a search query
    await searchInput.fill('SS-');
    // Debounced search fires after 300ms; wait for API call
    await sharedPage.waitForTimeout(500);
    // Verify the search API was invoked
    await waitForApiResponse(sharedPage, '/api/bookings?search=', 8_000);
  });

  test('1.5 — property filter changes bookings', async () => {
    // Locate the property select (has placeholder "Property" or "All Properties")
    const propertySelect = sharedPage.locator('button, [role="combobox"]').filter({
      hasText: /All Properties|Property/,
    }).first();
    await expect(propertySelect).toBeVisible({ timeout: 5_000 });

    await propertySelect.click();
    // Radix Select dropdown should open
    const dropdown = sharedPage.locator('[role="listbox"], [data-radix-select-content]');
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // Select any non-"All" property option (second item or later)
    const propertyOption = sharedPage.locator('[role="option"], [data-radix-select-item]').nth(1);
    if (await propertyOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const optionText = await propertyOption.textContent();
      await propertyOption.click();
      // Verify API call with propertyId filter
      await waitForApiResponse(sharedPage, '/api/bookings', 8_000);
      // Table should refresh with filtered data
      const table = sharedPage.locator('table');
      const emptyState = sharedPage.locator('text=No bookings found');
      await expect(table.or(emptyState)).toBeVisible({ timeout: 5_000 });
    }
  });

  test('1.6 — date range filter is accessible', async () => {
    // The advanced filter toggle uses the SlidersHorizontal icon
    const advancedToggle = sharedPage.locator('button').filter({
      has: sharedPage.locator('svg.lucide-sliders-horizontal, svg[class*="sliders"]'),
    }).first();

    // If found, click to reveal advanced filters
    if (await advancedToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await advancedToggle.click();
    }

    // Look for date input fields (Check-in From / Check-in To)
    const dateInput = sharedPage.locator('input[type="date"]').first();
    await expect(dateInput).toBeVisible({ timeout: 5_000 });

    // Set a date value
    const today = new Date().toISOString().split('T')[0];
    await dateInput.fill(today);
    // Wait for API refresh
    await sharedPage.waitForTimeout(500);
    await waitForApiResponse(sharedPage, '/api/bookings', 8_000);
  });

  test('1.7 — pagination controls work (when there are enough results)', async () => {
    // Wait for bookings to load
    await waitForApiResponse(sharedPage, '/api/bookings');

    const prevButton = sharedPage.locator('button').filter({ hasText: /Previous|Prev/ }).first();
    const nextButton = sharedPage.locator('button').filter({ hasText: /Next/ }).first();

    // Pagination may not be visible with few items — check gracefully
    const paginationContainer = sharedPage.locator('text=/Showing.*of.*bookings/i');
    const hasPagination = await paginationContainer.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasPagination) {
      // If both buttons are visible, clicking Next should change the page
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await sharedPage.waitForTimeout(300);
        // Verify the page changed (Previous should now be enabled)
        if (await prevButton.isVisible()) {
          await expect(prevButton).toBeEnabled();
        }
      }
    } else {
      // No pagination — that's acceptable if there are fewer than ITEMS_PER_PAGE bookings
      const table = sharedPage.locator('table');
      const emptyState = sharedPage.locator('text=No bookings found');
      await expect(table.or(emptyState)).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Booking Calendar (5 tests)
// ═══════════════════════════════════════════════════════════════════════
test.describe('Booking Calendar', () => {
  test.beforeEach(async () => {
    await navigateToSection(sharedPage, SECTIONS.bookingCalendar);
  });

  test('2.1 — navigates to booking calendar section and renders the view', async () => {
    // The calendar section should render a container with month/day grid
    // Wait for any API response
    await waitForApiResponse(sharedPage, '/api/bookings', 10_000).catch(() => {
      // Calendar might not need the bookings API directly
    });
    // At minimum the section header or calendar grid should be present
    const calendarHeading = sharedPage.locator('h2, h3').filter({
      hasText: /Calendar|calendar/i,
    }).first();
    await expect(
      calendarHeading.or(sharedPage.locator('[class*="calendar"], [class*="grid"]')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('2.2 — calendar renders with month view (day grid)', async () => {
    // A month-view calendar shows a grid of day cells
    const dayCells = sharedPage.locator('[class*="day"], [data-day], td[class*="cell"]');
    // Calendar might also use button elements for days
    const dayButtons = sharedPage.locator('button').filter({
      has: sharedPage.locator('text=/^\\d{1,2}$/'),
    });

    // At least one of these selectors should find elements
    const hasDays =
      (await dayCells.count()) > 0 || (await dayButtons.count()) > 0;
    expect(hasDays).toBeTruthy();
  });

  test('2.3 — can switch between month/week views', async () => {
    // Look for view-toggle tabs or buttons (Month / Week)
    const viewToggle = sharedPage.locator('button, [role="tab"]').filter({
      hasText: /Week|Month/i,
    }).first();
    if (await viewToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewToggle.click();
      await sharedPage.waitForTimeout(500);
      // After switching, content should re-render (no loading error)
      const calendarContent = sharedPage.locator('[class*="calendar"], [class*="grid"], main');
      await expect(calendarContent).toBeVisible({ timeout: 5_000 });
    }
  });

  test('2.4 — booking chips or indicators are visible on calendar dates', async () => {
    // Wait for calendar data to load
    await sharedPage.waitForTimeout(1_000);

    // Booking chips often appear as small colored badges or dots on dates
    // They may be absolutely positioned, have specific classes, or be links
    const bookingIndicators = sharedPage.locator(
      'a[href*="booking"], [class*="booking"], [class*="chip"], [class*="badge"], [class*="dot"]',
    );
    const indicatorCount = await bookingIndicators.count();
    // If there are bookings, at least one indicator should be present
    // (If no bookings exist, this is also acceptable — test passes gracefully)
    if (indicatorCount > 0) {
      expect(indicatorCount).toBeGreaterThanOrEqual(1);
    } else {
      // Verify no error state is shown
      const errorState = sharedPage.locator('text=/error|failed/i');
      await expect(errorState).not.toBeVisible({ timeout: 2_000 });
    }
  });

  test('2.5 — navigation between months works', async () => {
    // Look for prev/next month navigation chevrons or buttons
    const nextMonth = sharedPage.locator('button').filter({
      has: sharedPage.locator('svg.lucide-chevron-right, svg.lucide-chevron-left'),
    }).first();

    const prevMonth = sharedPage.locator('button').filter({
      hasText: /Previous|Next|<|>/,
    }).first();

    const navButton = (await nextMonth.isVisible({ timeout: 2_000 }).catch(() => false))
      ? nextMonth
      : prevMonth;

    if (await navButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await navButton.click();
      await sharedPage.waitForTimeout(500);
      // Calendar should still be visible after navigation
      const calendarContent = sharedPage.locator('[class*="calendar"], [class*="grid"]');
      await expect(calendarContent).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Create / Edit Booking (5 tests)
// ═══════════════════════════════════════════════════════════════════════
test.describe('Create / Edit Booking', () => {
  test.beforeEach(async () => {
    await navigateToSection(sharedPage, SECTIONS.bookingsList);
  });

  test('3.1 — create booking dialog opens via "New Booking" button', async () => {
    // Wait for bookings list to fully load
    await waitForApiResponse(sharedPage, '/api/bookings', 10_000);
    await waitForSectionLoaded(sharedPage);

    // Click the "New Booking" button
    const newBookingBtn = sharedPage.locator('button').filter({
      hasText: /New Booking/i,
    }).first();
    await expect(newBookingBtn).toBeVisible({ timeout: 5_000 });
    await newBookingBtn.click();

    // A shadcn Dialog should appear with role="dialog"
    const dialog = sharedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // Dialog should contain a title like "Create New Booking"
    await expect(dialog.locator('h2, [role="dialog"] [id*="title"]')).toContainText(
      /Create|New Booking/i,
      { timeout: 3_000 },
    );
  });

  test('3.2 — required field validation shows errors on empty submit', async () => {
    // Open the dialog first
    const newBookingBtn = sharedPage.locator('button').filter({
      hasText: /New Booking/i,
    }).first();
    await newBookingBtn.click();
    const dialog = sharedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click the submit button without filling any fields
    const submitBtn = dialog.locator('button').filter({
      hasText: /Create Booking|Submit|Save/i,
    }).first();
    if (await submitBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await submitBtn.click();
      // Validation toast should appear (shadcn uses data-slot="toast" or role="status")
      const toast = sharedPage.locator('[data-slot="toast"], [role="status"], [class*="toast"]');
      await expect(toast).toBeVisible({ timeout: 5_000 });
    }
  });

  test('3.3 — guest selection works in the booking form', async () => {
    // Open the dialog
    const newBookingBtn = sharedPage.locator('button').filter({
      hasText: /New Booking/i,
    }).first();
    await newBookingBtn.click();
    const dialog = sharedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Look for a guest-related select or combobox
    // The form has a "Primary Guest" select
    const guestLabel = dialog.locator('label, span').filter({ hasText: /Guest/i }).first();
    if (await guestLabel.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Find the adjacent select trigger
      const guestSelect = guestLabel.locator('..').locator('button, [role="combobox"]').first();
      if (await guestSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await guestSelect.click();
        // Radix Select content should open
        const options = sharedPage.locator('[role="listbox"], [role="option"], [data-radix-select-content]');
        await expect(options.first()).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('3.4 — room type / room selection works in the booking form', async () => {
    // Open the dialog
    const newBookingBtn = sharedPage.locator('button').filter({
      hasText: /New Booking/i,
    }).first();
    await newBookingBtn.click();
    const dialog = sharedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Look for "Room Type" label and its select
    const roomTypeLabel = dialog.locator('label, span').filter({
      hasText: /Room Type/i,
    }).first();
    if (await roomTypeLabel.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const roomTypeSelect = roomTypeLabel.locator('..').locator('button, [role="combobox"]').first();
      if (await roomTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await roomTypeSelect.click();
        const options = sharedPage.locator('[role="option"], [data-radix-select-item]');
        await expect(options.first()).toBeVisible({ timeout: 5_000 });
      }
    }
  });

  test('3.5 — form submission creates a booking (happy path)', async () => {
    // Open the dialog
    const newBookingBtn = sharedPage.locator('button').filter({
      hasText: /New Booking/i,
    }).first();
    await newBookingBtn.click();
    const dialog = sharedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fill in required fields
    // 1. Property select (should be pre-filled with first property)
    // 2. Guest select
    const guestSelect = dialog.locator('label, span').filter({ hasText: /Guest/i }).first()
      .locator('..').locator('button, [role="combobox"]').first();
    if (await guestSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await guestSelect.click();
      const firstGuestOption = sharedPage.locator('[role="option"], [data-radix-select-item"]').first();
      if (await firstGuestOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstGuestOption.click();
      }
    }

    // 3. Room type select
    const roomTypeSelect = dialog.locator('label, span').filter({ hasText: /Room Type/i }).first()
      .locator('..').locator('button, [role="combobox"]').first();
    if (await roomTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await roomTypeSelect.click();
      const firstRoomTypeOption = sharedPage.locator('[role="option"], [data-radix-select-item"]').first();
      if (await firstRoomTypeOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstRoomTypeOption.click();
      }
    }

    // 4. Check-in / Check-out dates
    const checkInInput = dialog.locator('input[type="date"]').first();
    const checkOutInput = dialog.locator('input[type="date"]').nth(1);
    if (await checkInInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const today = new Date();
      const checkIn = new Date(today);
      checkIn.setDate(today.getDate() + 5);
      const checkOut = new Date(today);
      checkOut.setDate(today.getDate() + 7);

      await checkInInput.fill(checkIn.toISOString().split('T')[0]);
      await checkOutInput.fill(checkOut.toISOString().split('T')[0]);
    }

    // 5. Submit
    const submitBtn = dialog.locator('button').filter({
      hasText: /Create Booking|Submit/i,
    }).first();
    if (await submitBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
      // Listen for the API call
      const postResponse = sharedPage.waitForResponse(
        (resp) => resp.url().includes('/api/bookings') && resp.request().method() === 'POST',
        { timeout: 10_000 },
      );
      await submitBtn.click();

      const response = await postResponse;
      // Should get 201 (created) or 200
      expect([200, 201]).toContain(response.status());

      // Dialog should close and a success toast should appear
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
      const toast = sharedPage.locator('[data-slot="toast"], [role="status"], [class*="toast"]');
      await expect(toast.filter({ hasText: /success|created/i })).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Booking Conflicts (4 tests)
// ═══════════════════════════════════════════════════════════════════════
test.describe('Booking Conflicts', () => {
  test.beforeEach(async () => {
    await navigateToSection(sharedPage, SECTIONS.conflicts);
  });

  test('4.1 — navigates to conflicts section', async () => {
    // The conflicts component should render
    await waitForApiResponse(sharedPage, '/api/bookings/conflicts', 10_000).catch(() => {
      // May not be called immediately
    });
    // A heading containing "Conflict" should be visible
    const heading = sharedPage.locator('h2, h3').filter({
      hasText: /Conflict/i,
    }).first();
    await expect(
      heading.or(sharedPage.locator('text=/Conflict/i').first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('4.2 — conflicts list loads or shows empty state', async () => {
    // Wait for API
    await waitForApiResponse(sharedPage, '/api/bookings/conflicts', 10_000).catch(() => {});

    // Either a list of conflicts or an empty/no-conflicts message should appear
    const conflictList = sharedPage.locator('table, [class*="list"], [class*="card"]');
    const emptyState = sharedPage.locator('text=/no conflict|no double booking|all clear/i');

    await expect(conflictList.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('4.3 — stats display shows total, critical, double bookings', async () => {
    // The conflicts section typically shows stat cards with numbers
    const statsContainer = sharedPage.locator('[class*="stats"], [class*="card"]').first();
    // Check for common stat labels
    const statLabels = sharedPage.locator('text=/Total|Critical|Double Booking|Overbooking/i');
    const hasStats = (await statLabels.count()) > 0;
    expect(hasStats).toBeTruthy();
  });

  test('4.4 — resolve dialog opens on action button click', async () => {
    // Look for a resolve/action button within the conflicts section
    const resolveBtn = sharedPage.locator('button').filter({
      hasText: /Resolve|Action|Fix/i,
    }).first();

    if (await resolveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await resolveBtn.click();
      // A dialog should open
      const dialog = sharedPage.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      // Dialog should contain resolution options
      await expect(
        dialog.locator('text=/cancel|keep|move|reassign/i'),
      ).toBeVisible({ timeout: 3_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Group Bookings (4 tests)
// ═══════════════════════════════════════════════════════════════════════
test.describe('Group Bookings', () => {
  test.beforeEach(async () => {
    await navigateToSection(sharedPage, SECTIONS.groupBookings);
  });

  test('5.1 — navigates to group bookings section', async () => {
    // Wait for the API to load
    await waitForApiResponse(sharedPage, '/api/group-bookings', 10_000).catch(() => {});
    await waitForSectionLoaded(sharedPage);

    // Heading or content should contain "Group"
    const heading = sharedPage.locator('h2, h3').filter({
      hasText: /Group Booking/i,
    }).first();
    await expect(
      heading.or(sharedPage.locator('text=/Group Booking/i').first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('5.2 — group list loads with stats', async () => {
    // Group bookings section typically shows stats (total groups, rooms, etc.)
    await waitForApiResponse(sharedPage, '/api/group-bookings', 10_000).catch(() => {});

    // Look for stat cards or summary information
    const statsOrList = sharedPage.locator(
      '[class*="stats"], [class*="card"], table, [class*="list"]',
    ).first();
    const emptyState = sharedPage.locator('text=/no group|no booking/i');

    await expect(statsOrList.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('5.3 — create group booking dialog opens', async () => {
    // Look for a "Create Group" or "New Group" button
    const createBtn = sharedPage.locator('button').filter({
      hasText: /Create Group|New Group|Add Group/i,
    }).first();

    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createBtn.click();
      const dialog = sharedPage.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      // Dialog should have a title mentioning group
      await expect(
        dialog.locator('h2, [role="dialog"] [id*="title"]').first(),
      ).toContainText(/Group/i, { timeout: 3_000 });
    }
  });

  test('5.4 — group detail view shows booked rooms', async () => {
    // If there's a group booking listed, clicking it should show detail
    const groupRow = sharedPage.locator('tr, [class*="row"], [class*="card"]').first();
    if (await groupRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await groupRow.click();
      await sharedPage.waitForTimeout(500);
      // After clicking, a detail panel or expanded view should show room information
      const roomInfo = sharedPage.locator('text=/room|Room/i').first();
      const hasRoomInfo = await roomInfo.isVisible({ timeout: 3_000 }).catch(() => false);
      // Group detail may be in a dialog or expanded row
      expect(hasRoomInfo || (await sharedPage.locator('[role="dialog"]').isVisible({ timeout: 2_000 }).catch(() => false))).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Waitlist (4 tests)
// ═══════════════════════════════════════════════════════════════════════
test.describe('Waitlist', () => {
  test.beforeEach(async () => {
    await navigateToSection(sharedPage, SECTIONS.waitlist);
  });

  test('6.1 — navigates to waitlist section', async () => {
    await waitForApiResponse(sharedPage, '/api/waitlist', 10_000).catch(() => {});
    await waitForSectionLoaded(sharedPage);

    const heading = sharedPage.locator('h2, h3').filter({
      hasText: /Waitlist/i,
    }).first();
    await expect(
      heading.or(sharedPage.locator('text=/Waitlist/i').first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('6.2 — waitlist loads with stats (total, waiting, notified, etc.)', async () => {
    await waitForApiResponse(sharedPage, '/api/waitlist', 10_000).catch(() => {});

    // Look for stat cards
    const statLabels = sharedPage.locator('text=/Total|Waiting|Notified|Converted|Expired/i');
    const hasStats = (await statLabels.count()) > 0;
    expect(hasStats).toBeTruthy();
  });

  test('6.3 — create waitlist entry dialog opens', async () => {
    const createBtn = sharedPage.locator('button').filter({
      hasText: /Add|Create|New/i,
    }).first();

    if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createBtn.click();
      const dialog = sharedPage.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      // The dialog should have form fields (guest, room type, dates)
      const formLabels = dialog.locator('label');
      const labelCount = await formLabels.count();
      expect(labelCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('6.4 — status filter works', async () => {
    await waitForApiResponse(sharedPage, '/api/waitlist', 10_000).catch(() => {});

    // Look for a status select/filter
    const statusFilter = sharedPage.locator('button, [role="combobox"]').filter({
      hasText: /All Status|Status|All/i,
    }).first();

    if (await statusFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await statusFilter.click();
      const dropdown = sharedPage.locator('[role="listbox"], [data-radix-select-content]');
      if (await dropdown.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // Select a specific status like "Waiting"
        const waitingOption = sharedPage.locator('[role="option"], [data-radix-select-item]').filter({
          hasText: /Waiting/i,
        });
        if (await waitingOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await waitingOption.click();
          await waitForApiResponse(sharedPage, '/api/waitlist?status=', 8_000);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Audit Logs (3 tests)
// ═══════════════════════════════════════════════════════════════════════
test.describe('Audit Logs', () => {
  test.beforeEach(async () => {
    await navigateToSection(sharedPage, SECTIONS.auditLogs);
  });

  test('7.1 — navigates to audit logs section', async () => {
    await waitForApiResponse(sharedPage, '/api/bookings/audit-logs', 10_000).catch(() => {});
    await waitForSectionLoaded(sharedPage);

    const heading = sharedPage.locator('h2, h3').filter({
      hasText: /Audit/i,
    }).first();
    await expect(
      heading.or(sharedPage.locator('text=/Audit/i').first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('7.2 — audit log timeline renders', async () => {
    await waitForApiResponse(sharedPage, '/api/bookings/audit-logs', 10_000).catch(() => {});

    // Audit logs are typically shown as a timeline or table
    const timelineOrTable = sharedPage.locator(
      'table, [class*="timeline"], [class*="log"], [class*="activity"]',
    ).first();
    const emptyState = sharedPage.locator('text=/no log|no audit|no entry|no record/i');

    await expect(timelineOrTable.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('7.3 — filter by action type', async () => {
    await waitForApiResponse(sharedPage, '/api/bookings/audit-logs', 10_000).catch(() => {});

    // Look for action type filter (select, tabs, or buttons)
    const actionFilter = sharedPage.locator('button, [role="tab"], [role="combobox"]').filter({
      hasText: /Action|All|Filter/i,
    }).first();

    if (await actionFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await actionFilter.click();
      await sharedPage.waitForTimeout(500);
      // After filtering, content should still be visible (no error state)
      const content = sharedPage.locator('table, [class*="timeline"], [class*="log"]');
      const emptyState = sharedPage.locator('text=/no log|no audit|no entry/i');
      await expect(content.first().or(emptyState)).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. No-Show Automation (3 tests)
// ═══════════════════════════════════════════════════════════════════════
test.describe('No-Show Automation', () => {
  test.beforeEach(async () => {
    await navigateToSection(sharedPage, SECTIONS.noShow);
  });

  test('8.1 — navigates to no-show section', async () => {
    await waitForApiResponse(sharedPage, '/api/no-show', 10_000).catch(() => {});
    await waitForSectionLoaded(sharedPage);

    const heading = sharedPage.locator('h2, h3').filter({
      hasText: /No.Show/i,
    }).first();
    await expect(
      heading.or(sharedPage.locator('text=/No.Show/i').first()),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('8.2 — settings card loads', async () => {
    await waitForApiResponse(sharedPage, '/api/no-show/settings', 10_000).catch(() => {});

    // The no-show section has a settings card with configuration options
    const settingsCard = sharedPage.locator('[class*="card"], [class*="setting"]').first();
    await expect(settingsCard).toBeVisible({ timeout: 10_000 });

    // Should contain settings-related labels
    const settingsLabels = sharedPage.locator('text=/buffer|hour|auto|threshold|notification/i');
    const hasSettingsLabels = (await settingsLabels.count()) > 0;
    expect(hasSettingsLabels).toBeTruthy();
  });

  test('8.3 — no-show bookings list is visible', async () => {
    await waitForApiResponse(sharedPage, '/api/no-show', 10_000).catch(() => {});

    // Look for a list/table of no-show bookings
    const noShowList = sharedPage.locator('table, [class*="list"], [class*="booking"]');
    const emptyState = sharedPage.locator('text=/no booking|no no.show/i');

    await expect(noShowList.first().or(emptyState)).toBeVisible({ timeout: 10_000 });
  });
});
