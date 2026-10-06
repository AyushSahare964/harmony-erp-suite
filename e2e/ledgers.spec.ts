import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { gotoReady } from './support/dom-helpers';

test.describe('Ledgers module', () => {
  test('supplier ledger shows opening row, transactions and closing balance', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoReady(page, '/m/ledgers');

    for (const name of ['Customer', 'Supplier', 'Staff', 'Cash']) {
      await expect(page.getByText(`${name} Ledger`, { exact: true })).toBeVisible();
    }

    await page.locator('#ledger-tile-supplier').click();
    await page.getByPlaceholder(/Search supplier/i).fill('Vivaldi');
    await page.getByRole('button', { name: /Vivaldi/i }).first().click();

    const dialog = page.locator('div[role="dialog"][data-state="open"]');
    await expect(dialog.getByText('Opening Balance')).toBeVisible();
    await expect(dialog.getByText(/Purchase Bill/).first()).toBeVisible();
    await expect(dialog.getByText(/₹ [\d,]+\.\d{2} (Dr|Cr)/).first()).toBeVisible();
  });

  test('cash ledger opens without a party picker', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoReady(page, '/m/ledgers');
    await page.locator('#ledger-tile-cash').click();
    await expect(page.locator('div[role="dialog"]').getByText('Opening Balance')).toBeVisible();
  });

  for (const type of ['customer', 'staff']) {
    test(`${type} ledger: pick first party and load report`, async ({ page }) => {
      await loginAsAdmin(page);
      await gotoReady(page, '/m/ledgers');
        await page.locator(`#ledger-tile-${type}`).click();
      const dialog = page.locator('div[role="dialog"][data-state="open"]');
      await dialog.locator('button.w-full').first().click();
      await expect(dialog.getByText('Opening Balance')).toBeVisible();
      await expect(dialog.getByText(/₹ [\d,]+\.\d{2} (Dr|Cr)/).first()).toBeVisible();
    });
  }
});
