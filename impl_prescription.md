# Implementation Plan — Doctor Rx & Diagnosis Rework

Veterinary ERP · Prescription ↔ Inventory ↔ Billing ↔ Laboratory

---

## 0. How to use this plan

The plan is split into 12 phases. Each phase has a scope, concrete tasks, and an exit check you should verify before moving on. Phases are ordered by dependency: the data layer and save/sync machinery come first, then a thin end-to-end slice (Consultation Fee → Billing) that proves the architecture, then the remaining sections, which mostly reuse what the slice built.

Code samples use PostgreSQL and TypeScript for concreteness. Table and column names are illustrative: in every case, map them onto what already exists in your codebase (Phase 0 tells you what that is). If you're on MongoDB/Firestore, the same keys and uniqueness rules apply as document IDs and unique indexes.

The last section explains how to drive this with Antigravity one phase at a time, which will give you far better results than pasting the full 26-section prompt in one go.

---

## 1. Core design decisions

Almost every bug the requirements warn about (duplicate bill lines, duplicate lab orders, double stock deduction, lost edits) comes from a handful of structural choices. Getting these right up front is most of the work.

**1.1 One prescription per visit.** The prescription is fetched with a get-or-create call keyed on `visit_id`, backed by a unique constraint. Two section saves racing each other can never create two prescriptions.

**1.2 Every line item gets a stable ID generated on the client** the moment it's added (a UUID). That ID never changes across saves and edits. It is the idempotency key for the item, the key for its billing line, and (for blood tests) the key for its lab order. This single decision is what makes "save → reopen → change qty → save" update rather than duplicate.

**1.3 Section save uses "replace this section's set" semantics.** The client sends the full current list for one section. The server diffs it against what's stored: new IDs are inserted, known IDs are updated, missing IDs are removed. Sending the same payload twice produces the same result, so saves are idempotent by construction.

**1.4 One generic item model for the six inventory-backed sections.** Immediate Medication, Prescribed Medicine, Injectable, Animal Food, Prescribed Food and Accessories are all "an inventory item with qty, unit, price, discount, and notes", distinguished by a `section` value. One backend code path and one reusable UI component serve all six.

**1.5 Price comes from inventory, and is snapshotted on the line.** The server (never the client) reads name, brand, unit and price from the inventory item when a line is first added, and stores a copy on the prescription line. The requirement says "don't maintain an independent price", and this respects it: inventory is the only source. The snapshot exists so that a bill doesn't silently change if someone edits the inventory price next week. Editing qty or discount later keeps the original price.

