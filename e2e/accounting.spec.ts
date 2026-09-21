import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable, gotoReady } from './support/dom-helpers';

const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);

function modalOf(page: Page) {
  return page.locator('div[role="dialog"][data-state="open"]').last();
}

async function openAccounting(page: Page) {
  await loginAsAdmin(page);
  await gotoReady(page, '/m/accounting');
}

test.describe('Accounting & Banking Reconciliation Module', () => {
  test('should load accounting hub and display core financial tabs', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/m/accounting');

    const hasChartOfAccounts = page.getByText(/Chart of Accounts|General Ledger|Trial Balance/i).first();
    await expect(hasChartOfAccounts).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Deep validation coverage for Add Expense, Add Purchase (Supplier Bill), and
// Add Supplier — every required-field error path, not just the happy path
// already covered in e2e/billing-invoicing.spec.ts. Launched here from their
// natural home in the Accounting module (Expenses / Supplier Bills tabs)
// rather than the Billing Desk quick-actions that open the same components.
//
// Two error paths are NOT exercised below and that's deliberate, not an
// oversight: ExpenseFormModal's "Please select an Expense Type." and
// SupplierBillFormModal's "Please select a Supplier Name." both guard a
// Select that auto-picks the first available row the instant its list loads
// (`if (cats.length > 0 && !categoryId) setCategoryId(cats[0]._id)`, and the
// equivalent for suppliers) — by the time a real user could click Save, at
// least one category/supplier already exists in this seeded environment, so
// that branch is unreachable from the UI. It would only fire on a genuinely
// empty install.
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Add Expense — Validation', () => {

  async function openExpenseModal(page: Page) {
    await openAccounting(page);
    await page.locator('#acc-tab-expenses').click();
    await page.getByRole('button', { name: /add expense/i }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    return modal;
  }

  test('rejects a zero/blank Amount', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openExpenseModal(page);
    // Category auto-selects; Paid To/Paid By are untouched — only Amount is missing.
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Amount must be greater than 0.')).toBeVisible({ timeout: 10_000 });
    await expect(modal).toBeVisible();
  });

  test('rejects a blank Paid To with a valid amount', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openExpenseModal(page);
    await fillStable(modal.locator('input[type="number"]').first(), '100'); // Amount
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Please specify Paid To.')).toBeVisible({ timeout: 10_000 });
    await expect(modal).toBeVisible();
  });

  test('rejects a blank Paid By (pre-filled by default, cleared here)', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openExpenseModal(page);
    const textInputs = modal.locator('input[type="text"], input:not([type])');
    await fillStable(modal.locator('input[type="number"]').first(), '100'); // Amount
    await fillStable(textInputs.first(), `Vendor-${suffix}`); // Paid To
    await fillStable(textInputs.nth(2), ''); // Paid By — clear the "Dr. Rohit Sharma" default
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Please specify Paid By.')).toBeVisible({ timeout: 10_000 });
    await expect(modal).toBeVisible();
  });

  test('all fields valid — no error toast, and the modal accepts the save', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openExpenseModal(page);
    const textInputs = modal.locator('input[type="text"], input:not([type])');
    await fillStable(modal.locator('input[type="number"]').first(), '175');
    await fillStable(textInputs.first(), `ValidVendor-${suffix}`);
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Expense saved successfully/i)).toBeVisible({ timeout: 15_000 });
  });

});

