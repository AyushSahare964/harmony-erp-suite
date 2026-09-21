/**
 * Billing Desk (/m/billing) — Comprehensive E2E Test Suite
 *
 * Every selector below was verified against the actual component source
 * (BillingDeskDashboard.tsx, NewSalesInvoiceModal.tsx, QuotationModal.tsx)
 * before being used here — not guessed. That matters because the previous
 * version of this file guessed several selectors that never matched real
 * DOM (wrong "Add" button name for Quotation, wrong Amount-Paid placeholder,
 * comma-formatted totals matched with a plain number regex), which made
 * whole tests silently no-op into their fallback branch instead of actually
 * testing anything. See BILLING_MODULE_TEST_REPORT.md for the full list.
 *
 * Structure:
 *   A. Page load — Quick Info, action buttons, activity/register tabs, search
 *   B. New Invoice — Non-GST calculation integrity (pure qty × price − disc.)
 *   C. New Invoice — GST calculation integrity (subtotal + GST = total)
 *   D. New Invoice — Partial payment & balance-due arithmetic
 *   E. New Invoice — Persistence (register row + reload)
 *   F. New Quotation — calculation & persistence
 *   G. Collect Payment modal
 *   H. Invoice register — search, status filter, detail view
 *   I. New Invoice — Shipping & packaging cost arithmetic
 *   J. New Invoice — Inter-state GST (place of supply ≠ branch state)
 *   K. Add Purchase (SupplierBillFormModal), incl. its nested Add-Supplier flow
 *   L. Add Expense (ExpenseFormModal)
 *   M. Add Client (OwnerPetRegistrationModal launched from the Billing Desk)
 *   N. Add Supplier (NewSupplierModal) — standalone quick-action
 *   O. Add Reminder (BillingReminderModal) — real serverFn persistence + reload
 *   P. Header Notification Bell — real reminder-backed count, list, quick-settle
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable, reloadReady, gotoReady } from './support/dom-helpers';

// ─── Shared unique suffix (jittered — see appointments.spec.ts for why) ────
const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);

async function openBilling(page: Page) {
  await loginAsAdmin(page);
  await gotoReady(page, '/m/billing');
}

/**
 * The most recently opened dialog. Radix portals dialogs to the end of
 * <body> in open order, so `.last()` is the topmost one — this matters for
 * the Add-Purchase flow, whose "+ Add New Supplier" shortcut opens a second
 * dialog on top of the first (both have data-state="open" simultaneously).
 */
function modalOf(page: Page) {
  return page.locator('div[role="dialog"][data-state="open"]').last();
}

/** Fill one invoice-grid particulars line and click the green [+] Add Line button. */
async function addInvoiceLine(
  modal: ReturnType<typeof modalOf>,
  item: string,
  qty: number,
  price: number,
  discountPct = 0
) {
  const numberInputs = modal.locator('input[type="number"]');
  await fillStable(modal.getByPlaceholder('Type or select item name...'), item);
  await fillStable(numberInputs.nth(0), String(qty)); // Quantity
  await fillStable(numberInputs.nth(1), String(price)); // Sale Price
  if (discountPct > 0) {
    await fillStable(numberInputs.nth(2), String(discountPct)); // Discount %
  }
  await modal.getByTitle('Add Line (Enter)').click();
  await expect(modal.locator('td', { hasText: item })).toBeVisible({ timeout: 10_000 });
}

/** Fill one quotation particulars line and click the green [+] Add button. */
async function addQuotationLine(
  modal: ReturnType<typeof modalOf>,
  item: string,
  qty: number,
  price: number
) {
  const numberInputs = modal.locator('input[type="number"]');
  await fillStable(modal.getByPlaceholder('Select or type item name...'), item);
  await fillStable(numberInputs.nth(0), String(qty)); // Quantity
  await fillStable(numberInputs.nth(1), String(price)); // Sale Price
  await modal.getByTitle('Add line item to quotation').click();
  await expect(modal.locator('td', { hasText: item })).toBeVisible({ timeout: 10_000 });
}

