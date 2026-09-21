import { test, expect } from '@playwright/test';
import { gotoReady } from './support/dom-helpers';

test.describe('Authentication & Profile Flows', () => {
  test('should render the login portal with correct branding and demo-seed action', async ({ page }) => {
    await gotoReady(page, '/login');

    // Check page title and branding (actual clinic branding, not the old "VetOS ERP" placeholder)
    await expect(page).toHaveTitle(/Real Care Clinic/i);
    await expect(page.getByText('Real Care Clinic').first()).toBeVisible();

    // Verify presence of email & password inputs
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // The login page no longer renders quick-login demo staff buttons, but it does have a
    // MongoDB Atlas demo-seed action — check that instead of the removed feature.
    await expect(page.getByRole('button', { name: /mongodb atlas/i })).toBeVisible();
  });

  test('should switch between Sign In and Registration modes', async ({ page }) => {
    await gotoReady(page, '/login');

    const registerTab = page.getByRole('button', { name: /^register$/i });
    await expect(registerTab).toBeVisible();
    await registerTab.click();

    // Form fields for registration should now appear
    await expect(page.getByPlaceholder(/dr\. rajesh mehra/i)).toBeVisible();
  });
});
