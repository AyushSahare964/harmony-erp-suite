# Implementation Plan: Partial Payment for Billing & Settlement

## 0. Scope & Guardrails

**Goal:** Add "Partial Payment" as a second payment option alongside the existing "Full Payment" flow, without touching any other module (Reception, Patient Profile, Doctor Rx, Inventory, Medical Records) except where Billing already integrates with them.

**Non-negotiables:**
- No new bill/invoice created per payment — one bill, many payment transactions.
- No change to existing fully-paid bill records or their displayed status.
- No change to inventory deduction logic.
- No change to existing payment methods list.
- Full Payment flow must remain byte-for-byte identical in behavior.

---

## 1. Discovery Phase (do this before writing code)

Spend a fixed, time-boxed session auditing the current system so the plan below is fitted to reality, not assumed:

| Item to inspect | What to record |
|---|---|
| Bill/Invoice table schema | Columns for total, paid, status; any existing `amount_paid` field |
| Payment table (if any) | Does a `payments` table already exist? What FKs does it use? |
| Bill status enum/values | Exact strings used today (`"Paid"`, `"PAID"`, `"Completed"`, etc.) |
| Billing UI components | Which screen/component renders the bill summary and payment form |
| Receipt generation code | Template engine used, what data it pulls |
| Reports queries | SQL/queries that aggregate revenue — do they read `bill.total` or `bill.paid`? |
| Prescription → Billing sync | How line items flow from Rx into the bill object |
| Inventory deduction trigger | Confirm it fires on **Rx save**, not on **payment**, so partial payment logic can't double-trigger it |

Output of this phase: a short "current state" doc (even 1 page) confirming assumptions before schema changes.

---

## 2. Data Model Changes

### 2.1 New table: `payment_transactions` (create only if one doesn't already exist)

```
payment_transactions
─────────────────────
id                  PK
bill_id             FK → bills.id
patient_id          FK → patients.id      (denormalized for fast lookup/reporting)
visit_id            FK → visits.id        (denormalized for fast lookup/reporting)
amount              decimal(10,2)
payment_method      enum (reuse existing: Cash, UPI, Card, Online, Other)
payment_date        timestamp
recorded_by         FK → users.id
notes               text, nullable
created_at
```

If a payments table already exists, extend it instead of creating a new one — add only the missing columns (e.g. `patient_id`, `visit_id` if not denormalized already).

### 2.2 Changes to `bills` table

Add (do not remove existing columns):

```
amount_paid          decimal(10,2)   default 0   -- running total, derived but cached
amount_due           decimal(10,2)   generated/derived (total - amount_paid)
payment_status        enum: 'unpaid' | 'partially_paid' | 'paid'
```

**Backward compatibility rule:** if `bills.status` already stores "Paid"/"Unpaid" as a string, map the new enum onto the existing field via a translation layer rather than introducing a second status column, unless the existing field can't hold a third state — in which case add `payment_status` as a new column and keep the old `status` column in sync for anything that still reads it.

### 2.3 Migration script

