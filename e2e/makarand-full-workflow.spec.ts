import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';

test.describe.serial('Full Workflow: Login as Dr. Makarand Dixit → Register Patient → Prescribe → Bill', () => {
  // Jittered so repeated runs across a long session don't collide on the same
  // slice of Date.now() (a bare timestamp slice cycles every few minutes).
  const jittered = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString();
  const testPatient = {
    ownerName: `Test Owner ${jittered.slice(-5)}`,
    ownerPhone: '9876543210',
    petName: `Bruno-${jittered.slice(-4)}`,
    breed: 'Labrador Retriever',
    medicine: `TestMed-${jittered.slice(-4)}`,
  };

  test('Complete Flow: login, register patient, prescribe medicine, generate bill', async ({ page }) => {
    test.setTimeout(90000);

    // ── STEP 1: LOGIN with Dr. Makarand Dixit's default credentials ──
    await loginAsAdmin(page);

    // ── STEP 2: REGISTER PATIENT IN DETAIL ──
    const registerBtn = page.getByRole('button', { name: /register client|new patient/i }).first();
    await expect(registerBtn).toBeVisible({ timeout: 15000 });
    await registerBtn.click();

    const regModal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(regModal).toBeVisible();

    // Owner details
    await regModal.getByPlaceholder(/atul bhise/i).fill(testPatient.ownerName);
    await regModal.getByPlaceholder(/98230 11221/i).fill(testPatient.ownerPhone);
    await regModal.getByRole('button', { name: /next: add patient details/i }).click();

    // Pet details
    await regModal.getByPlaceholder(/bruno/i).fill(testPatient.petName);
    await regModal.getByPlaceholder(/labrador retriever/i).fill(testPatient.breed);
    await regModal.getByRole('button', { name: /complete registration/i }).click();

    // ── STEP 3: ADMIT REGISTERED PATIENT TO OPD ──
    await expect(regModal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await regModal.getByRole('button', { name: /admit to opd consultation/i }).click();

    // ── STEP 4: PRESCRIBE MEDICINE ──
    const workspaceModal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(workspaceModal).toBeVisible({ timeout: 15000 });
    await expect(workspaceModal.getByText(/doctor rx & diagnosis/i).first()).toBeVisible();

    await workspaceModal.getByRole('button', { name: /4\. Treatment/i }).click();

    const medicineInput = workspaceModal.getByPlaceholder(/type medicine name and press add/i);
    await expect(medicineInput).toBeVisible();
    await medicineInput.fill(testPatient.medicine);
    await workspaceModal.getByRole('button', { name: /^add$/i }).click();

    // ── STEP 5: PROCEED TO BILLING & GENERATE BILL ──
    await workspaceModal.getByRole('button', { name: /proceed to billing & settlement/i }).click();
    await expect(workspaceModal.getByText(/billing & settlement/i).first()).toBeVisible({ timeout: 15000 });

    const finalizeBtn = workspaceModal.getByRole('button', { name: /finalize.*✓|collect partial.*✓/i });
    await expect(finalizeBtn).toBeVisible();
    await finalizeBtn.click();

    await expect(workspaceModal.getByText(/visit finalized & settled/i)).toBeVisible({ timeout: 15000 });
  });
});
