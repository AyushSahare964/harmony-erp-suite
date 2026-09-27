/**
 * Patient 360° Profile (/m/crm-pets → click a patient row) — E2E Test Suite
 *
 * Every selector below was verified against the actual component source
 * (Patient360Profile.tsx, OwnerPetRegistrationModal.tsx, PetOwnerCrmHub.tsx)
 * before being used here — same standard as e2e/reports-analytics.spec.ts.
 *
 * Investigation summary: unlike the Reports & Analytics module, Patient360Profile
 * itself contains no fakery — every <Field> traces to real data returned by
 * getPatient360Fn or a pure client-side derivation (no Math.random(), no flat
 * rates, no dead-label lookups). The real defect class here is OMISSION: a
 * value the registration form captures and genuinely saves to the database is
 * simply never rendered anywhere in the profile (or its Edit dialogs), so it
 * becomes permanently invisible to clinic staff even though it was typed in at
 * intake. Confirmed absent from Patient360Profile.tsx by source grep (zero
 * matches for the underlying field names): owner gender, owner date of birth,
 * ID proof type/number, opening balance. Two more fields have no display path
 * AND no registration input at all (registration-form-side gaps, not just
 * profile gaps): chronicConditions, dietPreference.
 *
 * One hardcoded finding lives just outside this file, on the CRM hub page that
 * launches the profile: PetOwnerCrmHub.tsx's "VISITS THIS MONTH" KPI card is a
 * literal `value: "0"` — it never reads any visit data.
 *
 * Structure:
 *   A. Registration → Profile Field-Accuracy Proof — every value a form field
 *      supports round-trips correctly into the profile, end to end.
 *   B. Registration → Profile Gap Proof — fields captured at registration that
 *      never surface anywhere in the profile (the omissions above).
 *   C. Tab Navigation & Empty-State Accuracy — all 8 tabs render without
 *      crashing, and a freshly registered pet with zero history shows the
 *      correct "no data" message in every section (not a blank crash, not
 *      leftover data from another patient).
 *   D. CRM Hub fakery proof — "VISITS THIS MONTH" is a hardcoded "0".
 */

import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable, gotoReady } from './support/dom-helpers';

interface OwnerFixture {
  name: string;
  phone: string;
  altPhone: string;
  email: string;
  dob: string;
  city: string;
  address: string;
  pin: string;
  idProofNo: string;
  openingBalance: string;
}

interface PetFixture {
  name: string;
  breed: string;
  weight: string;
  dob: string;
  color: string;
  microchip: string;
  bloodGroup: string;
  tagNumber: string;
  medicalNotes: string;
  foodAllergies: string;
  otherAllergies: string;
  clinicalAlerts: string;
}

function makeFixtures(tag: string): { owner: OwnerFixture; pet: PetFixture } {
  const suffix = `${tag}${(Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6)}`;
  return {
    owner: {
      name: `ProfileOwner-${suffix}`,
      phone: `9${suffix}1234567`.replace(/\D/g, '').slice(0, 10),
      altPhone: `8${suffix}7654321`.replace(/\D/g, '').slice(0, 10),
      email: `profile.owner.${suffix}@example.com`,
      dob: '1990-05-15',
      city: 'Pune',
      address: `Flat ${suffix}, Profile Test Address, Baner Road`,
      pin: '411045',
      idProofNo: `1234-5678-${suffix}`.slice(0, 14),
      openingBalance: '1500',
    },
    pet: {
      name: `ProfilePet-${suffix}`,
      breed: 'Labrador Retriever',
      weight: '22.3',
      dob: '2022-03-10',
      color: 'Golden with white patch',
      microchip: `98109812${suffix}`.replace(/\D/g, '').slice(0, 15),
      bloodGroup: 'DEA 1.1+',
      tagNumber: `TAG-${suffix}`,
      medicalNotes: 'Severe swelling from Penicillin G',
      foodAllergies: 'Chicken, Dairy',
      otherAllergies: 'Dust mites',
      clinicalAlerts: 'Cardiac patient',
    },
  };
}

/** Opens the CRM Pets hub, ready for the search box / register button. */
async function openCrmPets(page: Page) {
  await loginAsAdmin(page);
  await gotoReady(page, '/m/crm-pets');
  await expect(page.getByPlaceholder('Search records by pet name, ID, breed, owner...')).toBeVisible({ timeout: 15_000 });
}

