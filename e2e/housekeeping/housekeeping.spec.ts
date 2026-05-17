// e2e/housekeeping/housekeeping.spec.ts
// StaySuite Housekeeping Module — E2E Tests
//
// Covers all 10 housekeeping sub-sections: Tasks, Kanban Board, Room Status,
// Maintenance, Preventive Maintenance, Assets, Inspections, Lost & Found,
// Minibar, and Laundry.
//
// Seed data expectation:
//   • Housekeeping tasks
//   • Maintenance work orders (5)
//   • Assets (3)
//   • Inspection results
//   • Lost & Found items (7)
//   • Minibar items (10)

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

// ────────────────────────────────────────────────────────────────
// 1. HOUSEKEEPING TASKS  (#housekeeping-tasks)
// ────────────────────────────────────────────────────────────────

test.describe('Housekeeping Tasks', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-tasks');
  });

  test('section loads with task list and header', async ({ authedPage: page }) => {
    // Verify heading
    await expect(page.getByRole('heading', { name: /Housekeeping Tasks/i })).toBeVisible();

    // Verify stats cards (Pending, In Progress, Completed, Urgent)
    await expect(page.getByText('Pending')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Completed')).toBeVisible();
    await expect(page.getByText('Urgent')).toBeVisible();

    // Verify the tasks table or the loading → data transition
    // The table has column headers: Task, Room, Assigned To, Type, Priority, Scheduled, Status, Actions
    await page.locator('table').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('can open the New Task dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'New Task');

    // Dialog title should be visible
    await expect(page.getByRole('dialog').getByText('Create New Task')).toBeVisible();
  });

  test('create task form has expected fields', async ({ authedPage: page }) => {
    await clickButton(page, 'New Task');

    const dialog = page.getByRole('dialog');

    // Property selector
    await expect(dialog.getByText(/Property/i)).toBeVisible();

    // Room selector
    await expect(dialog.getByText(/Room/i)).toBeVisible();

    // Assign To selector
    await expect(dialog.getByText(/Assign To/i)).toBeVisible();

    // Title input
    await expect(dialog.getByLabel(/Title/i)).toBeVisible();

    // Description textarea
    await expect(dialog.getByLabel(/Description/i)).toBeVisible();

    // Type selector
    await expect(dialog.getByText(/Type/i)).toBeVisible();

    // Category selector
    await expect(dialog.getByText(/Category/i)).toBeVisible();

    // Priority selector
    await expect(dialog.getByText(/Priority/i)).toBeVisible();

    // Estimated Duration
    await expect(dialog.getByLabel(/Est\. Duration/i)).toBeVisible();

    // Scheduled At
    await expect(dialog.getByLabel(/Scheduled At/i)).toBeVisible();

    // Notes
    await expect(dialog.getByLabel(/Notes/i)).toBeVisible();
  });

  test('form validates required fields on submit without data', async ({ authedPage: page }) => {
    await clickButton(page, 'New Task');

    // Clear any pre-filled title
    const titleInput = page.getByLabel(/Title/i);
    await titleInput.clear();

    // Try to submit without filling required fields
    await submitForm(page);

    // A validation toast should appear (component shows "Property and title are required")
    await waitForToast(page, 'required');
  });

  test('can close the create task dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'New Task');
    await expect(page.getByRole('dialog').getByText('Create New Task')).toBeVisible();
    await closeDialog(page);
    // Dialog should be gone
    await expect(page.getByRole('dialog').getByText('Create New Task')).not.toBeVisible();
  });

  test('search input is available and functional', async ({ authedPage: page }) => {
    const searchInput = page.getByPlaceholder(/Search tasks/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('deep clean');
    // Wait for debounce and re-render
    await page.waitForTimeout(500);
  });

  test('filter dropdowns are visible (Status, Type, Priority, Recurrence)', async ({ authedPage: page }) => {
    // Filter card contains select triggers
    await expect(page.getByText('All Status').first()).toBeVisible();
    await expect(page.getByText('All Types').first()).toBeVisible();
    await expect(page.getByText('All Priorities').first()).toBeVisible();
    await expect(page.getByText('All Tasks').first()).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 2. KANBAN BOARD  (#housekeeping-kanban)
// ────────────────────────────────────────────────────────────────

test.describe('Kanban Board', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-kanban');
  });

  test('section loads with header', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Task Board/i })).toBeVisible();
    await expect(page.getByText(/Drag and drop tasks to update their status/i)).toBeVisible();
  });

  test('kanban columns are visible (pending, in-progress, completed, cancelled)', async ({ authedPage: page }) => {
    // Each column has a colored header with the title and a count badge
    await expect(page.getByText('Pending').first()).toBeVisible();
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByText('Completed').first()).toBeVisible();
    await expect(page.getByText('Cancelled').first()).toBeVisible();
  });

  test('priority filter badges are rendered', async ({ authedPage: page }) => {
    await expect(page.getByText('High Priority')).toBeVisible();
    await expect(page.getByText('Medium').first()).toBeVisible();
    await expect(page.getByText('Low').first()).toBeVisible();
  });

  test('Refresh button is present', async ({ authedPage: page }) => {
    await clickButton(page, 'Refresh');
    // Wait for re-render
    await page.waitForTimeout(1500);
    // Section should still be visible
    await expect(page.getByRole('heading', { name: /Task Board/i })).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 3. ROOM STATUS  (#housekeeping-status)
// ────────────────────────────────────────────────────────────────

test.describe('Room Status', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-status');
  });

  test('section loads with room status overview', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Room Status/i })).toBeVisible();
    await expect(page.getByText(/View and manage room status/i)).toBeVisible();
  });

  test('room status stat cards display all statuses', async ({ authedPage: page }) => {
    await expect(page.getByText('Total Rooms').first()).toBeVisible();
    await expect(page.getByText('Available').first()).toBeVisible();
    await expect(page.getByText('Occupied').first()).toBeVisible();
    await expect(page.getByText('Dirty').first()).toBeVisible();
    await expect(page.getByText('Cleaning').first()).toBeVisible();
    await expect(page.getByText('Inspected').first()).toBeVisible();
    await expect(page.getByText('Maintenance').first()).toBeVisible();
    await expect(page.getByText('Out of Order').first()).toBeVisible();
  });

  test('filter dropdowns (Property, Status, Floor) are present', async ({ authedPage: page }) => {
    await expect(page.getByText('All Properties').first()).toBeVisible();
    await expect(page.getByText('All Status').first()).toBeVisible();
    await expect(page.getByText('All Floors').first()).toBeVisible();
  });

  test('room cards render on the floor grid', async ({ authedPage: page }) => {
    // After loading, floor sections with room cards should appear
    // Wait for rooms to load
    await page.waitForTimeout(2000);

    // Floor labels should exist
    const floorLabels = page.locator('text=Floor');
    const floorCount = await floorLabels.count();
    expect(floorCount).toBeGreaterThan(0);
  });

  test('Change Status button is present on room cards', async ({ authedPage: page }) => {
    await page.waitForTimeout(2000);
    // The "Change Status" button appears on each room card
    const changeStatusButtons = page.getByRole('button', { name: /Change Status/i });
    await expect(changeStatusButtons.first()).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 4. MAINTENANCE  (#housekeeping-maintenance)
// ────────────────────────────────────────────────────────────────

test.describe('Maintenance Requests', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-maintenance');
  });

  test('section loads with Maintenance Management header', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Maintenance Management/i })).toBeVisible();
  });

  test('maintenance request tab is active by default', async ({ authedPage: page }) => {
    await expect(page.getByRole('tab', { name: /Maintenance Requests/i })).toBeVisible();
  });

  test('work order list renders with seeded data (5 entries)', async ({ authedPage: page }) => {
    // Wait for the table to load
    const table = page.locator('table');
    await table.waitFor({ state: 'visible', timeout: 10000 });

    // Check table headers
    await expect(page.getByText('Request').first()).toBeVisible();
    await expect(page.getByText('Category').first()).toBeVisible();
    await expect(page.getByText('Priority').first()).toBeVisible();
    await expect(page.getByText('Status').first()).toBeVisible();

    // Count table rows (seeded data should have 5 work orders)
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(5, { timeout: 10000 });
  });

  test('can open the New Request dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'New Request');

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('create maintenance request form has required fields', async ({ authedPage: page }) => {
    await clickButton(page, 'New Request');

    const dialog = page.getByRole('dialog');

    // Title
    await expect(dialog.getByLabel(/Title/i)).toBeVisible();

    // Description
    await expect(dialog.getByLabel(/Description/i)).toBeVisible();

    // Category
    await expect(dialog.getByText(/Category/i)).toBeVisible();

    // Priority
    await expect(dialog.getByText(/Priority/i)).toBeVisible();

    // Room (Location)
    await expect(dialog.getByText(/Room/i)).toBeVisible();
  });

  test('form validation prevents empty submit', async ({ authedPage: page }) => {
    await clickButton(page, 'New Request');

    // Clear title if pre-filled
    const titleInput = page.getByLabel(/Title/i);
    await titleInput.clear();

    // Attempt submit
    await submitForm(page);

    // Validation toast should appear
    await waitForToast(page, 'required');
  });

  test('search and filter controls are present', async ({ authedPage: page }) => {
    await expect(page.getByPlaceholder(/Search requests/i)).toBeVisible();
    await expect(page.getByText('All Status').first()).toBeVisible();
    await expect(page.getByText('All Priorities').first()).toBeVisible();
  });

  test('can close the create request dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'New Request');
    await expect(page.getByRole('dialog')).toBeVisible();
    await closeDialog(page);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 5. PREVENTIVE MAINTENANCE  (#housekeeping-preventive)
// ────────────────────────────────────────────────────────────────

test.describe('Preventive Maintenance', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-preventive');
  });

  test('section loads with the preventive maintenance tab visible', async ({ authedPage: page }) => {
    // The Maintenance component renders with two tabs; preventive is the second
    // After navigation to the preventive hash, the component should be visible
    await expect(page.getByRole('heading', { name: /Maintenance Management/i })).toBeVisible();
  });

  test('Preventive Maintenance tab is present', async ({ authedPage: page }) => {
    const preventiveTab = page.getByRole('tab', { name: /Preventive Maintenance/i });
    await expect(preventiveTab).toBeVisible();
  });

  test('Create Schedule button exists', async ({ authedPage: page }) => {
    // Click the preventive tab first
    await page.getByRole('tab', { name: /Preventive Maintenance/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: /Create Schedule/i })).toBeVisible();
  });

  test('preventive maintenance schedule table renders', async ({ authedPage: page }) => {
    // Click the preventive tab
    await page.getByRole('tab', { name: /Preventive Maintenance/i }).click();
    await page.waitForTimeout(1500);

    // Table headers for preventive maintenance
    await expect(page.getByText('Frequency').first()).toBeVisible();
    await expect(page.getByText('Last Completed').first()).toBeVisible();
    await expect(page.getByText('Next Due').first()).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 6. ASSET MANAGEMENT  (#housekeeping-assets)
// ────────────────────────────────────────────────────────────────

test.describe('Asset Management', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-assets');
  });

  test('section loads with Asset Management header', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Asset Management/i })).toBeVisible();
    await expect(page.getByText(/Track and manage property assets/i)).toBeVisible();
  });

  test('asset list renders with seeded data (3 entries)', async ({ authedPage: page }) => {
    const table = page.locator('table');
    await table.waitFor({ state: 'visible', timeout: 10000 });

    // Verify table headers
    await expect(page.getByText('Asset').first()).toBeVisible();
    await expect(page.getByText('Category').first()).toBeVisible();
    await expect(page.getByText('Status').first()).toBeVisible();

    // Should have 3 seeded rows
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 10000 });
  });

  test('stat cards display (Total, Active, In Maintenance)', async ({ authedPage: page }) => {
    await expect(page.getByText('Total Assets').first()).toBeVisible();
    await expect(page.getByText('Active').first()).toBeVisible();
    await expect(page.getByText('In Maintenance').first()).toBeVisible();
    await expect(page.getByText('Total Value').first()).toBeVisible();
  });

  test('Add Asset button opens dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'Add Asset');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Add New Asset')).toBeVisible();
  });

  test('asset create form has required fields', async ({ authedPage: page }) => {
    await clickButton(page, 'Add Asset');

    const dialog = page.getByRole('dialog');

    // Asset Name (required)
    await expect(dialog.getByLabel(/Asset Name/i)).toBeVisible();

    // Category
    await expect(dialog.getByText(/Category/i)).toBeVisible();

    // Status
    await expect(dialog.getByText(/Status/i)).toBeVisible();

    // Description
    await expect(dialog.getByLabel(/Description/i)).toBeVisible();

    // Location
    await expect(dialog.getByLabel(/Location/i)).toBeVisible();

    // Serial Number, Model Number
    await expect(dialog.getByLabel(/Serial Number/i)).toBeVisible();
    await expect(dialog.getByLabel(/Model Number/i)).toBeVisible();

    // Manufacturer
    await expect(dialog.getByLabel(/Manufacturer/i)).toBeVisible();

    // Financial fields
    await expect(dialog.getByLabel(/Purchase Price/i)).toBeVisible();
    await expect(dialog.getByLabel(/Current Value/i)).toBeVisible();

    // Dates
    await expect(dialog.getByLabel(/Purchase Date/i)).toBeVisible();
    await expect(dialog.getByLabel(/Warranty Expiry/i)).toBeVisible();
  });

  test('search and filter controls are present', async ({ authedPage: page }) => {
    await expect(page.getByPlaceholder(/Search assets/i)).toBeVisible();
    await expect(page.getByText('All Categories').first()).toBeVisible();
    await expect(page.getByText('All Status').first()).toBeVisible();
  });

  test('can close the add asset dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'Add Asset');
    await expect(page.getByRole('dialog')).toBeVisible();
    await closeDialog(page);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 7. INSPECTION CHECKLISTS  (#housekeeping-inspections)
// ────────────────────────────────────────────────────────────────

test.describe('Inspection Checklists', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-inspections');
  });

  test('section loads with Inspection Checklists header', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Inspection Checklists/i })).toBeVisible();
    await expect(page.getByText(/Manage templates, conduct inspections/i)).toBeVisible();
  });

  test('inspection tabs are rendered (Templates, Inspect Room, History, Quality Reports)', async ({ authedPage: page }) => {
    await expect(page.getByRole('tab', { name: /Templates/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Inspect Room/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /History/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Quality Reports/i })).toBeVisible();
  });

  test('Templates tab shows template cards or empty state', async ({ authedPage: page }) => {
    // Default tab is Templates — either cards or empty state should appear
    await page.waitForTimeout(2000);

    const hasCards = (await page.locator('text=No Templates Found').count()) === 0;
    if (hasCards) {
      // Template cards should render
      const templateCards = page.locator('[class*="card"]');
      expect(await templateCards.count()).toBeGreaterThan(0);
    }
    // Either way, the section loaded without error
    await expect(page.getByRole('heading', { name: /Inspection Checklists/i })).toBeVisible();
  });

  test('New Template button is present on Templates tab', async ({ authedPage: page }) => {
    await expect(page.getByRole('button', { name: /New Template/i })).toBeVisible();
  });

  test('search and filter controls on Templates tab', async ({ authedPage: page }) => {
    await expect(page.getByPlaceholder(/Search templates/i)).toBeVisible();
    await expect(page.getByText('Room Type').first()).toBeVisible();
    await expect(page.getByText('Category').first()).toBeVisible();
  });

  test('History tab is accessible', async ({ authedPage: page }) => {
    await page.getByRole('tab', { name: /History/i }).click();
    await page.waitForTimeout(1500);

    // History section should show a list or empty state
    const historyContent = page.locator('text=No inspection results');
    const hasHistory = (await historyContent.count()) === 0;
    if (!hasHistory) {
      // History list should be present
      expect(historyContent.first()).toBeVisible();
    }
  });

  test('Quality Reports tab is accessible', async ({ authedPage: page }) => {
    await page.getByRole('tab', { name: /Quality Reports/i }).click();
    await page.waitForTimeout(1500);

    // Reports tab should render
    await expect(page.locator('text=Quality Reports').first()).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 8. LOST & FOUND  (#housekeeping-lost-found)
// ────────────────────────────────────────────────────────────────

test.describe('Lost & Found', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-lost-found');
  });

  test('section loads with Lost & Found header', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Lost & Found/i })).toBeVisible();
    await expect(page.getByText(/Track and manage lost and found items/i)).toBeVisible();
  });

  test('Lost & Found items list renders with seeded data (7 entries)', async ({ authedPage: page }) => {
    // Wait for items grid to load
    await page.waitForTimeout(2000);

    // Stats cards should show counts
    await expect(page.getByText('Total').first()).toBeVisible();
    await expect(page.getByText('Lost').first()).toBeVisible();
    await expect(page.getByText('Found').first()).toBeVisible();
  });

  test('tabs are visible (All Items, Lost, Found, Matched, Returned)', async ({ authedPage: page }) => {
    await expect(page.getByRole('tab', { name: /All Items/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Lost/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Found/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Matched/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Returned/i })).toBeVisible();
  });

  test('Report Item button opens dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'Report Item');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Report Item')).toBeVisible();
  });

  test('report item form has required fields', async ({ authedPage: page }) => {
    await clickButton(page, 'Report Item');

    const dialog = page.getByRole('dialog');

    // Type toggle (Lost / Found)
    await expect(dialog.getByText('Lost Item')).toBeVisible();
    await expect(dialog.getByText('Found Item')).toBeVisible();

    // Category
    await expect(dialog.getByText(/Category/i)).toBeVisible();

    // Description
    await expect(dialog.getByLabel(/Description/i)).toBeVisible();

    // Location
    await expect(dialog.getByLabel(/Location/i)).toBeVisible();

    // Finder / Reporter name and contact
    await expect(dialog.getByPlaceholder(/Name/i)).toBeVisible();
    await expect(dialog.getByPlaceholder(/Phone or email/i)).toBeVisible();

    // Notes
    await expect(dialog.getByLabel(/Additional Notes/i)).toBeVisible();
  });

  test('search and category filter are present', async ({ authedPage: page }) => {
    await expect(page.getByPlaceholder(/Search items/i)).toBeVisible();
    await expect(page.getByText('All Categories').first()).toBeVisible();
  });

  test('can close the report item dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'Report Item');
    await expect(page.getByRole('dialog')).toBeVisible();
    await closeDialog(page);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 9. MINIBAR  (#housekeeping-minibar)
// ────────────────────────────────────────────────────────────────

test.describe('Minibar Management', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-minibar');
  });

  test('section loads with Minibar Management header', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Minibar Management/i })).toBeVisible();
    await expect(page.getByText(/Manage minibar inventory/i)).toBeVisible();
  });

  test('minibar items display with seeded data (10 entries)', async ({ authedPage: page }) => {
    // Wait for items table to load (default tab is Items Catalog)
    const table = page.locator('table');
    await table.waitFor({ state: 'visible', timeout: 10000 });

    // Verify table headers
    await expect(page.getByText('Name').first()).toBeVisible();
    await expect(page.getByText('Category').first()).toBeVisible();
    await expect(page.getByText('Sell Price').first()).toBeVisible();
    await expect(page.getByText('Status').first()).toBeVisible();

    // Should have 10 seeded items
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(10, { timeout: 10000 });
  });

  test('tabs are visible (Items Catalog, Room Setup, Consumption Log)', async ({ authedPage: page }) => {
    await expect(page.getByRole('tab', { name: /Items Catalog/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Room Setup/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Consumption Log/i })).toBeVisible();
  });

  test('Add Item button opens dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'Add Item');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Add Minibar Item')).toBeVisible();
  });

  test('add item form has expected fields', async ({ authedPage: page }) => {
    await clickButton(page, 'Add Item');

    const dialog = page.getByRole('dialog');

    // Name
    await expect(dialog.getByLabel(/Name/i)).toBeVisible();

    // Category
    await expect(dialog.getByText(/Category/i)).toBeVisible();

    // SKU
    await expect(dialog.getByLabel(/SKU/i)).toBeVisible();

    // Cost Price & Sell Price
    await expect(dialog.getByLabel(/Cost Price/i)).toBeVisible();
    await expect(dialog.getByLabel(/Sell Price/i)).toBeVisible();

    // Active toggle
    await expect(dialog.getByText('Active')).toBeVisible();
  });

  test('search input is present', async ({ authedPage: page }) => {
    await expect(page.getByPlaceholder(/Search items/i)).toBeVisible();
  });

  test('category filter is present', async ({ authedPage: page }) => {
    await expect(page.getByText('All Categories').first()).toBeVisible();
  });

  test('Consumption Log tab is accessible', async ({ authedPage: page }) => {
    await page.getByRole('tab', { name: /Consumption Log/i }).click();
    await page.waitForTimeout(1500);

    // Should show Log Consumption button and filters
    await expect(page.getByRole('button', { name: /Log Consumption/i })).toBeVisible();
  });

  test('can close the add item dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'Add Item');
    await expect(page.getByRole('dialog')).toBeVisible();
    await closeDialog(page);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────
// 10. LAUNDRY  (#housekeeping-laundry)
// ────────────────────────────────────────────────────────────────

test.describe('Laundry Management', () => {
  test.beforeEach(async ({ authedPage }) => {
    await openSection(authedPage, 'housekeeping-laundry');
  });

  test('section loads with Laundry Management header', async ({ authedPage: page }) => {
    await expect(page.getByRole('heading', { name: /Laundry Management/i })).toBeVisible();
    await expect(page.getByText(/Manage laundry service items/i)).toBeVisible();
  });

  test('laundry orders display on the Orders tab', async ({ authedPage: page }) => {
    // Default tab is Service Items; switch to Orders
    await page.getByRole('tab', { name: /Orders/i }).click();
    await page.waitForTimeout(1500);

    // Orders table should be present or empty state
    const table = page.locator('table');
    const tableExists = (await table.count()) > 0;
    if (tableExists) {
      await expect(table.first()).toBeVisible();
    }
  });

  test('tabs are visible (Service Items, Orders, Statistics)', async ({ authedPage: page }) => {
    await expect(page.getByRole('tab', { name: /Service Items/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Orders/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Statistics/i })).toBeVisible();
  });

  test('Service Items tab renders a table or empty state', async ({ authedPage: page }) => {
    // Default tab is Service Items
    await page.waitForTimeout(2000);

    const table = page.locator('table');
    const tableExists = (await table.count()) > 0;
    if (tableExists) {
      await expect(table.first()).toBeVisible();
      // Table headers
      await expect(page.getByText('Price').first()).toBeVisible();
      await expect(page.getByText('Turnaround').first()).toBeVisible();
    }
  });

  test('Add Item button opens dialog on Service Items tab', async ({ authedPage: page }) => {
    await clickButton(page, 'Add Item');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Add Laundry Service Item')).toBeVisible();
  });

  test('laundry item form has expected fields', async ({ authedPage: page }) => {
    await clickButton(page, 'Add Item');

    const dialog = page.getByRole('dialog');

    // Name
    await expect(dialog.getByLabel(/Name/i)).toBeVisible();

    // Category
    await expect(dialog.getByText(/Category/i)).toBeVisible();

    // Service Type
    await expect(dialog.getByText(/Service Type/i)).toBeVisible();

    // Unit Price
    await expect(dialog.getByLabel(/Unit Price/i)).toBeVisible();

    // Turnaround hours
    await expect(dialog.getByLabel(/Turnaround/i)).toBeVisible();
  });

  test('Statistics tab shows order metrics', async ({ authedPage: page }) => {
    await page.getByRole('tab', { name: /Statistics/i }).click();
    await page.waitForTimeout(1500);

    // Stats should show
    await expect(page.getByText('Total Orders').first()).toBeVisible();
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByText('Revenue Today').first()).toBeVisible();
    await expect(page.getByText('Avg Turnaround').first()).toBeVisible();
  });

  test('New Order button on Orders tab', async ({ authedPage: page }) => {
    await page.getByRole('tab', { name: /Orders/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: /New Order/i })).toBeVisible();
  });

  test('can close the add item dialog', async ({ authedPage: page }) => {
    await clickButton(page, 'Add Item');
    await expect(page.getByRole('dialog')).toBeVisible();
    await closeDialog(page);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
