# Fix production bugs in Clinical Consultation / Prescription workflow

## Context

Real Care Clinic's production deployment (harmony-erp-suite) is being used with a genuinely empty inventory/lab catalogue, and this has exposed 9 issues that were masked during development when hardcoded demo data was still in place. The root causes fall into three buckets:

1. **Hardcoded "seed"/"fallback" catalogs baked directly into component code** (`FALLBACK_CATALOG` in `VisitWorkspaceModal.tsx`, `COMMON_LAB_TESTS` in `LaboratoryOrderSection.tsx`) that were meant as dev placeholders but never gated behind an empty-database check, so they now surface as fake medicines/lab tests to real users.
2. **The Treatment section's three medicine subsections (Immediate / Prescribed / Injectable) all share one generic component** with no differentiation between "dispensed now from real stock, must be priced" (Immediate, Injectable) vs. "written on paper for the owner to buy elsewhere, no clinic price, no stock check" (Prescribed) — causing custom (non-inventory) items to land in the wrong section and get billed a fake price.
3. **A couple of isolated state/CSS bugs**: Symptoms falling back to OPD complaint text instead of staying blank, the Laboratory section's dirty-tracking dropping a field on save (causing a permanent false "unsaved" flag), the global search only being clickable on its small badges, and the sticky consultation summary panel's offset not matching the topbar height.

This plan fixes all 9 reported issues at their root cause, without adding new abstractions beyond what's needed.

---

## 1. Global search — click anywhere to open patient record

**File:** [src/components/erp/Shell.tsx](src/components/erp/Shell.tsx) — `GlobalSearch()`, result row at lines 257-302.

Currently only the small "Patient Record / Billing / Lab / Boarding" pill buttons inside each dropdown result are clickable; the row itself does nothing.

**Fix:** Make the whole result row (`<div key={p.petId} ...>`) clickable — `onClick` navigates to `crm-pets` (Patient Record) with `petId`/`petName`, same call already used by the "Patient Record" pill. Keep the 4 pill buttons for their specific destinations, but add `e.stopPropagation()` on their `onClick` so they don't double-navigate. Add `cursor-pointer` and a hover affordance to the row.

---

## 2. Symptoms section shows inherited text instead of being blank

**File:** [src/components/erp/clinical/prescription/PrescriptionWorkflow.tsx](src/components/erp/clinical/prescription/PrescriptionWorkflow.tsx) — lines 206-208 (init) and 231-233 (resync effect), plus the matching line in the `lastSaved` snapshot (line 473).

`symptomsText` is initialized as `initialRx.symptomsText ?? visit?.vitals?.complaint ?? ""` — despite the comment saying "blank default", it silently pre-fills from the OPD intake complaint (`visit.vitals.complaint`).

**Fix:** Drop the `visit?.vitals?.complaint` fallback in all 3 places — symptoms should only ever show a value that was explicitly saved for *this* prescription (`initialRx.symptomsText`), otherwise stay `""`.

---

## 3. Inventory search shows fake medicines when inventory is empty

**File:** [src/components/erp/clinical/VisitWorkspaceModal.tsx](src/components/erp/clinical/VisitWorkspaceModal.tsx) — `FALLBACK_CATALOG` (lines 73-91), `catalogItems` state (line 106), `loadCatalog()` (lines 275-284).

Root cause: `catalogItems` state defaults to an 18-item hardcoded `FALLBACK_CATALOG` (Amoxicillin, Rabies Vaccine, IV Fluid, etc.), and `loadCatalog()` only overwrites it `if (items && items.length > 0)` — so when the real inventory is genuinely empty, the fake catalog is never cleared and keeps appearing in every medicine/food/accessory search across the app.

**Fix:**
- Delete `FALLBACK_CATALOG` entirely.
- Initialize `catalogItems` to `[]`.
- In `loadCatalog()`, always `setCatalogItems(items ?? [])` (remove the `.length > 0` gate) so an empty inventory renders as genuinely empty. `CatalogueSearch` already has a correct empty state ("No X items found... + Add to prescription"), so no downstream change needed there.

---

## 4 & 6. Treatment subsections: Immediate / Prescribed / Injectable need different add-behavior

**Files:** [InventoryItemSection.tsx](src/components/erp/clinical/prescription/InventoryItemSection.tsx), [CatalogueSearch.tsx](src/components/erp/clinical/prescription/CatalogueSearch.tsx), [PrescriptionWorkflow.tsx](src/components/erp/clinical/prescription/PrescriptionWorkflow.tsx) (lines 1204-1264).

Today all 3 subsections use the same `<CatalogueSearch>`, which includes a "no match → + Add '<x>' to prescription" fallback that creates a custom (non-inventory) line **in whichever section you searched from**. That's why typing "had" inside *Immediate Medication* adds a fake-priced custom item straight into Immediate Medication (screenshots 3-4) — but immediate/injectable meds are dispensed from real stock right now and must be real, priced, stock-backed items; only the Prescribed Medicine section is meant to hold free-text, non-stock items.

