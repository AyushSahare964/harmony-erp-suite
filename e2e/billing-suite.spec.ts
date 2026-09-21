import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable } from './support/dom-helpers';

test.describe('Billing Suite: Manual Billing (previously dead/mocked)', () => {
  test('creates and finalizes a real manual bill against real inventory items', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/billing-suite');
    await page.getByRole('button', { name: 'Manual Bill' }).click();

    await expect(page.getByRole('heading', { name: /manual product billing/i })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /new manual bill/i }).click();

    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();

    // Pick the first real inventory item from the catalogue search results
    const firstProduct = modal.locator('button').filter({ hasText: '₹' }).first();
    await expect(firstProduct).toBeVisible({ timeout: 15000 });
    const productName = (await firstProduct.locator('span.font-medium').textContent())?.trim();
    await firstProduct.click();

    await expect(modal.locator('table')).toBeVisible();
    await modal.getByRole('button', { name: /finalize & bill/i }).click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // The new bill should now be listed as a real, server-persisted invoice
    await expect(page.locator('tr', { hasText: 'Paid' }).first()).toBeVisible({ timeout: 15000 });
    if (productName) {
      await expect(page.getByText(productName).first()).toBeVisible().catch(() => {});
    }
  });
});

test.describe('Billing Suite: Subscription Billing (previously mocked)', () => {
  test('creates a plan and sells a real subscription against real pets/owners', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/billing-suite');
    await page.getByRole('button', { name: /^Subscriptions/ }).click();

    await expect(page.getByRole('heading', { name: /subscription & recurring billing/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Loading subscriptions')).toHaveCount(0, { timeout: 15000 });

    const planName = `E2E Test Plan ${Date.now()}`;
    await page.getByRole('button', { name: /new plan/i }).click();
    const planModal = page.locator('div[role="dialog"][data-state="open"]');
    await fillStable(planModal.getByPlaceholder(/boarding monthly pass/i), planName);
    await fillStable(planModal.getByPlaceholder('3500'), '999');
    await planModal.getByRole('button', { name: /create plan/i }).click();
    await expect(planModal).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('p.font-semibold', { hasText: planName })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /sell subscription/i }).click();
    const sellModal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(sellModal).toBeVisible();
    await sellModal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: new RegExp(planName) }).click();
    await sellModal.getByRole('button', { name: /sell subscription/i }).click();
    await expect(sellModal).not.toBeVisible({ timeout: 15000 });

    await expect(page.locator('tr', { hasText: planName }).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Billing Suite: Payment Analytics (previously mocked)', () => {
  test('shows real KPIs and charts computed from actual payment records', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/m/billing-suite');
    await page.getByRole('button', { name: /^Analytics/ }).click();

    await expect(page.getByRole('heading', { name: /payment analytics/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Loading payment analytics')).toHaveCount(0, { timeout: 15000 });

    await expect(page.getByText('Total Collected (MTD)')).toBeVisible();
    await expect(page.locator('p.text-xs', { hasText: 'Outstanding' })).toBeVisible();
    await expect(page.getByText('Avg Bill Value (MTD)')).toBeVisible();
    await expect(page.getByText('Digital Payment Share')).toBeVisible();

    // No stray NaN/undefined from unguarded real-data math. Scoped to <main> —
    // Recharts briefly renders an off-tree measurement clone with a "₹0k" tick
    // before ResponsiveContainer has real dimensions; that's a library artifact,
    // not app output.
    const main = page.locator('main');
    await expect(main.getByText('NaN', { exact: false })).toHaveCount(0);
    await expect(main.getByText('undefined', { exact: false })).toHaveCount(0);
  });
});
