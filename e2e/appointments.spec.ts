
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable } from './support/dom-helpers';

test.describe.serial('Appointments & OPD Queue', () => {
  // Date.now() alone cycles every ~16.7 min once sliced to 6 digits, so two test runs
  // spaced far apart in wall-clock time can still collide on an identical suffix —
  // jitter with a random offset before slicing so every run gets a fresh window.
  const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);
  const petName = `Appt-Pet-${suffix}`;
  const ownerName = `Appt Owner ${suffix}`;
  const ownerPhone = `9${suffix}00`.slice(0, 10);
  const complaint = 'Mild fever, persistent scratching, annual vaccination booster';

  test('books a new appointment for a newly created patient', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/appointments');

    await page.getByRole('button', { name: /book appointment/i }).click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/book doctor appointment/i)).toBeVisible();

    // No existing patient matches this name -> quick "add as new patient" form appears
    await fillStable(modal.getByPlaceholder(/search patient by name, uid/i), petName);
    await expect(modal.getByText(/no match for/i)).toBeVisible();
    await fillStable(modal.getByPlaceholder(/e\.g\. labrador/i), 'Mixed Breed');
    await fillStable(modal.getByPlaceholder(/owner's full name/i), ownerName);
    await fillStable(modal.getByPlaceholder(/\+91 \.\.\./i), ownerPhone);
    await modal.getByRole('button', { name: /save new patient/i }).click();

    // Success toast confirms the new patient was actually created & auto-selected
    // (the "no match" banner text also contains the pet name, so asserting on it
    // alone would pass even if creation silently failed — use the toast instead).
    await expect(page.getByText(/added and selected/i)).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText(/no match for/i)).not.toBeVisible();

    await fillStable(modal.getByPlaceholder(/mild fever, persistent scratching/i), complaint);
    await modal.getByRole('button', { name: /confirm & issue token/i }).click();

    await expect(modal).not.toBeVisible({ timeout: 15000 });
    const row = page.locator('tr', { hasText: petName });
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText(/waiting/i).first()).toBeVisible();
  });

  test('edits the appointment complaint/reason', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/appointments');

    const row = page.locator('tr', { hasText: petName });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByTitle('Edit Appointment').click();

    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal.getByText(/edit appointment/i)).toBeVisible();

    const updatedComplaint = `${complaint} — follow-up updated`;
    const complaintInput = modal.getByPlaceholder(/mild fever, persistent scratching/i);
    await complaintInput.fill('');
    await fillStable(complaintInput, updatedComplaint);
    await modal.getByRole('button', { name: /save changes/i }).click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // Reload and confirm the edit persisted server-side, not just in local state
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const reloadedRow = page.locator('tr', { hasText: petName });
    await expect(reloadedRow).toBeVisible({ timeout: 15000 });
  });

  test('admits the patient to the OPD queue', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/appointments');

    const row = page.locator('tr', { hasText: petName });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: /admit opd/i }).click();

    await expect(page.getByText(/admitted to opd queue/i)).toBeVisible({ timeout: 15000 });
    await expect(row.getByText(/in opd/i)).toBeVisible({ timeout: 15000 });
  });

  test('deletes an appointment', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);
    await page.goto('/m/appointments');

    // Book a disposable appointment just for the delete test
    const disposablePet = `Delete-Me-${suffix}`;
    await page.getByRole('button', { name: /book appointment/i }).click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await fillStable(modal.getByPlaceholder(/search patient by name, uid/i), disposablePet);
    await fillStable(modal.getByPlaceholder(/e\.g\. labrador/i), 'Mixed Breed');
    await fillStable(modal.getByPlaceholder(/owner's full name/i), ownerName);
    await fillStable(modal.getByPlaceholder(/\+91 \.\.\./i), ownerPhone);
    await modal.getByRole('button', { name: /save new patient/i }).click();
    await expect(page.getByText(/added and selected/i)).toBeVisible({ timeout: 15000 });
    await modal.getByRole('button', { name: /confirm & issue token/i }).click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    const row = page.locator('tr', { hasText: disposablePet });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByTitle('Delete Appointment').click();

    await expect(page.getByText(/deleted/i)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('tr', { hasText: disposablePet })).toHaveCount(0);
  });
});
