/**
 * Reports & Analytics Hub (/m/reports) — Comprehensive E2E Test Suite
 *
 * Every selector was verified against the actual component source
 * (ClinicalReportsHub.tsx + its 10 analytics/* tab components + the
 * central serverFn getCentralAnalyticsFn in serverFns/analytics.ts)
 * before being used here.
 *
 * This module's central claim — that it shows real, computed clinic
 * analytics — turned out to be only partly true. A full source-code read
 * of the serverFn and every tab component found ~15 places where a
 * "metric" is actually a hardcoded constant, a Math.random() call, an
 * invented formula, or a client-side label lookup that silently returns 0
 * for real data whose naming doesn't match a hardcoded string. Several
 * tests below exist specifically to PROVE those findings live in the
 * running app, not just in the source — see REPORTS_MODULE_TEST_REPORT.md
 * for the full catalogue with severity and fix recommendations.
 *
 * Structure:
 *   A. Hub mode switching & page load
 *   B. Analytics Filter Bar
 *   C. Overview tab — rendering + real-value invariants
 *   D. Pets tab
 *   E. Clients tab — proves "Active Clients" is meaningless + "Avg Spend" is fake
 *   F. Appointments tab — proves Avg. Wait is random
 *   G. Billing & Revenue tab — real-value invariant (revenue = collected + outstanding)
 *   H. Payment Analysis tab
 *   I. Laboratory tab — proves flat ₹1,200/test fake revenue
 *   J. Inventory tab — proves "Expiry At Risk" is stuck on a dead label match
 *   K. Clinical Records tab
 *   L. Cross-Module Audit tab — search filter + fallback-fakery evidence
 *   M. Insights Banner — proves one insight is static text
 *   N. Export CSV & Drilldown modal
 *   O. Real-value delta proof — create a pet via CRM, confirm Total Patients +1
 *   P. Medical Records mode (Reports archive, upload, dossier, quotations)
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable, gotoReady, reloadReady } from './support/dom-helpers';

const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);

async function openReports(page: Page) {
  await loginAsAdmin(page);
  await gotoReady(page, '/m/reports');
  // Wait past the "Aggregating live ERP records from MongoDB..." loading state.
  await expect(page.getByText('Aggregating live ERP records')).toHaveCount(0, { timeout: 20_000 });
}

async function goToTab(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(300);
}

/** Parses "₹45,231" / "₹45.2k" / "45,231" style strings back to a number. */
function parseMoney(text: string): number {
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (cleaned.endsWith('k')) return Math.round(parseFloat(cleaned) * 1000);
  return parseInt(cleaned, 10);
}

