# Clinical Consultation Workflow — Implementation Plan

**Scope:** Modify Part 1 (Doctor Rx & Diagnosis) UX and connect it to existing inventory catalogues; add Partial Payment capability to Part 2 (Billing & Settlement). Preserve the existing two-step architecture, all existing data, and all existing integrations.

---

## 0. Guiding Constraints (Read First)

| # | Constraint |
|---|---|
| 1 | Two-step architecture stays exactly as-is: **Step 1 = Doctor Rx & Diagnosis**, **Step 2 = Billing & Settlement**. No merge, no nesting, no 3rd step. |
| 2 | Billing & Settlement is never rendered inside, below, or as a sub-section of the Prescription page. It opens only via the existing step/tab navigation. |
| 3 | No new catalogues. Medicine, Food, and Accessories each keep exactly **one** source of truth: the existing Inventory module. |
| 4 | No forced dropdown/collapsible pattern everywhere — only Clinical Findings (multi-select) and the three catalogue searches (Medicine/Food/Accessories) are "search" or "multi-select" UI; everything else is a plain visible form block. |
| 5 | Receptionist-entered fields (Patient Name, Patient ID, Weight, Temperature, Date) are never re-entered by the doctor — only displayed/read. |
| 6 | No destructive changes: existing prescriptions, bills, inventory records, auth, and calculations must keep working. |

---

## 1. Discovery Phase (Do Before Writing Code)

Before touching UI, inspect and document the current codebase so changes are additive, not a rewrite.

