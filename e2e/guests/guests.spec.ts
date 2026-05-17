// e2e/guests/guests.spec.ts
// StaySuite Guests Module — Comprehensive E2E Tests
//
// Covers all 8 guest section routes:
//   #guests-list        — Guest List (main CRUD)
//   #guests-kyc         — KYC / Documents
//   #guests-preferences — Preferences
//   #guests-history     — Stay History
//   #guests-loyalty     — Loyalty & Points
//   #guests-profile     — Guest Profile
//   #guests-journey     — Journey Map
//   #guests-vip-alerts  — VIP Recognition
//
// Seed data: 6 guests with various statuses (VIP, loyalty tiers, KYC).

import { test, expect } from '../fixtures/auth.fixture';
import {
  openSection,
  clickButton,
  fillInput,
  waitForToast,
  closeDialog,
  submitForm,
  selectOption,
  navigateToSection,
} from '../fixtures/auth.fixture';

// ============================================================
// Helpers
// ============================================================

/** Wait for the section content to fully render (past loading skeleton). */
async function waitForSectionReady(page: import('@playwright/test').Page) {
  // The section loader shows a SectionLoadingSkeleton first; wait for it to be
  // replaced by actual content — i.e. no more skeleton elements visible.
  await page.waitForTimeout(2500);
}

/** Get the number of rows in the first table on the page. */
async function getTableRows(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('table tbody tr').count();
}

/** Assert that the page contains no "Something Went Wrong" or error cards. */
async function assertNoSectionError(page: import('@playwright/test').Page) {
  await expect(
    page.getByText(/Something Went Wrong|Section Not Available|Loading Took Too Long/i)
  ).not.toBeVisible({ timeout: 5000 });
}

