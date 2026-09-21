import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable, gotoReady } from './support/dom-helpers';

/**
 * Global Search (`GlobalSearch` in src/components/erp/Shell.tsx) — the header search
 * box present on every Shell-wrapped page. It lazy-loads the full pet+owner list
 * (listPetsWithOwnersFn) on first focus and filters client-side by pet name / petId /
 * breed / species / owner name / owner phone. Each result row also offers 4 quick-link
 * pills: Patient Record, Billing, Lab, Boarding.
 *
 * A fresh, uniquely-named owner+pet is registered first (same real flow as
 * crm-registration.spec.ts) so every "does search find X" assertion below is against
 * data this run created, not leftover seed data that could rot the suite over time.
 */
test.describe.serial('Global Search', () => {
  const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);
  const owner = {
    name: `Search Owner ${suffix}`,
    phone: `9${suffix}12`.slice(0, 10),
  };
  const pet = {
    name: `Zephyr-${suffix}`,
    breed: `Xoloitzcuintli-${suffix}`, // unique breed string too, so it can't false-match seed data
  };
  let petId = '';

  const searchBox = (page: import('@playwright/test').Page) => page.getByPlaceholder(/search patients/i);
  const resultRow = (page: import('@playwright/test').Page) => page.locator('[role="button"]', { hasText: pet.name });

  test('A1 — search box renders on the dashboard, and an empty query shows no dropdown at all', async ({ page }) => {
    await loginAsAdmin(page);
    const box = searchBox(page);
    await expect(box).toBeVisible();
    await box.click();
    await page.waitForTimeout(300);
    await expect(page.getByText('No matching patients found.')).not.toBeVisible();
  });

  test('A2 — a nonsense query shows the exact empty-state text', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), 'zzzznonexistentquery12345');
    await expect(page.getByText('No matching patients found.')).toBeVisible();
  });

  test('B1 — registers a fresh, uniquely-named owner + pet fixture to search for', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await gotoReady(page, '/m/crm-pets');

    await page.getByRole('button', { name: /register pet.*new owner/i }).first().click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();

    await fillStable(modal.getByPlaceholder(/atul bhise/i), owner.name);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), owner.phone);
    await modal.getByRole('button', { name: /next: add patient details/i }).click();

    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), pet.name);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), pet.breed);

    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await modal.getByRole('button', { name: /done & close crm/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test('C1 — exact name search finds the fixture, with correct breed/owner/phone on the row', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.name);
    const row = resultRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(pet.breed);
    await expect(row).toContainText(owner.name);
    await expect(row).toContainText(owner.phone);

    petId = (await row.locator('span.font-mono').first().innerText()).trim();
    expect(petId.length).toBeGreaterThan(0);
  });

  test('C2 — search is case-insensitive and matches a partial substring', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.name.slice(0, 4).toUpperCase());
    await expect(resultRow(page)).toBeVisible({ timeout: 10000 });
  });

  test('C3 — search by petId finds the fixture', async ({ page }) => {
    test.skip(!petId, 'petId was not captured by test C1');
    await loginAsAdmin(page);
    await fillStable(searchBox(page), petId);
    await expect(resultRow(page)).toBeVisible({ timeout: 10000 });
  });

  test('C4 — search by breed finds the fixture', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.breed);
    await expect(resultRow(page)).toBeVisible({ timeout: 10000 });
  });

  test('C5 — search by owner name finds the fixture', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), owner.name);
    await expect(resultRow(page)).toBeVisible({ timeout: 10000 });
  });

  test('C6 — search by owner phone finds the fixture', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), owner.phone);
    await expect(resultRow(page)).toBeVisible({ timeout: 10000 });
  });

  test('D1 — clicking outside closes the dropdown', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.name);
    await expect(resultRow(page)).toBeVisible({ timeout: 10000 });
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await expect(resultRow(page)).not.toBeVisible();
  });

  test('D2 — clearing the query closes the dropdown even while still focused', async ({ page }) => {
    await loginAsAdmin(page);
    const box = searchBox(page);
    await fillStable(box, pet.name);
    await expect(resultRow(page)).toBeVisible({ timeout: 10000 });
    await box.fill('');
    await expect(page.getByText('No matching patients found.')).not.toBeVisible();
    await expect(resultRow(page)).not.toBeVisible();
  });

  test('E1 — clicking a result row (from a different module) opens that exact patient record', async ({ page }) => {
    await loginAsAdmin(page);
    // Start from Billing, not the dashboard — proves the search box works from anywhere
    // and that the click genuinely navigates across modules, not just re-renders in place.
    await gotoReady(page, '/m/billing');
    await fillStable(searchBox(page), pet.name);
    const row = resultRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    await expect(page).toHaveURL(/\/m\/crm-pets/, { timeout: 10000 });
    const detailDialog = page.locator('div[role="dialog"][data-state="open"]');
    await expect(detailDialog).toBeVisible({ timeout: 10000 });
    await expect(detailDialog.getByText(pet.name).first()).toBeVisible();
    if (petId) await expect(detailDialog.getByText(petId).first()).toBeVisible();
  });

  test('E2 — "Patient Record" quick-link pill opens the same patient record', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.name);
    const row = resultRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Patient Record' }).click();

    await expect(page).toHaveURL(/\/m\/crm-pets/, { timeout: 10000 });
    const detailDialog = page.locator('div[role="dialog"][data-state="open"]');
    await expect(detailDialog).toBeVisible({ timeout: 10000 });
    await expect(detailDialog.getByText(pet.name).first()).toBeVisible();
  });

  test('E3 — "Billing" quick-link opens the Billing Desk, and warns this patient has no billing records', async ({ page }) => {
    // The fixture pet was only ever registered via CRM — it has never had an invoice
    // created — so this also proves the "no records for this patient" popup fires
    // correctly instead of silently showing the whole, unfiltered register.
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.name);
    const row = resultRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Billing' }).click();

    await expect(page).toHaveURL(/\/m\/billing/, { timeout: 10000 });
    await expect(page.locator('h2', { hasText: 'Billing Desk' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(new RegExp(`No billing records found for ${pet.name}`, 'i'))).toBeVisible({ timeout: 10000 });
  });

  test('E4 — "Boarding" quick-link opens the Boarding & Swimming hub', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.name);
    const row = resultRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Boarding' }).click();

    await expect(page).toHaveURL(/\/m\/boarding/, { timeout: 10000 });
    await expect(page.locator('h2', { hasText: /pet boarding/i })).toBeVisible({ timeout: 10000 });
  });

  test('E5 — "Lab" quick-link opens the Laboratory hub, and warns this patient has no lab records', async ({ page }) => {
    // Was previously a dead link: GlobalSearch sent moduleId "lab_orders", which no route
    // recognized, so it silently bounced back to the dashboard (fixed — now "laboratory").
    // The fixture pet has never had a lab order created, so this also proves the
    // "no records for this patient" popup fires instead of silently showing everything.
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.name);
    const row = resultRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Lab' }).click();

    await expect(page).toHaveURL(/\/m\/laboratory/, { timeout: 10000 });
    await expect(page.locator('h2', { hasText: /laboratory/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(new RegExp(`No lab records found for ${pet.name}`, 'i'))).toBeVisible({ timeout: 10000 });
  });

  test('F1 — keyboard: focusing a result row and pressing Enter navigates the same as a click', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.name);
    const row = resultRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.focus();
    await row.press('Enter');

    await expect(page).toHaveURL(/\/m\/crm-pets/, { timeout: 10000 });
  });

  test('G1 — creates a real invoice for the fixture pet', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await gotoReady(page, '/m/billing');
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = page.locator('div[role="dialog"][data-state="open"]').last();
    await expect(modal).toBeVisible({ timeout: 10000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    // Link this invoice to the fixture pet via the "Walk-in / Select Pet" picker
    await modal.locator('button[role="combobox"]', { hasText: /walk-in \/ select pet/i }).click();
    await page.getByRole('option', { name: new RegExp(pet.name) }).click();

    const numberInputs = modal.locator('input[type="number"]');
    await fillStable(modal.getByPlaceholder('Type or select item name...'), `SearchFixtureItem-${suffix}`);
    await fillStable(numberInputs.nth(0), '1');
    await fillStable(numberInputs.nth(1), '500');
    await modal.getByTitle('Add Line (Enter)').click();
    await expect(modal.locator('td', { hasText: `SearchFixtureItem-${suffix}` })).toBeVisible({ timeout: 10000 });

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(modal).not.toBeVisible({ timeout: 20000 });
  });

  test('G2 — with real billing records, the "Billing" pill filters and highlights the register instead of warning', async ({ page }) => {
    await loginAsAdmin(page);
    await fillStable(searchBox(page), pet.name);
    const row = resultRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Billing' }).click();

    await expect(page).toHaveURL(/\/m\/billing/, { timeout: 10000 });
    await expect(page.getByText(/No billing records found/i)).not.toBeVisible();

    const register = page.locator('#billing-invoice-register');
    await expect(register).toBeVisible({ timeout: 10000 });
    await expect(register).toContainText(pet.name, { timeout: 10000 });
  });
});