- For every existing bill where `paid = total`, set `payment_status = 'paid'`, `amount_paid = total`.
- For every existing bill where `paid = 0` or null, set `payment_status = 'unpaid'`.
- Backfill one `payment_transactions` row per legacy fully-paid bill **only if** payment history is a hard requirement retroactively; otherwise leave legacy bills without transaction rows and only apply the new transaction model going forward. (Recommend: don't backfill — just ensure the aggregate `amount_paid` field is correct.)
- Run migration on a copy of production data first; diff before/after bill counts by status.

---

## 3. Backend Logic

### 3.1 Core calculation service

Centralize this in one function/service (e.g. `BillingService.recordPayment()`), never inline in the controller, so both the initial payment and "Pay Remaining Amount" flow use identical logic:

```
function recordPayment(billId, amount, method, userId):
    bill = getBill(billId)

    if amount <= 0:
        raise ValidationError("Please enter a valid payment amount.")

    newTotalPaid = bill.amount_paid + amount
    if newTotalPaid > bill.total:
        raise ValidationError("Paid amount cannot be greater than the total bill.")

    create payment_transactions row (bill_id, amount, method, userId, now())

    bill.amount_paid = newTotalPaid
    bill.amount_due  = bill.total - newTotalPaid
    bill.payment_status =
        'paid'            if bill.amount_due == 0
        'partially_paid'  if 0 < bill.amount_due < bill.total
        'unpaid'          if bill.amount_paid == 0

    save bill
    return updated bill + transaction record
```

### 3.2 Validation rules (map directly to spec)

| Condition | Result |
|---|---|
| amount == 0 | Reject: "Please enter a valid payment amount." |
| 0 < amount < remaining due | Accept, status → Partially Paid |
| amount == remaining due | Accept, status → Paid |
| amount > remaining due | Reject: "Paid amount cannot be greater than the total bill." (unless overpayment/credit is an existing supported feature — check Discovery Phase findings) |

### 3.3 Bill edit protection

- On bill total edit, recompute `amount_due = new_total - amount_paid`.
- If `new_total < amount_paid`: do not silently corrupt — either (a) block the edit with a warning, or (b) flag the bill for manual reconciliation, per whatever the existing edit-permission rules do for other bill changes. Pick one and document it; don't invent new silent behavior.
- Never delete or modify existing `payment_transactions` rows during a bill edit.

### 3.4 API endpoints

```
POST /bills/{billId}/payments
    body: { amount, payment_method, notes? }
    → creates a payment_transactions row, returns updated bill

GET /bills/{billId}/payments
    → returns full payment history for that bill

GET /bills/{billId}
    → existing endpoint, extend response to include:
        amount_paid, amount_due, payment_status, payment_history[]
```

Keep the existing "create bill" and "full payment" endpoints untouched; full payment simply becomes a call to the same `recordPayment()` with `amount == total`.

---

## 4. Frontend / UI Changes

### 4.1 Billing & Settlement screen additions

- **Payment Type toggle**: `○ Full Payment` / `● Partial Payment` (radio, defaults to Full Payment to preserve existing muscle memory for staff).
- Selecting Partial Payment reveals:
  - `Amount Paid (₹)` input
  - Auto-calculated, read-only `Remaining Amount (₹)`
  - Existing `Payment Method` dropdown (unchanged options)
  - `Record Payment` button (disabled until amount > 0 and ≤ due)
- **Bill Summary block**: Total / Paid / Due / Status, styled so Due amount is visually prominent (bold, distinct color) whenever status ≠ Paid.

### 4.2 Existing/outstanding invoice view

Add a **"Pay Remaining Amount"** button wherever an invoice with `payment_status = 'partially_paid'` is displayed (invoice list, patient visit view, search results). Clicking it opens the same payment form pre-filled with the outstanding amount, editable down to a smaller value.

### 4.3 Payment History panel

On the bill/invoice detail view, add a simple table:

| Date | Amount | Method | Recorded By |
|---|---|---|---|
| 10/09/2026 | ₹1,000 | UPI | staff name |
| 15/09/2026 | ₹1,000 | Cash | staff name |

### 4.4 Receipt template

Extend the receipt to show `Previous Paid`, `Current Payment`, `Total Paid`, `Balance Due` — only add these lines when `payment_status != 'paid'` on a first-time full payment, so existing full-payment receipts render unchanged.

---

## 5. Reports & Analysis Changes

Add three read-only aggregate queries (do not alter existing revenue queries used elsewhere unless they need this same fix):

```
Total Billing Amount   = SUM(bills.total)
Amount Collected       = SUM(payment_transactions.amount)   -- not bill.total
Outstanding Amount     = Total Billing Amount - Amount Collected

Fully Paid Bills       = COUNT(bills WHERE payment_status = 'paid')
Partially Paid Bills   = COUNT(bills WHERE payment_status = 'partially_paid')
Unpaid Bills           = COUNT(bills WHERE payment_status = 'unpaid')
```

Double-check any existing "Total Revenue" report — if it currently sums `bill.total` for all bills regardless of payment status, that's already a latent bug this feature will expose; flag it to the user rather than silently changing report numbers.

---

## 6. Patient/Client Outstanding Balance

Add a derived, read-only field on the patient/visit view:
```
Outstanding Balance = SUM(bill.amount_due) across that patient's bills where payment_status != 'paid'
```
No new table needed if `amount_due` is already tracked per bill — this is just an aggregation query, scoped strictly by `patient_id`/`visit_id` to avoid cross-patient leakage.

---

## 7. Test Plan (map 1:1 to spec's Section 22, plus a few extras)

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Full payment, ₹2,000 on ₹2,000 bill | Paid ₹2,000, Due ₹0, Status: Paid |
| 2 | Partial payment, ₹800 on ₹2,000 bill | Paid ₹800, Due ₹1,200, Status: Partially Paid |
| 3 | Three partials (₹500+₹700+₹800) on ₹2,000 | 3 transaction rows, one bill, Paid ₹2,000, Status: Paid |
| 4 | ₹0 payment | Rejected: "Please enter a valid payment amount." |
| 5 | ₹2,500 payment on ₹2,000 bill | Rejected: "Paid amount cannot be greater than the total bill." |
| 6 | Rx-driven bill (₹2,500) partial ₹1,000 | Bill matches Rx line items exactly; no item duplicated/dropped |
| 7 | Inventory check | Confirm stock deducted exactly once regardless of how many payments follow |
| 8 | Legacy fully-paid bill (pre-migration) | Still displays "Paid" after migration, no data loss |
| 9 | Bill total edited after partial payment | Due recalculates correctly; prior payment transactions untouched |
| 10 | Concurrent payments (two staff recording on same bill near-simultaneously) | No race condition causing overpayment or lost transaction (needs a DB-level lock or atomic increment on `amount_paid`) |
| 11 | Reports after mixed bills | Collected ≠ Billed when partials exist; counts match bill statuses exactly |
| 12 | Receipt for 2nd payment | Shows Previous Paid, Current Payment, Total Paid, Balance Due correctly |

Test 10 isn't in the original spec but is a real risk with concurrent staff terminals — worth explicitly handling with a transaction-safe update (e.g., `UPDATE bills SET amount_paid = amount_paid + :amt WHERE id = :id AND amount_paid + :amt <= total`, checking rows affected).

---

## 8. Rollout Plan

1. **Branch + schema migration** on a staging copy of the DB. Verify counts of Paid/Unpaid bills match pre-migration.
2. **Backend service + endpoints**, unit tests for all validation cases (Section 3.2/3.4).
3. **Frontend form + summary + history panel**, tested against staging API.
4. **Receipt + Reports updates**, verified against a handful of real historical bills.
5. **Regression pass**: run the full existing full-payment workflow end-to-end untouched by new code paths, confirm zero behavior change.
6. **UAT with billing staff** using Test Plan scenarios 1–12 above.
7. **Deploy schema migration to production during low-traffic window**, keep a rollback script ready (drop new columns/table only — never touch existing bill data).
8. **Monitor** first week of live partial payments closely: check for any bill where `SUM(payment_transactions.amount) != bills.amount_paid` (would indicate a sync bug).

---

## 9. Open Decisions to Confirm Before Building

These aren't fully specified and should be settled with stakeholders before coding:

1. Does the system currently support overpayment/credit anywhere? If yes, partial payment overpayment behavior should match that existing pattern rather than a hard reject.
2. What happens if a bill total is *reduced* below the already-paid amount (Section 12 of the original spec) — block the edit, or allow and flag for manual reconciliation? Pick one explicitly.
3. Should legacy fully-paid bills get a backfilled single payment_transaction row for consistency, or is it acceptable that only new bills have full transaction history?
4. Who is allowed to edit a bill after a payment has been recorded — same permission as before, or a stricter role?

Resolving these up front avoids rework mid-build.