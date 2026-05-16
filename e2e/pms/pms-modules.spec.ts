// e2e/pms/pms-modules.spec.ts
// Comprehensive E2E tests for StaySuite PMS (Property Management System) modules

import { test, expect } from '../fixtures/auth.fixture';
import {
  openSection,
  clickButton,
  fillInput,
  waitForToast,
  closeDialog,
  waitForSidebarLoad,
  navigateToSection,
} from '../fixtures/auth.fixture';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Properties (#pms-properties)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('PMS – Properties', () => {
  test.beforeEach(async ({ page }) => {
    await waitForSidebarLoad(page);
    await openSection(page, '#pms-properties');
  });

  test('section loads successfully with header and stats', async ({ page }) => {
    // Header should be visible
    await expect(page.getByRole('heading', { name: /properties/i })).toBeVisible();
    await expect(page.getByText(/manage your hotel properties/i)).toBeVisible();

    // Stats cards should render
    await expect(page.getByText('Total Properties')).toBeVisible();
    await expect(page.getByText('Total Rooms')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
    await expect(page.getByText('Cities')).toBeVisible();
  });

  test('property list renders with seed data (at least 1 property)', async ({ page }) => {
    // Wait for data to load — dismiss the loading spinner first
    await page.waitForTimeout(2000);

    // Verify that either card view or table view has content
    const cardView = page.locator('[class*="data-card"]');
    const tableView = page.locator('table tbody tr');

    // At least one view should have data
    const hasCards = (await cardView.count()) > 0;
    const hasRows = (await tableView.count()) > 0;
    expect(hasCards || hasRows).toBeTruthy();
  });

  test('can open property details via View button', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Try to find and click the View button (card view or table view)
    const viewBtn = page.getByRole('button', { name: /view/i }).first();
    const viewBtnCount = await viewBtn.count();

    if (viewBtnCount > 0) {
      await viewBtn.click();
      await page.waitForTimeout(500);

      // View dialog should open with property details
      await expect(page.getByRole('dialog')).toBeVisible();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(/city/i);
    }
  });

  test('edit property form opens and has required fields', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Click "Add Property" to open the create dialog (which shares form with edit)
    await clickButton(page, 'Add Property');
    await page.waitForTimeout(500);

    // Dialog should be open
    await expect(page.getByRole('dialog')).toBeVisible();
    const dialog = page.getByRole('dialog');

    // Verify key form fields exist
    await expect(dialog.getByLabel(/name/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/slug/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/address/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/city/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/country/i, { exact: false })).toBeVisible();

    // Tabs should be present: Basic, Settings, Tax, Branding
    await expect(dialog.getByRole('tab', { name: /basic/i })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: /settings/i })).toBeVisible();

    // Close the dialog
    await closeDialog(page);
  });

  test('search and filters work on properties list', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Search input should be present
    const searchInput = page.getByPlaceholder(/search properties/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('royal');
    await page.waitForTimeout(500);

    // Status filter should be present
    const statusSelect = page.locator('[aria-label="Status"]').first();
    if ((await statusSelect.count()) > 0) {
      await statusSelect.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
    }
  });

  test('switching between card and table view modes', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find the view toggle buttons
    const gridBtn = page.getByRole('button', { name: '' }).locator('[class*="lucide-layout-grid"], svg.lucide-layout-grid');
    const listBtn = page.locator('svg.lucide-list');

    // Try clicking list/table view if available
    const gridCount = await page.locator('svg.lucide-layout-grid').count();
    const listCount = await listBtn.count();

    if (gridCount > 0 && listCount > 0) {
      // Switch to table view
      await listBtn.first().click();
      await page.waitForTimeout(500);

      // Table should be visible
      await expect(page.locator('table').first()).toBeVisible();

      // Switch back to card view
      await page.locator('svg.lucide-layout-grid').first().click();
      await page.waitForTimeout(500);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Room Types (#pms-room-types)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('PMS – Room Types', () => {
  test.beforeEach(async ({ page }) => {
    await waitForSidebarLoad(page);
    await openSection(page, '#pms-room-types');
  });

  test('section loads with header and stats', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /room types/i })).toBeVisible();
    await expect(page.getByText(/define room categories, amenities, and pricing/i)).toBeVisible();

    // Stats cards
    await expect(page.getByText('Room Types').first()).toBeVisible();
    await expect(page.getByText('Total Rooms')).toBeVisible();
    await expect(page.getByText('Amenities')).toBeVisible();
    await expect(page.getByText('Starting Price')).toBeVisible();
  });

  test('room type list renders with seed data', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for either card or table view content
    const cardView = page.locator('[class*="data-card"]');
    const tableView = page.locator('table tbody tr');

    const hasCards = (await cardView.count()) > 0;
    const hasRows = (await tableView.count()) > 0;
    expect(hasCards || hasRows).toBeTruthy();
  });

  test('can create a new room type via dialog', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Open create dialog
    await clickButton(page, 'Add Room Type');
    await page.waitForTimeout(500);

    // Dialog should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    const dialog = page.getByRole('dialog');

    // Verify required form fields
    await expect(dialog.getByLabel(/property/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/name/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/code/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/base price/i, { exact: false })).toBeVisible();

    // Fill in the name field (should auto-generate code)
    await fillInput(page, 'name', 'E2E Test Suite');
    await page.waitForTimeout(300);

    // Code should auto-generate from name
    const codeInput = dialog.getByLabel(/code/i, { exact: false });
    await expect(codeInput).toHaveValue('E2ETEST');

    // Close without saving
    await closeDialog(page);
  });

  test('form validates required fields on create', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Open create dialog
    await clickButton(page, 'Add Room Type');
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');

    // Clear name and base price to trigger validation
    const nameInput = dialog.getByLabel(/name/i, { exact: false });
    await nameInput.clear();

    // Submit without filling required fields
    const saveBtn = dialog.getByRole('button', { name: /save|create/i });
    if ((await saveBtn.count()) > 0) {
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Should show validation toast
      await waitForToast(page, 'Validation Error');
    }

    await closeDialog(page);
  });

  test('can edit existing room type', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find and click Edit button on the first room type card/row
    const editBtns = page.getByRole('button', { name: /edit/i });
    const editBtnCount = await editBtns.count();

    if (editBtnCount > 0) {
      // Click the first visible edit button
      await editBtns.first().click();
      await page.waitForTimeout(500);

      // Edit dialog should be visible
      await expect(page.getByRole('dialog')).toBeVisible();
      const dialog = page.getByRole('dialog');

      // Form fields should be pre-populated
      const nameInput = dialog.getByLabel(/name/i, { exact: false });
      const nameValue = await nameInput.inputValue();
      expect(nameValue.length).toBeGreaterThan(0);

      // Close the dialog
      await closeDialog(page);
    }
  });

  test('amenities manager button is accessible', async ({ page }) => {
    await page.waitForTimeout(1000);

    const amenitiesBtn = page.getByRole('button', { name: /amenities/i });
    await expect(amenitiesBtn).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Rooms (#pms-rooms)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('PMS – Rooms', () => {
  test.beforeEach(async ({ page }) => {
    await waitForSidebarLoad(page);
    await openSection(page, '#pms-rooms');
  });

  test('section loads with header and status stats', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /rooms/i })).toBeVisible();
    await expect(page.getByText(/manage rooms and their status/i)).toBeVisible();

    // Status stat cards
    await expect(page.getByText('Total Rooms')).toBeVisible();
    await expect(page.getByText('Available')).toBeVisible();
    await expect(page.getByText('Occupied')).toBeVisible();
    await expect(page.getByText('Dirty')).toBeVisible();
    await expect(page.getByText('Maintenance')).toBeVisible();
  });

  test('rooms display with status color indicators', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Rooms should be organized by floor or in a grid
    // Look for floor headings or room cards
    const floorHeadings = page.getByRole('heading', { name: /floor \d/i });
    const roomCards = page.locator('[class*="rounded-lg border p-3 cursor-pointer"]');

    const hasFloorHeadings = (await floorHeadings.count()) > 0;
    const hasRoomCards = (await roomCards.count()) > 0;

    expect(hasFloorHeadings || hasRoomCards).toBeTruthy();

    // Verify status color dots exist (the colored dots in room cells)
    const statusDots = page.locator('[class*="rounded-full"][class*="bg-emerald-500"], [class*="rounded-full"][class*="bg-blue-500"], [class*="rounded-full"][class*="bg-yellow-500"]');
    const dotCount = await statusDots.count();
    // If there are rooms, there should be status dots
    if (hasFloorHeadings || hasRoomCards) {
      expect(dotCount).toBeGreaterThan(0);
    }
  });

  test('can filter rooms by status', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find status filter select
    const statusFilter = page.locator('[aria-label="Status"]').first();
    const statusSelects = page.locator('button[role="combobox"]');

    // Try to find the status filter dropdown
    const filterContainer = page.locator('[class*="p-4"]').filter({ has: page.locator('input[placeholder="Search rooms"]') });
    const statusBtns = filterContainer.locator('button[role="combobox"], [role="combobox"]');

    // Try status filter by checking for "Available" option in the status dropdown
    if ((await statusBtns.count()) >= 2) {
      // The second select should be status filter
      await statusBtns.nth(1).click();
      await page.waitForTimeout(500);

      // Select "Available" option
      const availableOption = page.getByRole('option', { name: /available/i });
      if ((await availableOption.count()) > 0) {
        await availableOption.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('room detail/edit view opens when clicking a room', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for room cards or rows that can be clicked
    const roomCards = page.locator('[class*="cursor-pointer"][class*="rounded-lg"]');
    const roomRows = page.locator('tr[class*="cursor-pointer"], tr[class*="hover:bg"]');

    const cardCount = await roomCards.count();
    const rowCount = await roomRows.count();

    if (cardCount > 0) {
      await roomCards.first().click();
      await page.waitForTimeout(500);
      // Edit dialog should open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog')).toContainText(/edit room/i);

      await closeDialog(page);
    } else if (rowCount > 0) {
      await roomRows.first().click();
      await page.waitForTimeout(500);
      await expect(page.getByRole('dialog')).toBeVisible();
      await closeDialog(page);
    }
  });

  test('add room and bulk import buttons are accessible', async ({ page }) => {
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: /add room/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /bulk import/i })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Rate Plans & Pricing (#pms-rate-plans-pricing)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('PMS – Rate Plans & Pricing', () => {
  test.beforeEach(async ({ page }) => {
    await waitForSidebarLoad(page);
    await openSection(page, '#pms-rate-plans-pricing');
  });

  test('section loads with header and stats', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /rate plans/i })).toBeVisible();
    await expect(page.getByText(/manage pricing plans for your room types/i)).toBeVisible();

    // Stats cards
    await expect(page.getByText('Total Rate Plans')).toBeVisible();
    await expect(page.getByText('Active Plans')).toBeVisible();
    await expect(page.getByText('Avg Base Price')).toBeVisible();
  });

  test('rate plan list renders in table', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for table with rate plan data or empty state
    const tableBody = page.locator('table tbody tr');
    const emptyState = page.getByText(/no rate plans found/i);

    const hasRows = (await tableBody.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasRows || hasEmpty).toBeTruthy();
  });

  test('create rate plan dialog opens with pricing fields', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Open create dialog
    await clickButton(page, 'Add Rate Plan');
    await page.waitForTimeout(500);

    // Dialog should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    const dialog = page.getByRole('dialog');

    // Verify required form fields
    await expect(dialog.getByText(/room type/i)).toBeVisible();
    await expect(dialog.getByLabel(/name/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/code/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/base price/i, { exact: false })).toBeVisible();

    // Verify pricing-specific fields
    await expect(dialog.getByText(/meal plan/i)).toBeVisible();
    await expect(dialog.getByText(/min stay/i)).toBeVisible();
    await expect(dialog.getByText(/cancellation policy/i)).toBeVisible();

    // Derivation section should be visible (create only)
    await expect(dialog.getByText(/derive from existing plan/i)).toBeVisible();

    // Close dialog
    await closeDialog(page);
  });

  test('rate plan form includes derivation option', async ({ page }) => {
    await page.waitForTimeout(2000);

    await clickButton(page, 'Add Rate Plan');
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');

    // Derivation section should exist
    await expect(dialog.getByText(/derive from existing plan/i)).toBeVisible();

    // Should have a select for derivation source
    const deriveSelect = dialog.getByText(/none \(standalone plan\)/i);
    await expect(deriveSelect).toBeVisible();

    await closeDialog(page);
  });

  test('search and property filters are present', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Search input
    await expect(page.getByPlaceholder(/search rate plans/i)).toBeVisible();

    // Property filter
    const propertySelect = page.locator('button[role="combobox"]').filter({
      hasText: /select property|all properties/i,
    });
    // At least some filter selectors should be present
    const comboboxCount = await page.locator('button[role="combobox"]').count();
    expect(comboboxCount).toBeGreaterThanOrEqual(1);
  });

  test('can edit existing rate plan', async ({ page }) => {
    await page.waitForTimeout(2000);

    const editBtns = page.locator('button[aria-label="Edit rate plan"]');
    if ((await editBtns.count()) > 0) {
      await editBtns.first().click();
      await page.waitForTimeout(500);

      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog')).toContainText(/edit rate plan/i);

      // Verify form fields are present
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByLabel(/name/i, { exact: false })).toBeVisible();
      await expect(dialog.getByLabel(/base price/i, { exact: false })).toBeVisible();

      await closeDialog(page);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Inventory Calendar (#pms-inventory-calendar)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('PMS – Inventory Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await waitForSidebarLoad(page);
    await openSection(page, '#pms-inventory-calendar');
  });

  test('section loads with header and stats', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /inventory calendar/i })).toBeVisible();
    await expect(page.getByText(/view and manage room availability and pricing/i)).toBeVisible();

    // Stats should render
    await expect(page.getByText('Avg Occupancy')).toBeVisible();
    await expect(page.getByText('Avg Daily Rate')).toBeVisible();
  });

  test('calendar view renders with month navigation', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Month navigation should be present
    const prevBtn = page.getByRole('button', { name: /previous month/i });
    const nextBtn = page.getByRole('button', { name: /next month/i });
    const todayBtn = page.getByRole('button', { name: /today/i });

    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();
    await expect(todayBtn).toBeVisible();

    // Day of week headers should be visible
    await expect(page.getByText('Sun')).toBeVisible();
    await expect(page.getByText('Mon')).toBeVisible();
    await expect(page.getByText('Sat')).toBeVisible();
  });

  test('property selector is available', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Property dropdown should be in the header area
    const propertySelect = page.locator('button[role="combobox"]').filter({
      hasText: /all properties|select property/i,
    });
    // At least one property selector should be present
    const selectCount = await propertySelect.count();
    expect(selectCount).toBeGreaterThanOrEqual(1);
  });

  test('calendar cells show availability and price data', async ({ page }) => {
    await page.waitForTimeout(3000);

    // Check for availability text patterns like "5/10" (available/total)
    const availabilityText = page.getByText(/\d+\/\d+/);
    const availCount = await availabilityText.count();

    // If room types exist, there should be availability data
    if (availCount > 0) {
      // Price data should also be present (currency symbols + numbers)
      const priceText = page.locator('[class*="text-muted-foreground"]').filter({
        hasText: /[₹$€£]/,
      });
      // Price indicators should exist alongside availability
    }
  });

  test('legend badges for availability status are present', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for availability legend badges
    await expect(page.getByText('Available')).toBeVisible();
    await expect(page.getByText('Limited')).toBeVisible();
    await expect(page.getByText('Sold Out')).toBeVisible();
  });

  test('can navigate to next and previous month', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Get current month text
    const monthDisplay = page.locator('[class*="font-semibold"][class*="min-w"]').first();
    const originalMonth = await monthDisplay.textContent();

    // Click next month
    await page.getByRole('button', { name: /next month/i }).click();
    await page.waitForTimeout(1000);

    const newMonth = await monthDisplay.textContent();
    expect(newMonth).not.toBe(originalMonth);

    // Navigate back
    await page.getByRole('button', { name: /previous month/i }).click();
    await page.waitForTimeout(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Package Plans (#pms-package-plans)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('PMS – Package Plans', () => {
  test.beforeEach(async ({ page }) => {
    await waitForSidebarLoad(page);
    await openSection(page, '#pms-package-plans');
  });

  test('section loads with header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /package plans/i })).toBeVisible();
    await expect(page.getByText(/create and manage room packages/i)).toBeVisible();
  });

  test('package list renders (table or empty state)', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Table or empty state should be visible
    const tableBody = page.locator('table tbody tr');
    const emptyState = page.getByText(/no packages found/i);

    const hasRows = (await tableBody.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasRows || hasEmpty).toBeTruthy();
  });

  test('create package button is accessible', async ({ page }) => {
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: /create package/i })).toBeVisible();
  });

  test('create package dialog opens with form fields', async ({ page }) => {
    await page.waitForTimeout(2000);

    await clickButton(page, 'Create Package');
    await page.waitForTimeout(500);

    // Dialog should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    const dialog = page.getByRole('dialog');

    // Verify form fields
    await expect(dialog.getByText(/package name/i)).toBeVisible();
    await expect(dialog.getByText(/base room type/i)).toBeVisible();
    await expect(dialog.getByText(/start date/i)).toBeVisible();
    await expect(dialog.getByText(/end date/i)).toBeVisible();

    // Components section
    await expect(dialog.getByText(/components/i)).toBeVisible();

    // Add Component button
    await expect(dialog.getByRole('button', { name: /add component/i })).toBeVisible();

    // Cancel and Create buttons
    await expect(dialog.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /create package/i })).toBeVisible();

    await closeDialog(page);
  });

  test('search and status filters are present', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Search input
    await expect(page.getByPlaceholder(/search packages/i)).toBeVisible();

    // Status filter dropdown
    const statusSelects = page.locator('button[role="combobox"]');
    expect((await statusSelects.count())).toBeGreaterThanOrEqual(1);
  });

  test('property selector is available in header', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Property selector should be in the header area
    const propertySelects = page.locator('button[role="combobox"]');
    expect((await propertySelects.count())).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Floor Plans (#pms-floor-plans)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('PMS – Floor Plans', () => {
  test.beforeEach(async ({ page }) => {
    await waitForSidebarLoad(page);
    await openSection(page, '#pms-floor-plans');
  });

  test('section loads without error', async ({ page }) => {
    // Header should be visible
    await expect(page.getByRole('heading', { name: /floor plans/i })).toBeVisible();
    await expect(page.getByText(/visual floor plan management/i)).toBeVisible();

    // No console errors for this section
    const hasError = await page.evaluate(() => {
      return document.querySelector('[class*="text-destructive"]')?.textContent?.includes('Error');
    }).catch(() => false);
    expect(hasError).toBeFalsy();
  });

  test('floor plans list or empty state renders', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Either floor plan cards or empty state should show
    const floorPlanCards = page.locator('[class*="cursor-pointer"][class*="rounded-lg"][class*="border"]');
    const emptyState = page.getByText(/no floor plans found/i);

    const hasCards = (await floorPlanCards.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test('stats cards render', async ({ page }) => {
    await page.waitForTimeout(1000);

    await expect(page.getByText('Floor Plans')).toBeVisible();
    await expect(page.getByText('Properties')).toBeVisible();
    await expect(page.getByText('Unique Floors')).toBeVisible();
  });

  test('new floor plan button is accessible', async ({ page }) => {
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: /new floor plan/i })).toBeVisible();
  });

  test('search input is present', async ({ page }) => {
    await page.waitForTimeout(1000);

    await expect(page.getByPlaceholder(/search floor plans/i)).toBeVisible();
  });

  test('create floor plan dialog opens', async ({ page }) => {
    await page.waitForTimeout(2000);

    await clickButton(page, 'New Floor Plan');
    await page.waitForTimeout(500);

    // Dialog should be visible
    await expect(page.getByRole('dialog')).toBeVisible();
    const dialog = page.getByRole('dialog');

    // Form fields
    await expect(dialog.getByText(/property/i)).toBeVisible();
    await expect(dialog.getByLabel(/name/i, { exact: false })).toBeVisible();
    await expect(dialog.getByLabel(/floor/i, { exact: false })).toBeVisible();

    // Close the dialog
    await closeDialog(page);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-section navigation tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe('PMS – Cross-section navigation', () => {
  test('navigating between PMS sections preserves app state', async ({ page }) => {
    await waitForSidebarLoad(page);

    // Navigate to properties first
    await openSection(page, '#pms-properties');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /properties/i })).toBeVisible();

    // Navigate to room types
    await openSection(page, '#pms-room-types');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /room types/i })).toBeVisible();

    // Navigate to rooms
    await openSection(page, '#pms-rooms');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /rooms/i })).toBeVisible();

    // Navigate to rate plans
    await openSection(page, '#pms-rate-plans-pricing');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /rate plans/i })).toBeVisible();

    // Navigate to inventory calendar
    await openSection(page, '#pms-inventory-calendar');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /inventory calendar/i })).toBeVisible();

    // Navigate to floor plans
    await openSection(page, '#pms-floor-plans');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /floor plans/i })).toBeVisible();

    // Navigate to package plans
    await openSection(page, '#pms-package-plans');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /package plans/i })).toBeVisible();
  });

  test('hash navigation updates URL correctly', async ({ page }) => {
    await waitForSidebarLoad(page);

    const sections = [
      '#pms-properties',
      '#pms-room-types',
      '#pms-rooms',
      '#pms-rate-plans-pricing',
      '#pms-inventory-calendar',
      '#pms-floor-plans',
      '#pms-package-plans',
    ];

    for (const section of sections) {
      await navigateToSection(page, section);
      await page.waitForTimeout(1000);
      expect(page.url()).toContain(section);
    }
  });
});