/** Reads a KpiCard's value by its exact uppercase label (KpiCard has no test-id). */
async function kpiValue(page: Page, label: string): Promise<string> {
  const card = page.locator('p.section-label', { hasText: label }).locator('xpath=..');
  return (await card.locator('p').nth(1).innerText()).trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// A. Hub Mode Switching & Page Load
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Page Load & Mode Switching', () => {

  test('loads in Analytics Dashboard mode by default with the Overview tab active', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await expect(page.getByText('Executive Analytics & Performance Intelligence')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics Dashboard' })).toHaveClass(/bg-primary/);
    await expect(page.getByText('Executive Performance Summary')).toBeVisible();
  });

  test('switches to Medical Reports & Records mode and back', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('button', { name: /Medical Reports & Records/ }).click();
    await expect(page.getByText('Clinical Reports & Diagnostic Archive')).toBeVisible();
    await expect(page.getByText('All Reports Master Archive')).toBeVisible();

    await page.getByRole('button', { name: 'Analytics Dashboard' }).click();
    await expect(page.getByText('Executive Analytics & Performance Intelligence')).toBeVisible();
  });

  test('all 10 analytics sub-tabs are present and switch without crashing', async ({ page }) => {
    test.setTimeout(90_000);
    await openReports(page);
    const tabs = [
      'Overview', 'Pets', 'Clients', 'Appointments', 'Billing & Revenue',
      'Payment Analysis', 'Laboratory', 'Inventory & Stock', 'Clinical Records', 'Cross-Module Audit',
    ];
    for (const tab of tabs) {
      await goToTab(page, tab);
      // No React error boundary / blank page — some content specific to that tab renders.
      await expect(page.locator('.erp-card, table').first()).toBeVisible({ timeout: 10_000 });
    }
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// B. Analytics Filter Bar
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Filter Bar', () => {

  test('all 9 date-range options are present', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('combobox').first().click();
    for (const label of ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Last Month', 'This Year', 'Custom Date Range', 'All Time']) {
      await expect(page.getByRole('option', { name: label, exact: true })).toBeVisible();
    }
    await page.keyboard.press('Escape');
  });

  test('doctor filter only appears on Appointments/Clinical tabs, not Overview', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await expect(page.getByText('All Clinicians')).toHaveCount(0);
    await goToTab(page, 'Appointments');
    await expect(page.getByText('All Clinicians')).toBeVisible({ timeout: 10_000 });
  });

  test('changing date range to "Today" updates the date-range badge and reloads data without error', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Today', exact: true }).click();
    await expect(page.getByText('Today', { exact: true }).last()).toBeVisible({ timeout: 15_000 });
  });

  test('Reset button restores "All Time"', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Today', exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByText('All Time').last()).toBeVisible({ timeout: 15_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// C. Overview Tab — Rendering + Real-Value Invariants
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Overview Tab', () => {

  test('all 6 KPI cards render with numeric (not NaN/undefined) values', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    for (const label of ['TOTAL PATIENTS', 'TOTAL CLIENTS', 'APPOINTMENTS', 'TOTAL BILLED', 'LAB ORDERS', 'INVENTORY VALUE']) {
      const value = await kpiValue(page, label);
      expect(value).not.toContain('NaN');
      expect(value).not.toContain('undefined');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test('"TOTAL BILLED" trend (collected) never exceeds the headline billed amount', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    const card = page.locator('p.section-label', { hasText: 'TOTAL BILLED' }).locator('xpath=..');
    const billed = parseMoney(await card.locator('p').nth(1).innerText());
    const trendText = await card.locator('p').nth(2).innerText(); // "₹X.Xk collected"
    const collected = parseMoney(trendText);
    expect(collected).toBeLessThanOrEqual(billed);
  });

  test('conversion funnel renders all 4 stages', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    for (const stage of ['Bookings Issued', 'Consultations Done', 'Invoices Generated', 'Fully Settled']) {
      await expect(page.getByText(stage)).toBeVisible({ timeout: 10_000 });
    }
  });

  test('Revenue Distribution and Species Demographics charts render', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await expect(page.getByText('REVENUE DISTRIBUTION BY SERVICE LINE')).toBeVisible();
    await expect(page.getByText('PATIENT SPECIES DEMOGRAPHICS')).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// D. Pets Tab
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Pets Tab', () => {

  test('Registered/Active Patients match the Overview tab exactly (cross-tab consistency)', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    const overviewTotal = await kpiValue(page, 'TOTAL PATIENTS');

    await goToTab(page, 'Pets');
    const petsTotal = await kpiValue(page, 'REGISTERED PATIENTS');
    expect(petsTotal).toBe(overviewTotal);
  });

  test('Canine Share + Feline Share are non-negative and charts render', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Pets');
    const canine = Number((await kpiValue(page, 'CANINE SHARE')).replace(/\D/g, '')) || 0;
    const feline = Number((await kpiValue(page, 'FELINE SHARE')).replace(/\D/g, '')) || 0;
    expect(canine).toBeGreaterThanOrEqual(0);
    expect(feline).toBeGreaterThanOrEqual(0);
    await expect(page.getByText('TOP BREEDS REGISTERED')).toBeVisible();
    await expect(page.getByText('PATIENT AGE DEMOGRAPHICS')).toBeVisible();
    await expect(page.getByText('VISIT FREQUENCY COHORTS')).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// E. Clients Tab — proves "Active Clients" is meaningless and "Avg Spend" is fake
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Clients Tab (fakery proofs)', () => {

  test('"Active Clients" always equals "Registered Clients" — the field cannot distinguish an inactive client', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Clients');
    const registered = await kpiValue(page, 'REGISTERED CLIENTS');
    const active = await kpiValue(page, 'ACTIVE CLIENTS');
    // Confirmed bug: activeClients = owners.filter(o => (o.outstandingBalance ?? 0) >= 0).length,
    // which is true for virtually every owner record, so this KPI is not a real "active" signal.
    expect(active).toBe(registered);
  });

  test('"Avg. Spend / Client" = 2 × Average Ticket Size (Billing tab) — an invented formula, not a real LTV metric', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);

    await goToTab(page, 'Billing & Revenue');
    const avgTicket = parseMoney(await kpiValue(page, 'AVERAGE TICKET SIZE'));

    await goToTab(page, 'Clients');
    const avgSpend = parseMoney(await kpiValue(page, 'AVG. SPEND / CLIENT'));

    expect(avgSpend).toBe(avgTicket * 2);
  });

  test('Top Clients table is sorted by Total Spend, descending', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Clients');
    await expect(page.getByText('TOP CLIENTS BY VISIT DENSITY & REVENUE')).toBeVisible({ timeout: 10_000 });
    const spendCells = page.locator('table').last().locator('tbody tr td:nth-child(6)');
    const count = await spendCells.count();
    if (count >= 2) {
      const values = await spendCells.allInnerTexts();
      const nums = values.map(parseMoney);
      for (let i = 1; i < nums.length; i++) {
        expect(nums[i]).toBeLessThanOrEqual(nums[i - 1]!);
      }
    }
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// F. Appointments Tab — proves Avg. Wait is Math.random(), not real data
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Appointments Tab (fakery proof)', () => {

  test('Clinician "Avg. Wait" changes across reloads with no underlying data change — proves it is random, not measured', async ({ page }) => {
    test.setTimeout(90_000);
    await openReports(page);
    await goToTab(page, 'Appointments');
    await expect(page.getByText('CLINICIAN ENCOUNTER PERFORMANCE')).toBeVisible({ timeout: 10_000 });

    const waitCells = page.locator('table', { hasText: 'ATTENDING DOCTOR' }).locator('tbody tr td:last-child');
    const rowCount = await waitCells.count();
    test.skip(rowCount === 0, 'No doctor-performance rows in this dataset to sample.');

    const before = await waitCells.allInnerTexts();

    await reloadReady(page);
    await goToTab(page, 'Appointments');
    await expect(page.getByText('CLINICIAN ENCOUNTER PERFORMANCE')).toBeVisible({ timeout: 10_000 });
    const after = await waitCells.allInnerTexts();

    // Same underlying appointment data both times (nothing was created between reloads),
    // so if any Avg. Wait value differs, it's proof the backend regenerates it randomly
    // (Math.floor(10 + Math.random() * 8)) rather than computing it from real timestamps.
    const changed = before.some((v, i) => v !== after[i]);
    expect(changed).toBe(true);
  });

  test('Doctor filter options are hardcoded and may not match any real doctor in the data', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Appointments');
    await expect(page.getByText('CLINICIAN ENCOUNTER PERFORMANCE')).toBeVisible({ timeout: 10_000 });

    const realDoctors = await page.locator('table', { hasText: 'ATTENDING DOCTOR' }).locator('tbody tr td:first-child').allInnerTexts();

    const doctorSelect = page.locator('button[role="combobox"]', { hasText: 'All Clinicians' });
    await doctorSelect.click();
    const hardcodedOptions = (await page.getByRole('option').allInnerTexts()).filter((o) => o !== 'All Clinicians');
    await page.keyboard.press('Escape');

    // This just records the finding — it's expected that the hardcoded list (3 fixed
    // names in AnalyticsFilterBar.tsx) frequently diverges from whatever doctor names
    // actually appear in the appointment records typed by front-desk staff.
    const overlap = hardcodedOptions.filter((d) => realDoctors.includes(d));
    console.log(`[finding] Doctor filter has ${hardcodedOptions.length} hardcoded options; ${overlap.length} match a real doctor name in the current data (${realDoctors.join(', ') || 'none'}).`);
    expect(hardcodedOptions.length).toBeGreaterThan(0);
  });

  test('status/type charts and appointment trend render', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Appointments');
    await expect(page.getByText('APPOINTMENT DEMAND TREND')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('CLINICAL VISIT TYPE DISTRIBUTION')).toBeVisible();
    await expect(page.getByText('BOOKING CHANNEL INFLOW')).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// G. Billing & Revenue Tab — real-value invariant
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Billing & Revenue Tab', () => {

  test('Total Invoiced = Total Collected + Outstanding Receivables (accounting identity holds)', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Billing & Revenue');

    const invoiced = parseMoney(await kpiValue(page, 'TOTAL INVOICED'));
    const collected = parseMoney(await kpiValue(page, 'TOTAL COLLECTED'));
    const outstanding = parseMoney(await kpiValue(page, 'OUTSTANDING RECEIVABLES'));

    // These three ARE independently computed real sums (totalRevenue, totalCollected,
    // totalOutstanding over the same period) — this is a genuine correctness check,
    // not a fakery proof, and should hold to within a few rupees of rounding.
    expect(Math.abs(invoiced - (collected + outstanding))).toBeLessThanOrEqual(Math.max(5, invoiced * 0.01));
  });

  test('"TOTAL INVOICED" (Billing tab) matches "TOTAL BILLED" (Overview tab) within k-rounding', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    const overviewBilled = parseMoney(await kpiValue(page, 'TOTAL BILLED')); // "₹X.Xk" — rounded to nearest 100

    await goToTab(page, 'Billing & Revenue');
    const billingInvoiced = parseMoney(await kpiValue(page, 'TOTAL INVOICED')); // full precision, comma-formatted

    expect(Math.abs(overviewBilled - billingInvoiced)).toBeLessThanOrEqual(100);
  });

  test('Fully Paid / Partially Paid / Unpaid invoice status cards render', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Billing & Revenue');
    await expect(page.getByText('Fully Paid Invoices')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Partially Paid Invoices')).toBeVisible();
    await expect(page.getByText('Unpaid / Pending Invoices')).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// H. Payment Analysis Tab
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Payment Analysis Tab', () => {

  test('"Overall Collection Efficiency" = round(Total Collected / Total Invoiced × 100)', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Billing & Revenue');
    const invoiced = parseMoney(await kpiValue(page, 'TOTAL INVOICED'));
    const collected = parseMoney(await kpiValue(page, 'TOTAL COLLECTED'));
    const expectedPct = invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0;

    await goToTab(page, 'Payment Analysis');
    await expect(page.getByText('Overall Collection Efficiency:')).toBeVisible({ timeout: 10_000 });
    const line = await page.getByText('Overall Collection Efficiency:').locator('xpath=..').innerText();
    if (invoiced > 0) {
      expect(line).toContain(`${expectedPct}%`);
    } else {
      expect(line).toContain('N/A');
    }
  });

  test('Payment Method Adoption and Outstanding Aging sections render', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Payment Analysis');
    await expect(page.getByText('PAYMENT METHOD ADOPTION')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('OUTSTANDING AGING BUCKETS')).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// I. Laboratory Tab — proves the flat ₹1,200/test fake revenue
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Laboratory Tab (fakery proof)', () => {

  test('every lab test\'s "revenue" is exactly count × ₹1,200 — a flat hardcoded rate, not a real price', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Laboratory');
    await expect(page.getByText('TOP DIAGNOSTIC PANELS & PROFILES')).toBeVisible({ timeout: 10_000 });

    const rows = page.locator('table', { hasText: 'Test / Panel Name' }).locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No lab test rows in this dataset to sample.');

    for (let i = 0; i < rowCount; i++) {
      const cells = rows.nth(i).locator('td');
      const count = parseInt((await cells.nth(1).innerText()).replace(/\D/g, ''), 10);
      const revenue = parseMoney(await cells.nth(3).innerText());
      expect(revenue).toBe(count * 1200);
    }
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// J. Inventory Tab — proves "Expiry At Risk" is stuck on a dead label match
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Inventory Tab (fakery proof)', () => {

  test('"Expiry At Risk" only ever reflects the hardcoded "Expired" bucket (count 2) — the component checks for a "Within 30 Days" label the backend never sends', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Inventory & Stock');
    const value = await kpiValue(page, 'EXPIRY AT RISK');
    // Backend's expiryRiskBuckets are entirely hardcoded (never computed from real batch
    // expiry dates) AND the component looks for a bucket literally labeled "Within 30
    // Days", which the backend never sends (it sends "≤ 30 Days") — so this KPI can only
    // ever show the "Expired" bucket's fixed count of 2, regardless of real inventory state.
    expect(value).toBe('2');
  });

  test('Stock Valuation, Expiry Risk chart, and Low-Stock table render', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Inventory & Stock');
    await expect(page.getByText('STOCK VALUATION BY CATEGORY')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('EXPIRY RISK DISTRIBUTION')).toBeVisible();
    await expect(page.getByText('LOW-STOCK ALERT SKUS')).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// K. Clinical Records Tab
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Clinical Records Tab', () => {

  test('"Avg Reports / Patient" = Total Reports ÷ Patients With Reports, to 1 decimal', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Clinical Records');
    const total = parseInt((await kpiValue(page, 'TOTAL CLINICAL REPORTS')).replace(/\D/g, ''), 10);
    const patients = parseInt((await kpiValue(page, 'PATIENTS WITH REPORTS')).replace(/\D/g, ''), 10);
    const avg = await kpiValue(page, 'AVG REPORTS / PATIENT');

    const expected = patients > 0 ? (total / patients).toFixed(1) : '0';
    expect(avg).toBe(expected);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// L. Cross-Module Audit Tab — search filter + fallback-fakery evidence
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Cross-Module Audit Tab', () => {

  test('search box filters the patient-billing-chain table client-side', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Cross-Module Audit');
    await expect(page.getByText('CROSS-MODULE AUDIT CHAIN')).toBeVisible({ timeout: 10_000 });

    const rows = page.locator('table').last().locator('tbody tr');
    const totalRows = await rows.count();
    test.skip(totalRows === 0, 'No patient-billing chains to search.');

    const firstPetName = (await rows.first().locator('td').first().innerText()).trim();
    await fillStable(page.getByPlaceholder('Search pet or owner...'), firstPetName);
    await page.waitForTimeout(400);

    const filteredCount = await rows.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(totalRows);
    await expect(rows.first()).toContainText(firstPetName);
  });

  test('a nonsense search shows the empty-state message', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Cross-Module Audit');
    await fillStable(page.getByPlaceholder('Search pet or owner...'), 'ZZZ_NONEXISTENT_XYZ_999');
    await expect(page.getByText('No patient clinical-financial chains match')).toBeVisible({ timeout: 10_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// M. Insights Banner — proves one insight is static, unconditional text
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Insights Banner (fakery proof)', () => {

  test('"Client Retention Cohort" insight shows the identical fixed text regardless of the selected date range', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    const staticText = 'Returning clients represent ~65% of all active appointments';

    await expect(page.getByText(staticText)).toBeVisible({ timeout: 10_000 });

    // Switch to "Today" — a period almost certainly containing zero or very different
    // appointment activity — and confirm the insight text is byte-identical anyway.
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Today', exact: true }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(staticText)).toBeVisible({ timeout: 10_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// N. Export CSV & Drilldown Modal
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Export & Drilldown', () => {

  test('"Export CSV" triggers a real file download named for the active tab', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^analytics_overview_.*\.csv$/);
  });

  test('clicking a KPI card on Overview opens the drilldown modal', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await page.locator('p.section-label', { hasText: 'TOTAL PATIENTS' }).locator('xpath=..').click();
    await expect(page.locator('div[role="dialog"][data-state="open"]')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking "View Profile" on a Top Client row opens a Client Dossier drilldown', async ({ page }) => {
    test.setTimeout(60_000);
    await openReports(page);
    await goToTab(page, 'Clients');
    const viewBtn = page.getByRole('button', { name: 'View Profile' }).first();
    if (await viewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await viewBtn.click();
      const modal = page.locator('div[role="dialog"][data-state="open"]');
      await expect(modal).toBeVisible({ timeout: 10_000 });
      await expect(modal.getByText(/Client Dossier:/)).toBeVisible();
    }
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// O. Real-Value Delta Proof — the one metric this suite verifies end-to-end
//    against a UI-created fixture, not just internal consistency.
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Reports Hub — Real-Value Delta Proof', () => {

  test('registering a new pet via CRM increases "TOTAL PATIENTS" by exactly 1', async ({ page }) => {
    test.setTimeout(90_000);
    await openReports(page);
    const before = parseInt((await kpiValue(page, 'TOTAL PATIENTS')).replace(/\D/g, ''), 10);

    // Register a real new owner + pet via the CRM module (already-proven flow from
    // e2e/crm-registration.spec.ts) so we have a known, deterministic +1 to check for.
    await gotoReady(page, '/m/crm-pets');
    const registerBtn = page.getByRole('button', { name: /register client|new patient/i }).first();
    await registerBtn.click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await fillStable(modal.getByPlaceholder(/atul bhise/i), `ReportsProof-${suffix}`);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), `9${suffix}1`.slice(0, 10));
    await modal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `ReportsPet-${suffix}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Mixed Breed');
    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(page.getByText(/registered successfully|complete/i).first()).toBeVisible({ timeout: 15_000 });

    await gotoReady(page, '/m/reports');
    await expect(page.getByText('Aggregating live ERP records')).toHaveCount(0, { timeout: 20_000 });
    const after = parseInt((await kpiValue(page, 'TOTAL PATIENTS')).replace(/\D/g, ''), 10);

    expect(after).toBe(before + 1);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// P. Medical Records Mode
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Reports Hub — Medical Records Mode', () => {

  async function openMedicalRecords(page: Page) {
    await openReports(page);
    await page.getByRole('button', { name: /Medical Reports & Records/ }).click();
    await expect(page.getByText('Clinical Reports & Diagnostic Archive')).toBeVisible({ timeout: 10_000 });
  }

  test('4 KPI cards and 3 sub-tabs render', async ({ page }) => {
    test.setTimeout(60_000);
    await openMedicalRecords(page);
    for (const label of ['TOTAL CLINICAL REPORTS', 'VERIFIED & SIGNED', 'PENDING DOCTOR REVIEW', 'EXTERNAL UPLOADS']) {
      await expect(page.locator('p.section-label', { hasText: label })).toBeVisible({ timeout: 10_000 });
    }
    await expect(page.getByText('All Reports Master Archive')).toBeVisible();
    await expect(page.getByText('Patient-Specific Medical Dossier')).toBeVisible();
    await expect(page.getByText('Document Ingestion & Uploads')).toBeVisible();
    await expect(page.getByText('Medical Quotations & Estimates')).toBeVisible();
  });

  test('search filters the reports register down to zero on a nonsense query', async ({ page }) => {
    test.setTimeout(60_000);
    await openMedicalRecords(page);
    await fillStable(page.getByPlaceholder(/search across all reports/i), 'ZZZ_NONEXISTENT_REPORT_999');
    await page.waitForTimeout(500);
    await expect(page.locator('tbody tr').first()).not.toBeVisible().catch(() => {});
    await expect(page.getByText(/0 of \d+ reports/)).toBeVisible({ timeout: 10_000 });
  });

  test('switching to Patient-Specific Medical Dossier and Document Ingestion tabs renders without crashing', async ({ page }) => {
    test.setTimeout(60_000);
    await openMedicalRecords(page);
    await page.getByRole('button', { name: 'Patient-Specific Medical Dossier' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Clinical Reports & Diagnostic Archive')).toBeVisible();

    await page.getByRole('button', { name: /Document Ingestion/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Clinical Reports & Diagnostic Archive')).toBeVisible();
  });

  test('"+ Upload External Report" opens the upload modal', async ({ page }) => {
    test.setTimeout(60_000);
    await openMedicalRecords(page);
    await page.getByRole('button', { name: /Upload External Report/ }).click();
    await expect(page.locator('div[role="dialog"][data-state="open"]')).toBeVisible({ timeout: 10_000 });
  });

});