/** Registers `owner` + `pet`, filling EVERY field the registration form exposes
 *  (not just the required minimum), then closes the success screen. */
async function registerFullyDetailedPatient(page: Page, owner: OwnerFixture, pet: PetFixture) {
  await page.getByRole('button', { name: /register pet.*new owner/i }).first().click();
  const modal = page.locator('div[role="dialog"][data-state="open"]');
  await expect(modal).toBeVisible({ timeout: 10_000 });

  // ── Owner: every field the form supports ──
  await fillStable(modal.getByPlaceholder(/atul bhise/i), owner.name);
  await fillStable(modal.getByPlaceholder(/98230 11221/i), owner.phone);
  await fillStable(modal.getByPlaceholder(/98230 99999/i), owner.altPhone);
  await fillStable(modal.getByPlaceholder(/atul\.bhise@gmail\.com/i), owner.email);
  await modal.getByRole('combobox').first().click(); // Gender — first combobox in the owner step
  await page.getByRole('option', { name: 'Female' }).click();
  await fillStable(
    modal.getByText('Date of Birth (Optional)').locator('xpath=following-sibling::input[1]'),
    owner.dob,
  );
  await fillStable(modal.getByPlaceholder('e.g. Nagpur'), owner.city);
  await fillStable(modal.getByPlaceholder(/dharampeth extension/i), owner.address);
  await fillStable(modal.getByPlaceholder('e.g. 440001'), owner.pin);
  await fillStable(modal.getByPlaceholder('XXXX-XXXX-XXXX'), owner.idProofNo);
  await fillStable(
    modal.getByText('Opening Balance (₹)').locator('xpath=following-sibling::input[1]'),
    owner.openingBalance,
  );

  await modal.getByRole('button', { name: /next: add patient details/i }).click();

  // ── Pet: every field the form supports (species/gender/sterilization left at
  // their defaults — Canine / Male / Intact — which is itself asserted below) ──
  await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), pet.name);
  await fillStable(modal.getByPlaceholder(/labrador retriever/i), pet.breed);
  await fillStable(modal.getByPlaceholder(/e\.g\. 24\.5/i), pet.weight);
  await fillStable(
    modal.getByText('Date of Birth', { exact: true }).locator('xpath=following-sibling::input[1]'),
    pet.dob,
  );
  await fillStable(modal.getByPlaceholder(/golden, black & tan/i), pet.color);
  await fillStable(modal.getByPlaceholder(/981098123456789/i), pet.microchip);
  await fillStable(modal.getByPlaceholder(/dea 1\.1/i), pet.bloodGroup);
  await fillStable(modal.getByPlaceholder(/collar tag tag-102/i), pet.tagNumber);

  await modal.getByRole('button', { name: 'Yes', exact: true }).click();
  await fillStable(modal.getByPlaceholder(/severe swelling from penicillin/i), pet.medicalNotes);
  await modal.getByRole('button', { name: 'NSAIDs' }).click();
  await fillStable(modal.getByPlaceholder(/comma separated, e\.g\. chicken, dairy/i), pet.foodAllergies);
  await fillStable(modal.getByPlaceholder('Comma separated', { exact: true }), pet.otherAllergies);
  await fillStable(modal.getByPlaceholder(/aggressive, cardiac patient/i), pet.clinicalAlerts);

  await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
  await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15_000 });
  await modal.getByRole('button', { name: /done & close crm/i }).click();
  await expect(modal).not.toBeVisible();
}

