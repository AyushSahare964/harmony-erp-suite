import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';

test.describe('Module Routing', () => {
  test('/m/pharmacy now renders the real PharmacyRetailHub POS UI (previously fell back to the generic table)', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/m/pharmacy');

    await expect(page.getByRole('heading', { name: /pharmacy & retail/i, level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /new sale/i })).toBeVisible();
  });
});
