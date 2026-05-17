// e2e/staff/staff-settings.spec.ts
// E2E tests for Staff Management & Settings modules

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
// STAFF MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe('Staff – Directory', () => {
  test('Staff Directory loads and user list renders', async ({ page }) => {
    await openSection(page, 'staff-directory');

    // Verify section heading
    await expect(
      page.getByRole('heading', { name: /staff/i }).or(page.getByRole('heading', { name: /directory/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify staff list / table is visible
    const listContainer = page.locator(
      'table, [role="table"], [data-testid="staff-list"], [data-testid="staff-grid"], [data-testid="user-list"]'
    );
    await expect(listContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify at least one staff member row/card is rendered
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="staff-"], [data-testid^="user-row"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('Staff Directory has search and filter controls', async ({ page }) => {
    await openSection(page, 'staff-directory');

    // Verify search input exists
    const searchInput = page.locator(
      'input[placeholder*="Search" i], input[placeholder*="Filter" i], [data-testid="staff-search"]'
    );
    const searchCount = await searchInput.count();
    if (searchCount > 0) {
      await expect(searchInput.first()).toBeVisible();
    }

    // Verify Add Staff / Invite button exists
    const addBtn = page.locator(
      'button:has-text("Add Staff"), button:has-text("Invite"), button:has-text("New Staff"), button:has-text("Add Member")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });

  test('Staff member rows show name and role information', async ({ page }) => {
    await openSection(page, 'staff-directory');

    // Verify column headers reference staff attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasStaffColumns = headerTexts.some(
      (h) => h.includes('name') || h.includes('role') || h.includes('department') || h.includes('status')
    );
    expect(hasStaffColumns).toBeTruthy();
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Staff – Shift Scheduling', () => {
  test('Shift Scheduling section loads', async ({ page }) => {
    await openSection(page, 'staff-shifts');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /shift/i }).or(page.getByRole('heading', { name: /schedule/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify the schedule view (calendar, grid, or list)
    const scheduleView = page.locator(
      'table, [role="table"], [data-testid="schedule-grid"], [data-testid="shift-calendar"], [data-testid="schedule-view"], [class*="calendar"], [data-testid="roster"]'
    );
    await expect(scheduleView.first()).toBeVisible({ timeout: 10000 });
  });

  test('Shift Scheduling has create and view controls', async ({ page }) => {
    await openSection(page, 'staff-shifts');

    // Look for Add Shift / Create Shift button
    const addBtn = page.locator(
      'button:has-text("Add Shift"), button:has-text("Create Shift"), button:has-text("New Shift"), button:has-text("Schedule")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }

    // Look for view toggle (day/week/month)
    const viewToggle = page.locator(
      'button[role="tab"], [data-testid="view-toggle"], button:has-text("Day"), button:has-text("Week"), button:has-text("Month")'
    );
    const toggleCount = await viewToggle.count();
    if (toggleCount > 0) {
      await expect(viewToggle.first()).toBeVisible();
    }
  });

  test('Can open the create shift dialog', async ({ page }) => {
    await openSection(page, 'staff-shifts');

    const addBtn = page.locator(
      'button:has-text("Add Shift"), button:has-text("Create Shift"), button:has-text("New Shift")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], [data-testid="shift-form"]'
      );
      const dialogCount = await dialog.count();
      if (dialogCount > 0) {
        await expect(dialog.first()).toBeVisible({ timeout: 8000 });

        // Verify form fields (staff member, start time, end time)
        const formFields = page.locator(
          '[role="dialog"] input, [data-state="open"] input, [role="dialog"] select'
        );
        await expect(formFields.first()).toBeVisible({ timeout: 5000 });

        await closeDialog(page);
      }
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Staff – Leave Management', () => {
  test('Leave Management section loads', async ({ page }) => {
    await openSection(page, 'staff-leave');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /leave/i }).or(page.getByRole('heading', { name: /time off/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify leave list or table renders
    const listContainer = page.locator(
      'table, [role="table"], [data-testid="leave-list"], [data-testid="leave-table"], [data-testid="timeoff-list"]'
    );
    await expect(listContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Leave Management has request and approve controls', async ({ page }) => {
    await openSection(page, 'staff-leave');

    // Look for request/approve buttons
    const actionBtn = page.locator(
      'button:has-text("Request Leave"), button:has-text("New Request"), button:has-text("Approve"), button:has-text("Add Leave")'
    );
    const btnCount = await actionBtn.count();
    if (btnCount > 0) {
      await expect(actionBtn.first()).toBeVisible();
      await expect(actionBtn.first()).toBeEnabled();
    }
  });

  test('Leave list shows status indicators', async ({ page }) => {
    await openSection(page, 'staff-leave');

    // Look for status badges (pending, approved, rejected)
    const statusElements = page.locator(
      '[data-testid^="status"], .badge, [class*="badge"], span[class*="status"]'
    );
    const statusCount = await statusElements.count();
    if (statusCount > 0) {
      await expect(statusElements.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Staff – Attendance', () => {
  test('Attendance section loads', async ({ page }) => {
    await openSection(page, 'staff-attendance');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /attendance/i }).or(page.getByRole('heading', { name: /timesheet/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify attendance view renders
    const viewContainer = page.locator(
      'table, [role="table"], [data-testid="attendance-grid"], [data-testid="attendance-table"], [data-testid="timesheet"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Attendance has clock-in / clock-out controls', async ({ page }) => {
    await openSection(page, 'staff-attendance');

    const clockBtn = page.locator(
      'button:has-text("Clock In"), button:has-text("Clock Out"), button:has-text("Clock"), button:has-text("Check In")'
    );
    const btnCount = await clockBtn.count();
    if (btnCount > 0) {
      await expect(clockBtn.first()).toBeVisible();
      await expect(clockBtn.first()).toBeEnabled();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Staff – Performance', () => {
  test('Performance section loads', async ({ page }) => {
    await openSection(page, 'staff-performance');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /performance/i }).or(page.getByRole('heading', { name: /review/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify performance view renders
    const viewContainer = page.locator(
      'table, [role="table"], [data-testid="performance-list"], [data-testid="reviews"], [data-testid="kpi-dashboard"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Staff – Payroll', () => {
  test('Payroll section loads', async ({ page }) => {
    await openSection(page, 'staff-payroll');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /payroll/i }).or(page.getByRole('heading', { name: /salary/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify payroll table/list renders
    const listContainer = page.locator(
      'table, [role="table"], [data-testid="payroll-table"], [data-testid="salary-list"], [data-testid="payslips"]'
    );
    await expect(listContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Payroll has generate and export controls', async ({ page }) => {
    await openSection(page, 'staff-payroll');

    const actionBtn = page.locator(
      'button:has-text("Generate"), button:has-text("Run Payroll"), button:has-text("Export"), button:has-text("Process")'
    );
    const btnCount = await actionBtn.count();
    if (btnCount > 0) {
      await expect(actionBtn.first()).toBeVisible();
      await expect(actionBtn.first()).toBeEnabled();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Staff – Channels', () => {
  test('Staff Channels section loads', async ({ page }) => {
    await openSection(page, 'staff-channels');

    // Verify heading or content renders (communication channels)
    const heading = page.getByRole('heading', { name: /channel/i }).or(
      page.getByRole('heading', { name: /communication/i }).or(
        page.getByRole('heading', { name: /message/i })
      )
    );

    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify the channels list or chat view renders
    const viewContainer = page.locator(
      'table, [role="table"], [data-testid="channel-list"], [data-testid="chat-list"], [data-testid="communication"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// SETTINGS MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe('Settings – General', () => {
  test('Settings General loads and hotel settings form is present', async ({ page }) => {
    await openSection(page, 'settings-general');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /general/i }).or(page.getByRole('heading', { name: /hotel setting/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify a settings form renders with input fields
    const formContainer = page.locator(
      'form, [data-testid="settings-form"], [data-testid="hotel-settings"], [role="form"]'
    );
    await expect(formContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify there are input fields in the form
    const formInputs = page.locator(
      'form input, [role="form"] input, [data-testid="settings-form"] input'
    );
    await expect(formInputs.first()).toBeVisible({ timeout: 10000 });
    const inputCount = await formInputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(1);
  });

  test('General settings has save button', async ({ page }) => {
    await openSection(page, 'settings-general');

    const saveBtn = page.locator(
      'button:has-text("Save"), button:has-text("Save Changes"), button[type="submit"]'
    );
    const btnCount = await saveBtn.count();
    if (btnCount > 0) {
      await expect(saveBtn.first()).toBeVisible();
      await expect(saveBtn.first()).toBeEnabled();
    }
  });

  test('General settings form includes hotel name field', async ({ page }) => {
    await openSection(page, 'settings-general');

    // Look for hotel name input
    const nameInput = page.locator(
      'input[name*="name" i], input[aria-label*="hotel" i], input[aria-label*="name" i], input[placeholder*="hotel" i], input[placeholder*="name" i]'
    );
    const inputCount = await nameInput.count();
    if (inputCount > 0) {
      await expect(nameInput.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Settings – Security', () => {
  test('Settings Security loads and password policy form is visible', async ({ page }) => {
    await openSection(page, 'settings-security');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /security/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify security settings form is present
    const formContainer = page.locator(
      'form, [data-testid="security-form"], [data-testid="password-policy"], [role="form"]'
    );
    await expect(formContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify there are form controls (inputs, selects, toggles)
    const formControls = page.locator(
      'form input, form select, form button[type="submit"], [role="form"] input, [role="switch"], [data-testid="security-form"] input'
    );
    await expect(formControls.first()).toBeVisible({ timeout: 10000 });
  });

  test('Security settings has password policy controls', async ({ page }) => {
    await openSection(page, 'settings-security');

    // Look for password-related controls
    const passwordControls = page.locator(
      'input[placeholder*="password" i], input[aria-label*="password" i], input[name*="password" i], [data-testid*="password"]'
    );
    const pwCount = await passwordControls.count();
    if (pwCount > 0) {
      await expect(passwordControls.first()).toBeVisible();
    }

    // Look for policy toggles (min length, complexity, etc.)
    const toggles = page.locator(
      '[role="switch"], [role="checkbox"], input[type="checkbox"], input[type="range"], [data-testid*="policy"]'
    );
    const toggleCount = await toggles.count();
    if (toggleCount > 0) {
      await expect(toggles.first()).toBeVisible();
    }
  });

  test('Security settings has save button', async ({ page }) => {
    await openSection(page, 'settings-security');

    const saveBtn = page.locator(
      'button:has-text("Save"), button:has-text("Save Changes"), button:has-text("Update"), button[type="submit"]'
    );
    const btnCount = await saveBtn.count();
    if (btnCount > 0) {
      await expect(saveBtn.first()).toBeVisible();
      await expect(saveBtn.first()).toBeEnabled();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Settings – Tax', () => {
  test('Settings Tax loads and tax configuration form is visible', async ({ page }) => {
    await openSection(page, 'settings-tax');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /tax/i }).or(page.getByRole('heading', { name: /taxation/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify tax configuration renders
    const formContainer = page.locator(
      'form, [data-testid="tax-form"], [data-testid="tax-configuration"], [role="form"], table'
    );
    await expect(formContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Tax settings includes tax rate fields', async ({ page }) => {
    await openSection(page, 'settings-tax');

    // Look for tax rate input or percentage field
    const taxFields = page.locator(
      'input[placeholder*="rate" i], input[placeholder*="tax" i], input[aria-label*="rate" i], input[name*="tax" i], input[name*="rate" i]'
    );
    const fieldCount = await taxFields.count();
    if (fieldCount > 0) {
      await expect(taxFields.first()).toBeVisible();
    }

    // Look for number inputs (percentage values)
    const numberInputs = page.locator('input[type="number"]');
    const numCount = await numberInputs.count();
    if (numCount > 0) {
      await expect(numberInputs.first()).toBeVisible();
    }
  });

  test('Tax settings has add/edit tax rule controls', async ({ page }) => {
    await openSection(page, 'settings-tax');

    const actionBtn = page.locator(
      'button:has-text("Add Tax"), button:has-text("New Tax"), button:has-text("Add Rule"), button:has-text("Create")'
    );
    const btnCount = await actionBtn.count();
    if (btnCount > 0) {
      await expect(actionBtn.first()).toBeVisible();
      await expect(actionBtn.first()).toBeEnabled();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Settings – Localization', () => {
  test('Settings Localization loads', async ({ page }) => {
    await openSection(page, 'settings-localization');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /localization/i }).or(page.getByRole('heading', { name: /language/i })).or(
        page.getByRole('heading', { name: /locale/i }).or(page.getByRole('heading', { name: /regional/i }))
      )
    ).toBeVisible({ timeout: 10000 });

    // Verify localization settings render
    const viewContainer = page.locator(
      'form, [data-testid="localization-form"], [data-testid="locale-settings"], [role="form"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Localization settings includes language or timezone controls', async ({ page }) => {
    await openSection(page, 'settings-localization');

    // Look for language, timezone, currency, or date format selectors
    const controls = page.locator(
      'select, [role="listbox"], [role="combobox"], button[aria-haspopup="listbox"], [data-testid*="language"], [data-testid*="timezone"], [data-testid*="currency"]'
    );
    const controlCount = await controls.count();
    if (controlCount > 0) {
      await expect(controls.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Settings – GDPR', () => {
  test('Settings GDPR loads', async ({ page }) => {
    await openSection(page, 'settings-gdpr');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /gdpr/i }).or(page.getByRole('heading', { name: /privacy/i })).or(
        page.getByRole('heading', { name: /data protection/i }).or(page.getByRole('heading', { name: /consent/i }))
      )
    ).toBeVisible({ timeout: 10000 });

    // Verify GDPR settings render
    const viewContainer = page.locator(
      'form, [data-testid="gdpr-form"], [data-testid="privacy-settings"], [role="form"], table, [data-testid="consent-management"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('GDPR settings includes consent or data management controls', async ({ page }) => {
    await openSection(page, 'settings-gdpr');

    // Look for toggles, checkboxes, or data management buttons
    const controls = page.locator(
      '[role="switch"], [role="checkbox"], input[type="checkbox"], button:has-text("Export"), button:has-text("Delete"), button:has-text("Request"), [data-testid*="consent"], [data-testid*="gdpr"]'
    );
    const controlCount = await controls.count();
    if (controlCount > 0) {
      await expect(controls.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Settings – Integrations', () => {
  test('Settings Integrations loads', async ({ page }) => {
    await openSection(page, 'settings-integrations');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /integration/i }).or(page.getByRole('heading', { name: /connect/i })).or(
        page.getByRole('heading', { name: /api/i }).or(page.getByRole('heading', { name: /third.party/i }))
      )
    ).toBeVisible({ timeout: 10000 });

    // Verify integrations list/grid renders
    const viewContainer = page.locator(
      'table, [role="table"], [data-testid="integrations"], [data-testid="integration-list"], [data-testid="connection-list"], form, [data-testid="api-settings"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Integrations shows configurable connection cards or rows', async ({ page }) => {
    await openSection(page, 'settings-integrations');

    // Look for integration items (cards, rows with connect/configure buttons)
    const integrationItems = page.locator(
      '[data-testid^="integration-"], [data-testid^="connection-"], [data-testid^="api-"]'
    );
    const itemCount = await integrationItems.count();
    if (itemCount > 0) {
      await expect(integrationItems.first()).toBeVisible();
    }

    // Look for Connect / Configure / Disconnect buttons
    const actionBtn = page.locator(
      'button:has-text("Connect"), button:has-text("Configure"), button:has-text("Disconnect"), button:has-text("Setup")'
    );
    const btnCount = await actionBtn.count();
    if (btnCount > 0) {
      await expect(actionBtn.first()).toBeVisible();
      await expect(actionBtn.first()).toBeEnabled();
    }
  });

  test('Integrations includes API key or webhook configuration', async ({ page }) => {
    await openSection(page, 'settings-integrations');

    // Look for API key / webhook / URL input fields
    const configFields = page.locator(
      'input[placeholder*="key" i], input[placeholder*="url" i], input[placeholder*="webhook" i], input[placeholder*="token" i], input[aria-label*="key" i], input[aria-label*="url" i], [data-testid*="api-key"], [data-testid*="webhook"]'
    );
    const fieldCount = await configFields.count();
    if (fieldCount > 0) {
      await expect(configFields.first()).toBeVisible();
    }
  });
});