**Fix:**
- **Immediate Medication & Injectable** (stock-bound, dispensed now): add an `allowCustomAdd?: boolean` prop to `CatalogueSearch` (default `true`). Pass `allowCustomAdd={false}` for these two sections so the "+Add custom" fallback buttons are hidden — you can only add items that actually exist in inventory.
- **Prescribed Medicine** (for-home, not from stock): remove `<CatalogueSearch>` for this section entirely. Replace it with a small always-visible "type a medicine name → Add" inline input (no dropdown, no server fetch, no price/stock lookup) directly in `InventoryItemSection.tsx`, gated on `section === "PRESCRIBED_MED"`. This satisfies "always add first, remove the search option" since prescribed medicines are never expected to be in inventory.

---

## 5. Prescribed Medicine should not carry a price / billing amount

**Files:** [InventoryItemSection.tsx](src/components/erp/clinical/prescription/InventoryItemSection.tsx), [PrescriptionWorkflow.tsx](src/components/erp/clinical/prescription/PrescriptionWorkflow.tsx) (lines 1224-1243, and bill-line generation at 758-773).

Prescribed (take-home) medicines are currently priced like real dispensed stock (defaulting to ₹150/item) and get added into the final settlement bill (`rxSection: "PRESCRIBED_MED"` bill line at line 758-773) — overcharging for medicine the clinic isn't actually selling.

**Fix:**
- Add a `showPrice?: boolean` prop to `InventoryItemSection` (default `true`). When `false`, hide the "Net (₹)" column and the section subtotal footer.
- Pass `showPrice={false}` and remove `showFrequencyDuration={true}` for the Prescribed Medicine section, leaving exactly: **Item Name, Dosage/Advice, Qty, Unit** (drop Freq/Duration and Discount columns — not requested).
- New Prescribed Medicine lines get `unitPrice: 0`. In `PrescriptionWorkflow.tsx`'s bill-line builder (line 758-773), force `unitPrice: 0` for `PRESCRIBED_MED` lines too as a safety net, so these never inflate the settlement total even if old records had a price.

---

## 7. Injectable section — remove non-functional "Show all medicines (fallback)" toggle

**File:** [InventoryItemSection.tsx](src/components/erp/clinical/prescription/InventoryItemSection.tsx) — `showAllMedicines` state (line 119) and the toggle UI (lines 206-224).

This `Switch` is wired to local state but that state is never read anywhere else in the component — toggling it does nothing. Remove the state and the toggle UI block entirely (dead code).

---

## 8. Laboratory section — false "unsaved changes", hardcoded seed tests, redundant "Done" button

**Files:** [PrescriptionWorkflow.tsx](src/components/erp/clinical/prescription/PrescriptionWorkflow.tsx) (`handleSaveLaboratory`, lines 681-686), [LaboratoryOrderSection.tsx](src/components/erp/clinical/prescription/LaboratoryOrderSection.tsx) (`COMMON_LAB_TESTS` lines 39-52, dropdown lines 292-369).

**a) False-dirty bug (root cause found):** `handleSaveLaboratory` saves `{ enabled, dueDate, bloodTests }` but **omits `quickOption`**. `serializeSectionState("LABORATORY", ...)` includes `quickOption` in its comparison, so after every save, the stored snapshot has `quickOption: ""` while the live state still has e.g. `"TODAY"` — a permanent mismatch that makes the section look dirty forever after the first save (exactly what screenshots 7→8 show: "Saved 12:45 PM" then "Unsaved changes" with no user changes in between).
   **Fix:** add `quickOption: laboratory.quickOption` to the `handleSaveLaboratory` payload.

**b) Hardcoded seed tests:** `COMMON_LAB_TESTS` (CBC, Kidney Function, etc.) is a fixed in-code list, unrelated to any real lab test catalogue — it's the same class of bug as item 3.
   **Fix:** remove `COMMON_LAB_TESTS` and the "Suggested Laboratory Diagnostic Tests" list rendering. The search box becomes type-to-add-custom only (same empty-state pattern already used elsewhere): typing a name shows "+ Add Custom Test '<x>'". This matches "empty inventory → empty search" behavior consistently across the app; a real, persisted Lab Test Master (synced with `TestMasterCatalog`/`CreateLabOrderModal`, which also currently use their own separate hardcoded lists) would be a larger follow-up feature — flagged below, not bundled into this fix.

