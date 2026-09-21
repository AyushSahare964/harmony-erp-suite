
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './support/auth-helpers';
import { fillStable } from './support/dom-helpers';

test.describe.serial('Patient & Owner CRM: Detailed Registration', () => {
  const suffix = (Date.now() + Math.floor(Math.random() * 1_000_000)).toString().slice(-6);
  const owner = {
    name: `CRM Owner ${suffix}`,
    phone: `9${suffix}12`.slice(0, 10),
    altPhone: `8${suffix}34`.slice(0, 10),
    email: `crm.owner.${suffix}@example.com`,
    address: 'Flat 302, Dharampeth Extension, Near Coffee House',
  };
  const pet1 = {
    name: `Rocky-${suffix}`,
    breed: 'Golden Retriever',
    weight: '28.5',
    color: 'Golden',
    microchip: `98109812${suffix}`,
    bloodGroup: 'DEA 1.1+',
  };

  test('registers a new owner with full contact/address/ID details and a fully-detailed pet with allergies', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    const registerBtn = page.getByRole('button', { name: /register client|new patient/i }).first();
    await registerBtn.click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();

    // ── Owner details (full field set) ──
    await fillStable(modal.getByPlaceholder(/atul bhise/i), owner.name);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), owner.phone);
    await fillStable(modal.getByPlaceholder(/98230 99999/i), owner.altPhone);
    await fillStable(modal.getByPlaceholder(/atul\.bhise@gmail\.com/i), owner.email);
    await fillStable(modal.getByPlaceholder(/dharampeth extension/i), owner.address);

    // Gender select (Radix combobox) -> Female
    await modal.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Female' }).click();

    await modal.getByRole('button', { name: /next: add patient details/i }).click();

    // ── Pet details (full field set) ──
    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), pet1.name);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), pet1.breed);
    await fillStable(modal.getByPlaceholder(/e\.g\. 24\.5/i), pet1.weight);
    await fillStable(modal.getByPlaceholder(/golden, black & tan/i), pet1.color);
    await fillStable(modal.getByPlaceholder(/981098123456789/i), pet1.microchip);
    await fillStable(modal.getByPlaceholder(/dea 1\.1/i), pet1.bloodGroup);

    // Species -> Feline
    await modal.getByRole('combobox').filter({ hasText: /canine/i }).click();
    await page.getByRole('option', { name: /feline \(cat\)/i }).click();

    // Allergies: mark Yes, add a detail note + toggle a category badge
    await modal.getByRole('button', { name: 'Yes', exact: true }).click();
    await fillStable(modal.getByPlaceholder(/severe swelling from penicillin/i), 'Mild hives after amoxicillin course');
    await modal.getByRole('button', { name: 'NSAIDs' }).click();

    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();

    // ── Success screen ──
    await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText(owner.name)).toBeVisible();
    await expect(modal.getByText(pet1.name)).toBeVisible();
    await expect(modal.getByText(/NSAIDs/i)).toBeVisible();

    await modal.getByRole('button', { name: /done & close crm/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test('adds a second pet to the same owner via existing-owner search', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /new pet only/i }).click();
    await fillStable(modal.getByPlaceholder(/search by owner name, mobile/i), owner.phone);

    const ownerRow = modal.getByText(owner.name).first();
    await expect(ownerRow).toBeVisible({ timeout: 15000 });
    await ownerRow.click();

    // Second pet — minimal required fields
    const pet2Name = `Milo-${suffix}`;
    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), pet2Name);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Beagle');

    await modal.getByRole('button', { name: /complete registration \(1 pet\)/i }).click();
    await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText(pet2Name)).toBeVisible();
  });

  test('registers a brand-new owner with two pets in a single multi-pet flow', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsAdmin(page);

    const multiOwnerName = `Multi Owner ${suffix}`;
    const multiPhone = `7${suffix}56`.slice(0, 10);

    await page.getByRole('button', { name: /register client|new patient/i }).first().click();
    const modal = page.locator('div[role="dialog"][data-state="open"]');
    await expect(modal).toBeVisible();

    await fillStable(modal.getByPlaceholder(/atul bhise/i), multiOwnerName);
    await fillStable(modal.getByPlaceholder(/98230 11221/i), multiPhone);
    await modal.getByRole('button', { name: /next: add patient details/i }).click();

    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `Tommy-${suffix}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Persian Cat');

    await modal.getByRole('button', { name: /add another pet/i }).first().click();
    await fillStable(modal.getByPlaceholder(/^e\.g\. bruno$/i), `Snowy-${suffix}`);
    await fillStable(modal.getByPlaceholder(/labrador retriever/i), 'Pomeranian');

    await modal.getByRole('button', { name: /complete registration \(2 pets\)/i }).click();
    await expect(modal.getByText(/registration successful/i)).toBeVisible({ timeout: 15000 });
    await expect(modal.getByText(/registered patients \(2\)/i)).toBeVisible();
    await expect(modal.getByText(`Tommy-${suffix}`)).toBeVisible();
    await expect(modal.getByText(`Snowy-${suffix}`)).toBeVisible();
  });
});