/** Registers `owner` + `pet` using only the required minimum fields. */
async function registerMinimalPatient(page: Page, owner: OwnerFixture, pet: PetFixture) {
  await page.getByRole('button', { name: /register pet.*new owner/i }).first().click();
  const modal = page.locator('div[role="dialog"][data-state="open"]');
  await expect(modal).toBeVisible({ timeout: 10_000 });

  await fillStable(modal.getByPlaceholder(/atul bhise/i), owner.name);
  await fillStable(modal.getByPlaceholder(/98230 11221/i), owner.phone);
  // Billing Address is a hard requirement to advance (handleProceedNewOwner in
  // OwnerPetRegistrationModal.tsx bails with a toast if it's empty) — State
  // already has a non-empty default ("Maharashtra"), so only address is needed.
  await fillStable(modal.getByPlaceholder(/dharampeth extension/i), owner.address);
  await modal.getByRole('button', { name: /next: add patient details/i }).click();

  // Weight is a hard requirement too (handleCompleteRegistration bails with a
  // toast if weightKg <= 0), even in an otherwise "minimal" registration.
  await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), pet.name);
  await fillStable(modal.getByPlaceholder(/labrador retriever/i), pet.breed);
  await fillStable(modal.getByPlaceholder(/e\.g\. 24\.5/i), pet.weight);

  await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
  await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15_000 });
  await modal.getByRole('button', { name: /done & close crm/i }).click();
  await expect(modal).not.toBeVisible();
}

