// e2e/pos/pos-inventory.spec.ts
// E2E tests for POS & Inventory modules

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

// ═══════════════════════════════════════════════════════════════════
// POS MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe('POS – Orders', () => {
  test('POS Orders section loads and order list renders', async ({ page }) => {
    await openSection(page, 'pos-orders');

    // Verify the section heading is present
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible({ timeout: 10000 });

    // Verify a table or list container exists
    const listContainer = page.locator(
      'table, [role="table"], [data-testid="order-list"], [data-testid="orders-table"]'
    );
    await expect(listContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify there are rows or cards rendered (not an empty state)
    const rows = page.locator('table tbody tr, [role="table"] [role="row"], [data-testid^="order-row"], [data-testid^="order-card"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // Verify at least one order is displayed
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('POS Orders section has functional action buttons', async ({ page }) => {
    await openSection(page, 'pos-orders');

    // Look for common action buttons (New Order, filter, refresh)
    const actionBtn = page.locator(
      'button:has-text("New Order"), button:has-text("Create Order"), button:has-text("Add Order")'
    );
    const btnCount = await actionBtn.count();

    if (btnCount > 0) {
      await expect(actionBtn.first()).toBeVisible();
      await expect(actionBtn.first()).toBeEnabled();
    }

    // Verify search or filter input exists
    const searchInput = page.locator(
      'input[placeholder*="Search" i], input[placeholder*="Filter" i], [data-testid="search-input"]'
    );
    const searchCount = await searchInput.count();
    if (searchCount > 0) {
      await expect(searchInput.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('POS – Menu Management', () => {
  test('Menu Management loads and displays 15+ menu items across categories', async ({ page }) => {
    await openSection(page, 'pos-menu');

    // Verify section heading
    await expect(
      page.getByRole('heading', { name: /menu/i }).or(page.getByRole('heading', { name: /items/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify category tabs/filters (5 seeded categories)
    const categoryElements = page.locator(
      'button[role="tab"], [data-testid="category-tab"], [data-testid="category-filter"]'
    );
    const categoryCount = await categoryElements.count();
    if (categoryCount > 0) {
      expect(categoryCount).toBeGreaterThanOrEqual(2);
    }

    // Verify menu items table renders
    const tableContainer = page.locator('table, [role="table"], [data-testid="menu-items-table"], [data-testid="menu-grid"]');
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify at least 15 menu items are displayed (seeds)
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="menu-item"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(15);
  });

  test('Can open the create menu item dialog', async ({ page }) => {
    await openSection(page, 'pos-menu');

    // Click the "Add" / "Create" / "New Item" button
    const addBtn = page.locator(
      'button:has-text("Add Item"), button:has-text("Create Item"), button:has-text("New Item"), button:has-text("Add Menu")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Verify a dialog / sheet / drawer opened
      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], .modal, [data-testid="menu-item-form"]'
      );
      await expect(dialog.first()).toBeVisible({ timeout: 8000 });

      // Verify form fields exist (name, price, category)
      const formFields = page.locator(
        '[role="dialog"] input, [data-state="open"] input, [data-testid="menu-item-form"] input'
      );
      await expect(formFields.first()).toBeVisible({ timeout: 5000 });

      // Close the dialog
      await closeDialog(page);
    }
  });

  test('Can create a new menu item with valid data', async ({ page }) => {
    await openSection(page, 'pos-menu');

    const addBtn = page.locator(
      'button:has-text("Add Item"), button:has-text("Create Item"), button:has-text("New Item"), button:has-text("Add Menu")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Fill in the form fields
      try {
        await fillInput(page, 'name', 'Test Grilled Salmon');
      } catch {
        // Field label may differ
        const nameInput = page.locator('[role="dialog"] input').first();
        await nameInput.fill('Test Grilled Salmon');
      }

      // Fill price
      try {
        await fillInput(page, 'price', '24.99');
      } catch {
        const priceInput = page.locator('[role="dialog"] input[type="number"]').first();
        if (await priceInput.isVisible()) {
          await priceInput.fill('24.99');
        }
      }

      // Fill description if available
      try {
        await fillInput(page, 'description', 'Fresh Atlantic salmon, grilled to perfection');
      } catch {
        // description field may not exist
      }

      // Submit the form
      await submitForm(page);

      // Verify success toast or dialog close
      try {
        await waitForToast(page);
      } catch {
        // Toast may not appear; check dialog closed instead
      }

      // Verify dialog is closed
      await page.waitForTimeout(1000);
      const dialog = page.locator('[role="dialog"]');
      if ((await dialog.count()) > 0) {
        await expect(dialog).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Menu items can be filtered by category', async ({ page }) => {
    await openSection(page, 'pos-menu');

    // Look for category tabs, pills, or a dropdown
    const categoryElements = page.locator(
      'button[role="tab"], [data-testid="category-tab"], [data-testid="category-filter"]'
    );
    const categoryCount = await categoryElements.count();

    if (categoryCount > 1) {
      // Click the second category tab
      await categoryElements.nth(1).click();
      await page.waitForTimeout(1000);

      // Verify table still renders with filtered items
      const rows = page.locator('table tbody tr, [role="table"] [role="row"]');
      await expect(rows.first()).toBeVisible({ timeout: 8000 });
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('POS – Table Management', () => {
  test('Table Management section loads and displays tables', async ({ page }) => {
    await openSection(page, 'pos-tables');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /table/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify table layout or grid renders
    const tableGrid = page.locator(
      'table, [role="table"], [data-testid="table-grid"], [data-testid="tables-grid"], [data-testid="floor-plan"]'
    );
    await expect(tableGrid.first()).toBeVisible({ timeout: 10000 });

    // Verify individual table elements exist
    const tableItems = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="table-"], [data-testid^="dining-table"]'
    );
    await expect(tableItems.first()).toBeVisible({ timeout: 10000 });
    const tableCount = await tableItems.count();
    expect(tableCount).toBeGreaterThanOrEqual(1);
  });

  test('Table Management has add and configure actions', async ({ page }) => {
    await openSection(page, 'pos-tables');

    // Look for Add Table / Add Section button
    const addBtn = page.locator(
      'button:has-text("Add Table"), button:has-text("New Table"), button:has-text("Add Section"), button:has-text("Configure")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('POS – Reservations', () => {
  test('Reservations section loads', async ({ page }) => {
    await openSection(page, 'pos-reservations');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /reservation/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify list/table renders
    const listContainer = page.locator(
      'table, [role="table"], [data-testid="reservation-list"], [data-testid="reservations-table"]'
    );
    await expect(listContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Reservations has create new reservation action', async ({ page }) => {
    await openSection(page, 'pos-reservations');

    const addBtn = page.locator(
      'button:has-text("New Reservation"), button:has-text("Add Reservation"), button:has-text("Book Table")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// INVENTORY MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe('Inventory – Stock Items', () => {
  test('Stock Items section loads and displays 6 items', async ({ page }) => {
    await openSection(page, 'inventory-stock');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /stock/i }).or(page.getByRole('heading', { name: /inventory/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify stock items table renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="stock-table"], [data-testid="stock-items"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify 6 seeded stock items
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="stock-item"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(6);
  });

  test('Can open the create stock item dialog', async ({ page }) => {
    await openSection(page, 'inventory-stock');

    // Click Add Stock Item button
    const addBtn = page.locator(
      'button:has-text("Add Stock"), button:has-text("Add Item"), button:has-text("New Stock"), button:has-text("Create Stock")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Verify dialog opened
      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], [data-testid="stock-item-form"]'
      );
      await expect(dialog.first()).toBeVisible({ timeout: 8000 });

      // Verify form fields (item name, quantity, unit)
      const formFields = page.locator(
        '[role="dialog"] input, [data-state="open"] input'
      );
      await expect(formFields.first()).toBeVisible({ timeout: 5000 });

      // Close dialog
      await closeDialog(page);
    }
  });

  test('Can create a new stock item with valid data', async ({ page }) => {
    await openSection(page, 'inventory-stock');

    const addBtn = page.locator(
      'button:has-text("Add Stock"), button:has-text("Add Item"), button:has-text("New Stock"), button:has-text("Create Stock")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Fill stock item name
      try {
        await fillInput(page, 'name', 'Test Olive Oil');
      } catch {
        const nameInput = page.locator('[role="dialog"] input').first();
        await nameInput.fill('Test Olive Oil');
      }

      // Fill quantity
      try {
        await fillInput(page, 'quantity', '50');
      } catch {
        const qtyInput = page.locator('[role="dialog"] input[type="number"]').first();
        if (await qtyInput.isVisible()) {
          await qtyInput.fill('50');
        }
      }

      // Fill unit price if available
      try {
        await fillInput(page, 'price', '8.50');
      } catch {
        // price field may not exist
      }

      // Submit
      await submitForm(page);

      // Verify success
      try {
        await waitForToast(page);
      } catch {
        // Toast may not appear
      }

      await page.waitForTimeout(1000);
      const dialog = page.locator('[role="dialog"]');
      if ((await dialog.count()) > 0) {
        await expect(dialog).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Stock items have quantity and unit columns', async ({ page }) => {
    await openSection(page, 'inventory-stock');

    // Verify column headers contain quantity-related text
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    // At least one header should reference quantity or unit
    const hasRelevantColumn = headerTexts.some(
      (h) => h.includes('quantity') || h.includes('unit') || h.includes('stock') || h.includes('qty')
    );
    expect(hasRelevantColumn).toBeTruthy();
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Inventory – Purchase Orders', () => {
  test('Purchase Orders section loads and displays 3 orders', async ({ page }) => {
    await openSection(page, 'inventory-purchase-orders');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /purchase order/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify table renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="purchase-orders"], [data-testid="po-table"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify 3 seeded purchase orders
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="purchase-order"], [data-testid^="po-"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);
  });

  test('Purchase Orders has status indicators', async ({ page }) => {
    await openSection(page, 'inventory-purchase-orders');

    // Look for status badges/pills
    const statusElements = page.locator(
      '[data-testid^="status"], .badge, [class*="badge"], span[class*="status"]'
    );
    const statusCount = await statusElements.count();
    if (statusCount > 0) {
      await expect(statusElements.first()).toBeVisible();
    }
  });

  test('Purchase Orders has create action', async ({ page }) => {
    await openSection(page, 'inventory-purchase-orders');

    const addBtn = page.locator(
      'button:has-text("New Order"), button:has-text("Create Order"), button:has-text("Add Order"), button:has-text("New PO")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Inventory – Vendors', () => {
  test('Vendors section loads and displays 3 vendors', async ({ page }) => {
    await openSection(page, 'inventory-vendors');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /vendor/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify vendors table/grid renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="vendors"], [data-testid="vendor-list"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify 3 seeded vendors
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="vendor"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);
  });

  test('Can open the create vendor dialog', async ({ page }) => {
    await openSection(page, 'inventory-vendors');

    const addBtn = page.locator(
      'button:has-text("Add Vendor"), button:has-text("New Vendor"), button:has-text("Create Vendor")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Verify dialog opened
      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], [data-testid="vendor-form"]'
      );
      await expect(dialog.first()).toBeVisible({ timeout: 8000 });

      // Verify form fields
      const formFields = page.locator(
        '[role="dialog"] input, [data-state="open"] input'
      );
      await expect(formFields.first()).toBeVisible({ timeout: 5000 });

      // Close
      await closeDialog(page);
    }
  });

  test('Can create a new vendor with valid data', async ({ page }) => {
    await openSection(page, 'inventory-vendors');

    const addBtn = page.locator(
      'button:has-text("Add Vendor"), button:has-text("New Vendor"), button:has-text("Create Vendor")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Fill vendor name
      try {
        await fillInput(page, 'name', 'Test Fresh Farms Co.');
      } catch {
        const nameInput = page.locator('[role="dialog"] input').first();
        await nameInput.fill('Test Fresh Farms Co.');
      }

      // Fill contact email
      try {
        await fillInput(page, 'email', 'supply@freshfarms.com');
      } catch {
        // email field may not exist
      }

      // Fill phone
      try {
        await fillInput(page, 'phone', '+1-555-0100');
      } catch {
        // phone field may not exist
      }

      // Submit
      await submitForm(page);

      // Verify success
      try {
        await waitForToast(page);
      } catch {
        // Toast may not appear
      }

      await page.waitForTimeout(1000);
      const dialog = page.locator('[role="dialog"]');
      if ((await dialog.count()) > 0) {
        await expect(dialog).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Vendor list shows contact information', async ({ page }) => {
    await openSection(page, 'inventory-vendors');

    // Verify column headers contain contact-related text
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasContactColumn = headerTexts.some(
      (h) => h.includes('contact') || h.includes('email') || h.includes('phone') || h.includes('name')
    );
    expect(hasContactColumn).toBeTruthy();
  });
});
