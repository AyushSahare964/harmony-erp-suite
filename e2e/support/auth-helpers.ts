import { expect, type Browser, type Page } from '@playwright/test';
import { fillStable, gotoReady } from './dom-helpers';

export const ADMIN_CREDENTIALS = { email: 'makarand.dixit@gmail.com', password: '12345678' };

export async function loginAsAdmin(page: Page) {
  await gotoReady(page, '/login');
  // If already logged in, the app immediately navigates away from /login
  if (!page.url().includes('/login')) {
    return;
  }
  const emailInput = page.locator('input[type="email"]');
  const isEmailVisible = await emailInput.isVisible({ timeout: 4000 }).catch(() => false);
  if (!isEmailVisible) {
    if (!page.url().includes('/login')) return;
  }
  await fillStable(emailInput, ADMIN_CREDENTIALS.email);
  await fillStable(page.locator('input[type="password"]'), ADMIN_CREDENTIALS.password);
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

export type RoleId = 'doctor' | 'admin' | 'reception' | 'accounts' | 'platform';

/** Fills and submits the Register tab on /login. Leaves the page on /pending-approval. */
export async function registerNewStaff(page: Page, roleId: RoleId) {
  const suffix = Date.now().toString().slice(-6);
  const fullName = `Test ${roleId} ${suffix}`;
  const email = `test.${roleId}.${suffix}@vetos.test`;
  const password = 'Test@12345';

  await gotoReady(page, '/login');
  await page.getByRole('button', { name: /^register$/i }).click();

  await fillStable(page.getByPlaceholder(/dr\. rajesh mehra/i), fullName);
  await fillStable(page.getByPlaceholder(/rajesh@clinic\.com/i), email);
  const pwdFields = page.locator('input[type="password"]');
  await fillStable(pwdFields.nth(0), password);
  await fillStable(pwdFields.nth(1), password);
  await page.locator('select').selectOption(roleId);
  await page.getByRole('button', { name: /create operator account/i }).click();
  await expect(page).toHaveURL('/pending-approval', { timeout: 15000 });

  return { fullName, email, password };
}

/** Uses a separate admin browser context to approve a pending staff member by name. */
export async function approveStaffAsAdmin(browser: Browser, fullName: string) {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  try {
    await loginAsAdmin(adminPage);
    await gotoReady(adminPage, '/m/identity');
    await fillStable(adminPage.getByPlaceholder(/search staff by name/i), fullName);
    const row = adminPage.locator('tr', { hasText: fullName });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: /review/i }).click();
    await adminPage.getByRole('button', { name: /approve & grant erp access/i }).click();
    await expect(adminPage.getByText(/approve|granted|success/i).first()).toBeVisible({ timeout: 15000 });
  } finally {
    await adminContext.close();
  }
}

/** Registers a new staff member, approves them as admin (separate context), then logs the
 *  given page in as that new user. Returns the credentials used. */
export async function registerAndApproveRole(browser: Browser, page: Page, roleId: RoleId) {
  const creds = await registerNewStaff(page, roleId);
  await approveStaffAsAdmin(browser, creds.fullName);

  await gotoReady(page, '/login');
  await fillStable(page.locator('input[type="email"]'), creds.email);
  await fillStable(page.locator('input[type="password"]'), creds.password);
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/', { timeout: 15000 });

  return creds;
}
