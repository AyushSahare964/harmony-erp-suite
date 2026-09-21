import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable } from './support/dom-helpers';

test.describe('Printing: Prescription & Invoice PDF, and the "Save and Print" gap', () => {
  test('finalized visit: Download PDF (Rx) and Print Invoice open a real formatted popup window', async ({ page }) => {
    test.setTimeout(90000);
    const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);
    const petName = `PrintFlow-${suffix}`;

    await loginAsAdmin(page);
    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const regModal = page.locator('div[role="dialog"][data-state="open"]');
    await fillStable(regModal.getByPlaceholder(/atul bhise/i), `${petName} Owner`);
    await fillStable(regModal.getByPlaceholder(/98230 11221/i), `9${suffix}00`.slice(0, 10));
    await regModal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(regModal.getByPlaceholder(/^e\.g\. bruno$/i), petName);
    await fillStable(regModal.getByPlaceholder(/labrador retriever/i), 'Labrador Retriever');
    await regModal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(regModal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await regModal.getByRole('button', { name: /admit to opd consultation/i }).click();

    const workspace = page.locator('div[role="dialog"][data-state="open"]');
    await expect(workspace).toBeVisible({ timeout: 15000 });
    await workspace.getByRole('button', { name: /proceed to billing & settlement/i }).click();
    await expect(workspace.getByText(/billing & settlement/i).first()).toBeVisible({ timeout: 15000 });

    const finalizeBtn = workspace.getByRole('button', { name: /finalize.*✓|collect partial.*✓/i });
    await finalizeBtn.click();
    await expect(workspace.getByText(/visit finalized & settled/i)).toBeVisible({ timeout: 15000 });

    const [rxPopup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }),
      workspace.getByRole('button', { name: /download pdf/i }).first().click(),
    ]);
    await rxPopup.waitForLoadState();
    await expect(rxPopup.getByText(petName).first()).toBeVisible({ timeout: 10000 });
    await rxPopup.close();

    const [invoicePopup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }),
      workspace.getByRole('button', { name: /print invoice/i }).first().click(),
    ]);
    await invoicePopup.waitForLoadState();
    await expect(invoicePopup.getByText(petName).first()).toBeVisible({ timeout: 10000 });
    await invoicePopup.close();
  });

  test('New Sales Invoice "Save and Print" now shows the real formatted InvoicePrintView (previously called raw window.print() on the live form)', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/billing');
    await page.getByText('New Invoice', { exact: true }).click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();

    const itemName = `PrintFix-${Date.now()}`;
    await fillStable(modal.getByPlaceholder('CASH', { exact: true }), `PrintFixClient-${Date.now()}`);
    await fillStable(modal.getByPlaceholder(/type or select item name/i), itemName);
    await fillStable(modal.locator('input[type="number"]').nth(0), '1');
    await fillStable(modal.getByPlaceholder('0', { exact: true }).first(), '100');
    await modal.getByTitle(/add line/i).click();
    await modal.getByRole('button', { name: /save and print/i }).click();

    // The modal should now swap to the formatted print view (same component finalized
    // clinical invoices use), not a raw print of the unstyled form.
    await expect(page.getByText(/tax invoice \(gst\)|commercial receipt/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#invoice-printable-area').getByText(itemName)).toBeVisible();

    const [invoicePopup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }),
      page.getByRole('button', { name: /print invoice/i }).click(),
    ]);
    await invoicePopup.waitForLoadState();
    await expect(invoicePopup.getByText(itemName).first()).toBeVisible({ timeout: 10000 });
    await invoicePopup.close();
  });

  test('Quotation "Save and Print" now shows the real formatted QuotationPrintView', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/billing');
    await page.getByText('New Quotation', { exact: true }).click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();

    const itemName = `QuotePrintFix-${Date.now()}`;
    await fillStable(modal.getByPlaceholder(/e\.g\. ramesh kulkarni/i), `QuotePrintClient-${Date.now()}`);
    await fillStable(modal.getByPlaceholder(/select or type item name/i), itemName);
    await fillStable(modal.getByPlaceholder('0', { exact: true }).first(), '250');
    await modal.getByRole('button', { name: /add/i }).first().click();
    await modal.getByRole('button', { name: /save and print/i }).click();

    await expect(page.getByText(/^quotation —/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#quotation-printable-area').getByText(itemName)).toBeVisible();
  });
});