test.describe('Add Supplier — Validation', () => {

  async function openSupplierModal(page: Page) {
    await openAccounting(page);
    await page.locator('#acc-tab-supplier-bills').click();
    await page.getByRole('button', { name: /new supplier bill/i }).click();
    const billModal = modalOf(page);
    await expect(billModal).toBeVisible({ timeout: 10_000 });
    await billModal.getByTitle('Add New Supplier').click();
    const supplierModal = modalOf(page);
    await expect(supplierModal).toBeVisible({ timeout: 10_000 });
    return supplierModal;
  }

  test('rejects a blank Company Name', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openSupplierModal(page);
    await fillStable(modal.getByPlaceholder('e.g. 9820011223'), '9820011225'); // Mobile only
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Company Name is required.')).toBeVisible({ timeout: 10_000 });
    await expect(modal).toBeVisible();
  });

  test('rejects a Company Name with no Mobile No. and no Phone No.', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openSupplierModal(page);
    await fillStable(modal.locator('input').first(), `NoContactSupplier-${suffix}`); // Company Name only
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Mobile No. or Phone No. is required.')).toBeVisible({ timeout: 10_000 });
    await expect(modal).toBeVisible();
  });

  test('accepts Company Name + Phone No. alone (Mobile No. is not the only valid contact)', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openSupplierModal(page);
    await fillStable(modal.locator('input').first(), `PhoneOnlySupplier-${suffix}`);
    await fillStable(modal.getByPlaceholder('022-28765432'), '022-40001234'); // Phone No., not Mobile
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/added successfully/i)).toBeVisible({ timeout: 15_000 });
  });

});

test.describe('Add Purchase (Supplier Bill) — Validation', () => {

  async function openPurchaseModal(page: Page) {
    await openAccounting(page);
    await page.locator('#acc-tab-supplier-bills').click();
    await page.getByRole('button', { name: /new supplier bill/i }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    return modal;
  }

  test('"Add Line" rejects a blank Product Name', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openPurchaseModal(page);
    await modal.getByTitle('Add Line').click();
    await expect(page.getByText('Please enter or select a Product Name.')).toBeVisible({ timeout: 10_000 });
    // The empty-state placeholder row should still be showing — nothing was added.
    await expect(modal.getByText(/No particulars added/i)).toBeVisible();
  });

  test('"Add Line" rejects a zero Quantity even with a Product Name filled', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openPurchaseModal(page);
    const productNameInput = modal.locator('input[type="text"], input:not([type])').nth(2); // after P.O. No. + Purchase Bill No.
    await fillStable(productNameInput, `ZeroQtyItem-${suffix}`);
    // Quantity renders as `value={quantity || ""}`, so once the state is really 0 the field
    // shows blank (0 is falsy) — fillStable's "did the value stick" check would never pass
    // here even though the validation below proves the underlying state genuinely is 0.
    const qtyInput = modal.locator('input[type="number"]').nth(0);
    await qtyInput.fill('0');
    await modal.getByTitle('Add Line').click();
    await expect(page.getByText('Quantity must be greater than 0.')).toBeVisible({ timeout: 10_000 });
  });

  test('rejects Save with a blank Purchase Bill No. (auto-filled by default, cleared here)', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openPurchaseModal(page);
    await fillStable(modal.getByPlaceholder('e.g. INV-8821'), '');

    // Still need a line item so the "no lines" check doesn't fire first and mask this one
    const productNameInput = modal.locator('input[type="text"], input:not([type])').nth(2);
    await fillStable(productNameInput, `BillNoItem-${suffix}`);
    await fillStable(modal.locator('input[type="number"]').nth(0), '2');
    await fillStable(modal.locator('input[type="number"]').nth(1), '50');
    await modal.getByTitle('Add Line').click();
    await expect(modal.locator('td', { hasText: `BillNoItem-${suffix}` })).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Please enter Purchase Bill No.')).toBeVisible({ timeout: 10_000 });
    await expect(modal).toBeVisible();
  });

  test('rejects Save with zero line items (Bill No. present, nothing added)', async ({ page }) => {
    test.setTimeout(60_000);
    const modal = await openPurchaseModal(page);
    // Purchase Bill No. auto-fills on open — just try to save with an empty line table.
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Please add at least one line item to the bill.')).toBeVisible({ timeout: 10_000 });
    await expect(modal).toBeVisible();
  });

});