**1.6 Billing lines are linked to their source, and only ever upserted.** Each billing line created from the prescription carries `source_type` + `source_id` (the item's stable ID, or the prescription ID for the consultation fee), protected by a unique index. Sync code does `INSERT … ON CONFLICT DO UPDATE`, so a duplicate line is impossible at the database level, not just "avoided" in code. Manually added billing lines have no source and are untouched by sync.

**1.7 The right-side panel is live; the billing record updates on save.** The Prescribed Items panel recalculates instantly from local state on every keystroke. The billing record in the database updates when a section is saved (or on Save Draft / Proceed to Billing). The panel shows an "unsaved" indicator when the two differ. This is how "immediately reflected in billing" is interpreted; confirm it with the doctor (see §2).

**1.8 Stock moves exactly once, at settlement.** Prescription saves never touch stock. Stock is deducted when the bill is settled (or at whatever dispensing point the existing system already uses), with each stock transaction keyed to its billing line by a unique index. Settling twice can't deduct twice.

**1.9 Lab orders are linked to their source and are cancelled, never deleted.** Same pattern as billing: `source_type` + `source_id` with a unique index. Removing a blood test cancels a not-yet-started lab order and is blocked once the sample has been collected.

**1.10 Every save is one database transaction.** Prescription rows, billing lines, bill totals and lab orders for a save either all commit or all roll back. A network failure halfway through can't leave a billing line without its prescription item.

**1.11 Dates are stored as dates and formatted only at display.** Follow-up dates are stored as `DATE` (no time component), sent over the API as `YYYY-MM-DD`, and shown as DD/MM/YYYY. Never use `toISOString()` to produce a date string in the browser: in IST, local midnight is 18:30 the previous day in UTC, which produces the classic "saved date is one day early" bug.

---

## 2. Decisions to confirm with the doctor / clinic owner before coding

These are genuine ambiguities in the requirements. Each has a recommended default so work isn't blocked, but a five-minute conversation now avoids rework later.

| # | Question | Recommended default | Why it matters |
|---|----------|--------------------|----------------|
| 1 | Is "Previous History" cumulative per patient, or a note per visit? | Per-visit note, with earlier visits' notes shown read-only above it | Decides whether it's stored on the visit or the patient |
| 2 | Is Prescribed Medicine always sold by the clinic, or sometimes bought outside? | Always billable for now; a "buy outside" toggle can be added later | If some are bought outside, auto-billing them would overcharge |
| 3 | Can the doctor edit billable items after the bill is settled? | No: billable sections lock with a banner once the bill is settled | Otherwise a paid bill can silently change |
| 4 | Does the Laboratory module already add test charges to the bill? | Assume yes; blood tests do **not** create prescription billing lines | Avoids charging for CBC twice |
| 5 | When does stock deduct today: prescription save, billing, settlement, or dispensing? | Keep whatever exists; if none, deduct at settlement | Must be exactly one point |
| 6 | Quick dates ("1 Month") count from the visit date or from today? | Visit date | Reopening an old Rx next week shouldn't shift dates |
| 7 | Should ₹0 "Free / Follow-up" appear on the bill? | Yes, as a ₹0 line | Shows the fee was waived deliberately, not forgotten |
| 8 | Can billing staff change qty/price on doctor-added lines? | No: those lines are read-only in Billing ("Edit in prescription"); bill-level discount still allowed | Prevents the doctor's next save from overwriting billing's changes |
| 9 | Should Vaccine / Deworming follow-ups feed an existing vaccination or reminder module? | Only if one already exists; otherwise just store dates | Scope control |

---

## 3. Phase 0 — Discovery (no code changes)

**Goal:** know exactly what exists before touching anything. Everything later references this.

**Setup:** create a git branch (`feature/rx-rework`), take a full database backup, and confirm the app runs locally against a copy of real data.

**Baseline capture:** pick three existing visits that already have bills. Record for each: bill total, number of bill lines, and a screenshot of the prescription and billing pages. After migrations (Phase 1) these must be identical.

**Discovery checklist.** Produce a `DISCOVERY.md` answering each item with file paths and line numbers.

| Area | What to find | Why |
|------|--------------|-----|
| Prescription page | Main component(s), child components, how state is managed (Context / Redux / Zustand / local state) | Where the new sections plug in |
| Symptoms default | Every place the text "Routine consultation and health checkup" appears: frontend initial state, backend default, DB column default, receptionist intake copying "reason for visit", printed Rx template | All must be removed or the text will keep reappearing |
| Medicine search | Endpoint, query (which fields: name/generic/brand?), active filter, response shape | Reuse, extend with a filter param |
| Food & accessory search | Same as above | Reuse unchanged |
| Inventory schema | Does the medicine table have dosage form / formulation / category / type? | Decides how Injectable filtering works |
| Prescription item storage | One table for all items, or separate per catalogue? Primary key type (UUID or integer)? | Decides migration shape |
| Consultation fee | Where it lives today (the screenshot design suggests it may already be in the Billing step) | The fee must live in exactly one place |
| Billing | How a bill is created, how lines are added, the total calculation function, taxes/GST, bill statuses, whether multiple bills per visit are possible | Sync must call existing logic, not duplicate it |
| Stock deduction | Every call site that decrements stock | If there's already more than one, that's an existing double-deduction risk |
| Laboratory | Order table, statuses, test master/catalogue, creation API, whether it bills | Lab integration |
| Follow-ups | Any existing follow-up, reminder, or vaccination-schedule tables | Reuse rather than duplicate |
| Save Draft | What it currently saves and how | New section saves must cooperate with it |
| Dates | Existing date formatting utility and date picker component | Reuse for DD/MM/YYYY |
| Right panel | Where "Prescribed Items" gets its data | Will become a derived view |
| Tests | Existing test setup, if any | Where new tests go |

**Exit check:** `DISCOVERY.md` is complete, reviewed by you, and the decisions in §2 are answered.

---

## 4. Phase 1 — Data model (additive, backward-compatible migrations)

**Rules:** only add columns/tables/indexes. No drops, no renames, no type changes. New columns are nullable or have defaults. The old code must run unchanged against the migrated database. Make migrations idempotent (`IF NOT EXISTS`).

### 4.1 Prescription header

```sql
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS previous_history        TEXT,
  ADD COLUMN IF NOT EXISTS consultation_fee        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS consultation_fee_preset VARCHAR(20),
  ADD COLUMN IF NOT EXISTS followup_required       BOOLEAN,          -- NULL = not answered yet
  ADD COLUMN IF NOT EXISTS version                 INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS section_saved_at        JSONB   NOT NULL DEFAULT '{}'::jsonb;

-- One prescription per visit. Check for existing duplicates FIRST and resolve them manually:
--   SELECT visit_id, count(*) FROM prescriptions GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS ux_prescriptions_visit ON prescriptions(visit_id);
```

If symptoms/history/findings already live elsewhere (a visit or consultation table), keep them there and skip the matching columns.

### 4.2 Prescription items

**If all items are already in one table** (likely for medicines at least):

```sql
ALTER TABLE prescription_items
  ADD COLUMN IF NOT EXISTS section        VARCHAR(20) NOT NULL DEFAULT 'PRESCRIBED_MED',
  ADD COLUMN IF NOT EXISTS catalogue_type VARCHAR(12) NOT NULL DEFAULT 'MEDICINE',
  ADD COLUMN IF NOT EXISTS unit_price     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS discount_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dosage         TEXT,
  ADD COLUMN IF NOT EXISTS instructions   TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;

ALTER TABLE prescription_items ADD CONSTRAINT chk_rx_section CHECK (section IN
  ('IMMEDIATE_MED','PRESCRIBED_MED','INJECTABLE','ANIMAL_FOOD','PRESCRIBED_FOOD','ACCESSORY'));
```

**If food and accessories are in separate tables,** keep them separate. Add `section` only to the food table (`ANIMAL_FOOD` default) and add the price/discount/deleted_at columns where missing. The backend service in Phase 2 can work over either layout.

**If the item primary key is an auto-increment integer,** add `client_uid UUID UNIQUE` and use it everywhere this plan says "item ID". Don't change the existing PK.

**Backfill:** existing medicine rows default to `PRESCRIBED_MED`, food to `ANIMAL_FOOD`, accessories to `ACCESSORY`. Backfill `unit_price` from whatever price field the old rows use. Old prescriptions will therefore open with their items under Prescribed Medicine, which is the least surprising place.

### 4.3 Inventory: identifying injectables

If the medicine table already has a dosage form / category field, reuse it and skip this. Otherwise:

```sql
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS dosage_form VARCHAR(30);   -- nullable

-- Heuristic backfill; produce a review list for the clinic afterwards
UPDATE medicines SET dosage_form = 'INJECTION'
 WHERE dosage_form IS NULL
   AND (name ILIKE '%inj%' OR name ILIKE '%vaccine%' OR name ILIKE '%vial%');
```

Export the list of tagged items for the clinic to check, and add the field to the inventory edit form so they can fix tags. Until tagging is complete, the Injectable search gets a "show all medicines" fallback (see Phase 6) so the doctor is never blocked by incomplete data.

### 4.4 Follow-ups

Reuse an existing follow-up table if Phase 0 found one. Otherwise:

```sql
CREATE TABLE IF NOT EXISTS prescription_followups (
  id              UUID PRIMARY KEY,
  prescription_id <same type as prescriptions.id> NOT NULL REFERENCES prescriptions(id),
  visit_id        <fk> NOT NULL,
  patient_id      <fk> NOT NULL,
  type            VARCHAR(20) NOT NULL
                  CHECK (type IN ('TREATMENT','CONSULTATION','VACCINE','DEWORMING','BLOOD_TEST')),
  due_date        DATE,
  quick_option    VARCHAR(10),              -- e.g. '7D', '1M', 'CUSTOM'
  notes           TEXT,
  status          VARCHAR(12) NOT NULL DEFAULT 'SCHEDULED',  -- SCHEDULED | DONE | CANCELLED
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_followup_type
  ON prescription_followups(prescription_id, type) WHERE status <> 'CANCELLED';

CREATE TABLE IF NOT EXISTS prescription_followup_tests (
  id                 UUID PRIMARY KEY,       -- client-generated; becomes the lab order's source_id
  followup_id        UUID NOT NULL REFERENCES prescription_followups(id),
  lab_test_id        <fk to existing lab test master>,
  test_name_snapshot TEXT NOT NULL,
  deleted_at         TIMESTAMPTZ
);
```

### 4.5 Source links on billing, lab and stock

```sql
-- Billing lines
ALTER TABLE bill_items
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20),   -- 'RX_ITEM' | 'RX_CONSULT' | NULL = manual line
  ADD COLUMN IF NOT EXISTS source_id   VARCHAR(64),
  ADD COLUMN IF NOT EXISTS rx_section  VARCHAR(20);   -- for grouping in the billing UI
CREATE UNIQUE INDEX IF NOT EXISTS ux_bill_items_source
  ON bill_items(source_type, source_id) WHERE source_id IS NOT NULL;

-- Lab orders
ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(24),   -- 'RX_FOLLOWUP_TEST'
  ADD COLUMN IF NOT EXISTS source_id   VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS ux_lab_orders_source
  ON lab_orders(source_type, source_id) WHERE source_id IS NOT NULL;

-- Stock transactions
ALTER TABLE stock_transactions
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20),   -- 'BILL_LINE'
  ADD COLUMN IF NOT EXISTS source_id   VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS ux_stock_source
  ON stock_transactions(source_type, source_id, txn_type) WHERE source_id IS NOT NULL;
```

`txn_type` is in the stock index so a SALE and its later RETURN/REVERSAL can both exist for the same bill line. Also add a unique index so there's at most one open (draft) bill per visit, unless Phase 0 showed the system legitimately uses several.

Money columns stay `NUMERIC`, never `FLOAT`.

**Exit check:** migrations run cleanly on a copy of production data; the old app runs with no errors; the three baseline visits show identical bill totals and line counts.

---

## 5. Phase 2 — Backend services and APIs

### 5.1 Endpoints

Adapt paths to your existing conventions. All mutating endpoints take the prescription `version` for optimistic locking and return the updated section, the new `version`, and an authoritative billing summary.

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `POST /visits/{visitId}/prescription/ensure` | Get or create the visit's prescription and return everything | Idempotent; relies on the unique index. Keep the existing pattern if the app already creates it on open |
| `PUT /prescriptions/{id}/history` | Save Previous History | `{ text, version }` |
| `PUT /prescriptions/{id}/symptoms` | Save Symptoms | Empty string allowed; no server-side default ever |
| `PUT /prescriptions/{id}/findings` | Save Clinical Findings | `{ findings: [{ id, findingId?, customText? }] }`, replace-set |
| `PUT /prescriptions/{id}/items/{section}` | Save one inventory-backed section | Replace-set + billing sync in one transaction |
| `PUT /prescriptions/{id}/consultation-fee` | Save fee | `{ amount, preset, version }` + billing sync |
| `PUT /prescriptions/{id}/followups` | Save all follow-ups | `{ required, entries[], bloodTests[] }` + lab sync |
| `PUT /prescriptions/{id}/draft` | Save Draft: all sections | One transaction, calls the same service functions |
| `GET /prescriptions/{id}/billing-summary` | Authoritative totals for the panel | Uses the existing billing calculation |
| Existing medicine search | Add optional `dosageForm` and `activeOnly` params | Backward compatible: no params = current behaviour |

### 5.2 Section save algorithm

This one function backs all six inventory sections.

```
saveItemsSection(prescriptionId, section, payload):
  BEGIN TRANSACTION
    rx = SELECT prescription FOR UPDATE
    if rx.version != payload.version      -> 409 CONFLICT ("updated elsewhere, reload")
    if billIsSettled(rx.visit_id)          -> 409 BILL_SETTLED

    existing = active items WHERE prescription_id = rx.id AND section = section

    for item in payload.items:
      validate(item)                                   # §5.8
      if item.id in existing:
        UPDATE qty, unit, discount_pct, dosage, instructions
        recompute net using the STORED unit_price       # price snapshot is not refreshed
      else:
        inv = inventory.get(item.inventoryItemId)
        require inv.active and inv.catalogue matches section
        INSERT with name, brand, generic, unit, unit_price copied FROM inv   # never from client

    removed = existing whose id is not in payload
    soft-delete removed (set deleted_at)

    billingSync(tx, rx, upserted = payload.items, removed = removed)
    rx.version += 1
    rx.section_saved_at[section] = now()
  COMMIT
  return { items, version, billingSummary }
```

Because the payload is a full set with stable IDs, a retried request produces the same end state. The version check protects against two people editing the same prescription; on 409 the UI reloads and tells the user.

### 5.3 Billing sync service

```
billingSync(tx, rx, upserted, removed):
  bill = getOrCreateOpenBill(tx, rx.visit_id)      # reuse existing bill creation logic

  for item in upserted:
    INSERT INTO bill_items (bill_id, source_type, source_id, rx_section, description,
                            qty, unit_price, discount_pct, net_amount, inventory_item_id)
    VALUES (bill.id, 'RX_ITEM', item.id, item.section, ...)
    ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
    DO UPDATE SET qty = EXCLUDED.qty, unit_price = EXCLUDED.unit_price,
                  discount_pct = EXCLUDED.discount_pct, net_amount = EXCLUDED.net_amount,
                  description = EXCLUDED.description

  for item in removed:
    DELETE FROM bill_items WHERE source_type = 'RX_ITEM' AND source_id = item.id

  recalculateBillTotals(tx, bill)                  # the EXISTING function; do not write a new one
```

Deleting lines is safe here because the bill is guaranteed to be open (settled bills were rejected earlier). Manual lines (no `source_id`) are never touched.

### 5.4 Consultation fee

Stored on the prescription header. Billing sync upserts a single line with `source_type = 'RX_CONSULT'`, `source_id = prescription.id`, description "Doctor Consultation". Changing ₹500 to ₹800 updates that one line. If Phase 0 found the fee currently lives in the Billing step, migrate that field to read from the prescription and make it read-only in Billing, so there is only one place the fee is set.

### 5.5 Follow-ups and laboratory sync

```
saveFollowups(prescriptionId, payload):
  BEGIN TRANSACTION
    lock rx, check version and settled state (settled lock applies only if tests are billable here)
    rx.followup_required = payload.required

    if payload.required == false:
      mark all active follow-ups CANCELLED
      treat every existing blood test as removed  -> labSync handles it (may block, see below)
    else:
      upsert follow-up rows by (prescription_id, type); cancel types no longer enabled
      replace-set blood tests under the BLOOD_TEST follow-up

    labSync(tx, rx, currentTests, removedTests)
    bump version
  COMMIT

labSync(tx, rx, currentTests, removedTests):
  for t in currentTests:
    order = find lab_order by ('RX_FOLLOWUP_TEST', t.id)
    if order is null:
      create via EXISTING lab order creation logic with patient_id, patient name, visit_id,
      owner, doctor, order date, scheduled date = follow-up due date, test, category,
      prescription reference, status 'ORDERED', source_type/source_id set
    elif order.status == 'ORDERED':
      update test and scheduled date if changed
    else:
      if test changed -> 409 "Sample already collected; change it from Laboratory"

  for t in removedTests:
    order = find by source
    if order.status == 'ORDERED': set status 'CANCELLED', reason 'Removed from prescription'
    elif order exists:            409 "Sample already collected; cancel from Laboratory"
```

Lab orders are created only on save, never on selection, so a test added and removed before saving never reaches the lab. Validation for blocked removals happens inside the transaction, so a 409 leaves nothing half-applied.

### 5.6 Search extension

Add optional `dosageForm` (e.g. `INJECTION,VACCINE`) and `activeOnly` to the existing medicine search query. Make sure the query matches name, generic name and brand. Include available stock and unit in the response so the UI can show them. Food and accessory search stay as they are.

### 5.7 Save Draft

Accepts every section's current state and calls the same service functions in sequence inside one transaction. It is not a separate code path, which is what keeps it from ever disagreeing with section saves. Invalid sections are reported back per section; valid ones still save.

### 5.8 Validation rules (server-side; mirror them in the UI)

| Field | Rule |
|-------|------|
| Qty | > 0 and ≤ 9999; whole number unless the unit allows decimals (ml, g) |
| Discount % | 0–100 |
| Consultation fee | 0–1,00,000 |
| Inventory item (new lines) | Must be active, and its catalogue must match the section (no food in Injectable) |
| Inventory item (existing lines) | May have become inactive since; keep it and flag it, don't reject |
| Follow-up date | Required when a type is enabled; not earlier than the visit date |
| Blood test | At least one test and a date when enabled |
| Stock | Warn when qty exceeds available stock; block only if the existing system blocks |

**Exit check:** automated tests for §14.2 items T1–T10 pass against the API alone, before any UI work.

---

## 6. Phase 3 — Frontend foundation

### 6.1 State shape

Keep it in whatever state library the page already uses.

```ts
type ItemSection =
  | 'IMMEDIATE_MED' | 'PRESCRIBED_MED' | 'INJECTABLE'
  | 'ANIMAL_FOOD' | 'PRESCRIBED_FOOD' | 'ACCESSORY';

type SectionKey = ItemSection | 'HISTORY' | 'SYMPTOMS' | 'FINDINGS' | 'FEE' | 'FOLLOWUP';

interface RxItem {
  id: string;                 // generated once on add, never regenerated
  inventoryItemId: string;
  name: string; brand?: string; genericName?: string;
  unit: string;
  qty: number;
  unitPrice: number;          // display only; the server is authoritative
  discountPct: number;
  dosage?: string; instructions?: string;
  availableStock?: number;
  inactive?: boolean;         // inventory item deactivated after it was prescribed
}

interface RxState {
  prescriptionId: string; visitId: string; patientId: string;
  version: number;
  history: string;
  symptoms: string;           // '' by default, never pre-filled
  findings: { id: string; findingId?: string; customText?: string }[];
  items: Record<ItemSection, RxItem[]>;
  fee: { amount: number | null; preset: string | null };
  followUp: {
    required: boolean | null;
    entries: Partial<Record<FollowUpType, { id: string; dueDate: string | null;
                                            quickOption?: string; notes?: string }>>;
    bloodTests: { id: string; labTestId: string; name: string }[];
  };
  lastSaved: Record<SectionKey, string>;                 // JSON snapshot at last save
  status: Record<SectionKey, 'idle' | 'saving' | 'saved' | 'error'>;
}
```

A section is dirty when `JSON.stringify(currentValue) !== lastSaved[section]`. No manual dirty flags to forget.

**UUID gotcha:** `crypto.randomUUID()` only exists in secure contexts (HTTPS or localhost). Clinics often run these systems over plain HTTP on a LAN IP, where it is `undefined`. Use the `uuid` package (or a fallback) instead.

### 6.2 Shared building blocks

**`SectionCard`**: header with title, status chip, and a compact "Save ✓" button (disabled when not dirty or while saving). Collapsible. Status chip states: "Not saved yet" (grey), "Unsaved changes" (amber), "Saving…", "✓ Saved 10:42" (green), "Save failed · Retry" (red). A toast "✓ Saved successfully" on success.

**`useSectionSave(sectionKey, saveFn)`**: handles saving status, disables double submits, applies the server response (new version, normalized items, billing summary), updates `lastSaved`, and on 409 reloads the prescription and shows a message.

**`InventoryItemSection`**: the one component behind all six item sections.

```ts
interface InventoryItemSectionProps {
  section: ItemSection;
  title: string;
  catalogue: 'MEDICINE' | 'FOOD' | 'ACCESSORY';
  searchFilter?: { dosageForm?: string[] };   // Injectable only
  showDosage?: boolean;                        // medicines
  showDiscount?: boolean;                      // food, accessories
  saveLabel: string;                           // "Save Injectable", etc.
}
```

It wraps the existing search input (reused, not rewritten), the item table (name, brand, qty, unit, price, discount, net, dosage/instructions, remove), stock warning, and inactive badge. Selecting a search result adds a line with a fresh ID and moves focus to the qty field.

**Shared money calculation.** One function used by the panel and mirrored from the existing billing logic. Compute in paise to avoid floating-point drift:

```ts
export function lineNet(qty: number, unitPrice: number, discountPct: number): number {
  const grossPaise = Math.round(qty * unitPrice * 100);
  const netPaise = Math.round(grossPaise * (1 - discountPct / 100));
  return netPaise / 100;
}
```

If the existing billing adds GST or rounds differently, match it exactly. After every save the server returns the authoritative summary; in development, log a warning if it differs from the local calculation so any mismatch is caught early.

**Navigation guard:** warn on leaving the page (route change and `beforeunload`) when any section is dirty.

**Section jump bar:** a sticky row of chips at the top (History · Symptoms · Findings · Treatment · Fee · Follow-up · Food · Accessories), each with an amber dot when unsaved. This does more for the "page is too long" problem than any restyling.

**Exit check:** the page loads existing prescriptions through the new state without visual changes; dirty detection works; no regressions in the current UI.

---

## 7. Phase 4 — Vertical slice: Consultation Fee → Billing

Build this first, end to end, before the other sections. It's the simplest billable section, and it proves every piece of the architecture: section save, version handling, transactional billing sync, the upsert, the live panel, and the billing page showing a linked line.

**UI:** placed after Clinical Treatment. Reuse the existing fee design. A numeric input with ₹ prefix, plus preset chips: ₹0 Free / Follow-up, ₹300 Re-check, ₹500 Standard, ₹800 Specialist, ₹1200 Emergency / Surgery. Clicking a preset fills the input and highlights the chip; typing a custom amount clears the highlight unless it matches a preset. "Save Consultation Fee" button.

**Exit check:** set ₹500, save → Billing shows one "Doctor Consultation ₹500" line. Change to ₹800, save → still one line, now ₹800. Save three more times → still one line. The panel updated instantly before each save and showed "unsaved" until saved.

---

## 8. Phase 5 — Previous History, Symptoms, Clinical Findings

**Previous History:** a textarea for this visit plus, if decision §2.1 is per-visit, a collapsed "Earlier history" list showing previous visits' notes read-only with their DD/MM/YYYY dates. "Save History" button.

**Symptoms:** remove the default text from every location found in Phase 0: frontend initial state, any `symptoms || 'Routine…'` fallback on the server, DB column default, intake-to-symptoms copying, and the printed Rx template. Do not modify historical records that already contain the text; they are real saved data. Placeholder text in the empty field (e.g. "Enter presenting symptoms") is fine, since it isn't a value. "Save Symptoms" button.

**Clinical Findings:** keep the existing search/select exactly. Add "Other" free-text entries if not already supported. Each finding gets a stable ID; save is replace-set. "Save Clinical Findings" button.

**Exit check:** a new visit shows a blank symptoms field; saved text in all three reappears on reload; editing and re-saving updates rather than adds rows; old visits still show their old symptoms.

---

## 9. Phase 6 — Clinical Treatment (three subsections)

Three `InventoryItemSection` instances inside one "Clinical Treatment" card:

| Subsection | Section value | Search | Extra fields |
|------------|--------------|--------|--------------|
| Immediate Medication | `IMMEDIATE_MED` | Existing medicine search, all active medicines | Dosage / instructions |
| Prescribed Medicine | `PRESCRIBED_MED` | Existing medicine search (name, generic, brand) | Dosage / instructions |
| Injectable | `INJECTABLE` | Same search with `dosageForm = INJECTION,VACCINE` | Dosage / route / instructions |

The Injectable search includes a small "Show all medicines" toggle for items not yet tagged in inventory. Items selected through the fallback are still stored as `INJECTABLE` lines, because the section, not the inventory tag, determines where they sit.

The same inventory item may legitimately appear in two subsections (e.g. a first dose given now and a course prescribed for home). They're separate lines with separate IDs and separate bill lines. Within one subsection, adding the same item twice shows a gentle "already added, increase qty instead?" prompt but doesn't block.

Items whose inventory record has since been deactivated still display, with an "Inactive in inventory" badge, and still bill at their snapshot price. They just can't be newly added.

**Exit check:** all three subsections search inventory, save independently, sync to billing, and reopen correctly; legacy prescriptions show their items under Prescribed Medicine.

---

## 10. Phase 7 — Food Items and Accessories

These are two more instances of the same component, which is the payoff of Phase 3.

| Subsection | Section value | Search | Extra fields |
|------------|--------------|--------|--------------|
| Animal Food | `ANIMAL_FOOD` | Existing food search | Discount, net |
| Prescribed Food | `PRESCRIBED_FOOD` | Existing food search | Discount, net, feeding instructions (optional) |
| Accessories | `ACCESSORY` | Existing accessory search (name, category) | Discount, net |

Buttons: "Save Animal Food", "Save Prescribed Food", "Save Accessories".

**Exit check:** Royal Canin Maxi Adult 4kg ₹1850 × 1, 0% discount, saves and appears on the bill as ₹1850; Pet Collar ₹500 × 1 likewise; repeated saves never add lines.

---

## 11. Phase 8 — Clinical Follow-up and quick dates

### 11.1 UI

Starts with "Follow-up required?" Yes / No.

When No: nothing else is shown; saving records "No follow-up required". When Yes: five rows, each with an enable toggle.

| Type | Fields | Quick options |
|------|--------|---------------|
| Treatment | Date, notes | 3 days · 5 days · 7 days · 14 days · Custom |
| Consultation | Date, notes | 7 days · 15 days · 1 month · Custom |
| Vaccine | Date | 1 month · 3 months · 6 months · 1 year · Custom |
| Deworming | Date | 1 month · 3 months · 6 months · Custom |
| Blood Test | Date, test multi-select from the existing lab test master | Today · 7 days · 1 month · Custom |

Selecting a quick option computes and fills the date (visible, in DD/MM/YYYY) and stores the option code alongside it. Custom opens the app's existing date picker. Don't use a bare `<input type="date">`, because the browser renders it in the OS locale, which may be MM/DD/YYYY.

Switching Yes → No asks for confirmation when follow-ups already exist, since saving will cancel them (and possibly lab orders).

### 11.2 Date utilities

```ts
import { addDays, addMonths, addYears, format, parseISO } from 'date-fns';

export const QUICK: Record<string, (base: Date) => Date> = {
  '3D': d => addDays(d, 3),   '5D': d => addDays(d, 5),   '7D': d => addDays(d, 7),
  '14D': d => addDays(d, 14), '15D': d => addDays(d, 15),
  '1M': d => addMonths(d, 1), '3M': d => addMonths(d, 3), '6M': d => addMonths(d, 6),
  '1Y': d => addYears(d, 1),
};

export const toApiDate  = (d: Date)   => format(d, 'yyyy-MM-dd');   // local date, NOT toISOString()
export const fromApi    = (s: string) => parseISO(s);                // date-only parsed as local
export const toDisplay  = (d: Date)   => format(d, 'dd/MM/yyyy');
```

`addMonths` clamps month-end correctly: 31/01/2026 + 1 month = 28/02/2026. The base date is the visit date (decision §2.6).

**Exit check:** each type saves and reopens with its date and option; No-follow-up saves; dates display as DD/MM/YYYY everywhere and never shift by a day.

---

## 12. Phase 9 — Blood Test → Laboratory integration

The backend is done in Phase 2 (§5.5); this phase wires the UI and verifies behaviour across the Laboratory module.

**Behaviour by lab order status:**

| Doctor action | Order status ORDERED | Order status SAMPLE_COLLECTED or later |
|---------------|---------------------|--------------------------------------|
| Save with a new test | Order created | n/a |
| Save again unchanged | No change | No change |
| Change the date | Scheduled date updated | Blocked with message |
| Swap the test | Test updated on the same order | Blocked with message |
| Remove the test / set follow-up to No | Order set to CANCELLED | Blocked: "Sample already collected; cancel from Laboratory" |

Map these status names to the ones your lab module actually uses. In the prescription UI, each saved test shows a small status badge ("Lab: Ordered", "Lab: Sample collected") so the doctor can see why removal is blocked.

Per decision §2.4, blood tests don't create prescription billing lines if the lab module already bills them. If it doesn't, add them to billing sync with `source_type = 'RX_LAB'` using the same upsert pattern.

**Exit check:** CBC for Candy (PET-0017, visit V-4698) appears in the Laboratory section with patient, visit, owner, doctor, order date, test, category, Rx reference and status Ordered; saving twice leaves one order; removing it cancels it; existing lab workflows (manual orders, results entry) are unaffected.

---

## 13. Phase 10 — Right panel, Save Draft, Billing hand-off, stock

### 13.1 Prescribed Items panel

A derived view of local state: grouped by category (Consultation, Immediate, Prescribed, Injectable, Food, Accessories) with line nets, group subtotals, and a grand total. Recalculates on add, qty change, removal, discount change, and fee change. Shows an amber "Includes unsaved changes" note when any billable section is dirty. Sticky on desktop (`position: sticky` below the header); on narrow screens it collapses into a bottom bar showing the total, expandable to the full list.

### 13.2 Save Draft

Keeps its current place and meaning, now calling the `/draft` endpoint (§5.7). After success every section chip shows "Saved". Validation failures are shown on the specific sections.

### 13.3 Proceed to Billing & Settlement

Runs Save Draft if anything is dirty, stops if validation fails, then navigates. Billing & Settlement stays a separate step.

### 13.4 Billing page changes (minimal)

Lines with a `source_type` get a small "Rx" tag and are grouped by `rx_section`. Per decision §2.8, their qty and price are read-only in Billing, with an "Edit in prescription" link. Manual lines, bill-level discount, payment modes and settlement work exactly as before. The total comes from the existing calculation.

### 13.5 Settled-bill lock

Once a bill is settled, billable prescription sections show a lock banner ("Bill settled on 09/09/2026, billable items are locked") and their Save buttons are disabled. Clinical notes and non-billable follow-ups stay editable.

### 13.6 Stock

At settlement (or the existing dispensing point), insert one stock transaction per bill line that has an `inventory_item_id`, with `source_type = 'BILL_LINE'`, `source_id = bill line ID`. The unique index makes double deduction impossible even if settlement is triggered twice. Remove any stock call that Phase 0 found on prescription save. Refund or cancellation of a settled bill creates a reversal transaction with its own `txn_type`.

**Exit check:** full Candy scenario (§14.3) passes end to end.

---

## 14. Phase 11 — Testing

### 14.1 Unit tests

`lineNet` against fixtures that match existing bills; quick-date functions including month-end and leap year (31/01/2028 + 1 month = 29/02/2028); display formatting; the item diff function (insert/update/remove); dirty detection.

### 14.2 Integration tests (API + database)

| ID | Scenario | Expected |
|----|----------|----------|
| T1 | Save the same section payload twice | One prescription item, one bill line |
| T2 | Change qty 10 → 20 and save | Same bill line ID, updated amount and total |
| T3 | Remove an item and save | Bill line gone, total reduced, item soft-deleted |
| T4 | Same inventory item in two sections | Two lines, two bill lines |
| T5 | Fee ₹500 → ₹800 | One consultation line at ₹800 |
| T6 | Save blood test twice | One lab order |
| T7 | Remove test while ORDERED / after SAMPLE_COLLECTED | Cancelled / 409 with nothing changed |
| T8 | Follow-up Yes → No | Follow-ups cancelled, lab rule from T7 applies |
| T9 | Settle bill, then trigger settle again | Stock decremented exactly once |
| T10 | Edit billable section after settlement | 409 BILL_SETTLED |
| T11 | Open a pre-migration prescription | Items under Prescribed Medicine; bill unchanged |
| T12 | Inventory item deactivated after being prescribed | Still shown (badged) and billed; not searchable |
| T13 | Two sessions save the same prescription | Second gets 409 and reloads |
| T14 | Client sends a tampered unit price | Ignored; price comes from inventory |
| T15 | New visit symptoms | Empty string; old visits keep their saved text |
| T16 | Save follow-up in IST late evening | Stored date equals the date shown; no day shift |

### 14.3 End-to-end scenario: Candy

Assumed prices for the test: Medicine A ₹120, Medicine B ₹15 per unit, Injection C (Rabies Vaccine) ₹480, Royal Canin Maxi Adult ₹1850, Pet accessory ₹300.

| Step | Action | Expected |
|------|--------|----------|
| 1 | History "Previous skin allergy treatment", save | Saved chip; persists on reload |
| 2 | Symptoms field starts blank; enter "Vomiting and loss of appetite", save | Saved |
| 3 | Findings: Dehydration, save | Saved |
| 4 | Immediate: Medicine A × 1, save | Panel ₹120; bill line created |
| 5 | Prescribed: Medicine B × 10, save | ₹150 |
| 6 | Injectable: Injection C × 1, save | ₹480 |
| 7 | Fee ₹500 Standard, save | ₹500 |
| 8 | Follow-up Yes: Treatment 7 days, Vaccine 1 month, Deworming 3 months, Blood Test CBC; save | Dates stored and shown DD/MM/YYYY; CBC lab order "Ordered" |
| 9 | Animal Food: Royal Canin × 1, save | ₹1850 |
| 10 | Accessory × 1, save | ₹300 |
| 11 | Check panel and Billing | **6 lines, total ₹3,400** in both |
| 12 | Reopen, change Medicine B qty 10 → 20, save | **Still 6 lines, total ₹3,550** |
| 13 | Save Draft three times | No change in line count or lab orders |
| 14 | Settle bill | Stock decremented once per item |
| 15 | Reopen Rx | All data present; billable sections locked |

### 14.4 Regression checklist

Reception intake, patient profile, visit creation, medical records and history, reports (especially any revenue report that reads bill lines), appointments, inventory CRUD and stock reports, laboratory manual orders and results, existing billing for visits with no prescription, authentication and permissions, and the three baseline visits from Phase 0 (identical totals and line counts). Scan every screen touched for dates not in DD/MM/YYYY.

### 14.5 Edge cases to exercise manually

Double-clicking any Save button; losing network mid-save (section stays "Unsaved", nothing half-written); saving an empty section on purpose (clears its bill lines, confirm dialog first); qty above available stock; discount of 100%; ₹0 fee; a very long prescription on a tablet screen; browser back button with unsaved changes.

---

## 15. Phase 12 — Rollout

1. Deploy to staging with a fresh copy of production data; run migrations; re-verify the three baseline visits.
2. Doctor UAT: have the doctor run the Candy script and a couple of their own real-world cases; collect feedback on layout before go-live.
3. Production backup immediately before deploy; deploy outside clinic hours.
4. Because migrations are additive, rollback is "redeploy previous build"; the old code still runs against the new schema.
5. Run these health-check queries daily for the first week. Each should return zero rows.

```sql
-- Active billable Rx items that have no billing line (sync drift)
SELECT i.id FROM prescription_items i
LEFT JOIN bill_items b ON b.source_type = 'RX_ITEM' AND b.source_id = i.id::text
WHERE i.deleted_at IS NULL AND b.id IS NULL;

-- Bills whose stored total doesn't match the sum of their lines
SELECT bl.id FROM bills bl
JOIN bill_items b ON b.bill_id = bl.id
GROUP BY bl.id, bl.total HAVING bl.total <> SUM(b.net_amount);   -- adjust if tax is applied at bill level

-- More than one active lab order for the same visit and test
SELECT visit_id, test_id, count(*) FROM lab_orders
WHERE status <> 'CANCELLED' GROUP BY 1, 2 HAVING count(*) > 1;
```

---

## 16. Sequencing summary

| Phase | Depends on | Relative size |
|-------|-----------|---------------|
| 0 Discovery | — | S |
| 1 Data model | 0 | M |
| 2 Backend services | 1 | L |
| 3 Frontend foundation | 2 | M |
| 4 Consultation fee slice | 3 | S |
| 5 History / Symptoms / Findings | 3 | S |
| 6 Clinical Treatment | 4 | M |
| 7 Food & Accessories | 6 | S |
| 8 Follow-ups | 3 | M |
| 9 Laboratory | 8 | M |
| 10 Panel / Draft / Billing / Stock | 6, 7, 9 | M |
| 11 Testing | all | M |
| 12 Rollout | 11 | S |

Commit after every phase so any phase can be reverted on its own.

---

## 17. Driving this with Antigravity

The original prompt is thorough, but handing an agent 26 sections at once tends to produce sprawling changes that are hard to review and easy to break things with. You'll get better results by giving it one phase at a time, reviewing the diff, committing, then moving on.

**Phase 0 prompt (read-only):**

> Read-only task: do not modify, create, or delete any source files. Inspect this codebase and write a single file `DISCOVERY.md` that answers every item in the Discovery checklist in `IMPLEMENTATION_PLAN.md` §3. For each answer, cite file paths and line numbers. Also list every place stock is decremented, every place the text "Routine consultation and health checkup" appears, and the exact schema of the prescription, billing line, lab order and inventory tables. Stop after writing the file.

**Template for later phases:**

> Implement Phase N of `IMPLEMENTATION_PLAN.md`, using the findings in `DISCOVERY.md`. Scope is limited to what Phase N describes. You may modify: [list files/folders]. Do not modify: [list]. Do not refactor or restyle anything outside this scope. Reuse existing components, APIs and the billing calculation as described. When done: run [tests], confirm the Phase N exit check, and list every file you changed with a one-line reason for each.

Put this plan in the repo as `IMPLEMENTATION_PLAN.md` so the agent can reference sections by number, and review each phase's diff before the next prompt.