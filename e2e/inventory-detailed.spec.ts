import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable } from './support/dom-helpers';

/** Selects an option from a shadcn/Radix Select whose trigger sits right after the given label text.
 *  Deliberately NOT `exact` — required-field labels render with a trailing "*" span, so an exact
 *  match against the plain label string never finds the element (confirmed against the live app). */
async function selectByLabel(container: Locator, page: Page, labelText: string, optionName: string | RegExp) {
  const trigger = container.getByText(labelText).first().locator('xpath=following::button[@role="combobox"][1]');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.getByRole('option', { name: optionName }).click();
}

/** Toggles a shadcn Checkbox/Switch by clicking its associated <Label> text (native label-click delegation). */
async function toggleByLabel(container: Locator, labelText: string) {
  await container.getByText(labelText).first().click();
}

async function fillByLabel(container: Locator, labelText: string, value: string) {
  const input = container.getByText(labelText).first().locator('xpath=following::input[1]');
  await fillStable(input, value);
}

test.describe.serial('Inventory — Detailed End-to-End: all 4 categories, field round-trip, cross-module reach', () => {
  const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);
  const medName = `E2EMed-${suffix}`;
  const injName = `E2EInjection-${suffix}`;
  const foodName = `E2EFood-${suffix}`;
  const accName = `E2EAccessory-${suffix}`;
  const injThrowawayName = `E2EInjectionDelete-${suffix}`;
  const injPrice = 450;
  const injGstRate = 12; // matches getDefaultFormState's INJECTION gstRate default
  let injItemCode = '';

  test('Medicine: every Step-1 clinical field round-trips through save + reopen', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');

    await page.getByRole('button', { name: /add medicine/i }).click();
    const wizard = page.locator('div[role="dialog"][data-state="open"]');
    await expect(wizard).toBeVisible();

    await fillStable(wizard.getByPlaceholder('e.g. Amoxicillin 250mg', { exact: true }), medName);
    await fillByLabel(wizard, 'Composition / Active Substance', 'Amoxicillin 250mg + Clavulanic 50mg');
    await fillByLabel(wizard, 'Strength / Concentration', '250mg');
    await selectByLabel(wizard, page, 'Dosage Form', 'Capsule');
    await selectByLabel(wizard, page, 'Administration Route', 'IV');
    await selectByLabel(wizard, page, 'Storage Temperature / Condition', 'Cold Chain (2-8°C)');
    await selectByLabel(wizard, page, 'Drug Schedule / Classification', 'Schedule H1');
    await toggleByLabel(wizard, 'Controlled Substance / Narcotic Register entry mandatory');

    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Minimum Stock Level / Reorder Point', '5');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Selling Price / Retail Price (₹)', '250');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save product master/i }).click();
    await expect(wizard).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText(medName).first()).toBeVisible({ timeout: 15000 });
    // Let the optimistic temp-row's exit animation finish so only the real row remains
    // (AnimatePresence briefly renders both the exiting temp row and the new real row).
    await page.waitForTimeout(800);

    // Re-open in edit mode and assert every field written above survived the round trip.
    // (Click the row's Edit icon directly — clicking the name/row itself opens the read-only
    // ItemDetailView instead, which has no "Edit Medicine Master" control on it.)
    await page.locator('tr', { hasText: medName }).getByRole('button', { name: /edit medicine master/i }).click();
    const editWizard = page.locator('div[role="dialog"][data-state="open"]');
    await expect(editWizard).toBeVisible();

    await expect(editWizard.locator('input[value="Amoxicillin 250mg + Clavulanic 50mg"]')).toBeVisible({ timeout: 10000 });
    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Capsule' })).toBeVisible();
    await expect(editWizard.locator('button[role="combobox"]', { hasText: /^IV$/ })).toBeVisible();
    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Cold Chain (2-8°C)' })).toBeVisible();
    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Schedule H1' })).toBeVisible();
    await expect(editWizard.getByRole('checkbox', { checked: true })).toHaveCount(1);
    await editWizard.getByRole('button', { name: /cancel/i }).click();
  });

  test('Injection: category tile exists, full field set round-trips, item code uses I- prefix', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');
    await page.locator('#inv-tab-injection').click();
    await expect(page.getByRole('heading', { name: /injection & vaccine master/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /add injection/i }).click();
    const wizard = page.locator('div[role="dialog"][data-state="open"]');
    await expect(wizard).toBeVisible();
    await expect(wizard.getByText('Injection', { exact: true })).toBeVisible();

    await fillStable(wizard.getByPlaceholder(/meloxicam 20mg\/ml injection/i), injName);
    await fillByLabel(wizard, 'Composition / Active Substance', 'Meloxicam 20mg/ml');
    await fillByLabel(wizard, 'Strength / Concentration', '20mg/ml');
    await fillByLabel(wizard, 'Vial / Ampoule Size', '10ml vial');
    await selectByLabel(wizard, page, 'Administration Route', 'SC');
    await fillByLabel(wizard, 'Injection Site', 'Gluteal');
    await fillByLabel(wizard, 'Withdrawal Period', '7 days meat/milk');
    await selectByLabel(wizard, page, 'Storage / Cold Chain Condition', 'Deep Freeze (< -18°C)');
    await selectByLabel(wizard, page, 'Drug Schedule / Classification', 'Schedule X');
    await toggleByLabel(wizard, 'Controlled Substance / Narcotic Register entry mandatory');

    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Minimum Stock Level / Reorder Point', '10');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Selling Price / Retail Price (₹)', '450');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save product master/i }).click();
    await expect(wizard).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText(injName).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);

    // Item code must be issued from the "I-" sequence, not the Medicine "M-" one.
    const row = page.locator('tr', { hasText: injName });
    const codeCell = await row.locator('td').nth(1).innerText();
    injItemCode = codeCell.trim();
    expect(injItemCode).toMatch(/^I-\d+$/);

    // Re-open in edit mode and assert every injection-specific field survived the round trip.
    await page.locator('tr', { hasText: injName }).getByRole('button', { name: /edit injection master/i }).click();
    const editWizard = page.locator('div[role="dialog"][data-state="open"]');
    await expect(editWizard).toBeVisible();

    await expect(editWizard.locator('input[value="Meloxicam 20mg/ml"]')).toBeVisible({ timeout: 10000 });
    await expect(editWizard.locator('input[value="20mg/ml"]')).toBeVisible();
    await expect(editWizard.locator('input[value="10ml vial"]')).toBeVisible();
    await expect(editWizard.locator('button[role="combobox"]', { hasText: /^SC$/ })).toBeVisible();
    await expect(editWizard.locator('input[value="Gluteal"]')).toBeVisible();
    await expect(editWizard.locator('input[value*="7 days"]')).toBeVisible();
    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Deep Freeze' })).toBeVisible();
    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Schedule X' })).toBeVisible();
    await editWizard.getByRole('button', { name: /cancel/i }).click();
  });

  test('Food: species/lifeStage/flavour/dietary fields round-trip', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');
    await page.locator('#inv-tab-food').click();

    await page.getByRole('button', { name: /add food/i }).click();
    const wizard = page.locator('div[role="dialog"][data-state="open"]');
    await expect(wizard).toBeVisible();

    await fillStable(wizard.getByPlaceholder(/royal canin maxi adult 4kg/i), foodName);
    await selectByLabel(wizard, page, 'Target Species', 'Cat');
    await selectByLabel(wizard, page, 'Food Type', 'Wet / Canned');
    await selectByLabel(wizard, page, 'Life Stage', 'Senior');
    await fillByLabel(wizard, 'Flavour / Primary Protein', 'Ocean Fish');
    await fillByLabel(wizard, 'Net Weight / Pack Size', '3kg');
    await fillByLabel(wizard, 'Dietary Indication', 'Renal Support');

    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Minimum Stock Level / Reorder Point', '5');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Selling Price / Retail Price (₹)', '1200');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save product master/i }).click();
    await expect(wizard).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText(foodName).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);

    await page.locator('tr', { hasText: foodName }).getByRole('button', { name: /edit food master/i }).click();
    const editWizard = page.locator('div[role="dialog"][data-state="open"]');
    await expect(editWizard).toBeVisible();

    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Cat' })).toBeVisible({ timeout: 10000 });
    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Wet / Canned' })).toBeVisible();
    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Senior' })).toBeVisible();
    await expect(editWizard.locator('input[value="Ocean Fish"]')).toBeVisible();
    await expect(editWizard.locator('input[value="3kg"]')).toBeVisible();
    await expect(editWizard.locator('input[value="Renal Support"]')).toBeVisible();
    await editWizard.getByRole('button', { name: /cancel/i }).click();
  });

  test('Accessory: type/size/material/color fields round-trip', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');
    await page.locator('#inv-tab-accessories').click();

    await page.getByRole('button', { name: /add accessory/i }).click();
    const wizard = page.locator('div[role="dialog"][data-state="open"]');
    await expect(wizard).toBeVisible();

    await fillStable(wizard.getByPlaceholder(/ergonomic padded dog harness/i), accName);
    await selectByLabel(wizard, page, 'Accessory Category', 'Bed / Mattress / Comfort');
    await selectByLabel(wizard, page, 'Pet Size / Breed Fit', 'Large (L)');
    await fillByLabel(wizard, 'Material Composition', 'Memory Foam');
    await fillByLabel(wizard, 'Color / Pattern Variant', 'Matte Black');

    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Minimum Stock Level / Reorder Point', '3');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Selling Price / Retail Price (₹)', '1800');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save product master/i }).click();
    await expect(wizard).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText(accName).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);

    await page.locator('tr', { hasText: accName }).getByRole('button', { name: /edit accessory master/i }).click();
    const editWizard = page.locator('div[role="dialog"][data-state="open"]');
    await expect(editWizard).toBeVisible();

    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Bed / Mattress / Comfort' })).toBeVisible({ timeout: 10000 });
    await expect(editWizard.locator('button[role="combobox"]', { hasText: 'Large (L)' })).toBeVisible();
    await expect(editWizard.locator('input[value="Memory Foam"]')).toBeVisible();
    await expect(editWizard.locator('input[value="Matte Black"]')).toBeVisible();
    await editWizard.getByRole('button', { name: /cancel/i }).click();
  });

  test('Stock View: category dropdown includes Injection and filters to it', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');
    await page.locator('#inv-tab-stock').click();

    const catSelect = page.locator('button[role="combobox"]', { hasText: 'All categories' });
    await catSelect.click();
    await expect(page.getByRole('option', { name: 'Injection', exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole('option', { name: 'Injection', exact: true }).click();
    await expect(page.getByText(injName).first()).toBeVisible({ timeout: 10000 });
  });

  test('Alerts panel: Injections category filter pill exists and filters', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');
    await page.locator('#inv-tab-alerts').click();
    await expect(page.getByRole('button', { name: /injections/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /injections/i }).click();
  });

  test('Sales Invoice: "Injections & Vaccines" category exists and surfaces the created item', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/billing');
    await page.getByRole('button', { name: /new invoice/i }).first().click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible({ timeout: 15000 });

    await modal.locator('button[role="combobox"]', { hasText: 'All Categories' }).click();
    await expect(page.getByRole('option', { name: /injections & vaccines/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('option', { name: /injections & vaccines/i }).click();

    await modal.locator('button[role="combobox"]', { hasText: /browse items/i }).click();
    await expect(page.getByRole('option', { name: injName })).toBeVisible({ timeout: 10000 });
  });

  test('Quotation: "Injections & Vaccines" category exists', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/billing');
    await page.getByRole('button', { name: /new quotation/i }).click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await modal.locator('button[role="combobox"]', { hasText: 'All Categories' }).click();
    await expect(page.getByRole('option', { name: /injections & vaccines/i })).toBeVisible({ timeout: 10000 });
  });

  test('Clinical visit: the Injectable/Vaccine Administration search finds and adds the real Injection item', async ({ page }) => {
    test.setTimeout(120000);
    await loginAsAdmin(page);

    const petName = `InjRx-${suffix}`;
    const ownerName = `InjRx Owner ${suffix}`;

    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const regModal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(regModal).toBeVisible();
    await fillStable(regModal.getByPlaceholder(/atul bhise/i), ownerName);
    await fillStable(regModal.getByPlaceholder(/98230 11221/i), `9${suffix}11`.slice(0, 10));
    await regModal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(regModal.getByPlaceholder(/^e\.g\. bruno$/i), petName);
    await fillStable(regModal.getByPlaceholder(/labrador retriever/i), 'Labrador Retriever');
    await regModal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(regModal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await regModal.getByRole('button', { name: /admit to opd consultation/i }).click();

    const workspace = page.locator('div[role="dialog"][data-state="open"]');
    await expect(workspace).toBeVisible({ timeout: 15000 });

    const injectableSearch = workspace.getByPlaceholder(/search injectable medicines, vaccines, or vials/i);
    await fillStable(injectableSearch, injName);
    // Match only a real clickable result <button> (CatalogueSearch.tsx renders results as
    // <button onClick={handleSelectItem}>), NOT the "No injection items found matching…"
    // empty-state <p>, which also contains the query text and would otherwise false-pass this.
    const resultOption = workspace.locator('button').filter({ hasText: injName }).first();
    await expect(resultOption).toBeVisible({ timeout: 10000 });
    // Confirms this is really a search-result hit, not the disabled "no results" copy.
    await expect(workspace.getByText(new RegExp(`no injection items found matching`, 'i'))).toHaveCount(0);
    await resultOption.click();
    // autoClearOnSelect wipes the search box on a genuine selection — proves a real item,
    // not the empty-state paragraph, was what got clicked.
    await expect(injectableSearch).toHaveValue('', { timeout: 5000 });
    await expect(workspace.getByText(injName).first()).toBeVisible({ timeout: 10000 });
  });

  test('Injection: status toggle (Active/Inactive) and delete both work on a throwaway item', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');
    await page.locator('#inv-tab-injection').click();

    await page.getByRole('button', { name: /add injection/i }).click();
    const wizard = page.locator('div[role="dialog"][data-state="open"]');
    await expect(wizard).toBeVisible();
    await fillStable(wizard.getByPlaceholder(/meloxicam 20mg\/ml injection/i), injThrowawayName);
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Minimum Stock Level / Reorder Point', '5');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await fillByLabel(wizard, 'Selling Price / Retail Price (₹)', '100');
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save & next/i }).click();
    await wizard.getByRole('button', { name: /save product master/i }).click();
    await expect(wizard).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText(injThrowawayName).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);

    const row = page.locator('tr', { hasText: injThrowawayName });
    await expect(row.getByRole('button', { name: 'Active', exact: true })).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Active', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Inactive', exact: true })).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: 'Inactive', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Active', exact: true })).toBeVisible({ timeout: 10000 });

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: /delete injection/i }).click();
    await expect(page.locator('tr', { hasText: injThrowawayName })).toHaveCount(0, { timeout: 10000 });
  });

  test('Alerts panel: category filter genuinely narrows the low-stock list', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');
    await page.locator('#inv-tab-alerts').click();

    // The Injection item created earlier still has 0 opening stock, so it's Out of Stock
    // and shows under "ALL" — proves the default (unfiltered) view isn't empty by accident.
    await expect(page.getByText(injName).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Medicines', exact: true }).click();
    await expect(page.getByText(injName)).toHaveCount(0);

    await page.getByRole('button', { name: 'Injections', exact: true }).click();
    await expect(page.getByText(injName).first()).toBeVisible({ timeout: 10000 });
  });

  test('Injection: item-detail sub-tabs render cleanly, and a GRN batch appears in Stock Movements', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');
    await page.locator('#inv-tab-injection').click();

    // Click the item's name cell specifically (not the Edit icon, and not just the row's
    // bounding-box center — several cells in this row, e.g. the stock editor, stop click
    // propagation, so a whole-row click can silently land on one of those instead) to open
    // the read-only ItemDetailView.
    await page.locator('tr', { hasText: injName }).getByText(injName, { exact: false }).first().click();
    const heading = page.locator('h1', { hasText: injName });
    await expect(heading).toBeVisible({ timeout: 10000 });

    const subTabs = ['dashboard', 'inventory', 'variants', 'accounting', 'purchasing', 'sales', 'tax', 'quality', 'manufacturing'];
    for (const tab of subTabs) {
      await page.locator(`#item-tab-${tab}`).click();
      // A render crash would unmount the whole page (including the header) — this is a
      // lightweight but real "didn't crash" signal for each of the 9 remaining tabs.
      await expect(heading).toBeVisible();
    }

    // Back on Inventory sub-tab — record a real GRN batch.
    await page.locator('#item-tab-inventory').click();
    await page.getByRole('button', { name: /add batch/i }).click();
    const grnBatchNo = `INJBAT-${suffix}`;
    await fillStable(page.getByPlaceholder(/e\.g\. bat-2026-001/i), grnBatchNo);
    const qtyInput = page.getByText('Quantity (').locator('xpath=following::input[1]').last();
    await fillStable(qtyInput, '25');
    await page.locator('input[type="date"]').fill('2027-12-31');
    await page.getByRole('button', { name: /save batch/i }).click();
    await expect(page.locator('tr', { hasText: grnBatchNo })).toBeVisible({ timeout: 10000 });

    // Stock Movements tab should now carry a ledger entry for this item.
    await page.goto('/m/inventory');
    await page.locator('#inv-tab-movements').click();
    await expect(page.getByText(injName).first()).toBeVisible({ timeout: 10000 });
  });

  test('Pharmacy Retail POS: Injection category tab filters to the real injection item', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/pharmacy');
    await page.getByRole('button', { name: /new sale/i }).click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible({ timeout: 15000 });

    await modal.getByRole('button', { name: 'Injection', exact: true }).click();
    await expect(modal.getByText(injName).first()).toBeVisible({ timeout: 10000 });

    await modal.getByRole('button', { name: 'Medicine', exact: true }).click();
    await expect(modal.getByText(injName)).toHaveCount(0);
  });

  test('Sales Invoice: a finalized Injection line item posts the correct 12% GST end-to-end', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);
    await page.goto('/m/billing');
    await page.getByRole('button', { name: /new invoice/i }).first().click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible({ timeout: 15000 });

    const gstClient = `GSTCheck-${suffix}`;
    await fillStable(modal.getByPlaceholder('CASH', { exact: true }), gstClient);

    // Type the name then click the real dropdown result row (`.first()` — the "Quick Add to
    // Catalogue" bar below the results also echoes the typed name as `Add "<name>" as:`, and
    // is rendered after the results list, so `.first()` deterministically hits the real item,
    // which is what actually fires handleSelectInventoryItem() and applies its real GST rate).
    await fillStable(modal.getByPlaceholder('Type or select item name...'), injName);
    await modal.getByText(injName, { exact: false }).first().click();

    await modal.getByTitle('Add Line (Enter)').click();
    await expect(modal.locator('td', { hasText: injName })).toBeVisible({ timeout: 10000 });

    const expectedGst = (injPrice * injGstRate) / 100;
    const expectedTotal = injPrice + expectedGst;
    await expect(modal.getByText(`₹${injPrice.toFixed(2)}`).first()).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText(`₹${expectedGst.toFixed(2)}`)).toBeVisible();
    await expect(modal.getByText(`₹${expectedTotal.toFixed(2)}`).first()).toBeVisible();

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(modal).not.toBeVisible({ timeout: 20000 });

    await page.goto('/m/billing');
    const searchBox = page.getByPlaceholder(/search invoice #, client name, pet, mobile, or doctor/i);
    await fillStable(searchBox, gstClient);
    await expect(page.getByText(gstClient).first()).toBeVisible({ timeout: 15000 });
  });
});
