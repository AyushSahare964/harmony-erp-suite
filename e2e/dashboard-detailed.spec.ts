import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { gotoReady, fillStable } from './support/dom-helpers';

/** Scopes to the "Attention Required Today" card row so generic labels like "Appointments"
 *  don't collide with the same words used elsewhere on this data-dense dashboard. */
function attentionSection(page: import('@playwright/test').Page) {
  return page
    .locator('h3', { hasText: 'Attention Required Today' })
    .locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]');
}

test.describe('Admin Home Dashboard — Detailed Functioning', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await gotoReady(page, '/');
  });

  test('renders the Command Center hero banner with admin scope and branding', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Clinic Administrator & Owner Dashboard' })).toBeVisible();
    await expect(page.getByText('Full Access')).toBeVisible();
    await expect(
      page.getByText('Live overview of Clinical, Laboratory, Boarding, Swimming & Inventory operations.')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /opd queue/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /register client/i })).toBeVisible();
  });

  test('OPD Queue button opens the Admit Patient picker with its three intake tabs', async ({ page }) => {
    await page.getByRole('button', { name: /opd queue/i }).click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText('Admit Patient to OPD Consultation')).toBeVisible();
    await expect(modal.getByText(/scheduled appointments & queue/i)).toBeVisible();
    await expect(modal.getByText(/registered patient directory/i)).toBeVisible();
    await expect(modal.getByText(/direct walk-in patient/i)).toBeVisible();

    // Switch to the walk-in tab and confirm its form renders.
    await modal.getByText(/direct walk-in patient/i).first().click();
    await expect(modal.getByText(/direct walk-in patient registration & intake/i)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('Register Client button opens the New Pet & Owner registration modal', async ({ page }) => {
    await page.getByRole('button', { name: /register client/i }).click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText('Register New Pet & Owner')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('Attention Required Today renders all three cards with their actions', async ({ page }) => {
    const section = attentionSection(page);
    await expect(section.getByText('Appointments', { exact: true })).toBeVisible();
    await expect(section.getByText('Patients to Review', { exact: true })).toBeVisible();
    await expect(section.getByText('Dues & Reminders', { exact: true })).toBeVisible();
    await expect(section.getByRole('button', { name: /view queue/i })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Review', exact: true })).toBeVisible();
    await expect(section.getByRole('button', { name: /view all/i })).toBeVisible();
  });

  test('"View Queue" on the Appointments card navigates to the Appointments module', async ({ page }) => {
    await attentionSection(page).getByRole('button', { name: /view queue/i }).click();
    await expect(page).toHaveURL(/\/m\/appointments/i, { timeout: 10000 });
  });

  test('"Review" on the Patients to Review card navigates to Lab Orders', async ({ page }) => {
    await attentionSection(page).getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page).toHaveURL(/\/m\/lab_orders/i, { timeout: 10000 });
  });

  test('"View All" on the Dues & Reminders card navigates to Inventory', async ({ page }) => {
    await attentionSection(page).getByRole('button', { name: /view all/i }).click();
    await expect(page).toHaveURL(/\/m\/inventory/i, { timeout: 10000 });
  });

  test('Quick Actions render the two intake buttons and all module shortcut links point to the right modules', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: /new patient/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /treat patient/i })).toBeVisible();

    const expectedLinks: Record<string, string> = {
      'Lab Order': 'lab_orders',
      Pharmacy: 'pharmacy',
      Boarding: 'boarding',
      Swimming: 'swimming',
      Inventory: 'inventory',
    };
    for (const [label, moduleId] of Object.entries(expectedLinks)) {
      const link = page.getByRole('link', { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', new RegExp(`/m/${moduleId}$`));
    }

    // Exercise one end-to-end to prove the shortcuts are live, not just decorative hrefs.
    await page.getByRole('link', { name: 'Inventory', exact: true }).click();
    await expect(page).toHaveURL(/\/m\/inventory/i, { timeout: 10000 });
  });

  test('Treatment Queue table renders with all expected columns', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Treatment Queue — Today' })).toBeVisible();
    const table = page.locator('table').filter({ has: page.locator('th', { hasText: 'Complaint' }) });
    for (const col of ['Date', 'Patient', 'Doctor', 'Complaint', 'Status', 'Action']) {
      await expect(table.locator('th', { hasText: col })).toBeVisible();
    }
  });

  test('Hospital Snapshot shows all five live KPI cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Hospital Snapshot' })).toBeVisible();
    for (const label of [
      "Today's Appointments",
      'Revenue Today',
      'Boarding Occupancy',
      'Low-Stock Items',
      'Staff on Shift',
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('Revenue Mix and Outstanding & Billing panels render, and Open Billing navigates to Billing', async ({ page }) => {
    await expect(page.getByText('Revenue Mix (Today)')).toBeVisible();
    for (const stream of ['Clinical', 'Lab', 'Boarding', 'Swimming']) {
      await expect(page.getByText(stream, { exact: true }).first()).toBeVisible();
    }

    await expect(page.getByText('Outstanding & Billing')).toBeVisible();
    await expect(page.getByText('Total Outstanding')).toBeVisible();
    await expect(page.getByText("Today's Invoices")).toBeVisible();
    await expect(page.getByText('Settled Visits')).toBeVisible();

    await page.getByRole('button', { name: /open billing/i }).click();
    await expect(page).toHaveURL(/\/m\/billing/i, { timeout: 10000 });
  });

  test('Laboratory Analytics section shows sample stat chips and Open Lab navigates', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Laboratory Analytics' })).toBeVisible();
    for (const chip of ['Samples Today', 'Pending', 'Doctor Review', 'Critical', 'Completed']) {
      await expect(page.getByText(chip, { exact: true }).first()).toBeVisible();
    }
    await page.getByRole('button', { name: /open lab/i }).click();
    await expect(page).toHaveURL(/\/m\/lab_orders/i, { timeout: 10000 });
  });

  test('Boarding section shows occupancy stats and Open Boarding navigates', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Boarding', exact: true })).toBeVisible();
    await expect(page.getByText('Check-ins', { exact: true })).toBeVisible();
    await expect(page.getByText('Check-outs', { exact: true })).toBeVisible();
    await expect(page.getByText('Diet Plans', { exact: true })).toBeVisible();
    await expect(page.getByText('Occupancy Rate')).toBeVisible();

    await page.getByRole('button', { name: /open boarding/i }).click();
    await expect(page).toHaveURL(/\/m\/boarding/i, { timeout: 10000 });
  });

  test('Swimming & Hydrotherapy section shows session stats and Open Swimming navigates', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Swimming & Hydrotherapy' })).toBeVisible();
    await expect(page.getByText('Total Today', { exact: true })).toBeVisible();
    await expect(page.getByText('In Session', { exact: true })).toBeVisible();
    await expect(page.getByText('Upcoming', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /open swimming/i }).click();
    await expect(page).toHaveURL(/\/m\/swimming/i, { timeout: 10000 });
  });

  test('Live Clinic Pulse panel shows the KPI mini-grid and toggles between Activity and Alerts tabs', async ({ page }) => {
    await expect(page.getByText('Live Clinic Pulse')).toBeVisible();
    for (const label of ['Active Queue', 'Consulting', 'Settled', 'Total Records']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    const activityTab = page.getByRole('button', { name: /realtime activity/i });
    const alertsTab = page.getByRole('button', { name: /clinic alerts/i });
    await expect(activityTab).toBeVisible();
    await expect(alertsTab).toBeVisible();

    // Default tab is the activity feed.
    await expect(
      page.getByText(/no recent clinic visit activity logged yet\.|·/).first()
    ).toBeVisible();

    await alertsTab.click();
    await expect(
      page.getByText(/all clear! no pending medical alerts or overdue vaccinations\./i).or(
        page.getByText(/allergy alert|vaccine due/i)
      ).first()
    ).toBeVisible({ timeout: 5000 });

    await activityTab.click();
    await expect(activityTab).toHaveClass(/border-primary/);
  });

  test('Patient CRM Quick Info: search box and species filter chips are interactive', async ({ page }) => {
    await expect(page.getByText('Patient CRM Quick Info')).toBeVisible();
    const search = page.getByPlaceholder('Search pet name, breed, ID, owner...');
    await expect(search).toBeVisible();

    const allChip = page.getByRole('button', { name: /^all\s*\(/i });
    const dogsChip = page.getByRole('button', { name: /dogs/i });
    const catsChip = page.getByRole('button', { name: /cats/i });
    const opdChip = page.getByRole('button', { name: /in opd/i });
    await expect(allChip).toBeVisible();
    await expect(dogsChip).toBeVisible();
    await expect(catsChip).toBeVisible();
    await expect(opdChip).toBeVisible();

    await dogsChip.click();
    await expect(dogsChip).toHaveClass(/bg-primary/);
    await catsChip.click();
    await expect(catsChip).toHaveClass(/bg-primary/);
    await opdChip.click();
    await expect(opdChip).toHaveClass(/bg-emerald-600/);
    await allChip.click();
    await expect(allChip).toHaveClass(/bg-primary/);

    // A query that matches nothing should hit the explicit empty state, proving the
    // search box is wired to the live patient list rather than being decorative.
    await fillStable(search, `no-such-patient-${Date.now()}`);
    await expect(page.getByText('No matching patients found')).toBeVisible({ timeout: 10000 });
  });

  test('Selecting a patient from the CRM directory opens the profile dossier modal', async ({ page }) => {
    const panel = page.locator('div', { hasText: 'Patient CRM Quick Info' }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    const firstPatientRow = panel.locator('div.cursor-pointer').first();

    const hasPatients = await firstPatientRow.isVisible({ timeout: 8000 }).catch(() => false);
    test.skip(!hasPatients, 'No patients registered in this environment to open a dossier for.');

    await firstPatientRow.click();
    const dossier = page.locator('div[role="dialog"][data-state="open"]');
    await expect(dossier).toBeVisible({ timeout: 10000 });
    await expect(dossier.getByText('Pet Parent Information')).toBeVisible();
    await dossier.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dossier).not.toBeVisible({ timeout: 5000 });
  });

  test('Module flashcards render in categorized sections and the first card navigates into its module', async ({ page }) => {
    const moduleCountLabel = page.getByText(/^\d+ modules$/).first();
    await expect(moduleCountLabel).toBeVisible();

    const firstFlashcardLink = page.locator('a[href^="/m/"]').last();
    const href = await firstFlashcardLink.getAttribute('href');
    expect(href).toMatch(/^\/m\/[a-z_-]+$/);

    await firstFlashcardLink.click();
    await expect(page).toHaveURL(/\/m\//i, { timeout: 10000 });
  });
});
