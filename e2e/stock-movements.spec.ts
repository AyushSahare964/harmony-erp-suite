import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable } from './support/dom-helpers';

/**
 * Stock Movements (`/m/inventory` → "Stock Movements" tab) — dedicated coverage.
 *
 * Covers three real bugs found and fixed while building this suite:
 *   1. The ledger never loaded from the server on page load — it only ever showed
 *      entries created in the current browser session (fixed in useInventoryStore.ts:
 *      added refetchLedger() calling the already-existing getLedgerFn on mount).
 *   2. "Stock Adjustment / Write-Off"'s submit handler wasn't awaited and had no error
 *      handling — a failed deduction still showed a success toast and reset the form
 *      (fixed: now async, awaited, try/catch with a real error toast).
 *   3. Leaving "Specific Batch" on its "Auto-FIFO deduction" placeholder sent an empty/
 *      sentinel batch id to the server, which can never match a real batch — so the
 *      advertised auto-FIFO deduction could never actually succeed (fixed: client picks
 *      the earliest-expiring batch that alone covers the requested quantity).
 */

async function fillByLabel(container: Locator, labelText: string, value: string) {
  const input = container.getByText(labelText).first().locator('xpath=following::input[1]');
  await fillStable(input, value);
}

/** Creates a minimal Medicine item via the Product Master wizard and returns its name. */
async function createTestMedicine(page: Page, name: string, reorderLevel = '5', price = '100') {
  await page.goto('/m/inventory');
  await page.getByRole('button', { name: /add medicine/i }).click();
  const wizard = page.locator('div[role="dialog"][data-state="open"]');
  await expect(wizard).toBeVisible();
  await fillStable(wizard.getByPlaceholder('e.g. Amoxicillin 250mg', { exact: true }), name);
  await wizard.getByRole('button', { name: /save & next/i }).click();
  await fillByLabel(wizard, 'Minimum Stock Level / Reorder Point', reorderLevel);
  await wizard.getByRole('button', { name: /save & next/i }).click();
  await fillByLabel(wizard, 'Selling Price / Retail Price (₹)', price);
  await wizard.getByRole('button', { name: /save & next/i }).click();
  await wizard.getByRole('button', { name: /save & next/i }).click();
  await wizard.getByRole('button', { name: /save product master/i }).click();
  await expect(wizard).not.toBeVisible({ timeout: 15000 });
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(800); // let the optimistic temp-row exit animation settle
}

async function gotoStockMovements(page: Page) {
  await page.goto('/m/inventory');
  await page.locator('#inv-tab-movements').click();
}

/** Fills and submits the "Add Stock (Purchase / Goods Inward)" panel for a given item. */
async function addStock(page: Page, itemName: string, qty: string, batchNo?: string) {
  await page.locator('#add-item').click();
  await page.getByRole('option', { name: new RegExp(itemName) }).click();
  if (batchNo) {
    await fillStable(page.locator('#add-batch'), batchNo);
  }
  await fillStable(page.locator('#add-qty'), qty);
  await page.getByRole('button', { name: /add stock to inventory/i }).click();
  await expect(page.getByText(/added to stock/i)).toBeVisible({ timeout: 10000 });
}

