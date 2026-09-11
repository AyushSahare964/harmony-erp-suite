import { test, expect } from '@playwright/test';

test.describe('Accounting & Banking Reconciliation Module', () => {
  test('should load accounting hub and display core financial tabs', async ({ page }) => {
    await page.goto('/m/accounting');

    // Wait for the accounting view to load
    await expect(page.locator('body')).toBeVisible();

    // Verify key accounting tabs/headers exist if on accounting route
    const hasChartOfAccounts = page.getByText(/Chart of Accounts|General Ledger|Trial Balance/i).first();
    await expect(hasChartOfAccounts).toBeVisible();
  });
});
