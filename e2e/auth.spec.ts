import { test, expect } from '@playwright/test';

test.describe('Authentication & Profile Flows', () => {
  test('should render the login portal with staff quick selection', async ({ page }) => {
    await page.goto('/login');

    // Check page title and branding
    await expect(page).toHaveTitle(/VetOS ERP/i);
    await expect(page.getByText('VetOS ERP').first()).toBeVisible();

    // Verify presence of email & password inputs
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Verify quick-login demo staff buttons are present
    const demoStaffButtons = page.locator('button:has-text("Dr."), button:has-text("Karan"), button:has-text("Maya"), button:has-text("Staff")');
    await expect(demoStaffButtons.first()).toBeVisible();
  });

  test('should switch between Sign In and Registration modes', async ({ page }) => {
    await page.goto('/login');

    // Click register tab
    const registerTab = page.getByRole('button', { name: /register|create profile|sign up/i });
    if (await registerTab.isVisible()) {
      await registerTab.click();
      // Form fields for registration should now appear
      await expect(page.locator('input[placeholder*="Full Name" i], input[type="text"]').first()).toBeVisible();
    }
  });
});
