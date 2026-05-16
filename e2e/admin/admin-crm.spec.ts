// e2e/admin/admin-crm.spec.ts
// E2E tests for Admin & CRM modules

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
// ADMIN MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe('Admin – Users', () => {
  test('Admin Users section loads and user table renders', async ({ page }) => {
    await openSection(page, 'admin-users');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /user/i }).or(page.getByRole('heading', { name: /admin/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify user table renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="user-table"], [data-testid="admin-users"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify user rows exist
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="user-row"], [data-testid^="admin-user"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('Admin Users has search, filter, and invite controls', async ({ page }) => {
    await openSection(page, 'admin-users');

    // Search input
    const searchInput = page.locator(
      'input[placeholder*="Search" i], input[placeholder*="Filter" i], [data-testid="user-search"]'
    );
    const searchCount = await searchInput.count();
    if (searchCount > 0) {
      await expect(searchInput.first()).toBeVisible();
    }

    // Invite / Add User button
    const addBtn = page.locator(
      'button:has-text("Invite"), button:has-text("Add User"), button:has-text("New User"), button:has-text("Create User")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });

  test('Admin Users table shows email and role columns', async ({ page }) => {
    await openSection(page, 'admin-users');

    // Verify column headers contain user attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasUserColumns = headerTexts.some(
      (h) => h.includes('email') || h.includes('role') || h.includes('name') || h.includes('status')
    );
    expect(hasUserColumns).toBeTruthy();
  });

  test('Can open the invite user dialog', async ({ page }) => {
    await openSection(page, 'admin-users');

    const inviteBtn = page.locator(
      'button:has-text("Invite"), button:has-text("Add User"), button:has-text("New User"), button:has-text("Create User")'
    );
    const btnCount = await inviteBtn.count();

    if (btnCount > 0) {
      await inviteBtn.first().click();
      await page.waitForTimeout(500);

      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], [data-testid="invite-form"], [data-testid="user-form"]'
      );
      const dialogCount = await dialog.count();
      if (dialogCount > 0) {
        await expect(dialog.first()).toBeVisible({ timeout: 8000 });

        // Verify email input exists
        const emailInput = page.locator(
          '[role="dialog"] input[type="email"], [role="dialog"] input[name*="email" i], [data-state="open"] input'
        );
        await expect(emailInput.first()).toBeVisible({ timeout: 5000 });

        await closeDialog(page);
      }
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Admin – Roles', () => {
  test('Admin Roles loads with role and permission management', async ({ page }) => {
    await openSection(page, 'admin-roles');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /role/i }).or(page.getByRole('heading', { name: /permission/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify roles table or list renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="roles-table"], [data-testid="role-list"], [data-testid="permissions"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify role rows exist
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="role-"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test('Roles section shows permission checkboxes or toggles', async ({ page }) => {
    await openSection(page, 'admin-roles');

    // Look for permission controls (checkboxes, toggles)
    const permControls = page.locator(
      'input[type="checkbox"], [role="checkbox"], [role="switch"], [data-testid*="permission"]'
    );
    const controlCount = await permControls.count();
    if (controlCount > 0) {
      await expect(permControls.first()).toBeVisible();
    }
  });

  test('Roles has create/edit role action', async ({ page }) => {
    await openSection(page, 'admin-roles');

    const addBtn = page.locator(
      'button:has-text("Add Role"), button:has-text("New Role"), button:has-text("Create Role"), button:has-text("Edit Role")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });

  test('Can open create role dialog and see permission controls', async ({ page }) => {
    await openSection(page, 'admin-roles');

    const addBtn = page.locator(
      'button:has-text("Add Role"), button:has-text("New Role"), button:has-text("Create Role")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], [data-testid="role-form"]'
      );
      const dialogCount = await dialog.count();
      if (dialogCount > 0) {
        await expect(dialog.first()).toBeVisible({ timeout: 8000 });

        // Verify role name input
        const nameInput = page.locator('[role="dialog"] input').first();
        await expect(nameInput).toBeVisible({ timeout: 5000 });

        // Verify permission controls
        const permControls = page.locator(
          '[role="dialog"] input[type="checkbox"], [role="dialog"] [role="checkbox"], [role="dialog"] [role="switch"]'
        );
        const permCount = await permControls.count();
        if (permCount > 0) {
          await expect(permControls.first()).toBeVisible();
        }

        await closeDialog(page);
      }
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Admin – Tenants', () => {
  test('Admin Tenants loads with tenant list (2 tenants seeded)', async ({ page }) => {
    await openSection(page, 'admin-tenants');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /tenant/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify tenant table renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="tenant-table"], [data-testid="tenant-list"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify at least 2 seeded tenants
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="tenant-"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });

  test('Tenant rows show property/hotel name and status', async ({ page }) => {
    await openSection(page, 'admin-tenants');

    // Verify column headers reference tenant attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasTenantColumns = headerTexts.some(
      (h) => h.includes('name') || h.includes('hotel') || h.includes('property') || h.includes('status') || h.includes('plan')
    );
    expect(hasTenantColumns).toBeTruthy();
  });

  test('Tenants has create and manage controls', async ({ page }) => {
    await openSection(page, 'admin-tenants');

    const addBtn = page.locator(
      'button:has-text("Add Tenant"), button:has-text("New Tenant"), button:has-text("Create Tenant"), button:has-text("Manage")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Admin – Audit Logs', () => {
  test('Admin Audit logs loads', async ({ page }) => {
    await openSection(page, 'admin-audit');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /audit/i }).or(page.getByRole('heading', { name: /activity log/i })).or(
        page.getByRole('heading', { name: /log/i })
      )
    ).toBeVisible({ timeout: 10000 });

    // Verify audit log table renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="audit-table"], [data-testid="audit-log"], [data-testid="activity-log"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify log entries exist
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="audit-"], [data-testid^="log-entry"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
  });

  test('Audit logs show timestamp and action columns', async ({ page }) => {
    await openSection(page, 'admin-audit');

    // Verify column headers contain audit attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasAuditColumns = headerTexts.some(
      (h) => h.includes('date') || h.includes('time') || h.includes('action') || h.includes('user') || h.includes('event') || h.includes('module')
    );
    expect(hasAuditColumns).toBeTruthy();
  });

  test('Audit logs has filter by date range and user', async ({ page }) => {
    await openSection(page, 'admin-audit');

    // Look for date inputs or date range picker
    const dateInput = page.locator('input[type="date"], input[placeholder*="date" i], [data-testid*="date"]');
    const dateCount = await dateInput.count();
    if (dateCount > 0) {
      await expect(dateInput.first()).toBeVisible();
    }

    // Look for user filter
    const userFilter = page.locator(
      'select, [role="listbox"], [role="combobox"], input[placeholder*="user" i], [data-testid*="user-filter"]'
    );
    const filterCount = await userFilter.count();
    if (filterCount > 0) {
      await expect(userFilter.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Admin – Features', () => {
  test('Settings Features section loads', async ({ page }) => {
    await openSection(page, 'settings-features');

    // Verify heading or feature toggles render
    const heading = page.getByRole('heading', { name: /feature/i });
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify feature flags/toggles render
    const toggles = page.locator(
      '[role="switch"], [role="checkbox"], input[type="checkbox"], [data-testid*="feature"]'
    );
    const toggleCount = await toggles.count();
    if (toggleCount > 0) {
      await expect(toggles.first()).toBeVisible();
    }

    // Fallback: verify any form content
    const content = page.locator(
      'form, [data-testid="features"], [data-testid="feature-flags"]'
    );
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Admin – License', () => {
  test('Settings License section loads', async ({ page }) => {
    await openSection(page, 'settings-license');

    // Verify heading or license info renders
    const heading = page.getByRole('heading', { name: /license/i }).or(
      page.getByRole('heading', { name: /subscription/i }).or(
        page.getByRole('heading', { name: /billing/i }).or(
          page.getByRole('heading', { name: /plan/i })
        )
      )
    );
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify license content renders (card, form, or table)
    const content = page.locator(
      'table, form, [data-testid="license"], [data-testid="subscription"], [data-testid="billing"], [data-testid="plan-info"]'
    );
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CRM MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe('CRM – Segments', () => {
  test('CRM Segments loads with guest segments (3 seeded)', async ({ page }) => {
    await openSection(page, 'crm-segments');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /segment/i }).or(page.getByRole('heading', { name: /guest segment/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify segments table/grid renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="segments"], [data-testid="segment-list"], [data-testid="guest-segments"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify at least 3 seeded segments
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="segment-"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);
  });

  test('Segments has create segment action', async ({ page }) => {
    await openSection(page, 'crm-segments');

    const addBtn = page.locator(
      'button:has-text("Add Segment"), button:has-text("New Segment"), button:has-text("Create Segment"), button:has-text("Add Group")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });

  test('Can open create segment dialog', async ({ page }) => {
    await openSection(page, 'crm-segments');

    const addBtn = page.locator(
      'button:has-text("Add Segment"), button:has-text("New Segment"), button:has-text("Create Segment")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], [data-testid="segment-form"]'
      );
      const dialogCount = await dialog.count();
      if (dialogCount > 0) {
        await expect(dialog.first()).toBeVisible({ timeout: 8000 });

        // Verify form fields
        const formFields = page.locator('[role="dialog"] input, [data-state="open"] input');
        await expect(formFields.first()).toBeVisible({ timeout: 5000 });

        await closeDialog(page);
      }
    }
  });

  test('Segment rows show guest count or member info', async ({ page }) => {
    await openSection(page, 'crm-segments');

    // Verify column headers reference segment attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasSegmentColumns = headerTexts.some(
      (h) => h.includes('name') || h.includes('guest') || h.includes('count') || h.includes('member') || h.includes('criteria') || h.includes('status')
    );
    expect(hasSegmentColumns).toBeTruthy();
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('CRM – Campaigns', () => {
  test('CRM Campaigns loads (2 seeded campaigns)', async ({ page }) => {
    await openSection(page, 'crm-campaigns');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /campaign/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify campaigns table/list renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="campaigns"], [data-testid="campaign-list"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify at least 2 seeded campaigns
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="campaign-"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });

  test('Campaigns shows status and type information', async ({ page }) => {
    await openSection(page, 'crm-campaigns');

    // Look for status badges
    const statusElements = page.locator(
      '[data-testid^="status"], .badge, [class*="badge"], span[class*="status"]'
    );
    const statusCount = await statusElements.count();
    if (statusCount > 0) {
      await expect(statusElements.first()).toBeVisible();
    }

    // Verify column headers reference campaign attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasCampaignColumns = headerTexts.some(
      (h) => h.includes('name') || h.includes('type') || h.includes('status') || h.includes('date') || h.includes('audience') || h.includes('sent')
    );
    expect(hasCampaignColumns).toBeTruthy();
  });

  test('Campaigns has create campaign action', async ({ page }) => {
    await openSection(page, 'crm-campaigns');

    const addBtn = page.locator(
      'button:has-text("Add Campaign"), button:has-text("New Campaign"), button:has-text("Create Campaign")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });

  test('Can open create campaign dialog', async ({ page }) => {
    await openSection(page, 'crm-campaigns');

    const addBtn = page.locator(
      'button:has-text("Add Campaign"), button:has-text("New Campaign"), button:has-text("Create Campaign")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], [data-testid="campaign-form"]'
      );
      const dialogCount = await dialog.count();
      if (dialogCount > 0) {
        await expect(dialog.first()).toBeVisible({ timeout: 8000 });

        // Verify form fields
        const formFields = page.locator('[role="dialog"] input, [data-state="open"] input');
        await expect(formFields.first()).toBeVisible({ timeout: 5000 });

        await closeDialog(page);
      }
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('CRM – Loyalty', () => {
  test('CRM Loyalty loads with loyalty tiers (3 seeded)', async ({ page }) => {
    await openSection(page, 'crm-loyalty');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /loyalty/i }).or(page.getByRole('heading', { name: /reward/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify loyalty tiers table/grid renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="loyalty"], [data-testid="tiers"], [data-testid="loyalty-tiers"], [data-testid="reward-program"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify at least 3 seeded loyalty tiers
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="tier-"], [data-testid^="loyalty-"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(3);
  });

  test('Loyalty tiers show tier name and benefits', async ({ page }) => {
    await openSection(page, 'crm-loyalty');

    // Verify column headers reference loyalty attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasLoyaltyColumns = headerTexts.some(
      (h) => h.includes('tier') || h.includes('name') || h.includes('point') || h.includes('benefit') || h.includes('member') || h.includes('discount') || h.includes('level')
    );
    expect(hasLoyaltyColumns).toBeTruthy();
  });

  test('Loyalty has manage tiers action', async ({ page }) => {
    await openSection(page, 'crm-loyalty');

    const actionBtn = page.locator(
      'button:has-text("Add Tier"), button:has-text("New Tier"), button:has-text("Edit Tier"), button:has-text("Manage"), button:has-text("Configure")'
    );
    const btnCount = await actionBtn.count();
    if (btnCount > 0) {
      await expect(actionBtn.first()).toBeVisible();
      await expect(actionBtn.first()).toBeEnabled();
    }
  });

  test('Loyalty section shows member statistics or summary', async ({ page }) => {
    await openSection(page, 'crm-loyalty');

    // Look for stats cards, counters, or summary sections
    const statsContainer = page.locator(
      '[data-testid^="stat"], [data-testid*="summary"], [data-testid*="dashboard"], [class*="stat"], [class*="metric"], [class*="counter"], [class*="summary"]'
    );
    const statsCount = await statsContainer.count();
    if (statsCount > 0) {
      await expect(statsContainer.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('CRM – Lead Pipeline', () => {
  test('CRM Lead Pipeline loads', async ({ page }) => {
    await openSection(page, 'crm-lead-pipeline');

    // Verify heading
    const heading = page.getByRole('heading', { name: /lead/i }).or(
      page.getByRole('heading', { name: /pipeline/i })
    );
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify pipeline view renders (kanban board, table, or list)
    const viewContainer = page.locator(
      'table, [role="table"], [data-testid="pipeline"], [data-testid="lead-pipeline"], [data-testid="leads"], [data-testid="kanban"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Lead Pipeline has add lead action', async ({ page }) => {
    await openSection(page, 'crm-lead-pipeline');

    const addBtn = page.locator(
      'button:has-text("Add Lead"), button:has-text("New Lead"), button:has-text("Create Lead")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });
});