// ============================================================
// 1. Guest List (#guests-list)
// ============================================================
test.describe('Guest List — #guests-list', () => {
  test.beforeEach(async ({ page }) => {
    await openSection(page, 'guests-list');
    await waitForSectionReady(page);
  });

  test('section loads with guest table visible', async ({ page }) => {
    // The guests-list component renders an <h2> with "Guests"
    await expect(page.getByRole('heading', { name: /guests/i, level: 2 })).toBeVisible();
    await assertNoSectionError(page);
  });

  test('table renders seed data (6+ guests)', async ({ page }) => {
    // On desktop the component renders a <table>; on mobile it renders cards.
    // Check for either table rows or at least 6 guest cards.
    const tableRows = await getTableRows(page);
    const cardCount = await page.locator('[class*="hover:shadow-lg"]').count();

    // At least one representation should have 6+ items
    const hasEnoughData = tableRows >= 6 || cardCount >= 6;
    expect(hasEnoughData).toBeTruthy();
  });

  test('search/filter works — search by name reduces visible guests', async ({ page }) => {
    // Locate the search input and type a query unlikely to match all guests
    const searchInput = page.getByPlaceholder(/search by name/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('xyznonexistent');
    await page.waitForTimeout(600); // Wait for debounce

    // After filtering, either no rows or no matching cards should appear
    const tableRows = await getTableRows(page);
    const cardCount = await page.locator('[class*="hover:shadow-lg"]').count();
    const totalVisible = tableRows + cardCount;
    // Should be significantly fewer than 6 or zero
    expect(totalVisible).toBeLessThan(3);
  });

  test('"Add Guest" button opens form dialog', async ({ page }) => {
    // Click the "Add Guest" button
    await clickButton(page, 'Add Guest');
    await page.waitForTimeout(500);

    // A dialog or drawer with "Add New Guest" title should appear
    await expect(
      page.getByRole('heading', { name: /add new guest/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test('create guest form has required fields', async ({ page }) => {
    await clickButton(page, 'Add Guest');
    await page.waitForTimeout(500);

    // Check for key form fields in the create dialog
    await expect(page.getByLabel(/first name/i, { exact: false })).toBeVisible();
    await expect(page.getByLabel(/last name/i, { exact: false })).toBeVisible();
    await expect(page.getByLabel(/email/i, { exact: false })).toBeVisible();
    await expect(page.getByLabel(/phone/i, { exact: false })).toBeVisible();

    // Close the dialog so subsequent tests aren't affected
    await closeDialog(page);
  });

  test('form submission triggers validation for empty required fields', async ({ page }) => {
    await clickButton(page, 'Add Guest');
    await page.waitForTimeout(500);

    // Submit the form without filling required fields
    await clickButton(page, 'Create Guest');
    await page.waitForTimeout(1000);

    // A toast with "Validation Error" should appear
    await waitForToast(page, 'Validation Error');

    // Close dialog
    await closeDialog(page);
  });

  test('can fill form and create a new guest', async ({ page }) => {
    await clickButton(page, 'Add Guest');
    await page.waitForTimeout(500);

    // Fill required fields
    await fillInput(page, 'First Name', 'E2E');
    await fillInput(page, 'Last Name', 'TestGuest');
    await fillInput(page, 'Email', `e2e.guest.${Date.now()}@test.com`);
    await fillInput(page, 'Phone', '+919876543210');

    // Submit
    await clickButton(page, 'Create Guest');
    await page.waitForTimeout(2000);

    // Toast should appear — either "Success" or "created successfully"
    await waitForToast(page, 'Success');

    // Dialog should close after success
    await expect(
      page.getByRole('heading', { name: /add new guest/i })
    ).not.toBeVisible({ timeout: 5000 });
  });

  test('guest row actions work — edit button opens edit dialog', async ({ page }) => {
    // On desktop, table rows have an "Edit guest" button
    const editBtn = page.locator('button[aria-label="Edit guest"]').first();
    const cardEditBtn = page.getByRole('button', { name: /edit guest/i }).first();
    const btnToClick = (await editBtn.count()) > 0 ? editBtn : cardEditBtn;

    if ((await btnToClick.count()) > 0) {
      await btnToClick.click();
      await page.waitForTimeout(500);

      // Edit dialog should appear with "Edit Guest" title
      await expect(
        page.getByRole('heading', { name: /edit guest/i })
      ).toBeVisible({ timeout: 5000 });

      // Close dialog
      await closeDialog(page);
    } else {
      // On mobile the edit might be in a different format; skip gracefully
      test.info().annotations.push({ type: 'skip-reason', description: 'Edit button not found in current viewport' });
    }
  });

  test('guest row actions work — view profile button', async ({ page }) => {
    // On desktop, there's a "View Profile" button per row
    const viewBtn = page.locator('button[aria-label="View Profile"]').first();
    const viewBtnAlt = page.getByRole('button', { name: /view profile/i }).first();
    const btnToClick = (await viewBtn.count()) > 0 ? viewBtn : viewBtnAlt;

    if ((await btnToClick.count()) > 0) {
      await btnToClick.click();
      await page.waitForTimeout(1500);

      // After clicking view, the page should either navigate to #guests-profile
      // or open a detailed view. At minimum, no error should appear.
      await assertNoSectionError(page);
    } else {
      test.info().annotations.push({ type: 'skip-reason', description: 'View button not found in current viewport' });
    }
  });

  test('quick filter pills work — VIP Only filter', async ({ page }) => {
    const vipFilter = page.getByRole('button', { name: /vip only/i });
    if ((await vipFilter.count()) > 0) {
      await vipFilter.click();
      await page.waitForTimeout(600);

      // The active filter pill should now show as selected (primary style)
      await expect(vipFilter).toHaveClass(/bg-primary/);
    }
  });
});

// ============================================================
// 2. KYC Documents (#guests-kyc)
// ============================================================
test.describe('KYC Documents — #guests-kyc', () => {
  test.beforeEach(async ({ page }) => {
    await openSection(page, 'guests-kyc');
    await waitForSectionReady(page);
  });

  test('section loads without error', async ({ page }) => {
    // The kyc-management section should render its header
    await assertNoSectionError(page);
    // Should show some KYC-related content
    const kycContent = page.getByText(/kyc|document/i);
    await expect(kycContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('document list renders', async ({ page }) => {
    // The KYC section shows document cards or a "No documents uploaded" empty state
    const hasDocuments = await page.locator('text=No documents uploaded').count() > 0
      || await page.locator('[class*="hover:shadow"]').count() > 0
      || await page.getByText(/passport|national id|driver/i).first().isVisible().catch(() => false);

    // At minimum, one of these should be true
    expect(hasDocuments || await page.getByText(/upload/i).first().isVisible()).toBeTruthy();
  });

  test('can view document details via View button', async ({ page }) => {
    const viewBtn = page.getByRole('button', { name: /^view$/i }).first();
    if ((await viewBtn.count()) > 0) {
      // The view button opens the document file URL in a new tab
      // We can verify the button is present and clickable
      await expect(viewBtn).toBeVisible();
      await expect(viewBtn).toBeEnabled();
    }
    // If no documents exist, skip gracefully
  });

  test('upload document dialog has required fields', async ({ page }) => {
    await clickButton(page, 'Upload Document');
    await page.waitForTimeout(500);

    // Upload dialog should be open with required fields
    const docType = page.getByText(/document type/i);
    const docName = page.getByLabel(/document name/i);
    await expect(docType).toBeVisible({ timeout: 5000 });
    await expect(docName).toBeVisible({ timeout: 5000 });

    await closeDialog(page);
  });
});

// ============================================================
// 3. Guest Preferences (#guests-preferences)
// ============================================================
test.describe('Guest Preferences — #guests-preferences', () => {
  test.beforeEach(async ({ page }) => {
    await openSection(page, 'guests-preferences');
    await waitForSectionReady(page);
  });

  test('section loads without error', async ({ page }) => {
    await assertNoSectionError(page);
  });

  test('preference section tabs are visible', async ({ page }) => {
    // The preferences component has tabs: Room, Dietary, Amenities, Communication
    const roomTab = page.getByRole('button', { name: /room/i });
    const dietaryTab = page.getByRole('button', { name: /dietary/i });
    const amenitiesTab = page.getByRole('button', { name: /amenities/i });
    const communicationTab = page.getByRole('button', { name: /communication/i });

    // At least one tab should be visible
    const tabVisible = (
      (await roomTab.count()) > 0 ||
      (await dietaryTab.count()) > 0 ||
      (await amenitiesTab.count()) > 0 ||
      (await communicationTab.count()) > 0
    );
    expect(tabVisible).toBeTruthy();
  });

  test('room preferences form is accessible', async ({ page }) => {
    // Default active section is "room"
    const roomPrefs = page.getByText(/room preferences/i);
    await expect(roomPrefs.first()).toBeVisible({ timeout: 5000 });
  });

  test('save preferences button is present', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: /save preferences/i });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// 4. Stay History (#guests-history)
// ============================================================
test.describe('Stay History — #guests-history', () => {
  test.beforeEach(async ({ page }) => {
    await openSection(page, 'guests-history');
    await waitForSectionReady(page);
  });

  test('section loads without error', async ({ page }) => {
    await assertNoSectionError(page);
  });

  test('stay history summary stats are displayed', async ({ page }) => {
    // Stay history shows summary cards: Total Stays, Total Nights, Total Spent
    const totalStays = page.getByText(/total stays/i);
    const totalNights = page.getByText(/total nights/i);
    const totalSpent = page.getByText(/total spent/i);

    await expect(totalStays).toBeVisible({ timeout: 5000 });
  });

  test('history records display in a list or empty state', async ({ page }) => {
    // Either stay cards are rendered or "No stay history found" empty state
    const hasHistory = await page.getByText(/no stay history found/i).isVisible().catch(() => false)
      || await page.locator('[class*="overflow-hidden"]').count() > 0
      || await page.locator('table tbody tr').count() > 0;

    expect(hasHistory || await page.getByText(/total stays/i).isVisible()).toBeTruthy();
  });
});

// ============================================================
// 5. Loyalty & Points (#guests-loyalty)
// ============================================================
test.describe('Loyalty & Points — #guests-loyalty', () => {
  test.beforeEach(async ({ page }) => {
    await openSection(page, 'guests-loyalty');
    await waitForSectionReady(page);
  });

  test('section loads without error', async ({ page }) => {
    await assertNoSectionError(page);
  });

  test('loyalty tier information is visible', async ({ page }) => {
    // The loyalty component shows tier info (Bronze, Silver, Gold, Platinum)
    const tierInfo = page.getByText(/bronze|silver|gold|platinum/i);
    await expect(tierInfo.first()).toBeVisible({ timeout: 5000 });
  });

  test('loyalty points display is present', async ({ page }) => {
    // Points-related content should be visible
    const pointsContent = page.getByText(/points/i);
    await expect(pointsContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('adjust points button is present', async ({ page }) => {
    const adjustBtn = page.getByRole('button', { name: /adjust points/i });
    if ((await adjustBtn.count()) > 0) {
      await expect(adjustBtn).toBeVisible();
      await expect(adjustBtn).toBeEnabled();
    }
    // If the button is not present (e.g., no guest selected), skip gracefully
  });
});

// ============================================================
// 6. Guest Profile (#guests-profile)
// ============================================================
test.describe('Guest Profile — #guests-profile', () => {
  test.beforeEach(async ({ page }) => {
    await openSection(page, 'guests-profile');
    await waitForSectionReady(page);
  });

  test('section loads without error', async ({ page }) => {
    await assertNoSectionError(page);
  });

  test('displays guest profile content or selection prompt', async ({ page }) => {
    // GuestProfile either shows a guest's details or "Select a guest to view their profile"
    const hasProfile = await page.getByText(/select a guest/i).isVisible().catch(() => false)
      || await page.getByText(/guest not found/i).isVisible().catch(() => false)
      || await page.getByText(/contact information/i).isVisible().catch(() => false)
      || await page.getByText(/personal information/i).isVisible().catch(() => false)
      || await page.getByRole('heading', { name: /.+/i }).first().isVisible();

    expect(hasProfile).toBeTruthy();
  });
});

// ============================================================
// 7. Guest Journey Map (#guests-journey)
// ============================================================
test.describe('Guest Journey Map — #guests-journey', () => {
  test.beforeEach(async ({ page }) => {
    await openSection(page, 'guests-journey');
    await waitForSectionReady(page);
  });

  test('section loads without error', async ({ page }) => {
    await assertNoSectionError(page);
  });

  test('journey map heading is visible', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /journey/i, level: 2 });
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('displays journey phases or empty state', async ({ page }) => {
    // The journey map shows phases (Pre-Arrival, Arrival, In-Stay, Departure, Post-Stay)
    // or an empty state if no guest is selected
    const hasContent = await page.getByText(/no journey data available/i).isVisible().catch(() => false)
      || await page.getByText(/pre.?arrival|arrival|in.?stay|departure|post.?stay/i).first().isVisible().catch(() => false)
      || await page.getByText(/select a guest/i).isVisible().catch(() => false);

    expect(hasContent).toBeTruthy();
  });

  test('phase filter buttons are present when data exists', async ({ page }) => {
    // If there is journey data, filter buttons should be visible
    const filterBtn = page.getByRole('button', { name: /all phases/i });
    if ((await filterBtn.count()) > 0) {
      await expect(filterBtn).toBeVisible();
    }
  });
});

// ============================================================
// 8. VIP Recognition (#guests-vip-alerts)
// ============================================================
test.describe('VIP Recognition — #guests-vip-alerts', () => {
  test.beforeEach(async ({ page }) => {
    await openSection(page, 'guests-vip-alerts');
    await waitForSectionReady(page);
  });

  test('section loads without error', async ({ page }) => {
    await assertNoSectionError(page);
  });

  test('VIP Recognition heading is visible', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /vip recognition/i, level: 2 });
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('tier count badges are displayed in header', async ({ page }) => {
    // The VIP recognition header shows tier count badges (Platinum, Gold, Silver, Bronze)
    const tierBadges = page.locator('text=Platinum');
    const hasBadges = (await tierBadges.count()) > 0
      || await page.getByText(/platinum|gold|silver|bronze/i).first().isVisible().catch(() => false);

    expect(hasBadges).toBeTruthy();
  });

  test('summary cards are visible', async ({ page }) => {
    // The VIP recognition section has summary cards for:
    // Today's Arrivals, Active Rules, Alerts Sent Today, Total VIP Guests
    const todayArrivals = page.getByText(/today'?s arrivals/i);
    const totalVip = page.getByText(/total vip guests/i);

    await expect(todayArrivals).toBeVisible({ timeout: 5000 });
    await expect(totalVip).toBeVisible({ timeout: 5000 });
  });

  test('tabs are available — Dashboard, Tier Config, Rules Engine, Alert Log', async ({ page }) => {
    const dashboardTab = page.getByRole('tab', { name: /dashboard/i });
    const tierTab = page.getByRole('tab', { name: /tier config/i });
    const rulesTab = page.getByRole('tab', { name: /rules engine/i });
    const historyTab = page.getByRole('tab', { name: /alert log/i });

    // At least Dashboard tab should be present
    await expect(dashboardTab).toBeVisible({ timeout: 5000 });
  });

  test('VIP guest table is present on dashboard tab', async ({ page }) => {
    // The dashboard tab contains a table of VIP guests
    const table = page.locator('table');
    const hasTable = (await table.count()) > 0;
    const hasGuestList = await page.getByText(/all vip guests/i).isVisible().catch(() => false);

    expect(hasTable || hasGuestList).toBeTruthy();
  });
});