**c) Remove "Done" button / make dropdown dynamic:** `handleAddBloodTest` already closes the dropdown immediately on selection (line 94-95, 111-112), so the footer "Done" button is redundant. Remove it, and add a click-outside-to-close handler (`containerRef` + `mousedown` listener, same pattern already used in `CatalogueSearch.tsx` and `Shell.tsx`'s `GlobalSearch`) so the dropdown also closes when clicking away — no explicit confirm step needed anywhere.

---

## 6 & 7 (Follow-up section) — T+N scheduling, Treatment Follow-up books a real appointment

**Files:** [FollowUpSection.tsx](src/components/erp/clinical/prescription/FollowUpSection.tsx), [PrescriptionWorkflow.tsx](src/components/erp/clinical/prescription/PrescriptionWorkflow.tsx) (`handleSaveFollowUp`, line 676-680), [dateUtils.ts](src/lib/utils/dateUtils.ts) (`calculateQuickDate`), [appointments.ts](src/lib/mongodb/serverFns/appointments.ts) (`createAppointmentFn`/`updateAppointmentFn`).

`calculateQuickDate(baseDate, code)` (dateUtils.ts:196) already correctly implements **T+N** (`T` = visit date passed in as `baseDate`, `N` = days parsed from codes like `"3D"/"7D"/"1M"`) and is used by all 4 follow-up types (Treatment, Consultation, Vaccine, Deworming) plus the Laboratory schedule. **No formula change needed** — it's already correct; Consultation/Vaccine/Deworming stay exactly as-is per your "rest remain same with formula upgrade" (upgrade already present).

What's missing for **Treatment Follow-up** specifically: selecting a quick date (3/5/7/14 days) only stores a `dueDate` on the prescription — it doesn't create an actual queued appointment, so reception/doctors never see it on the Appointments board.

**Fix:**
- Extend `FollowUpEntry` (FollowUpSection.tsx) with an optional `appointmentToken?: string` so we don't create duplicate appointments on repeated saves.
- In `handleSaveFollowUp` (PrescriptionWorkflow.tsx), when `followUp.entries.TREATMENT.enabled` and has a `dueDate`: build an appointment payload from data already available in `PrescriptionWorkflow` (`visit.petId/petName`, `petDetails.species/breed`, owner info, `doctorName` prop, computed `dueDate`, `type: "Follow-up"`, `status: "Waiting"`, notes from `TREATMENT.notes`), and a generated token (`A-${100+random(900)}`, same scheme `BookAppointmentModal.tsx:43` already uses).
  - If `TREATMENT.appointmentToken` is not yet set → `createAppointmentFn`, store the returned token back onto the entry.
  - If it's already set and the date/notes changed → `updateAppointmentFn` with that token instead, so re-saving updates rather than duplicates.
- If `TREATMENT.enabled` is turned off after an appointment was created, no auto-delete is implemented (out of scope — reception can cancel it from the Appointments board like any other).

---

## 9. Clinical consultation summary panel — sticky offset & spacing

**File:** [LivePrescriptionSummaryPanel.tsx](src/components/erp/clinical/prescription/LivePrescriptionSummaryPanel.tsx) — wrapper `sticky top-14` (line 107).

Confirmed with you: this is the right-side "Prescribed Items / Settlement" panel in the consultation screen, not the dashboard. Root cause: the app's topbar (`Shell.tsx` `Topbar`) is `sticky top-0 h-16` (64px tall), but this panel sticks at `top-14` (56px) — an 8px mismatch that creates a visible gap/overlap glitch between the two sticky elements as the page scrolls.

**Fix:** change `sticky top-14` → `sticky top-16` so the panel's top edge sits flush against the bottom of the topbar with zero gap while scrolling. Also tighten the vertical spacing between the panel's internal line-item cards (`space-y-3` → `space-y-2`) so the itemized list reads more like one continuous bill.

---

## Also found during investigation (not in your list — flagging, not fixing unless you want it)

- `src/components/erp/billing/ManualBilling.tsx` ("Manual Billing" tab of the Billing module) has its own separate hardcoded `PRODUCTS`/`PETS` mock arrays, same class of bug as item 3, but not wired to real inventory/CRM at all yet.
- `src/lib/mongodb/serverFns/appointments.ts` has an unused `SEED_APPOINTMENTS` constant — dead code, never referenced.

---

## Verification

- Search bar: type a query, click anywhere on a result row → lands on Patient Record for that pet; pill buttons still work for their specific destinations.
- Open a fresh visit's prescription: Symptoms starts empty even when the OPD intake had a complaint recorded.
- With inventory empty (current prod state): Immediate/Prescribed/Injectable/Animal Food/Accessories search all show "no items found" + appropriate add option, no Amoxicillin/Rabies Vaccine/etc. fake entries anywhere.
- Immediate Medication: searching a non-existent medicine shows no "+Add custom" option (inventory-only). Injectable: same, plus the "Show all medicines" toggle is gone.
- Prescribed Medicine: no search box, just name/dosage/qty/unit fields, no price column, no price added to bill/settlement total.
- Laboratory: toggle Yes, save, reload the section (jump away and back) — stays "Saved", no false "Unsaved changes"; no fake CBC/Kidney/etc. suggestions when nothing typed; dropdown closes on outside click, no "Done" button.
- Follow-up: enable Treatment Follow-up, pick "3 days" → due date = visit date + 3; after saving, a new appointment appears on the Appointments Queue for that date/pet; saving again does not create a duplicate appointment.
- Consultation screen: scroll the left form with the right summary panel visible — panel sticks flush under the topbar with no gap, and line items sit closer together.