**Checklist:**
- [ ] Locate the top-level consultation container component (the one that renders the Step 1 / Step 2 tab or wizard navigation).
- [ ] Locate the component currently labeled "Structured Clinical Workflow (9 Sections)" and enumerate its 9 child "Section" components.
- [ ] Identify the component/route responsible for **Billing & Settlement** and confirm how it currently receives data from Part 1 (props, global store, API fetch, route param, etc.).
- [ ] Identify the **Patient Details / Registration** entry point used by the receptionist (may be a separate screen from the doctor's consultation).
- [ ] Locate existing Inventory Catalogue APIs/services, and confirm they already expose:
  - Medicine search endpoint (filterable by type = medicine)
  - Food search endpoint (filterable by type = food)
  - Accessories search endpoint (filterable by type = accessory)
- [ ] Identify how "Clinical Findings" currently stores data (schema) to confirm we can keep the schema and only change the UI/interaction pattern.
- [ ] Identify current payment fields/schema in the billing table (e.g., `totalAmount`, `amountPaid`, `pendingAmount`, `paymentStatus`) so Partial Payment can extend rather than replace them.
- [ ] Confirm whether state between Part 1 and Part 2 is passed via a shared "consultation" record persisted to DB after each step, or held in client memory/context — this determines how "Billing receives prescription items" (Section 6 below) should be wired.

**Output of this phase:** a short internal note mapping each requirement in this document to the actual file/component it will touch. Do not proceed to implementation until this mapping exists — it prevents an unnecessary redesign.

---

## 2. Top-Level Navigation (No Change, Just Preserve)

Keep the existing 2-step flow:

```
Consultation
 ├── Step 1: Doctor Rx & Diagnosis   (prescription authoring)
 └── Step 2: Billing & Settlement    (payment + invoice)
```

Explicitly **not** doing:

```
Consultation
 └── Prescription
      └── Billing & Settlement   ❌ (nested — forbidden)
```

Implementation notes:
- If navigation is a tab component, no structural change needed — only Step 1's internal content changes.
- If navigation is a stepper/wizard, keep step count at 2. Do not add, remove, or reorder steps.
- The "Proceed to Billing & Settlement" action at the end of Step 1 continues to use whatever mechanism already exists (route push, step index increment, event emit) — do not replace this mechanism, just ensure it still fires after the new UI is in place.

---

## 3. Part 1 — Doctor Rx & Diagnosis: Target Component Layout

Replace the "9 collapsible section cards" pattern with a **single scrollable page of visible form blocks**, in this order:

```
Doctor Rx & Diagnosis                     [Date: DD-MMM-YYYY  ← top-right, read-only]
────────────────────────────────────────────────────────────
1. Patient Details (read-only, receptionist-entered)
2. Previous History (text area)
3. Symptoms (text area)
4. Clinical Findings (searchable multi-select)
5. Clinical Treatment (medicine search + selected list)
6. Clinical Follow-up (Next Vaccine / Deworming)
7. Food Items (food search + qty/unit/discount)
8. Accessories (accessory search + qty/discount)
────────────────────────────────────────────────────────────
                                   [ Proceed to Billing & Settlement → ]
```

Rename all visible headers from `"<N>. Section: <Name>"` / `"Section <N>"` style to plain `"<Name>"`. This is UI-label-only — do not rename backend field keys, DB columns, or API payload keys unless a key literally contains the display string "Section" and is only used for UI rendering (confirm during discovery phase before renaming anything backend-facing).

---

## 4. Patient Details

### 4.1 Receptionist-side (registration/intake screen — separate from doctor's view)
Fields entered **once**, before the doctor opens the consultation:
- Patient Name
- Patient ID / Reg ID
- Weight
- Body Temperature
- Date of Visit → rendered only as a small read-only label, top-right of the intake form

### 4.2 Doctor-side (inside Doctor Rx & Diagnosis)
- Render Patient Name, Patient ID, Weight, Body Temperature as a **read-only summary block** at the top of Step 1.
- Doctor must **not** get editable inputs for these fields on this screen (no re-entry).
- If a genuine correction is needed, that should route back to the receptionist/registration screen, not be edited inline in the doctor view (flag this as a follow-up decision if product wants an "edit" affordance later — out of scope for this change).
- Date shown top-right = date of visit (already captured at intake), read-only.

### 4.3 Data flow
- Consultation record is created/loaded via Patient ID at intake.
- Doctor's Step 1 screen fetches the consultation record (including receptionist-entered fields) by consultation/patient ID — do not duplicate storage of these fields in a separate "doctor draft" object.

---

## 5. Previous History — Simple Text Area

- Single `<textarea>` bound to `previousHistory` (or existing equivalent field — confirm exact field name in discovery phase).
- No structured sub-fields, no collapsible wrapper.
- Placeholder: "Enter previous medical history / notes".
- Preserve existing saved history data on load — do not clear or reformat existing records when rendering them in the new textarea.

---

## 6. Symptoms — Simple Text Area

- Single `<textarea>` bound to `symptoms`.
- No dropdown, no checkbox list, no nested "Section" wrapper.
- Placeholder: "Enter patient symptoms".
- Goal: fastest possible free-text entry for the doctor.

---

## 7. Clinical Findings — Searchable Multi-Select (the one exception)

- Component: searchable multi-select dropdown (e.g., typeahead + chip list of selected findings).
- Doctor can select multiple findings from a predefined findings list (existing schema/reference data — do not recreate, reuse existing findings master list if one exists; otherwise confirm source list with discovery phase).
- Include an **"Other"** option in the list.
- When "Other" is selected: reveal a manual free-text input (e.g., "Specify other finding") that is required only if "Other" is among the selected chips.
- Store findings as an array; store the "Other" free text as a separate linked field (e.g., `clinicalFindings: string[]`, `clinicalFindingsOtherText?: string`) so existing analytics/reporting on structured findings is not broken by mixing free text into the array.

---

## 8. Clinical Treatment — Medicine Search Connected to Inventory

### 8.1 UI
- Text input: "Search medicine…" with dynamic results appearing as the doctor types (debounced, e.g., 250–300ms).
- Selecting a result adds it to a **Selected Medicines** list shown immediately below the search box (name, dosage/strength if available, quantity, and a remove control per line).
- Doctor can add multiple medicines by repeating the search/select action.

### 8.2 Integration (critical)
- Search calls the **existing Inventory Medicine Catalogue** search/query endpoint — do not build a second medicine table or duplicate dataset.
- The query must filter results to `type = medicine` only (must exclude Food and Accessories records) — implemented via existing catalogue's type/category filter, not a new endpoint.
- If the existing inventory search endpoint is generic (returns all catalogue types), add a `type=medicine` query param/filter at the call site rather than modifying the shared endpoint's default behavior, to avoid breaking other existing consumers of that endpoint.

### 8.3 Data stored on prescription
Each selected medicine line references the inventory item (e.g., `inventoryItemId`), plus consultation-specific fields such as dosage instructions/quantity, so billing can later pull price from inventory and prescription-specific quantity from this record.

---

## 9. Clinical Follow-up

Simple two-part block, no nested sections:

**Next Vaccine**
- Yes/No toggle.
- If Yes → reveal date field (Vaccine Due Date).

**Deworming**
- Date field (Deworming Due Date) — always visible, simple.

No additional complexity beyond these fields.

---

## 10. Food Items — Connected to Inventory

- Search input: "Search food item…", dynamic results as the doctor types.
- Results sourced from the **existing Inventory Food Catalogue** only (`type = food` filter) — no duplicate food list.
- On selection, show the item with editable **Quantity** and **Unit** fields.
- Add a **Discount** field per food line (numeric, either % or flat amount — confirm existing billing discount convention during discovery and match it).
- Discount must dynamically recompute that line's amount (`amount = unitPrice * qty − discount`, or `unitPrice * qty * (1 − discount%)`, per existing discount convention).
- Multiple food items can be added; each is its own line with its own qty/unit/discount.
- Food Items stay on the Prescription page — they are **not** rendered as part of the Billing & Settlement UI; they only feed into the bill's line items when Step 2 loads.

---

## 11. Accessories — Connected to Inventory

- Search input: "Search accessory…", dynamic results as the doctor types.
- Results sourced from the **existing Inventory Accessories Catalogue** only (`type = accessory` filter) — no duplicate accessories list.
- On selection, show **Quantity** field.
- Add a **Discount** field (manual entry), dynamically recalculating the line amount, same convention as Food discount.
- Multiple accessories can be added as separate lines.

---

## 12. Catalogue Separation — Enforced Rule

```
Inventory (single source of truth)
 ├── Medicine Catalogue     → used only by Clinical Treatment search
 ├── Food Catalogue         → used only by Food Items search
 └── Accessories Catalogue  → used only by Accessories search
```

Implementation guardrails:
- One shared "catalogue search" component/hook, parameterized by `type` (`medicine | food | accessory`), calling the same underlying inventory service — avoids code duplication while still hitting one real data source per type.
- Do not let the Medicine search box return Food/Accessory results, or vice versa — enforce via the `type` filter param on every call, and add a unit test/assertion for each of the three search contexts confirming only the correct `type` is returned.

---

## 13. End of Part 1 → Transition to Part 2

- After completing sections 1–8 above (Patient Details view, Previous History, Symptoms, Clinical Findings, Clinical Treatment, Clinical Follow-up, Food Items, Accessories), show a clear call-to-action button, e.g. **"Proceed to Billing & Settlement →"**, or reuse the existing top navigation control that already advances the step — whichever mechanism the discovery phase identified.
- On transition, persist the completed prescription (medicines, food items w/ qty+discount, accessories w/ qty+discount) to the consultation record via the existing save mechanism.
- Step 2 (Billing & Settlement) reads its line items **from this persisted consultation record** — do not have Step 1 push data directly into a billing-specific in-memory state that bypasses persistence, since that would risk losing data if the doctor navigates away.

---

## 14. Part 2 — Billing & Settlement (Structure Unchanged)

- Keep the existing Billing & Settlement screen/route/component as-is structurally.
- It continues to receive/derive its line items (medicines, food, accessories with their prescribed qty and discount) from the Part 1 consultation record, per whatever existing billing architecture already pulls prescription data into a bill (confirm exact mechanism in discovery phase — likely an existing "generate bill from prescription" service/function).
- Do not turn the prescription page itself into a billing page. Do not render billing fields on Step 1.

---

## 15. Partial Payment — New Requirement in Part 2

### 15.1 Fields
Replace/extend the current single "amount" concept with:

| Field | Type | Editable | Notes |
|---|---|---|---|
| Total Amount | number | read-only (computed) | sum of all bill line items after discounts |
| Amount Received | number | **editable** | user enters actual amount paid |
| Pending Amount | number | **read-only (computed)** | `Total Amount − Amount Received`, auto-calculated, never manually entered |
| Payment Status | enum | read-only (derived) | `Full` / `Partial` / `Unpaid` |

### 15.2 Calculation logic

```
pendingAmount = totalAmount - amountReceived
```

- **Full Payment:** `amountReceived === totalAmount` → `pendingAmount = 0`, `paymentStatus = "Full"`.
- **Partial Payment:** `0 < amountReceived < totalAmount` → `pendingAmount = totalAmount - amountReceived` (> 0), `paymentStatus = "Partial"`.
- **No Payment:** `amountReceived === 0` → `pendingAmount = totalAmount`, `paymentStatus = "Unpaid"`.

### 15.3 Validation rules

- Reject `amountReceived > totalAmount` — show inline error (e.g., "Amount received cannot exceed total amount") and block save/submit until corrected.
- Reject negative values in `amountReceived` (`< 0`) — show inline error and block submit.
- Input field should be constrained to numeric input with `min=0` and (client + server-side) max validation against `totalAmount`; **never** trust client-only validation — validate again on the backend before persisting.
- `pendingAmount` field itself must be non-editable/derived only — no UI control should allow direct entry of pending amount, to guarantee it's always consistent with `totalAmount − amountReceived`.

### 15.4 Backward compatibility

- Existing bills already recorded as fully paid should map cleanly onto the new schema (`amountReceived = totalAmount`, `pendingAmount = 0`, `paymentStatus = "Full"`) — write a migration/backfill only if the schema is changing field names; if only adding new fields, default existing rows appropriately (e.g., `amountReceived = totalAmount` for historically closed bills) so historical reporting doesn't break.
- Do not remove or rename any existing payment-related fields relied on by existing invoices/reports without confirming downstream consumers in the discovery phase.

---

## 16. Data Model Touch Points (to confirm during discovery, then implement)

**Consultation / Prescription record**
- `patientDetails` (read from receptionist intake — no new writable fields here)
- `previousHistory: string`
- `symptoms: string`
- `clinicalFindings: string[]`
- `clinicalFindingsOtherText?: string`
- `treatments: [{ inventoryItemId, name, dosage/instructions, quantity }]`
- `followUp: { nextVaccine: boolean, vaccineDueDate?: date, dewormingDueDate?: date }`
- `foodItems: [{ inventoryItemId, name, quantity, unit, discount, amount }]`
- `accessories: [{ inventoryItemId, name, quantity, discount, amount }]`

**Billing record**
- existing line-item structure (unchanged), sourced from `treatments` + `foodItems` + `accessories`
- `totalAmount: number` (computed)
- `amountReceived: number` (new, user-entered)
- `pendingAmount: number` (new, computed, read-only)
- `paymentStatus: "Full" | "Partial" | "Unpaid"` (new/derived)

---

## 17. Component/File Plan (adjust paths to match actual repo once discovery is done)

```
/consultation
  ConsultationContainer.*          (unchanged: renders Step1/Step2 nav)
  /step1-doctor-rx
    DoctorRxPage.*                 (was: "9-section collapsible workflow")
    PatientDetailsSummary.*        (read-only, receptionist data)
    PreviousHistoryField.*         (textarea)
    SymptomsField.*                (textarea)
    ClinicalFindingsMultiSelect.*  (searchable multi-select + Other input)
    ClinicalTreatment.*
      MedicineSearch.*             (queries Inventory: type=medicine)
      SelectedMedicinesList.*
    ClinicalFollowUp.*             (vaccine + deworming)
    FoodItems.*
      FoodSearch.*                 (queries Inventory: type=food)
      SelectedFoodList.*           (qty, unit, discount, live amount)
    Accessories.*
      AccessorySearch.*            (queries Inventory: type=accessory)
      SelectedAccessoriesList.*    (qty, discount, live amount)
  /step2-billing
    BillingSettlementPage.*        (unchanged structure)
    PaymentPanel.*                 (NEW: amountReceived input, pendingAmount computed, status badge)
/shared
  CatalogueSearch.* (generic, parameterized by `type`, calls existing Inventory service)
```

---

## 18. Validation / QA Checklist Before Ship

- [ ] Step 1 and Step 2 remain two distinct steps; Billing never renders inside/below Prescription.
- [ ] "Section" wording removed from all Part 1 UI labels; no backend keys broken.
- [ ] Previous History and Symptoms are plain textareas, not collapsible/dropdown.
- [ ] Clinical Findings is a searchable multi-select; "Other" reveals manual text input.
- [ ] Medicine search returns **only** medicine-type inventory items; verified against a mixed catalogue.
- [ ] Food search returns **only** food-type items; Accessory search returns **only** accessory-type items.
- [ ] No second/duplicate catalogue was created for medicine, food, or accessories.
- [ ] Food and Accessory lines compute live amounts correctly when discount changes.
- [ ] Receptionist-entered Patient Name/ID/Weight/Temperature appear read-only on doctor's screen; doctor cannot edit or is not prompted to re-enter them.
- [ ] Date of Visit shown top-right, read-only, on both intake and doctor views.
- [ ] Proceeding from Step 1 persists all prescription data before Step 2 loads.
- [ ] Billing & Settlement correctly pulls line items (medicine/food/accessory) from the persisted prescription.
- [ ] Partial Payment: entering `amountReceived < totalAmount` auto-computes correct `pendingAmount` and sets status `Partial`.
- [ ] Full payment (`amountReceived === totalAmount`) sets `pendingAmount = 0`, status `Full`.
- [ ] Zero payment (`amountReceived = 0`) sets `pendingAmount = totalAmount`, status `Unpaid`.
- [ ] `amountReceived > totalAmount` is blocked with a visible error, both client- and server-side.
- [ ] Negative `amountReceived` is blocked with a visible error, both client- and server-side.
- [ ] `pendingAmount` cannot be manually typed into — always derived.
- [ ] Existing historical bills, prescriptions, inventory records, and auth flows are unaffected (regression pass on existing test suite / manual smoke test).

---

## 19. Suggested Rollout Order

1. Discovery phase (Section 1) — produce component/field mapping doc.
2. Backend: add `amountReceived` / `pendingAmount` / `paymentStatus` fields + validation to Billing API (Section 15), with backfill for existing rows (Section 15.4). Ship behind a flag if needed.
3. Frontend: build generic `CatalogueSearch` component (Section 12) wired to existing Inventory endpoints with `type` filter; unit test the three type-filtered contexts.
4. Frontend: rebuild Part 1 page using the flat-block layout (Sections 3–11), reusing `CatalogueSearch` for Medicine/Food/Accessories, replacing the 9-collapsible-card pattern.
5. Frontend: build `PaymentPanel` in Part 2 (Section 15) with live pending-amount calculation and validation.
6. Wire Step 1 → Step 2 hand-off (Section 13–14) using existing persistence/billing-generation mechanism.
7. Full regression pass per Section 18 checklist.
8. Staged rollout (internal/staff testing → limited clinics → full rollout), monitoring for any billing calculation discrepancies given this touches payment logic.

---

## 20. Explicit Non-Goals (Do Not Do)

- ❌ Do not merge Part 1 and Part 2 into a single page.
- ❌ Do not add a third step/tab.
- ❌ Do not create new Medicine, Food, or Accessories catalogues.
- ❌ Do not make Previous History, Symptoms, Clinical Treatment, Follow-up, Food, or Accessories collapsible "Section" cards — only Clinical Findings and the three catalogue searches use search/multi-select patterns.
- ❌ Do not let the doctor re-enter Weight/Temperature/Patient Name/ID.
- ❌ Do not allow manual entry of Pending Amount.
- ❌ Do not remove or overwrite existing prescriptions, bills, or inventory data during migration.