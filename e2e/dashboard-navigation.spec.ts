import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';

test.describe('ERP Dashboard & Module Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should load the dashboard and display navigation sidebar', async ({ page }) => {
    // Check main branding (actual clinic branding, not the old "VetOS ERP" placeholder)
    await expect(page.getByText('Real Care Clinic').first()).toBeVisible();

    // Verify presence of sidebar navigation
    const navHome = page.getByText('Home Dashboard');
    await expect(navHome.first()).toBeVisible();
  });

  test('should allow navigating to core ERP modules', async ({ page }) => {
    const accountingLink = page.locator('a[href*="/m/accounting"], a:has-text("Accounting")').first();
    await expect(accountingLink).toBeVisible();
    await accountingLink.click();
    await expect(page).toHaveURL(/.*accounting.*/i);
  });
});
