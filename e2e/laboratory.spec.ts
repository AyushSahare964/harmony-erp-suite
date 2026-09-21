import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable, reloadReady } from './support/dom-helpers';

test.describe.serial('Laboratory: Dual Order Entry Points, Results Persistence', () => {
  const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);
  const inConsultPetName = `LabRx-${suffix}`;
  const standalonePetName = `LabStandalone-${suffix}`;
  const inConsultTest = `InConsultTest-${suffix}`;

  test('orders a lab test in-consultation and confirms the section stays saved (not stuck dirty)', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);

    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const regModal = page.locator('div[role="dialog"][data-state="open"]');
    await fillStable(regModal.getByPlaceholder(/atul bhise/i), `${inConsultPetName} Owner`);
    await fillStable(regModal.getByPlaceholder(/98230 11221/i), `9${suffix}00`.slice(0, 10));
    await regModal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(regModal.getByPlaceholder(/^e\.g\. bruno$/i), inConsultPetName);
    await fillStable(regModal.getByPlaceholder(/labrador retriever/i), 'Beagle');
    await regModal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(regModal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await regModal.getByRole('button', { name: /admit to opd consultation/i }).click();

    const workspace = page.locator('div[role="dialog"][data-state="open"]');
    await expect(workspace).toBeVisible({ timeout: 15000 });

    await workspace.getByRole('button', { name: 'Yes', exact: true }).click();
    await fillStable(workspace.getByPlaceholder(/type a lab test name to add/i), inConsultTest);
    await workspace.getByRole('button', { name: new RegExp(`add custom test.*${inConsultTest}`, 'i') }).click();
    await workspace.getByRole('button', { name: /save lab tests/i }).click();
    await expect(workspace.getByText(/^saved/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('orders a lab test via the standalone Laboratory hub and both orders appear in the queue', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);

    // Register a second patient dedicated to the standalone-order path
    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const regModal = page.locator('div[role="dialog"][data-state="open"]');
    await fillStable(regModal.getByPlaceholder(/atul bhise/i), `${standalonePetName} Owner`);
    await fillStable(regModal.getByPlaceholder(/98230 11221/i), `8${suffix}00`.slice(0, 10));
    await regModal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(regModal.getByPlaceholder(/^e\.g\. bruno$/i), standalonePetName);
    await fillStable(regModal.getByPlaceholder(/labrador retriever/i), 'Beagle');
    await regModal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(regModal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await regModal.getByRole('button', { name: /done & close crm/i }).click();

    await page.goto('/m/laboratory');
    await page.getByRole('button', { name: /create lab order/i }).click();
    const labModal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(labModal.getByText(/create diagnostic laboratory order/i)).toBeVisible();

    await fillStable(labModal.getByPlaceholder(/search patient by name, uid/i), standalonePetName);
    const patientCard = labModal.getByText(standalonePetName).first();
    await expect(patientCard).toBeVisible({ timeout: 10000 });
    await patientCard.click();

    // Select the first available test panel from the catalog
    await fillStable(labModal.getByPlaceholder(/search tests by name, panel code/i), 'CBC');
    const testCard = labModal.locator('div.cursor-pointer', { hasText: /CBC|Complete Blood Count/i }).first();
    await expect(testCard).toBeVisible({ timeout: 10000 });
    await testCard.click();

    await labModal.getByRole('button', { name: /place lab order/i }).click();
    await expect(labModal).not.toBeVisible({ timeout: 15000 });

    // Both the in-consultation order and this standalone order should now be queued
    await fillStable(page.getByPlaceholder(/search by order id, pet name, test, owner/i), inConsultPetName);
    await expect(page.getByText(new RegExp(inConsultPetName)).first()).toBeVisible({ timeout: 15000 });

    await fillStable(page.getByPlaceholder(/search by order id, pet name, test, owner/i), standalonePetName);
    await expect(page.getByText(new RegExp(standalonePetName)).first()).toBeVisible({ timeout: 15000 });
  });

  test('entering lab results and reloading — checks whether results actually persist', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsAdmin(page);
    await page.goto('/m/laboratory');

    await fillStable(page.getByPlaceholder(/search by order id, pet name, test, owner/i), standalonePetName);
    const row = page.locator('tr', { hasText: standalonePetName });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: /enter results/i }).click();

    const resultsModal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(resultsModal.getByText(/enter diagnostic test results/i)).toBeVisible();

    // Fill the Hemoglobin result field with a distinctive value
    const firstResultInput = resultsModal.locator('tr', { hasText: 'Hemoglobin' }).locator('input').first();
    await fillStable(firstResultInput, '13.7');
    await resultsModal.getByRole('button', { name: /save & publish official lab report/i }).click();
    await expect(resultsModal).not.toBeVisible({ timeout: 15000 }).catch(() => {});

    await reloadReady(page);
    await fillStable(page.getByPlaceholder(/search by order id, pet name, test, owner/i), standalonePetName);
    await expect(row).toBeVisible({ timeout: 15000 });

    // A successfully "Reported" order now correctly shows "View Report" (read-only) instead of
    // "Enter Results" (editable) — a signal in itself that the status transition persisted too.
    await expect(row.getByRole('button', { name: /view report/i })).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: /view report/i }).click();

    const reportView = page.locator('div[role="dialog"][data-state="open"]');
    await expect(reportView).toBeVisible({ timeout: 15000 });
    // The value entered before the reload should still be there — a fresh server fetch, not
    // locally-cached React state.
    await expect(reportView.getByText('13.7')).toBeVisible({ timeout: 10000 });
  });
});