/** Searches the Pets tab for `name` and opens its Patient 360 Profile dialog. */
async function openProfileFor(page: Page, name: string): Promise<Locator> {
  const search = page.getByPlaceholder('Search records by pet name, ID, breed, owner...');
  await fillStable(search, name);
  const row = page.locator('tr', { hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  const dialog = page.locator('div[role="dialog"][data-state="open"]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  // Wait past every section's own "Loading ..." spinner before reading values.
  await expect(dialog.getByText(/^Loading /)).toHaveCount(0, { timeout: 20_000 });
  return dialog;
}

/** Reads a <dt>label</dt><dd>value</dd> pair's value by the dt's EXACT text
 *  (anchored regex — "Weight" must not also match a "Current Weight" field). */
async function fieldValue(dialog: Locator, label: string): Promise<string> {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const dt = dialog.locator('dt').filter({ hasText: new RegExp(`^${escaped}$`) }).first();
  await expect(dt).toBeVisible({ timeout: 10_000 });
  return (await dt.locator('xpath=following-sibling::dd[1]').innerText()).trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// A + B. Registration → Profile Round-Trip (accuracy proof + gap proof)
// ═══════════════════════════════════════════════════════════════════════════
test.describe.serial('Patient 360 Profile — Registration Data Round-Trip', () => {
  const { owner, pet } = makeFixtures('rt');

  test('registers a fully-detailed owner + pet, then every captured field appears correctly in the profile', async ({ page }) => {
    test.setTimeout(120_000);
    await openCrmPets(page);
    await registerFullyDetailedPatient(page, owner, pet);

    const dialog = await openProfileFor(page, pet.name);

    // ── Patient Information ──
    expect(await fieldValue(dialog, 'Patient Name')).toBe(pet.name);
    expect(await fieldValue(dialog, 'Species')).toBe('Canine'); // left at form default
    expect(await fieldValue(dialog, 'Breed')).toBe(pet.breed);
    expect(await fieldValue(dialog, 'Gender')).toBe('Male'); // left at form default
    expect(await fieldValue(dialog, 'Date of Birth')).not.toBe('N/A'); // real DOB was entered
    expect(await fieldValue(dialog, 'Weight')).toBe(`${pet.weight} kg`);
    expect(await fieldValue(dialog, 'Coat / Color')).toBe(pet.color);
    expect(await fieldValue(dialog, 'Sterilization')).toBe('Intact'); // left at form default
    expect(await fieldValue(dialog, 'Microchip No.')).toBe(pet.microchip);
    expect(await fieldValue(dialog, 'Blood Group')).toBe(pet.bloodGroup);
    expect(await fieldValue(dialog, 'Identification / Tag No.')).toBe(pet.tagNumber);
    expect(await fieldValue(dialog, 'Status')).toBe('Active');

    // ── Pet Parent & Contact Information ── (name/phone etc. can legitimately
    // appear more than once — e.g. a header summary plus the detail section —
    // so these only assert the value is rendered SOMEWHERE, via .first()).
    // Phone numbers are stored/displayed formatted as "+91 XXXXX XXXXX" (see
    // handleCompleteRegistration's formattedPhone), not the raw 10 digits typed
    // in — match on the first 5 digits, which survive that formatting unbroken.
    await expect(dialog.getByText(owner.name).first()).toBeVisible();
    await expect(dialog.getByText(new RegExp(owner.phone.slice(0, 5))).first()).toBeVisible();
    await expect(dialog.getByText(new RegExp(owner.altPhone.slice(0, 5))).first()).toBeVisible();
    await expect(dialog.getByText(owner.email).first()).toBeVisible();
    await expect(dialog.getByText(new RegExp(owner.city)).first()).toBeVisible();
    await expect(dialog.getByText(new RegExp(owner.pin)).first()).toBeVisible();

    // ── Clinical Alerts & Allergies banner ──
    await expect(dialog.getByText(/NSAIDs/).first()).toBeVisible();
    await expect(dialog.getByText(/Chicken/).first()).toBeVisible();
    await expect(dialog.getByText(/Dust mites/).first()).toBeVisible();
    await expect(dialog.getByText(/Cardiac patient/).first()).toBeVisible();
    await expect(dialog.getByText(pet.medicalNotes).first()).toBeVisible();
  });

  test('owner gender, owner DOB, ID proof number and opening balance are captured at registration but never shown anywhere in the profile', async ({ page }) => {
    test.setTimeout(60_000);
    await openCrmPets(page);
    const dialog = await openProfileFor(page, pet.name);
    const dialogText = await dialog.innerText();

    // Owner Gender was explicitly set to "Female" — Patient360Profile.tsx has no
    // Field/FormField referencing ownerGender anywhere (confirmed by source grep),
    // so this value the receptionist chose is permanently invisible on this screen.
    expect(dialogText).not.toContain('Female');

    // ID Proof Number and Opening Balance: also zero display references in source.
    expect(dialogText).not.toContain(owner.idProofNo);
    expect(dialogText).not.toContain(owner.openingBalance);

    // Owner DOB ("1990-05-15"): no field reads ownerDob anywhere, so no date
    // string derived from it — nor its literal year, which nothing else on this
    // freshly-created record would coincidentally produce — appears either.
    expect(dialogText).not.toContain('1990');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C. Tab Navigation & Empty-State Accuracy
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Patient 360 Profile — Tab Navigation & Empty States', () => {
  const TAB_EMPTY_STATES: Record<string, string[]> = {
    Overview: ['No upcoming appointments', 'No other pets registered for this owner'],
    Appointments: ['No upcoming appointments', 'No previous appointments'],
    'Medical History': ['No medical history recorded'],
    'Consultations & Reports': ['No consultation reports'],
    Prescriptions: ['No prescription history'],
    'Preventive Care': ['No vaccination records', 'No deworming records'],
    'Documents & Photos': ['No documents uploaded', 'No additional photos'],
    Billing: ['No previous bills', 'No payment history'],
  };

  test('every tab renders without crashing and shows the correct "no data" message for a freshly registered pet with zero history', async ({ page }) => {
    test.setTimeout(120_000);
    const { owner, pet } = makeFixtures('tabs');
    await openCrmPets(page);
    await registerMinimalPatient(page, owner, pet);

    const dialog = await openProfileFor(page, pet.name);

    for (const [tabName, expectedTexts] of Object.entries(TAB_EMPTY_STATES)) {
      await dialog.getByRole('tab', { name: tabName }).click();
      // No React error boundary / blank pane — some real content area renders.
      await expect(dialog.locator('section, [role="tabpanel"]').first()).toBeVisible({ timeout: 10_000 });
      for (const text of expectedTexts) {
        // .first(): "No upcoming appointments" (etc.) legitimately appears on more
        // than one tab (Overview's summary widget + the Appointments tab itself);
        // Radix keeps inactive TabsContent mounted, so the locator can resolve to
        // more than one match even though only one is actually visible right now.
        await expect(dialog.getByText(text).first()).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D. CRM Hub fakery proof — "VISITS THIS MONTH" is a hardcoded "0"
// ═══════════════════════════════════════════════════════════════════════════
test.describe('CRM Hub — KPI fakery proof', () => {
  test('"VISITS THIS MONTH" always reads exactly "0", regardless of real visit data', async ({ page }) => {
    test.setTimeout(60_000);
    await openCrmPets(page);
    // PetOwnerCrmHub.tsx: <KpiCard kpi={{ label: "VISITS THIS MONTH", value: "0", ... }} /> —
    // a literal constant, never computed from any visit/appointment data.
    const card = page.locator('p.section-label', { hasText: 'VISITS THIS MONTH' }).locator('xpath=..');
    await expect(card.locator('p').nth(1)).toHaveText('0');
  });
});
