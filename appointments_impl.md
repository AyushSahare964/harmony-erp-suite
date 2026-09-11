# Implementation Plan: Appointments & Queue Enhancement + Lab Module Cleanup

**Principle:** Minimum-change, additive-only. No redesign, no architecture rewrite.

`Existing System + 2 New Fields − Sample Tracking & Barcodes = Final System`

---

## 1. Scope Summary

| Module | Change | Type |
|---|---|---|
| Appointments & Queue | Add `Appointment Date` | Additive field |
| Appointments & Queue | Add `Appointment Category` (Call / WhatsApp / Social Media) | Additive field |
| Laboratory & Diagnostics | Remove `Sample Tracking and Barcodes` | UI/nav removal only |
| Everything else | No change | — |

**Out of scope (must not touch):** Patient Management, Prescription, Billing, Settlement, Inventory, Medicine/Food/Accessories Catalogue, Doctors, Staff, User Management, Reports, Dashboard, Auth, Roles & Permissions, all other Lab features, existing Queue logic, sidebar/header/table styling.

---

## 2. Field Definitions

### 2.1 Appointment Date
- Represents the date the appointment is scheduled for.
- **Before building:** check if the appointments table already has a date field (e.g. `appointment_date`, `scheduled_date`). If yes → reuse it, do not duplicate.
- Display format: match whatever date format is already used elsewhere in the app (e.g. `09 Sep 2026`). Do not invent a new format.

### 2.2 Appointment Category
- Represents **how the appointment was booked** (channel), not the clinical type.
- Fixed enum, exactly 3 values — no free text, no "Other":
  - `call`
  - `whatsapp`
  - `social_media`
- Rendered as a dropdown on create/edit, and as a badge (using existing badge styling) on the list.

### 2.3 Category vs. Type — do not conflate
| Field | Answers | Example values |
|---|---|---|
| `Type` (existing, unchanged) | What kind of clinical visit? | Consultation, Follow-up, Dental, Vaccination, Surgery review |
| `Category` (new) | How was it booked? | Call, WhatsApp, Social Media |

Both columns coexist independently. `Category` must never replace `Type`.

---

## 3. Database Changes

1. Inspect existing appointment table/model first. Do not modify before this.
2. If `appointment_date` (or equivalent) exists → reuse; no schema change needed for it.
3. If no category field exists → add one column:
   ```
   appointment_category ENUM('call','whatsapp','social_media') NULL
   ```
4. Nullable / no default — existing rows must not be force-populated.
5. No renamed columns, no dropped columns, no table recreation.
6. Migration must be additive and reversible (simple `ADD COLUMN`).

**Backfill rule:** existing/old appointments get `appointment_category = NULL` (displayed as "Not specified"). Never auto-assign a category to historical records.

---

## 4. Backend / API Changes

- Extend the appointment create/update endpoint(s) to accept and persist `appointment_category` (and `appointment_date` if not already present).
- Extend the appointment read/list endpoint(s) to return both fields.
- **Do not rename or remove any existing response fields.**
- Validation: `appointment_category` must be one of the 3 enum values or null — reject anything else.
- Queue endpoints continue reading from the same appointment record (no new/parallel queue table or object).

---

## 5. Frontend Changes

### 5.1 Appointment creation/edit form
Add two fields to the existing form, keep everything else unchanged:
- `Appointment Date` (date picker, reuse existing date field/component if one exists)
- `Appointment Category` (dropdown: Call / WhatsApp / Social Media)

### 5.2 Appointment & Queue list/table
Add two columns to the existing table without removing any current column:

```
TOKEN | APPOINTMENT DATE | SLOT | PET | OWNER | DOCTOR | TYPE | CATEGORY | STATUS | ACTIONS
```

- `Category` rendered as a badge/pill using the existing badge component/styling.
- `Appointment Date` rendered as plain text in the app's standard date format.

### 5.3 Filters
Add two new filter controls alongside the existing Search / Status filter:
- **Date filter:** Today / Tomorrow / Specific Date / All Dates (or reuse existing filter pattern if the app already has one).
- **Category filter:** All Categories / Call / WhatsApp / Social Media.

### 5.4 Search
No change required. Optionally extend search to also match category text — not mandatory.

### 5.5 Visual/UX constraints
- No new sidebar, header, table layout, typography, or spacing conventions.
- No redesign of existing status badges or the actions dropdown.
- Only insert the two new columns/fields into the current layout.

---

## 6. Queue Integration

- Queue continues to reference the same appointment record — no second queue table, no duplicate record.
- `Appointment Date` and `Appointment Category` simply flow through to the queue view because they live on the appointment record.
- Existing status flow (`Waiting → In consultation → Completed`, `Admit OPD`, etc.) is untouched.

---

## 7. Laboratory & Diagnostics — Removal

1. Remove **"Sample Tracking and Barcodes"** from the Lab module navigation/menu.
2. Remove its dedicated page(s), barcode generation, barcode scanning, and any related buttons/cards/tabs — but **only** components that belong exclusively to this feature.
3. Keep all other Lab features intact: Test Catalogue, Test Orders, Results, Reports, etc.
4. **Do not delete underlying data:** patient lab records, test records, results, diagnostic reports, lab history, billing data all stay in the database. This is a UI/feature removal, not a data purge.

---

## 8. Build Order (Phased)

| Phase | Work |
|---|---|
| 1 | Inspect existing appointment model, forms, list, queue component, APIs, and the Sample Tracking/Barcodes components. No code changes yet. |
| 2 | Database migration (add `appointment_category`; confirm/reuse `appointment_date`). |
| 3 | Backend/API updates to accept, validate, and return the two fields. |
| 4 | Update appointment create/edit form. |
| 5 | Update appointment/queue list table + badges. |
| 6 | Wire new filters (date, category). |
| 7 | Remove Sample Tracking and Barcodes from Lab UI/nav. |
| 8 | Full regression test (below). |

---

## 9. Regression Test Checklist

**Appointments**
- [ ] Create appointment (with date + category)
- [ ] Edit appointment (date + category editable)
- [ ] View appointment
- [ ] Search still works as before
- [ ] Filter by date
- [ ] Filter by category (Call / WhatsApp / Social Media / All)
- [ ] Old appointments still open/edit correctly with category shown as "Not specified"
- [ ] New appointment appears correctly in Queue

**Queue**
- [ ] Token generation
- [ ] Slot display
- [ ] Waiting / Scheduled / In consultation / Completed transitions
- [ ] Admit OPD
- [ ] Existing actions dropdown

**Laboratory**
- [ ] Sample Tracking and Barcodes no longer visible anywhere
- [ ] Test Catalogue, Test Orders, Results, Reports still work
- [ ] Existing lab records/results/reports intact

**Other modules (smoke test only)**
- [ ] Prescription, Billing, Settlement, Inventory, Patient records, Doctor records, Auth, Permissions all unaffected

---

## 10. Non-Negotiable Rules for the Developer

1. No architectural redesign — additive changes only.
2. Reuse existing date field if one already exists; don't duplicate.
3. `Category` is separate from `Type` — never merge or replace.
4. No forced backfill of category on historical appointments.
5. No renamed/removed API fields or DB columns.
6. No new queue table or parallel data model.
7. Sample Tracking/Barcodes removal is UI/nav-level — underlying lab data stays.
8. All modules outside this scope remain untouched.