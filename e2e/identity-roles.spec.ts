import { test, expect } from '@playwright/test';
import { loginAsAdmin, registerNewStaff, registerAndApproveRole } from './support/auth-helpers';
import { fillStable } from './support/dom-helpers';

test.describe('Identity, Roles & Access: Registration, Approval, Rejection', () => {
  test('registers a Doctor applicant, admin declines it, and staff directory search finds them', async ({ page, browser }) => {
    test.setTimeout(90000);
    const creds = await registerNewStaff(page, 'doctor');
    await expect(page.getByText(/pending approval/i).first()).toBeVisible();
    await expect(page.getByText(creds.email)).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsAdmin(adminPage);
    await adminPage.goto('/m/identity');

    await fillStable(adminPage.getByPlaceholder(/search staff by name/i), creds.fullName);
    const row = adminPage.locator('tr', { hasText: creds.fullName });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: /review/i }).click();

    // ApproveStaffModal is a hand-rolled overlay (not the shared Dialog component), so it has
    // no role="dialog" wrapper to scope to — interact directly on the page.
    await expect(adminPage.getByText(/review & authorize staff access/i)).toBeVisible();
    await adminPage.getByRole('button', { name: /decline request/i }).click();
    await fillStable(adminPage.getByPlaceholder(/license verification incomplete/i), 'Test rejection — automated coverage check');
    await adminPage.getByRole('button', { name: /confirm decline/i }).click();
    await expect(adminPage.getByText(/review & authorize staff access/i)).not.toBeVisible({ timeout: 15000 });

    await adminContext.close();
  });

  test('registers and approves an Accounts-role applicant, who can then log in to a role-appropriate dashboard', async ({ page, browser }) => {
    test.setTimeout(90000);
    const creds = await registerAndApproveRole(browser, page, 'accounts');
    await expect(page.getByText(new RegExp(creds.fullName)).first()).toBeVisible({ timeout: 15000 });
  });
});
