import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable, reloadReady } from './support/dom-helpers';

async function createMedicineViaWizard(page: Page, name: string) {
  await page.goto('/m/inventory');
  await page.getByRole('button', { name: /add medicine/i }).click();
  const wizard = page.locator('div[role="dialog"][data-state="open"]');
  await expect(wizard).toBeVisible();

  // Step 1: Identity — only Item Name is required
  const nameInput = wizard.getByPlaceholder('e.g. Amoxicillin 250mg', { exact: true });
  await fillStable(nameInput, name);
  await wizard.getByRole('button', { name: /save & next/i }).click();

  // Step 2: Stock & Inventory — Reorder Level is required
  const reorderInput = wizard.getByText('Minimum Stock Level / Reorder Point').locator('xpath=following::input[1]');
  await fillStable(reorderInput, '5');
  await wizard.getByRole('button', { name: /save & next/i }).click();

  // Step 3: Pricing & Tax — Selling Price is required
  const priceInput = wizard.getByText('Selling Price / Retail Price (₹)').locator('xpath=following::input[1]');
  await fillStable(priceInput, '250');
  await wizard.getByRole('button', { name: /save & next/i }).click();

  // Steps 4 & 5 have no required fields
  await wizard.getByRole('button', { name: /save & next/i }).click();
  await wizard.getByRole('button', { name: /save product master/i }).click();
  await expect(wizard).not.toBeVisible({ timeout: 15000 });
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });
}

test.describe.serial('Inventory: Item Creation, Stock (GRN) Persistence, Purchasing Tab', () => {
  const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);
  const itemName = `TestMedicine-${suffix}`;
  const purchasingItemName = `PurchasingItem-${suffix}`;
  const batchNo = `BAT-${suffix}`;

  test('creates a new medicine via the 5-step Product Master wizard', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await createMedicineViaWizard(page, itemName);
  });

  test('Purchasing tab loads real suppliers from Accounting and can record a real purchase', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    // Its own item, independent of the GRN test's stock counting below.
    await createMedicineViaWizard(page, purchasingItemName);

    await page.getByText(purchasingItemName).first().click();
    await page.locator('#item-tab-purchasing').click();

    // Suppliers now come from listSuppliersFn (Accounting's real Supplier collection),
    // not a hardcoded array — assert at least one real row renders.
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/no suppliers found/i)).toHaveCount(0);

    const purchaseBatchNo = `PUR-${suffix}`;
    await page.getByRole('button', { name: /record purchase/i }).click();
    await fillStable(page.getByPlaceholder(/e\.g\. bat-2026-001/i), purchaseBatchNo);
    await page.locator('input[type="date"]').fill('2027-06-30');
    await page.getByRole('button', { name: /save purchase/i }).click();

    await expect(page.getByText(new RegExp(`purchase recorded.*${purchaseBatchNo}`, 'i'))).toBeVisible({ timeout: 15000 });
  });

  test('adds a stock batch (GRN) and confirms the item stock quantity survives a reload', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/inventory');

    await page.getByText(itemName).first().click();
    const inventoryTab = page.locator('#item-tab-inventory');
    await expect(inventoryTab).toBeVisible({ timeout: 15000 });
    await inventoryTab.click();

    await page.getByRole('button', { name: /add batch/i }).click();
    await fillStable(page.getByPlaceholder(/e\.g\. bat-2026-001/i), batchNo);

    const qtyInput = page.getByText('Quantity (').locator('xpath=following::input[1]').last();
    await fillStable(qtyInput, '40');
    await page.locator('input[type="date"]').fill('2027-12-31');

    await page.getByRole('button', { name: /save batch/i }).click();
    // (the "Batch added" toast is transient and can auto-dismiss before we get to check it —
    // asserting the Total row below is a more durable signal than racing the toast)

    // "Total" stock row should reflect the +40 units immediately (optimistic client update).
    // This item is untouched by any other test, so it should read exactly 40.
    await expect(page.locator('tr', { hasText: 'Total' }).getByText('40')).toBeVisible({ timeout: 10000 });

    // Reload and re-open the same item — does the stock total still show the added quantity,
    // or does it reset because InventoryItem.currentStock was never updated server-side?
    await reloadReady(page);
    await page.goto('/m/inventory');
    await page.getByText(itemName).first().click();
    await expect(inventoryTab).toBeVisible({ timeout: 15000 });
    await inventoryTab.click();
    await expect(page.locator('tr', { hasText: 'Total' }).getByText('40')).toBeVisible({ timeout: 10000 });
  });
});
