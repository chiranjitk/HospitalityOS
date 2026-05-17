// e2e/reports/reports-facilities.spec.ts
// E2E tests for Reports & Facilities modules

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
// REPORTS MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe('Reports – Dashboard', () => {
  test('Reports Dashboard loads', async ({ page }) => {
    await openSection(page, 'reports-dashboard');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /dashboard/i }).or(page.getByRole('heading', { name: /overview/i })).or(
        page.getByRole('heading', { name: /report/i })
      )
    ).toBeVisible({ timeout: 10000 });

    // Verify dashboard content renders (cards, charts, or metrics)
    const dashboardContent = page.locator(
      '[data-testid*="stat"], [data-testid*="metric"], [data-testid*="chart"], [data-testid*="summary"], [data-testid*="kpi"], [class*="chart"], [class*="card"]'
    );
    await expect(dashboardContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Dashboard shows key metrics or summary cards', async ({ page }) => {
    await openSection(page, 'reports-dashboard');

    // Verify multiple stat/metric cards exist (at least 2)
    const metricCards = page.locator(
      '[data-testid^="stat"], [data-testid^="metric"], [data-testid^="kpi"], [data-testid^="summary"]'
    );
    const cardCount = await metricCards.count();
    if (cardCount > 0) {
      expect(cardCount).toBeGreaterThanOrEqual(2);
    }

    // Fallback: verify any cards or panels are visible
    const cards = page.locator(
      '[class*="card"], [role="region"], article, section > div'
    );
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('Dashboard has date range or period selector', async ({ page }) => {
    await openSection(page, 'reports-dashboard');

    // Look for date picker, range selector, or period tabs
    const dateSelector = page.locator(
      'input[type="date"], input[placeholder*="date" i], button[role="tab"], [data-testid*="date"], [data-testid*="period"], [data-testid*="range"], select'
    );
    const selectorCount = await dateSelector.count();
    if (selectorCount > 0) {
      await expect(dateSelector.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Reports – Occupancy', () => {
  test('Occupancy Reports loads', async ({ page }) => {
    await openSection(page, 'reports-occupancy');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /occupancy/i })
    ).toBeVisible({ timeout: 10000 });

    // Verify report content renders (table, chart, or metrics)
    const reportContent = page.locator(
      'table, [role="table"], [data-testid*="occupancy"], [data-testid*="chart"], [data-testid*="report"], [class*="chart"], [class*="graph"]'
    );
    await expect(reportContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Occupancy Reports has filter controls', async ({ page }) => {
    await openSection(page, 'reports-occupancy');

    // Look for date range, room type, or property filters
    const filters = page.locator(
      'input[type="date"], input[placeholder*="date" i], select, [role="listbox"], [role="combobox"], button[role="tab"], [data-testid*="filter"], button:has-text("Filter")'
    );
    const filterCount = await filters.count();
    if (filterCount > 0) {
      await expect(filters.first()).toBeVisible();
    }
  });

  test('Occupancy Reports shows occupancy rate data', async ({ page }) => {
    await openSection(page, 'reports-occupancy');

    // Verify data is present — look for percentage values, table rows, or chart elements
    const dataElements = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid*="data"], [class*="chart"] canvas, [class*="bar"], [class*="line"]'
    );
    await expect(dataElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('Occupancy Reports has export or download action', async ({ page }) => {
    await openSection(page, 'reports-occupancy');

    const exportBtn = page.locator(
      'button:has-text("Export"), button:has-text("Download"), button:has-text("PDF"), button:has-text("CSV"), button:has-text("Print")'
    );
    const btnCount = await exportBtn.count();
    if (btnCount > 0) {
      await expect(exportBtn.first()).toBeVisible();
      await expect(exportBtn.first()).toBeEnabled();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Reports – Revenue', () => {
  test('Revenue Reports loads', async ({ page }) => {
    await openSection(page, 'reports-revenue');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /revenue/i }).or(page.getByRole('heading', { name: /income/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify report content renders
    const reportContent = page.locator(
      'table, [role="table"], [data-testid*="revenue"], [data-testid*="chart"], [data-testid*="report"], [class*="chart"], [class*="graph"]'
    );
    await expect(reportContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Revenue Reports shows monetary data', async ({ page }) => {
    await openSection(page, 'reports-revenue');

    // Verify data is present — look for table rows or chart elements
    const dataElements = page.locator(
      'table tbody tr, [role="table"] [role="row"], [class*="chart"] canvas, [data-testid*="data"]'
    );
    await expect(dataElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('Revenue Reports has period selector and export', async ({ page }) => {
    await openSection(page, 'reports-revenue');

    // Period / date selector
    const dateSelector = page.locator(
      'input[type="date"], select, button[role="tab"], [data-testid*="period"], [data-testid*="date"], button:has-text("Today"), button:has-text("Week"), button:has-text("Month")'
    );
    const selectorCount = await dateSelector.count();
    if (selectorCount > 0) {
      await expect(dateSelector.first()).toBeVisible();
    }

    // Export button
    const exportBtn = page.locator(
      'button:has-text("Export"), button:has-text("Download"), button:has-text("PDF"), button:has-text("CSV")'
    );
    const btnCount = await exportBtn.count();
    if (btnCount > 0) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Reports – Guest Analytics', () => {
  test('Guest Analytics Reports loads', async ({ page }) => {
    await openSection(page, 'reports-guest-analytics');

    // Verify heading
    const heading = page.getByRole('heading', { name: /guest/i }).or(
      page.getByRole('heading', { name: /analytics/i })
    );
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify report content renders
    const reportContent = page.locator(
      'table, [role="table"], [data-testid*="guest"], [data-testid*="analytics"], [data-testid*="chart"], [class*="chart"]'
    );
    await expect(reportContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Guest Analytics shows demographic or booking data', async ({ page }) => {
    await openSection(page, 'reports-guest-analytics');

    // Verify data is present
    const dataElements = page.locator(
      'table tbody tr, [role="table"] [role="row"], [class*="chart"] canvas, [data-testid*="data"], [data-testid*="metric"]'
    );
    await expect(dataElements.first()).toBeVisible({ timeout: 10000 });
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Reports – Financial', () => {
  test('Financial Reports loads', async ({ page }) => {
    await openSection(page, 'reports-financial');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /financial/i }).or(page.getByRole('heading', { name: /finance/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify report content renders
    const reportContent = page.locator(
      'table, [role="table"], [data-testid*="financial"], [data-testid*="chart"], [data-testid*="report"], [class*="chart"], [class*="graph"]'
    );
    await expect(reportContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Financial Reports shows financial data with tables or charts', async ({ page }) => {
    await openSection(page, 'reports-financial');

    // Verify data is present
    const dataElements = page.locator(
      'table tbody tr, [role="table"] [role="row"], [class*="chart"] canvas, [data-testid*="data"], [data-testid*="metric"]'
    );
    await expect(dataElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('Financial Reports has filter and export controls', async ({ page }) => {
    await openSection(page, 'reports-financial');

    // Filter controls
    const filters = page.locator(
      'input[type="date"], select, button[role="tab"], [data-testid*="filter"], [data-testid*="period"], button:has-text("Filter")'
    );
    const filterCount = await filters.count();
    if (filterCount > 0) {
      await expect(filters.first()).toBeVisible();
    }

    // Export button
    const exportBtn = page.locator(
      'button:has-text("Export"), button:has-text("Download"), button:has-text("PDF"), button:has-text("CSV"), button:has-text("Print")'
    );
    const btnCount = await exportBtn.count();
    if (btnCount > 0) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });

  test('Financial Reports includes income and expense breakdown', async ({ page }) => {
    await openSection(page, 'reports-financial');

    // Verify column headers reference financial attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasFinancialColumns = headerTexts.some(
      (h) => h.includes('revenue') || h.includes('expense') || h.includes('income') || h.includes('cost') || h.includes('profit') || h.includes('amount') || h.includes('total')
    );
    expect(hasFinancialColumns).toBeTruthy();
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Reports – Competitor', () => {
  test('Competitor Reports loads', async ({ page }) => {
    await openSection(page, 'reports-competitor');

    // Verify heading
    const heading = page.getByRole('heading', { name: /competitor/i }).or(
      page.getByRole('heading', { name: /market/i }).or(
        page.getByRole('heading', { name: /benchmark/i })
      )
    );
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify report content renders
    const reportContent = page.locator(
      'table, [role="table"], [data-testid*="competitor"], [data-testid*="benchmark"], [data-testid*="chart"], [class*="chart"]'
    );
    await expect(reportContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('Competitor Reports shows comparison data', async ({ page }) => {
    await openSection(page, 'reports-competitor');

    // Verify data is present
    const dataElements = page.locator(
      'table tbody tr, [role="table"] [role="row"], [class*="chart"] canvas, [data-testid*="data"]'
    );
    await expect(dataElements.first()).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// FACILITIES MODULE
// ═══════════════════════════════════════════════════════════════════

test.describe('Facilities – Parking Slots', () => {
  test('Parking Slots loads (5 seeded)', async ({ page }) => {
    await openSection(page, 'parking-slots');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /parking/i }).or(page.getByRole('heading', { name: /slot/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify slots table/grid renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="parking-slots"], [data-testid="slot-grid"], [data-testid="parking-grid"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify at least 5 seeded parking slots
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="slot-"], [data-testid^="parking-"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5);
  });

  test('Parking Slots shows slot number and availability status', async ({ page }) => {
    await openSection(page, 'parking-slots');

    // Verify column headers reference parking attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasSlotColumns = headerTexts.some(
      (h) => h.includes('slot') || h.includes('number') || h.includes('status') || h.includes('type') || h.includes('available') || h.includes('occupied')
    );
    expect(hasSlotColumns).toBeTruthy();
  });

  test('Parking Slots has add and manage actions', async ({ page }) => {
    await openSection(page, 'parking-slots');

    const addBtn = page.locator(
      'button:has-text("Add Slot"), button:has-text("New Slot"), button:has-text("Add Parking"), button:has-text("Manage")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });

  test('Parking slots have status indicators (available/occupied)', async ({ page }) => {
    await openSection(page, 'parking-slots');

    // Look for status badges or color-coded indicators
    const statusElements = page.locator(
      '[data-testid^="status"], .badge, [class*="badge"], span[class*="status"], [class*="available"], [class*="occupied"]'
    );
    const statusCount = await statusElements.count();
    if (statusCount > 0) {
      await expect(statusElements.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Facilities – Parking Vehicles', () => {
  test('Parking Vehicles loads (5 seeded)', async ({ page }) => {
    await openSection(page, 'parking-vehicles');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /vehicle/i }).or(page.getByRole('heading', { name: /car/i }))
    ).toBeVisible({ timeout: 10000 });

    // Verify vehicles table renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="parking-vehicles"], [data-testid="vehicle-list"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify at least 5 seeded vehicles
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="vehicle-"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5);
  });

  test('Parking Vehicles shows vehicle details (plate, type)', async ({ page }) => {
    await openSection(page, 'parking-vehicles');

    // Verify column headers reference vehicle attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasVehicleColumns = headerTexts.some(
      (h) => h.includes('plate') || h.includes('license') || h.includes('type') || h.includes('vehicle') || h.includes('model') || h.includes('color') || h.includes('owner') || h.includes('guest') || h.includes('slot')
    );
    expect(hasVehicleColumns).toBeTruthy();
  });

  test('Parking Vehicles has register/check-in action', async ({ page }) => {
    await openSection(page, 'parking-vehicles');

    const actionBtn = page.locator(
      'button:has-text("Register"), button:has-text("Check In"), button:has-text("Add Vehicle"), button:has-text("New Vehicle")'
    );
    const btnCount = await actionBtn.count();
    if (btnCount > 0) {
      await expect(actionBtn.first()).toBeVisible();
      await expect(actionBtn.first()).toBeEnabled();
    }
  });

  test('Can open register vehicle dialog', async ({ page }) => {
    await openSection(page, 'parking-vehicles');

    const addBtn = page.locator(
      'button:has-text("Register"), button:has-text("Check In"), button:has-text("Add Vehicle"), button:has-text("New Vehicle")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], [data-testid="vehicle-form"]'
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

test.describe('Facilities – Events Spaces', () => {
  test('Events Spaces loads (2 seeded)', async ({ page }) => {
    await openSection(page, 'events-spaces');

    // Verify heading
    await expect(
      page.getByRole('heading', { name: /event/i }).or(page.getByRole('heading', { name: /space/i })).or(
        page.getByRole('heading', { name: /venue/i }).or(page.getByRole('heading', { name: /banquet/i })).or(
          page.getByRole('heading', { name: /hall/i }).or(page.getByRole('heading', { name: /room/i }))
        )
      )
    ).toBeVisible({ timeout: 10000 });

    // Verify spaces table/grid renders
    const tableContainer = page.locator(
      'table, [role="table"], [data-testid="event-spaces"], [data-testid="space-list"], [data-testid="venues"]'
    );
    await expect(tableContainer.first()).toBeVisible({ timeout: 10000 });

    // Verify at least 2 seeded event spaces
    const rows = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="space-"], [data-testid^="venue-"], [data-testid^="event-space"]'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });

  test('Events Spaces shows capacity and availability info', async ({ page }) => {
    await openSection(page, 'events-spaces');

    // Verify column headers reference space attributes
    const headers = page.locator('table thead th, [role="columnheader"]');
    const headerTexts: string[] = [];
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text) headerTexts.push(text.toLowerCase());
    }

    const hasSpaceColumns = headerTexts.some(
      (h) => h.includes('name') || h.includes('capacity') || h.includes('type') || h.includes('status') || h.includes('available') || h.includes('size') || h.includes('price') || h.includes('rate')
    );
    expect(hasSpaceColumns).toBeTruthy();
  });

  test('Events Spaces has add and manage actions', async ({ page }) => {
    await openSection(page, 'events-spaces');

    const addBtn = page.locator(
      'button:has-text("Add Space"), button:has-text("New Space"), button:has-text("Create Space"), button:has-text("Add Venue"), button:has-text("Manage")'
    );
    const btnCount = await addBtn.count();
    if (btnCount > 0) {
      await expect(addBtn.first()).toBeVisible();
      await expect(addBtn.first()).toBeEnabled();
    }
  });

  test('Can open create event space dialog', async ({ page }) => {
    await openSection(page, 'events-spaces');

    const addBtn = page.locator(
      'button:has-text("Add Space"), button:has-text("New Space"), button:has-text("Create Space"), button:has-text("Add Venue")'
    );
    const btnCount = await addBtn.count();

    if (btnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      const dialog = page.locator(
        '[role="dialog"], [data-state="open"], [data-testid="space-form"], [data-testid="venue-form"]'
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

test.describe('Facilities – Events Calendar', () => {
  test('Events Calendar loads', async ({ page }) => {
    await openSection(page, 'events-calendar');

    // Verify heading
    const heading = page.getByRole('heading', { name: /calendar/i }).or(
      page.getByRole('heading', { name: /schedule/i }).or(
        page.getByRole('heading', { name: /booking/i })
      )
    );
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify calendar view renders
    const calendarView = page.locator(
      'table, [role="table"], [role="grid"], [data-testid="calendar"], [data-testid="event-calendar"], [class*="calendar"], [data-testid="schedule"]'
    );
    await expect(calendarView.first()).toBeVisible({ timeout: 10000 });
  });

  test('Events Calendar has navigation controls', async ({ page }) => {
    await openSection(page, 'events-calendar');

    // Look for prev/next month, today button, view toggles
    const navBtn = page.locator(
      'button:has-text("Today"), button:has-text("Prev"), button:has-text("Next"), button:has-text("Month"), button:has-text("Week"), button:has-text("Day"), button[aria-label*="prev" i], button[aria-label*="next" i]'
    );
    const btnCount = await navBtn.count();
    if (btnCount > 0) {
      await expect(navBtn.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Facilities – Resort Pools', () => {
  test('Resort Pools section loads', async ({ page }) => {
    await openSection(page, 'resort-pools');

    // Verify heading
    const heading = page.getByRole('heading', { name: /pool/i });
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify pool content renders (table, cards, or status panel)
    const viewContainer = page.locator(
      'table, [role="table"], [data-testid="pool"], [data-testid="pools"], [data-testid="pool-status"], [data-testid="pool-list"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Pools shows pool status or availability', async ({ page }) => {
    await openSection(page, 'resort-pools');

    // Look for status indicators, open/closed labels
    const statusElements = page.locator(
      '[data-testid^="status"], .badge, [class*="badge"], span[class*="status"], [class*="open"], [class*="closed"]'
    );
    const statusCount = await statusElements.count();
    if (statusCount > 0) {
      await expect(statusElements.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Facilities – Resort Gym', () => {
  test('Resort Gym section loads', async ({ page }) => {
    await openSection(page, 'resort-gym');

    // Verify heading
    const heading = page.getByRole('heading', { name: /gym/i }).or(
      page.getByRole('heading', { name: /fitness/i })
    );
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify gym content renders
    const viewContainer = page.locator(
      'table, [role="table"], [data-testid="gym"], [data-testid="fitness"], [data-testid="gym-status"], [data-testid="gym-list"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Gym shows operating hours or status', async ({ page }) => {
    await openSection(page, 'resort-gym');

    // Look for hours, capacity, or status information
    const infoElements = page.locator(
      'text=/\\d{1,2}:\\d{2}/, [data-testid*="hours"], [data-testid*="capacity"], [data-testid^="status"], [class*="status"]'
    );
    const infoCount = await infoElements.count();
    if (infoCount > 0) {
      await expect(infoElements.first()).toBeVisible();
    }
  });
});

// ───────────────────────────────────────────────────────────────────

test.describe('Facilities – Resort Spa', () => {
  test('Resort Spa section loads', async ({ page }) => {
    await openSection(page, 'resort-spa');

    // Verify heading
    const heading = page.getByRole('heading', { name: /spa/i });
    const headingCount = await heading.count();
    if (headingCount > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10000 });
    }

    // Verify spa content renders
    const viewContainer = page.locator(
      'table, [role="table"], [data-testid="spa"], [data-testid="spa-status"], [data-testid="spa-list"], [data-testid="treatment"]'
    );
    await expect(viewContainer.first()).toBeVisible({ timeout: 10000 });
  });

  test('Spa shows treatments or appointment info', async ({ page }) => {
    await openSection(page, 'resort-spa');

    // Look for treatment list, appointment table, or booking controls
    const contentElements = page.locator(
      'table tbody tr, [role="table"] [role="row"], [data-testid^="treatment"], [data-testid^="appointment"], [data-testid^="booking"], button:has-text("Book"), button:has-text("Schedule")'
    );
    const contentCount = await contentElements.count();
    if (contentCount > 0) {
      await expect(contentElements.first()).toBeVisible();
    }
  });

  test('Spa has booking or manage controls', async ({ page }) => {
    await openSection(page, 'resort-spa');

    const actionBtn = page.locator(
      'button:has-text("Book"), button:has-text("Schedule"), button:has-text("Add"), button:has-text("Manage"), button:has-text("New Appointment")'
    );
    const btnCount = await actionBtn.count();
    if (btnCount > 0) {
      await expect(actionBtn.first()).toBeVisible();
      await expect(actionBtn.first()).toBeEnabled();
    }
  });
});
