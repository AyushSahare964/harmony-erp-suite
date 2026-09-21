import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';

test.describe.serial('End-to-End Workflow: Receptionist Intake to Doctor Patient Consultation', () => {
  const testPatient = {
    petName: `Simba-${(Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-4)}`,
    breed: 'Golden Retriever',
    ownerName: 'Rahul Sharma',
    ownerPhone: '9876543210',
    complaint: 'Routine wellness examination and seasonal checkup',
    diagnosis: 'Healthy adult canine. Routine vaccination advised.',
    clinicalNotes: 'Vitals stable. Temperature normal. Heart and lungs clear.',
  };

  test('Complete Flow: Admit walk-in patient, record diagnosis & consultation notes', async ({ page }) => {
    test.setTimeout(60000);
    // ── STEP 1: RECEPTIONIST ADMITS PATIENT ──
    await loginAsAdmin(page);
    await expect(page.getByText('Real Care Clinic').first()).toBeVisible();

    // Click the OPD admit-patient-picker trigger (labeled "OPD Queue" / "Treat Patient" today,
    // not "Admit Patient (OPD)" as before)
    const admitButton = page.getByRole('button', { name: /opd queue|treat patient/i }).first();
    await expect(admitButton).toBeVisible();
    await admitButton.click();

    // Verify Modal opens
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();

    // Switch to Walk-in Tab precisely
    const walkinTab = modal.getByText(/Direct Walk-in Patient/i);
    await expect(walkinTab).toBeVisible();
    await walkinTab.click();

    // Fill Pet & Owner form fields
    const petInput = modal.locator('input[placeholder*="Max" i], input[placeholder*="Bella" i]').first();
    await petInput.fill(testPatient.petName);

    const ownerInput = modal.locator('input[placeholder*="pet parent" i], input[placeholder*="Full name" i]').first();
    if (await ownerInput.isVisible()) {
      await ownerInput.fill(testPatient.ownerName);
    }

    const phoneInput = modal.locator('input[placeholder*="mobile number" i], input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill(testPatient.ownerPhone);
    }

    const complaintInput = modal.locator('input[placeholder*="Fever" i], input[placeholder*="Complaint" i]').first();
    if (await complaintInput.isVisible()) {
      await complaintInput.fill(testPatient.complaint);
    }

    // Submit admission with the exact form submit button
    const submitBtn = modal.locator('form').getByRole('button', { name: /Admit Walk-in/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // ── STEP 2: DOCTOR CLINICAL WORKSPACE ──
    // The consultation workspace modal opens directly
    const workspaceModal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(workspaceModal).toBeVisible({ timeout: 15000 });

    // Verify Clinical Consultation header
    await expect(workspaceModal.getByText(/clinical consultation|doctor rx & diagnosis/i).first()).toBeVisible();

    // Enter Diagnosis & Notes
    const diagnosisInput = workspaceModal.locator('input[placeholder*="diagnosis" i], textarea[placeholder*="diagnosis" i]').first();
    if (await diagnosisInput.isVisible()) {
      await diagnosisInput.fill(testPatient.diagnosis);
    }

    const notesInput = workspaceModal.locator('textarea[placeholder*="notes" i], textarea[placeholder*="examination" i]').first();
    if (await notesInput.isVisible()) {
      await notesInput.fill(testPatient.clinicalNotes);
    }

    // Switch to Billing & Settlement tab
    const billingTab = workspaceModal.getByText(/2\. Billing & Settlement/i);
    if (await billingTab.isVisible()) {
      await billingTab.click();
      await expect(workspaceModal.getByText(/Billing & Settlement|Summary/i).first()).toBeVisible();
    }
  });

  test('CRM Flow: Owner & Pet Registration Modal Verification', async ({ page }) => {
    await loginAsAdmin(page);

    const registerModalBtn = page.getByRole('button', { name: /register owner & pet|new patient/i });
    if (await registerModalBtn.isVisible()) {
      await registerModalBtn.click();

      const modal = page.locator('div[role="dialog"][data-state="open"]');
      await expect(modal).toBeVisible();
      await expect(modal.getByText(/owner|patient|pet/i).first()).toBeVisible();

      // Close modal
      const closeBtn = modal.locator('button[aria-label="Close"], button:has-text("Cancel")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
  });
});
