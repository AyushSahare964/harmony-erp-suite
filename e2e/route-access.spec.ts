import { test, expect } from '@playwright/test';
import { registerAndApproveRole } from './support/auth-helpers';

test.describe('Role-Based URL Access Control', () => {
  test('a Reception-role user is redirected away from Accounting and Identity module URLs typed directly', async ({ page, browser }) => {
    test.setTimeout(90000);
    await registerAndApproveRole(browser, page, 'reception');

    // Shell now gates module routes against roleModules(role) — the same mapping the sidebar
    // nav already used to decide which links to show — so a direct URL visit to a module
    // outside that list redirects home instead of rendering the module.
    await page.goto('/m/accounting');
    await expect(page).toHaveURL('/', { timeout: 15000 });

    await page.goto('/m/identity');
    await expect(page).toHaveURL('/', { timeout: 15000 });
  });

  test('an Accounts-role user can still reach the Accounting module normally', async ({ page, browser }) => {
    test.setTimeout(90000);
    await registerAndApproveRole(browser, page, 'accounts');

    await page.goto('/m/accounting');
    await expect(page).toHaveURL(/\/m\/accounting/, { timeout: 15000 });
    await expect(page.getByText(/financial dashboard/i).first()).toBeVisible({ timeout: 15000 });
  });
});