test.describe.serial('Stock Movements — Add Stock, Remove/Adjust Stock, Ledger', () => {
  const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);
  const itemA = `SM-Item-A-${suffix}`; // single-batch item, for Add Stock + explicit-batch + auto-FIFO happy path
  const itemB = `SM-Item-B-${suffix}`; // two-batch item, for the "no single batch covers it" guard
  const batchA1 = `BATCH-A1-${suffix}`;
  const batchB1 = `BATCH-B1-${suffix}`;
  const batchB2 = `BATCH-B2-${suffix}`;

  test('setup: create two fresh Medicine items for this suite', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);
    await createTestMedicine(page, itemA);
    await createTestMedicine(page, itemB);
  });

  test('Add Stock: a real purchase increases authoritative stock and appears in the ledger', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await gotoStockMovements(page);

    await addStock(page, itemA, '20', batchA1);

    // The product dropdown's own "N in stock" label is the most direct proof the
    // authoritative balance actually moved, not just that a toast appeared.
    await page.locator('#add-item').click();
    await expect(page.getByRole('option', { name: new RegExp(`${itemA}.*20 in stock`) })).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');

    // The ledger accumulates across every run of this suite, so scope the row lookup by
    // this run's unique item AND batch number together, not just the item name alone.
    const ledgerRow = page.locator('tr').filter({ hasText: itemA }).filter({ hasText: batchA1 });
    await expect(ledgerRow).toBeVisible({ timeout: 10000 });
    await expect(ledgerRow.getByText('PURCHASE IN')).toBeVisible();
  });

  test('Stock Adjustment: deducting from an explicitly chosen batch works and posts to the ledger', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await gotoStockMovements(page);

    await page.locator('#remove-item').click();
    await page.getByRole('option', { name: new RegExp(itemA) }).click();
    await expect(page.getByText(/total authoritative balance.*20/i)).toBeVisible({ timeout: 10000 });

    // Explicitly pick the specific batch rather than leaving it on Auto-FIFO.
    const batchSelect = page.locator('button[role="combobox"]').filter({ hasText: /auto-fifo deduction|batch/i }).last();
    await batchSelect.click();
    await page.getByRole('option', { name: new RegExp(batchA1) }).click();

    // Reason defaults to "Damage" already — no need to touch that selector.
    await fillStable(page.locator('#remove-qty'), '5');
    await page.getByRole('button', { name: /post stock deduction/i }).click();
    await expect(page.getByText(/deducted from stock/i)).toBeVisible({ timeout: 10000 });

    // 20 - 5 = 15 remaining.
    await page.locator('#add-item').click();
    await expect(page.getByRole('option', { name: new RegExp(`${itemA}.*15 in stock`) })).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');

    const ledgerRow = page.locator('tr').filter({ hasText: itemA }).filter({ hasText: batchA1 }).filter({ hasText: 'DAMAGE WRITEOFF' });
    await expect(ledgerRow).toBeVisible({ timeout: 10000 });
  });

  test('Stock Adjustment: leaving "Specific Batch" unselected auto-picks a real batch (the actual bug fix)', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await gotoStockMovements(page);

    await page.locator('#remove-item').click();
    await page.getByRole('option', { name: new RegExp(itemA) }).click();
    await expect(page.getByText(/total authoritative balance.*15/i)).toBeVisible({ timeout: 10000 });

    // Deliberately do NOT touch the "Specific Batch" selector — it must stay on its
    // "Auto-FIFO deduction" placeholder. Before the fix, this always failed server-side
    // with a swallowed error (false "success" toast); now it must genuinely succeed.
    await fillStable(page.locator('#remove-qty'), '3');
    await page.getByRole('button', { name: /post stock deduction/i }).click();

    await expect(page.getByText(/failed to post stock deduction|batch not found/i)).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByText(/deducted from stock/i)).toBeVisible({ timeout: 10000 });

    // 15 - 3 = 12 remaining — proves the deduction actually landed, not just that no
    // error was thrown.
    await page.locator('#add-item').click();
    await expect(page.getByRole('option', { name: new RegExp(`${itemA}.*12 in stock`) })).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
  });

  test('Stock Adjustment: a quantity no single batch can cover is rejected with a clear error, not a crash', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await gotoStockMovements(page);

    // Give itemB two separate small batches (5 + 5 = 10 total) so a request for 8 is
    // within the combined total but exceeds either batch alone.
    await addStock(page, itemB, '5', batchB1);
    await addStock(page, itemB, '5', batchB2);

    await page.locator('#remove-item').click();
    await page.getByRole('option', { name: new RegExp(itemB) }).click();
    await expect(page.getByText(/total authoritative balance.*10/i)).toBeVisible({ timeout: 10000 });

    // Leave "Specific Batch" unselected and ask for more than any one batch holds.
    await fillStable(page.locator('#remove-qty'), '8');
    await page.getByRole('button', { name: /post stock deduction/i }).click();

    await expect(page.getByText(/no single batch has 8/i)).toBeVisible({ timeout: 10000 });
    // Confirms nothing was silently deducted — balance must remain 10.
    await page.locator('#add-item').click();
    await expect(page.getByRole('option', { name: new RegExp(`${itemB}.*10 in stock`) })).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
  });

  test('Ledger: the "Purchases In" / "Manual Adjustments" filters genuinely narrow the list', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await gotoStockMovements(page);

    // itemA has both a PURCHASE IN entry (setup) and DAMAGE WRITEOFF + auto-FIFO
    // ADJUSTMENT OUT entries (previous tests) by this point in the run.
    await expect(page.getByText(itemA).first()).toBeVisible({ timeout: 10000 });

    // Located structurally (not by its current displayed value) — that value changes
    // with every selection below, so a `hasText` filter would stop matching after the
    // first click.
    const filterSelect = page
      .getByText('Auditable Inventory Transaction Ledger')
      .locator('xpath=following::button[@role="combobox"][1]');
    // Scoped to the ledger <table> specifically — the "Add Stock" panel's own static
    // copy ("...records purchase in ledger") also contains the substring "purchase in"
    // and would otherwise falsely satisfy a page-wide getByText match.
    const ledgerTable = page.locator('table');

    await filterSelect.click();
    await page.getByRole('option', { name: 'Purchases In', exact: true }).click();
    await expect(ledgerTable.getByText('PURCHASE IN').first()).toBeVisible({ timeout: 10000 });
    await expect(ledgerTable.getByText('DAMAGE WRITEOFF')).toHaveCount(0);

    await filterSelect.click();
    await page.getByRole('option', { name: 'Manual Adjustments', exact: true }).click();
    await expect(ledgerTable.getByText('DAMAGE WRITEOFF').first()).toBeVisible({ timeout: 10000 });
    await expect(ledgerTable.getByText('PURCHASE IN')).toHaveCount(0);

    await filterSelect.click();
    await page.getByRole('option', { name: 'All Movements', exact: true }).click();
    await expect(ledgerTable.getByText('PURCHASE IN').first()).toBeVisible({ timeout: 10000 });
  });

  test('Ledger: entries survive a full page reload (the server-hydration fix)', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await gotoStockMovements(page);
    await expect(page.getByText(itemA).first()).toBeVisible({ timeout: 10000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.locator('#inv-tab-movements').click();

    // Before the fix, `ledger` reset to [] on every mount — this would be empty here.
    // Scoped to a real table row for this run's item+batch (not just anywhere on the
    // page — the "Add Stock" panel's own static copy also contains "purchase in").
    const ledgerRow = page.locator('tr').filter({ hasText: itemA }).filter({ hasText: batchA1 }).filter({ hasText: 'PURCHASE IN' });
    await expect(ledgerRow).toBeVisible({ timeout: 10000 });
  });
});
