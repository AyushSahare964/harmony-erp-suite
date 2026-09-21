import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable, reloadReady } from './support/dom-helpers';

test.describe.serial('Clinical Consultation & Prescription: All 10 Rx Sections', () => {
  const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);
  const petName = `RxFlow-${suffix}`;
  const ownerName = `RxFlow Owner ${suffix}`;
  const historyText = 'Previously treated for tick fever in March 2025, fully recovered.';
  const symptomsText = 'Vomiting and loss of appetite since yesterday evening.';
  const immediateMed = `ImmedMed-${suffix}`;
  const prescribedMed = `HomeMed-${suffix}`;
  const injectable = `Injectable-${suffix}`;
  const labTest = `CustomLabTest-${suffix}`;
  const animalFood = `PetFood-${suffix}`;
  const prescribedDiet = `RenalDiet-${suffix}`;
  const accessory = `Accessory-${suffix}`;

  test('walks all 10 prescription sections with real detail, verifies History persists across a modal reopen, then bills and finalizes', async ({ page }) => {
    test.setTimeout(180000);
    await loginAsAdmin(page);

    // ── Register & admit a fresh patient straight to OPD ──
    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const regModal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(regModal).toBeVisible();
    await fillStable(regModal.getByPlaceholder(/atul bhise/i), ownerName);
    await fillStable(regModal.getByPlaceholder(/98230 11221/i), `9${suffix}00`.slice(0, 10));
    await regModal.getByRole('button', { name: /next: add patient details/i }).click();
    await fillStable(regModal.getByPlaceholder(/^e\.g\. bruno$/i), petName);
    await fillStable(regModal.getByPlaceholder(/labrador retriever/i), 'Labrador Retriever');
    await regModal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(regModal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await regModal.getByRole('button', { name: /admit to opd consultation/i }).click();

    const workspace = page.locator('div[role="dialog"][data-state="open"]');
    await expect(workspace).toBeVisible({ timeout: 15000 });
    await expect(workspace.getByText(/doctor rx & diagnosis/i).first()).toBeVisible();

    // ── 1. Previous History ──
    await fillStable(workspace.getByPlaceholder(/previous medical history/i), historyText);
    await workspace.getByRole('button', { name: /save history/i }).click();
    await expect(workspace.getByText(/history saved|saved/i).first()).toBeVisible({ timeout: 10000 }).catch(() => {});

    // ── Persistence check: close the workspace, reload (forces a fresh server fetch of the
    // OPD queue rather than trusting stale client state), and reopen this visit ──
    await page.keyboard.press('Escape');
    await expect(workspace).not.toBeVisible({ timeout: 10000 });
    await reloadReady(page);

    const opdRow = page.locator('tr', { hasText: petName });
    await expect(opdRow).toBeVisible({ timeout: 15000 });
    await opdRow.getByRole('button', { name: /treat/i }).click();

    const reopened = page.locator('div[role="dialog"][data-state="open"]');
    await expect(reopened).toBeVisible({ timeout: 15000 });
    await expect(reopened.getByPlaceholder(/previous medical history/i)).toHaveValue(historyText, { timeout: 15000 });

    // ── 2. Symptoms ──
    await fillStable(reopened.getByPlaceholder(/enter presenting symptoms/i), symptomsText);

    // ── 3. Clinical Findings (multi-select chip picker) — narrow the dropdown by typing
    // so the option list stays short and doesn't get clipped by the scroll container ──
    const findingsInput = reopened.getByPlaceholder(/search or pick clinical findings/i);
    await findingsInput.scrollIntoViewIfNeeded();
    await fillStable(findingsInput, 'Vomit');
    await reopened.getByRole('button', { name: 'Vomiting', exact: true }).click({ timeout: 10000 });
    await fillStable(findingsInput, 'Anorexia');
    // Not `/anorexia/i` — the picker also offers an "Add "Anorexia" as custom finding" button
    // whenever the query isn't an exact match to a canned option (it isn't: the canned option is
    // "Anorexia / Loss of Appetite"), so a loose regex matches both and throws a strict-mode error.
    await reopened.getByRole('button', { name: 'Anorexia / Loss of Appetite', exact: true }).click({ timeout: 10000 });
    await findingsInput.fill('');
    // Close the still-open dropdown overlay by clicking outside its container. It closes on
    // outside mousedown (not Escape, which would bubble to the parent Dialog instead), and the
    // click target must be somewhere the dropdown panel doesn't visually cover — the jump-to
    // bar at the top of the modal is always clear of it.
    await reopened.getByRole('button', { name: '1. History' }).click();

    // ── 4. Clinical Treatment: Immediate Med, Prescribed (home) Med, Injectable ──
    // Immediate Medication and Injectable are stock-bound (allowCustomAdd={false}) — typing a
    // name that doesn't match real inventory should NOT offer a custom-add option, unlike the
    // free-text Prescribed Medicine section below. With no matching stock, nothing can be added
    // here; this confirms the restriction holds rather than attempting a (correctly blocked) add.
    await fillStable(reopened.getByPlaceholder(/search medicines by brand, generic name, or composition/i), immediateMed);
    await expect(reopened.getByRole('button', { name: new RegExp(`add.*${immediateMed}`, 'i') })).toHaveCount(0);

    await fillStable(reopened.getByPlaceholder(/type medicine name and press add/i), prescribedMed);
    await reopened.getByRole('button', { name: /^add$/i }).click();

    await fillStable(reopened.getByPlaceholder(/search injectable medicines, vaccines, or vials/i), injectable);
    await expect(reopened.getByRole('button', { name: new RegExp(`add.*${injectable}`, 'i') })).toHaveCount(0);

    // ── 5. Consultation Fee ──
    await reopened.getByRole('button', { name: /specialist.*₹800/i }).click();

    // ── 6. Follow-up & Reminders (Treatment follow-up in 7 days) ──
    const switches = reopened.getByRole('switch');
    await switches.first().click(); // "Follow-up Required?"
    await switches.nth(1).click(); // "1. Treatment Follow-up"
    await reopened.getByRole('button', { name: '7 days' }).first().click();

    // ── 7. Laboratory Orders ──
    await reopened.getByRole('button', { name: 'Yes', exact: true }).click();
    await fillStable(reopened.getByPlaceholder(/type a lab test name to add/i), labTest);
    await reopened.getByRole('button', { name: new RegExp(`add custom test.*${labTest}`, 'i') }).click();

    // ── 8 & 9. Animal Food vs Prescribed Veterinary Diet (share the same placeholder — disambiguate by position) ──
    const foodInputs = reopened.getByPlaceholder(/search food items by name, brand, formula, or bag size/i);
    await fillStable(foodInputs.nth(0), animalFood);
    await reopened.getByRole('button', { name: new RegExp(`add.*${animalFood}`, 'i') }).first().click();
    await fillStable(foodInputs.nth(1), prescribedDiet);
    await reopened.getByRole('button', { name: new RegExp(`add.*${prescribedDiet}`, 'i') }).first().click();

    // ── 10. Pet Care Accessories ──
    await fillStable(reopened.getByPlaceholder(/search accessories by name, category, or type/i), accessory);
    await reopened.getByRole('button', { name: new RegExp(`add.*${accessory}`, 'i') }).first().click();

    // ── Proceed to Billing & finalize with full payment ──
    await reopened.getByRole('button', { name: /proceed to billing & settlement/i }).click();
    await expect(reopened.getByText(/billing & settlement/i).first()).toBeVisible({ timeout: 15000 });
    await expect(reopened.locator('td', { hasText: prescribedMed }).last()).toBeVisible();

    const finalizeBtn = reopened.getByRole('button', { name: /finalize.*✓|collect partial.*✓/i });
    await expect(finalizeBtn).toBeVisible();
    await finalizeBtn.click();
    await expect(reopened.getByText(/visit finalized & settled/i)).toBeVisible({ timeout: 15000 });
  });
});