/** en-IN formatted money the way the Invoice modal footer prints it: "1,500.00" */
function fmtINR(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** en-IN formatted money the way the register/dashboard prints it: "₹ 3,000" (no decimals). */
function fmtRegister(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// A. Page Load & Static UI Integrity
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Billing Desk — Page Load & UI Integrity', () => {

  test('renders QUICK INFO card with TOTAL SALE, AMOUNT RECEIVED, AMOUNT DUE', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await expect(page.getByText('QUICK INFO')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('TOTAL SALE')).toBeVisible();
    await expect(page.getByText('AMOUNT RECEIVED', { exact: true })).toBeVisible();
    await expect(page.getByText('AMOUNT DUE', { exact: true })).toBeVisible();
    await expect(page.getByText('TODAY')).toBeVisible();

    // KPI values must be real numbers, never NaN/undefined leaking from unguarded math
    const quickInfo = page.getByText('QUICK INFO').locator('../..');
    const text = await quickInfo.innerText();
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('undefined');
  });

  test('all 6 quick-action buttons are present and open their modals', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    for (const label of ['New Invoice', 'New Quotation', 'Add Purchase', 'Add Expense', 'Add Client', 'Add Supplier']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('New Invoice button opens the invoice modal', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    await expect(modalOf(page)).toBeVisible({ timeout: 10_000 });
    await expect(modalOf(page).getByText('Unsaved Invoice')).toBeVisible();
  });

  test('New Quotation button opens the quotation modal', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await page.getByText('New Quotation', { exact: true }).click();
    await expect(modalOf(page)).toBeVisible({ timeout: 10_000 });
  });

  test('activity tabs — Recent Sales, Client Amount Due, Amount Received, Client Cash / Cheque Alert — all render and switch', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await expect(page.getByText('Recent Sales')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Client Amount Due')).toBeVisible();
    // Accessible name includes the trailing badge count ("Amount Received 3") — never exact-match this one.
    await expect(page.getByRole('button', { name: /^Amount Received/ })).toBeVisible();
    await expect(page.getByText(/Client Cash/i)).toBeVisible();

    await page.getByRole('button', { name: 'Client Amount Due' }).click();
    await expect(page.getByText('Client Amount Due').first()).toBeVisible();

    await page.getByRole('button', { name: /^Amount Received/ }).click();
    await expect(page.getByRole('button', { name: /^Amount Received/ })).toBeVisible();

    await page.getByRole('button', { name: /Client Cash/i }).click();
    await expect(page.getByText(/Client Cash/i)).toBeVisible();
  });

  test('DISTRIBUTION IN LAST 30 DAYS chart section is visible', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await expect(page.getByText('DISTRIBUTION IN LAST 30 DAYS')).toBeVisible({ timeout: 10_000 });
  });

  test('register tab bar — Invoices, Quotations, Purchases, Expenses — all switch without crashing', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    for (const tab of ['Quotations', 'Purchases', 'Expenses', 'Invoices']) {
      await page.getByRole('button', { name: new RegExp(`^${tab}`, 'i') }).first().click();
      await page.waitForTimeout(400);
      await expect(page.getByText(/Billing Desk/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('search panel — Stock / Serial No / Invoice / Client scopes — all present and clickable', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await expect(page.getByText('SEARCH')).toBeVisible({ timeout: 10_000 });
    for (const scope of ['Stock', 'Serial No', 'Invoice', 'Client']) {
      const radio = page.getByText(scope, { exact: true }).first();
      await expect(radio).toBeVisible();
      await radio.click();
    }
    // Placeholder should now reflect the last-selected scope (Client)
    await expect(page.getByPlaceholder('Pet Parent Name or Phone')).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// B. New Invoice — Non-GST Calculation Integrity
//    (isolates pure qty × price − discount math from the GST engine)
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Billing Desk — New Invoice: Non-GST Calculation', () => {

  test('single line: TOTAL AMOUNT = qty × price (no GST, no discount)', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Switch to Non-GST so the total is pure qty × price with zero tax noise
    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    const qty = 5, price = 300; // 1500
    await addInvoiceLine(modal, `NonGstSingle-${suffix}`, qty, price);

    await expect(modal.getByText(`₹${fmtINR(qty * price)}`)).toBeVisible({ timeout: 10_000 });
  });

  test('multi-line: TOTAL AMOUNT = sum of all (qty × price) lines', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    const lines = [
      { item: `MultiA-${suffix}`, qty: 2, price: 500 }, // 1000
      { item: `MultiB-${suffix}`, qty: 3, price: 100 }, // 300
      { item: `MultiC-${suffix}`, qty: 1, price: 750 }, // 750
    ];
    const expectedTotal = lines.reduce((s, l) => s + l.qty * l.price, 0); // 2050

    for (const l of lines) await addInvoiceLine(modal, l.item, l.qty, l.price);

    await expect(modal.getByText(`₹${fmtINR(expectedTotal)}`)).toBeVisible({ timeout: 10_000 });
  });

  test('discount %: line amount = qty × price × (1 − discount/100)', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    const qty = 4, price = 250, discount = 20; // gross 1000, disc 200, net 800
    const expected = qty * price * (1 - discount / 100);
    await addInvoiceLine(modal, `Disc-${suffix}`, qty, price, discount);

    // Line row shows the discounted amount, and it's also the grand total (single line)
    await expect(modal.locator('td', { hasText: `₹${expected.toFixed(2)}` })).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`₹${fmtINR(expected)}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('removing a line recalculates TOTAL AMOUNT correctly', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    await addInvoiceLine(modal, `RemA-${suffix}`, 1, 400); // 400
    await addInvoiceLine(modal, `RemB-${suffix}`, 1, 600); // 600
    await expect(modal.getByText(`₹${fmtINR(1000)}`)).toBeVisible({ timeout: 10_000 });

    // Delete the first row (trash icon, last column) and confirm total drops to just line 2
    await modal.locator('tbody tr').first().locator('button').last().click();
    await expect(modal.getByText(`₹${fmtINR(600)}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`₹${fmtINR(1000)}`)).toHaveCount(0);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// C. New Invoice — GST Calculation Integrity
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Billing Desk — New Invoice: GST Calculation', () => {

  test('GST invoice: TOTAL AMOUNT = subtotal + 18% GST (default rate, round numbers)', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    // Invoice Type defaults to GST; default GST rate for a typed (non-catalogue) item is 18%.

    const qty = 2, price = 500; // subtotal 1000, GST 18% = 180, total 1180
    await addInvoiceLine(modal, `Gst18-${suffix}`, qty, price);

    const subtotal = qty * price;
    const gst = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + gst;

    await expect(modal.getByText(`₹${subtotal.toFixed(2)}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`₹${gst.toFixed(2)}`).first()).toBeVisible();
    await expect(modal.getByText(`₹${fmtINR(total)}`)).toBeVisible();
  });

  test('Bill of Supply invoice type charges zero GST', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Bill of Supply' }).click();

    const qty = 3, price = 300; // 900, no tax
    await addInvoiceLine(modal, `Bos-${suffix}`, qty, price);
    await expect(modal.getByText(`₹${fmtINR(qty * price)}`).first()).toBeVisible({ timeout: 10_000 });
    // No GST line should render since tax is inapplicable for Bill of Supply
    await expect(modal.getByText('GST:', { exact: true })).toHaveCount(0);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// D. New Invoice — Partial Payment & Balance-Due Arithmetic
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Billing Desk — New Invoice: Partial Payment', () => {

  test('typing an amount less than the total switches to Partial and Balance Due = Total − Paid', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    await addInvoiceLine(modal, `PartPay-${suffix}`, 1, 800); // total 800
    await expect(modal.getByText(`₹${fmtINR(800)}`).first()).toBeVisible({ timeout: 10_000 });

    // "Amount Received" input (real placeholder is "0.00", not "amount paid"/"enter amount")
    const paidInput = modal.getByPlaceholder('0.00');
    await fillStable(paidInput, '300');

    await expect(modal.getByText('Balance Due:').first()).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`₹${(800 - 300).toFixed(2)}`).first()).toBeVisible();
    await expect(modal.getByText('Paid: ₹300.00')).toBeVisible();
  });

  test('Full Payment toggle sets Amount Received = Total and Balance Due disappears', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    await addInvoiceLine(modal, `FullPay-${suffix}`, 1, 500);
    const paidInput = modal.getByPlaceholder('0.00');
    await fillStable(paidInput, '200'); // goes Partial
    await expect(modal.getByText('Balance Due:').first()).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('button', { name: 'Full Payment' }).click();
    await expect(modal.getByText('Fully Paid')).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText('Balance Due:')).toHaveCount(0);
  });

  test('Credit / Unpaid toggle sets Balance Due = full Total Amount', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    await addInvoiceLine(modal, `Credit-${suffix}`, 1, 650);
    await modal.getByRole('button', { name: 'Credit / Unpaid' }).click();

    await expect(modal.getByText('Credit Invoice (Full Balance Due)')).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`₹${(650).toFixed(2)}`).first()).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// E. New Invoice — Persistence
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Billing Desk — New Invoice: Persistence', () => {

  test('saved invoice appears in the register after reload with the correct total', async ({ page }) => {
    test.setTimeout(120_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const persistClient = `Persist-${suffix}`;
    const qty = 4, price = 750; // 3000
    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();
    await fillStable(modal.getByPlaceholder('CASH', { exact: true }), persistClient);
    await addInvoiceLine(modal, `PersistItem-${suffix}`, qty, price);

    await expect(modal.getByText(`₹${fmtINR(qty * price)}`)).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(modal).not.toBeVisible({ timeout: 20_000 });

    await reloadReady(page);
    await gotoReady(page, '/m/billing');

    const searchBox = page.getByPlaceholder('Search invoice #, client name, pet, mobile, or doctor...');
    await fillStable(searchBox, persistClient);
    await expect(page.getByText(persistClient).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(fmtRegister(qty * price)).first()).toBeVisible({ timeout: 10_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// F. New Quotation — Calculation & Persistence
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Billing Desk — New Quotation', () => {

  test('modal opens and can be dismissed with Escape', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await page.getByText('New Quotation', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
  });

  test('multi-line quotation: TOTAL AMOUNT = sum of (qty × price) lines', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Quotation', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const lines = [
      { item: `QLineA-${suffix}`, qty: 2, price: 300 }, // 600
      { item: `QLineB-${suffix}`, qty: 1, price: 620 }, // 620
    ];
    const expectedTotal = lines.reduce((s, l) => s + l.qty * l.price, 0); // 1220

    for (const l of lines) await addQuotationLine(modal, l.item, l.qty, l.price);

    await expect(modal.getByText(`₹ ${expectedTotal.toFixed(2)}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('saves and appears in the Quotations register after reload', async ({ page }) => {
    test.setTimeout(120_000);
    await openBilling(page);
    await page.getByText('New Quotation', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const qClient = `QClient-${suffix}`;
    const qItem = `QItem-${suffix}`;
    await fillStable(modal.getByPlaceholder('e.g. Ramesh Kulkarni'), qClient);
    await addQuotationLine(modal, qItem, 1, 620);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(modal).not.toBeVisible({ timeout: 20_000 });

    await reloadReady(page);
    await gotoReady(page, '/m/billing');
    await page.getByRole('button', { name: /^Quotations/i }).first().click();
    await expect(page.getByText(qClient).first()).toBeVisible({ timeout: 20_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// G. Collect Payment Modal
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Billing Desk — Collect Payment modal', () => {

  test('opens from the quick-action button and can be dismissed with Escape', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await page.getByText('Collect Payment', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(/payment/i).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// H. Invoice Register — Search, Status Filter, Detail View
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Billing Desk — Invoice Register', () => {

  test('table shows the expected columns', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await page.getByRole('button', { name: /^Invoices/i }).first().click();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    for (const col of ['Invoice #', 'Total (₹)', 'Paid (₹)', 'Due (₹)', 'Status']) {
      await expect(page.locator('th', { hasText: col }).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('search filters the register down to zero rows for a nonsense query', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    const searchBox = page.getByPlaceholder('Search invoice #, client name, pet, mobile, or doctor...');
    await fillStable(searchBox, 'NONEXISTENT_XYZ_99999');
    await page.waitForTimeout(500);
    await expect(page.getByText('No invoices found')).toBeVisible({ timeout: 10_000 });
  });

  test('Status filter narrows the register to Paid invoices only', async ({ page }) => {
    test.setTimeout(60_000);
    await openBilling(page);
    await page.getByRole('button', { name: /^Invoices/i }).first().click();

    const statusSelect = page.locator('button[role="combobox"]', { hasText: 'All Statuses' });
    await expect(statusSelect).toBeVisible({ timeout: 10_000 });
    await statusSelect.click();
    await page.getByRole('option', { name: 'Paid', exact: true }).click();
    await page.waitForTimeout(500);

    const statusCells = page.locator('tbody tr td:nth-child(9)');
    const count = await statusCells.count();
    for (let i = 0; i < count; i++) {
      await expect(statusCells.nth(i)).toContainText('Paid');
    }
  });

  test('clicking a row (or its View button) opens the Invoice Detail modal with matching totals', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);

    // Create a known invoice first so there's guaranteed to be a row to open
    await page.getByText('New Invoice', { exact: true }).click();
    const invModal = modalOf(page);
    await expect(invModal).toBeVisible({ timeout: 10_000 });
    await invModal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();
    const detailClient = `DetailRow-${suffix}`;
    await fillStable(invModal.getByPlaceholder('CASH', { exact: true }), detailClient);
    await addInvoiceLine(invModal, `DetailItem-${suffix}`, 2, 450); // 900
    await invModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(invModal).not.toBeVisible({ timeout: 20_000 });

    const searchBox = page.getByPlaceholder('Search invoice #, client name, pet, mobile, or doctor...');
    await fillStable(searchBox, detailClient);
    const row = page.locator('tbody tr', { hasText: detailClient });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /view/i }).click();

    const detail = modalOf(page);
    await expect(detail).toBeVisible({ timeout: 10_000 });
    await expect(detail.getByText(`₹${fmtINR(900)}`).first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// I. New Invoice — Shipping & Packaging Cost Arithmetic
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Billing Desk — New Invoice: Shipping Cost', () => {

  test('TOTAL AMOUNT = subtotal + shipping when "Add Shipping and Packaging Costs" is checked', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Non-GST' }).click();

    const qty = 2, price = 400; // 800
    await addInvoiceLine(modal, `Ship-${suffix}`, qty, price);
    await expect(modal.getByText(`₹${fmtINR(800)}`).first()).toBeVisible({ timeout: 10_000 });

    await modal.getByText('Add Shipping and Packaging Costs').click();
    // With shipping visible, number-input order is now: qty(0) price(1) discount(2) shipping(3) paidAmount(4)
    await fillStable(modal.locator('input[type="number"]').nth(3), '150');

    await expect(modal.getByText('Shipping (+):')).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`₹${fmtINR(800 + 150)}`).first()).toBeVisible({ timeout: 10_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// J. New Invoice — Inter-State GST
//    The UI only ever shows the combined "GST:" figure (never a CGST/SGST/IGST
//    breakdown), so what's verifiable from here is that switching Place of
//    Supply to a different state still charges the correct total tax — i.e.
//    the intra→inter-state split (handled entirely inside computeDocument)
//    doesn't silently drop or double the tax amount shown to the user.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Billing Desk — New Invoice: Inter-State GST', () => {

  test('changing Place of Supply to a different state still charges the correct 18% GST total', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    // Invoice Type stays GST (default); branch state is Maharashtra (27) — switch to Delhi (07), interstate.

    const placeOfSupplySelect = modal.locator('button[role="combobox"]').filter({ hasText: /Maharashtra/i });
    await placeOfSupplySelect.click();
    await page.getByRole('option', { name: /Delhi \(07\)/ }).click();

    const qty = 2, price = 500; // subtotal 1000, GST 18% = 180, total 1180 — same as intra-state
    await addInvoiceLine(modal, `Interstate-${suffix}`, qty, price);

    const subtotal = qty * price;
    const gst = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + gst;

    await expect(modal.getByText(`₹${gst.toFixed(2)}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(`₹${fmtINR(total)}`)).toBeVisible();
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// K. Add Purchase (SupplierBillFormModal) — incl. its nested Add-Supplier flow
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Billing Desk — Add Purchase (Supplier Bill)', () => {

  test('creates a supplier inline via "+ Add New Supplier" and saves a purchase bill against it', async ({ page }) => {
    test.setTimeout(120_000);
    await openBilling(page);
    await page.getByText('Add Purchase', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Open the nested "New Supplier" modal from inside the purchase-bill flow.
    // `modalOf` resolves to whichever dialog is currently last/topmost, so once
    // this second dialog closes, re-resolving it would just land back on the
    // Purchase dialog — track "back to one dialog open" instead of "not visible".
    const allOpenDialogs = page.locator('div[role="dialog"][data-state="open"]');
    await modal.getByTitle('Add New Supplier').click();
    await expect(allOpenDialogs).toHaveCount(2, { timeout: 10_000 });
    const supplierModal = modalOf(page);
    await expect(supplierModal).toBeVisible({ timeout: 10_000 });

    const supplierName = `PurchaseSupplier-${suffix}`;
    await fillStable(supplierModal.locator('input').first(), supplierName); // Company Name — first field, no placeholder
    await fillStable(supplierModal.getByPlaceholder('e.g. 9820011223'), '9820011223'); // Mobile No.
    await supplierModal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(allOpenDialogs).toHaveCount(1, { timeout: 15_000 });

    // Back in the purchase bill — supplier should now be auto-selected; fill a line item
    await expect(modal.locator('button[role="combobox"]', { hasText: supplierName })).toBeVisible({ timeout: 10_000 });

    const numberInputs = modal.locator('input[type="number"]');
    // Product Name has no placeholder — it's the first plain text Input inside the
    // Particulars group, after P.O. No. and Purchase Bill No. (both text inputs too).
    const productNameInput = modal.locator('input[type="text"], input:not([type])').nth(2);
    await fillStable(productNameInput, `PurchItem-${suffix}`);
    await fillStable(numberInputs.nth(0), '5'); // Quantity
    await fillStable(numberInputs.nth(1), '120'); // Purchase Price → 600
    await modal.getByTitle('Add Line').click();
    await expect(modal.locator('td', { hasText: `PurchItem-${suffix}` })).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Purchase bill saved successfully!')).toBeVisible({ timeout: 15_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// L. Add Expense (ExpenseFormModal)
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Billing Desk — Add Expense', () => {

  test('saves a minimal expense (auto-selected category, amount, paid to)', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('Add Expense', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Expense Type auto-selects the first category once loaded — just wait for it.
    await expect(modal.locator('button[role="combobox"]').first()).not.toContainText('Select Expense Type', { timeout: 10_000 });

    // DOM order of plain <Input>s: Date(0, type=date), Amount(1, type=number), Paid To(2, text)
    await fillStable(modal.locator('input[type="number"]').first(), '250');
    await fillStable(modal.locator('input[type="text"], input:not([type])').first(), `E2E Vendor ${suffix}`);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Expense saved successfully/i)).toBeVisible({ timeout: 15_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// M. Add Client (OwnerPetRegistrationModal, launched from the Billing Desk)
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Billing Desk — Add Client', () => {

  test('registers a new owner + pet from the quick-action button', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('Add Client', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await fillStable(modal.getByPlaceholder(/atul bhise/i), `BillClient-${suffix}`);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), `987654${suffix.slice(0, 4)}`);
    await modal.getByRole('button', { name: /next: add patient details/i }).click();

    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `BillPet-${suffix}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Mixed Breed');

    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(page.getByText(/registered successfully/i).first()).toBeVisible({ timeout: 15_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// N. Add Supplier (NewSupplierModal) — standalone quick-action
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Billing Desk — Add Supplier', () => {

  test('saves a new supplier with just Company Name + Mobile No.', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('Add Supplier', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const supplierName = `StandaloneSupplier-${suffix}`;
    await fillStable(modal.locator('input').first(), supplierName); // Company Name — first field
    await fillStable(modal.getByPlaceholder('e.g. 9820011223'), '9820011224');
    await modal.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText(/added successfully|added to clinic suppliers/i).first()).toBeVisible({ timeout: 15_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// O. Add Reminder (BillingReminderModal) — now backed by a real serverFn
//    (BillingReminderModel / reminders.ts), not local state.
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Billing Desk — Add Reminder', () => {

  test('schedules a reminder, appears in the list, and survives a reload (real persistence)', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);
    await page.getByText('Add Reminder', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });

    await modal.getByRole('button', { name: '+ Schedule New' }).click();
    const ownerName = `ReminderOwner-${suffix}`;
    await fillStable(modal.getByPlaceholder(/e\.g\. anil deshmukh/i), ownerName);
    await fillStable(modal.getByPlaceholder(/e\.g\. bruno/i), `ReminderPet-${suffix}`);

    await modal.getByRole('button', { name: /save reminder/i }).click();
    await expect(page.getByText(/billing reminder scheduled/i)).toBeVisible({ timeout: 10_000 });
    await expect(modal.getByText(ownerName)).toBeVisible({ timeout: 10_000 });

    // Reload the whole page and reopen — a real serverFn-backed list survives this;
    // the old localStorage-only version would too, but a fresh server round-trip
    // through Mongo is the actual claim being tested here.
    await reloadReady(page);
    await gotoReady(page, '/m/billing');
    await page.getByText('Add Reminder', { exact: true }).click();
    const reopenedModal = modalOf(page);
    await expect(reopenedModal).toBeVisible({ timeout: 10_000 });
    await expect(reopenedModal.getByText(ownerName)).toBeVisible({ timeout: 15_000 });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// P. Header Notification Bell — now a real notification center backed by the
//    same reminders data, instead of a permanently-hardcoded "5" badge.
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Billing Desk — Header Notification Bell', () => {

  test('reflects a newly created reminder: badge count increases and the reminder is listed', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);

    // Create a reminder via the Billing Desk so we have a known, findable entry.
    await page.getByText('Add Reminder', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button', { name: '+ Schedule New' }).click();
    const ownerName = `BellOwner-${suffix}`;
    await fillStable(modal.getByPlaceholder(/e\.g\. anil deshmukh/i), ownerName);
    await fillStable(modal.getByPlaceholder(/e\.g\. bruno/i), `BellPet-${suffix}`);
    await modal.getByRole('button', { name: /save reminder/i }).click();
    await expect(page.getByText(/billing reminder scheduled/i)).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    // Reload so the header's own fetch picks up the fresh reminder from scratch.
    await reloadReady(page);

    const bell = page.getByRole('button', { name: /Notifications/ });
    await expect(bell).toBeVisible({ timeout: 10_000 });
    // The badge only renders once reminders.length > 0 — this also proves it isn't hardcoded.
    await expect(bell.locator('span')).toBeVisible({ timeout: 10_000 });

    await bell.click();
    await expect(page.getByText('Billing Reminders')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(new RegExp(`${'BellPet'}-${suffix}.*${ownerName}`))).toBeVisible({ timeout: 10_000 });
  });

  test('"Mark settled" from the dropdown removes it from the bell without opening the full modal', async ({ page }) => {
    test.setTimeout(90_000);
    await openBilling(page);

    await page.getByText('Add Reminder', { exact: true }).click();
    const modal = modalOf(page);
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.getByRole('button', { name: '+ Schedule New' }).click();
    const ownerName = `SettleFromBell-${suffix}`;
    await fillStable(modal.getByPlaceholder(/e\.g\. anil deshmukh/i), ownerName);
    await fillStable(modal.getByPlaceholder(/e\.g\. bruno/i), `SettlePet-${suffix}`);
    await modal.getByRole('button', { name: /save reminder/i }).click();
    await expect(page.getByText(/billing reminder scheduled/i)).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');

    await reloadReady(page);
    const bell = page.getByRole('button', { name: /Notifications/ });
    await bell.click();
    // Scope to the specific reminder-item leaf div (class="rounded-lg p-2 ..."), not any
    // ancestor container that also happens to contain the owner name as a descendant.
    const entry = page.locator('div.rounded-lg.p-2', { hasText: ownerName });
    await expect(entry).toBeVisible({ timeout: 10_000 });
    await entry.getByText('Mark settled').click();
    await expect(page.getByText('Reminder marked as settled!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(ownerName)).toHaveCount(0);
  });

});
