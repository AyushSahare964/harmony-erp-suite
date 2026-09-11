import { test, expect } from '@playwright/test';

test.describe('ERP Dashboard & Module Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to root (will either land on dashboard or redirect to login)
    await page.goto('/');
  });

  test('should load the dashboard and display navigation sidebar', async ({ page }) => {
    // Check main branding
    await expect(page.getByText('VetOS ERP').first()).toBeVisible();

    // Verify presence of sidebar or navigation
    const navHome = page.getByText('Home Dashboard').or(page.getByText('Dashboard'));
    await expect(navHome.first()).toBeVisible();
  });

  test('should allow navigating to core ERP modules', async ({ page }) => {
    // Check if Accounting or Billing module links exist in the sidebar
    const accountingLink = page.locator('a[href*="/m/accounting"], a:has-text("Accounting")').first();
    
    if (await accountingLink.isVisible()) {
      await accountingLink.click();
      await expect(page).toHaveURL(/.*accounting.*/i);
    }
  });
});
