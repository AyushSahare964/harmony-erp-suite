# Billing & Accounts: Implementation Plan

**Scope:** Custom date ranges everywhere · Supplier Bills tab · Payment Out tab (bill-wise + on-account, adjusted in supplier ledger) · Categorised Expenses with split payment modes (Cash + UPI + …)

**Reference behaviour:** Hitech BillSoft 9.3 (Add Purchase, Add Expense, Payment Out screens) currently used at Real Care Small Animal Clinic.

---

## 0. Summary of Changes

| # | Change | Where | Priority |
|---|--------|-------|----------|
| 1 | Every period selector gets **From** and **To** date fields (plus presets) | Global reusable component, all screens | P0 (foundation) |
| 2 | New **Supplier Bills** tab to enter medicine and other supplier bills | Accounting & Finance | P0 |
| 3 | Pay a bill at the time of entry (full / partial), bill-wise | Inside Supplier Bill form | P0 |
| 4 | New **Payment Out** tab: supplier payments allocated to bills or kept on account, reflected in supplier ledger | Accounting & Finance | P0 |
| 5 | New **Expenses** tab with category master (Rent, Salary, Printing and Stationery, …) | Accounting & Finance | P0 |
| 6 | **Split payment** for one expense (e.g. ₹2,000 UPI + ₹1,000 Cash). Same component reused in Payment Out and bill-time payment | Shared component | P0 |
| 7 | Supplier ledger, payables ageing, expense and cash/bank reports | Reports / Ledger | P1 |
| 8 | Dashboard KPIs rewired to new data + quick action buttons | Financial Dashboard | P1 |

---

## 1. Global Rules (apply to everything below)

1. **Date display:** all user-facing dates in `DD/MM/YYYY`. Store as ISO (`YYYY-MM-DD`) in DB and API.
2. **Timezone:** day boundaries are computed in `Asia/Kolkata`. The app is hosted on Vercel (servers run in UTC), so never use `new Date()` on the server to decide "today" or month start without converting to IST. Otherwise entries made between 00:00 and 05:30 IST land on the wrong day.
3. **Money:** store as `NUMERIC(12,2)` (or integer paise). Never use JS floats for sums; use a decimal library or integer paise arithmetic.
4. **Atomic saves:** a bill save (bill + items + stock + payment + allocations + GL entries) runs in a single DB transaction. Either everything saves or nothing does.
5. **No hard deletes** of financial records. Use **Void** with a reason, keep an audit trail.
6. **Financial year:** Indian FY, 01/04 to 31/03. Voucher numbers reset per FY (e.g. `PB/2026-27/0001`).

---

## 2. Custom Date Range on Every Period Selector

### 2.1 Reusable component: `DateRangeFilter`

Replace every "Month to Date (Aug 2026)"-style dropdown with:

```
[ Preset ▼ This Month ]   From [ 01/08/2026 📅 ]   To [ 31/08/2026 📅 ]   [ Apply ]
```

**Props:** `value {from, to, preset}`, `onChange`, `allowFuture` (default `false`), `presets` (optional override), `compact` (for mobile).

### 2.2 Presets

| Preset | From | To |
|--------|------|----|
| Today | today | today |
| Yesterday | today − 1 | today − 1 |
| This Week | Monday of current week | today |
| Last 7 Days | today − 6 | today |
| This Month (MTD) | 1st of current month | today |
| Last Month | 1st of previous month | last day of previous month |
| Last 30 Days | today − 29 | today |
| This Quarter | FY quarter start (Apr/Jul/Oct/Jan) | today |
| This Financial Year | 01/04 of current FY | today |
| Last Financial Year | 01/04 of previous FY | 31/03 before current FY (e.g. 01/04/2025 – 31/03/2026) |
| Custom | user entered | user entered |

### 2.3 Behaviour

1. Choosing a preset fills From and To automatically and applies immediately.
2. Editing either date manually switches the preset label to **Custom**. Custom ranges apply on **Apply** (or on blur when both dates are valid).
3. Validation: both dates required, `From ≤ To`, typed dates must be valid `DD/MM/YYYY`. Show inline error, don't fire the query.
4. Future dates disabled by default. Enable (`allowFuture=true`) only for filters like "bills due between".
5. Persist the range in URL query params (`?from=2026-08-01&to=2026-08-31`) so refresh/back keeps the selection and links can be shared.
6. Mobile: preset on first row, From/To stacked below.

### 2.4 API contract (all list, report and dashboard endpoints)

- Query params: `from=YYYY-MM-DD&to=YYYY-MM-DD`, **both inclusive**.
- `DATE` columns (bill_date, expense_date, payment_date): `WHERE col BETWEEN :from AND :to`.
- `TIMESTAMPTZ` columns: `WHERE col >= (:from 00:00 IST) AND col < (:to + 1 day 00:00 IST)`.
- If params are missing, default to This Month (server computes in IST).
- Reject `from > to` with HTTP 400.

### 2.5 Dashboard label changes

- "MTD NET REVENUE" becomes **NET REVENUE** with the range below it: `01/08/2026 – 31/08/2026`. Same for Expenses, Receivables, Payables.
- "vs last month" becomes "vs previous period", with the compared range in a tooltip.
  - Month-based presets compare with the same day span of the previous month (MTD 01/09–11/09 vs 01/08–11/08).
  - Custom ranges compare with the equal-length period immediately before `From`.
- P&L chart granularity: up to 31 days = daily bars, up to 92 days = weekly, above that = monthly.

### 2.6 Rollout checklist

Search the codebase for every period dropdown / hard-coded "MTD" and replace. At minimum:

- [ ] 18.1 Financial Dashboard (period selector + P&L Overview chart)
- [ ] 18.2 Chart of Accounts & GL (ledger view)
- [ ] Receivables & Payables tab
- [ ] 18.5 Taxation & Compliance (GST / TDS period)
- [ ] 18.6 Budgeting & Cost Centers (budget vs actual)
- [ ] New tabs: Supplier Bills, Payment Out, Expenses, Supplier Ledger
- [ ] All reports
- [ ] Any non-accounting list with a period filter (invoices, lab orders, appointments)

---

## 3. Navigation Changes

Add three tabs to the Accounting & Finance module (renumber if an existing tab, e.g. "Receivables & Payables", should host them):

| Tab | Purpose |
|-----|---------|
| **18.7 Supplier Bills** | Enter/view bills from medicine and other suppliers |
| **18.8 Payment Out** | Record payments to suppliers, adjusted in their ledger |
| **18.9 Expenses** | Record categorised expenses with split payment modes |

Add **quick-action buttons** on the Financial Dashboard (similar to Hitech): `+ Supplier Bill`, `+ Payment Out`, `+ Expense`. Each opens the form as a modal/drawer so the user doesn't lose their place.

Supplier Ledger opens from: Supplier Bills list (click supplier name), Payment Out form (link next to supplier), and Reports.

---

## 4. Masters

### 4.1 Expense categories (editable master)

Seeded from the current list. The **Nature** column decides whether it hits the clinic P&L:

| Category | Nature (proposed) |
|----------|-------------------|
| Advertisement | Business |
| Bank Charges | Business |
| Business Expansion | Business |
| Clinic expenditure | Business |
| Education | **Confirm with doctor** (CME/conference = Business, children's fees = Personal) |
| Home Loan Emi | **Personal** |
| Household & Personal | **Personal** |
| Laboratory Expenditure | Business |
| Marketing Expenditure | Business |
| Party | **Confirm with doctor** |
| Power and fuel | Business |
| Printing and Stationery | Business |
| Professional Charges | Business |
| Rent | Business |
| Salary | Business |
| Telephone & internet | Business |

- **Business** expenses appear in P&L and the Expenses KPI.
- **Personal** expenses are still recorded (cash/bank balances stay correct) but post to **Drawings** and are excluded from clinic profit. Otherwise home loan EMI makes the clinic look less profitable than it is.
- Manage screen: add, rename, change nature, reorder, deactivate. A category that has entries cannot be deleted, only deactivated (hidden from the dropdown, still visible in old records and reports).
- Dropdown sorted alphabetically with a search box (the list will grow).

### 4.2 Payment modes and accounts

| Mode | Money comes from | Reference field |
|------|------------------|-----------------|
| Cash | Cash in Hand | none |
| UPI | Selected bank account (default bank) | UPI transaction ID (optional, recommended) |
| Card | Selected bank account | Last 4 digits / approval code (optional) |
| Bank Transfer (NEFT/IMPS/RTGS) | Selected bank account | UTR number (optional, recommended) |
| Cheque | Selected bank account | Cheque no. **required** + cheque date |

`payment_accounts` master: `Cash in Hand` + one row per bank account. If only one bank account exists, hide the account selector and use it automatically.

### 4.3 Supplier master (check existing, add missing fields)

Name*, Mobile, Email, GSTIN, State (for CGST+SGST vs IGST), Address, Supplier type (Medicine / Food / Accessories / Lab / Other), **Credit days** (used to auto-fill due date), **Opening balance** + Cr/Dr as on a date, Active flag.

---

## 5. Data Model

PostgreSQL syntax below; adapt to your ORM (Prisma/Drizzle etc.). Skip any table that already exists and add only missing columns.

```sql
-- ---------- Masters ----------
CREATE TABLE expense_categories (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(80)  NOT NULL UNIQUE,
  nature         VARCHAR(10)  NOT NULL DEFAULT 'BUSINESS',  -- BUSINESS | PERSONAL
  gl_account_id  INT REFERENCES gl_accounts(id),            -- expense head or Drawings
  sort_order     INT          NOT NULL DEFAULT 0,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE payment_accounts (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(80)  NOT NULL,        -- 'Cash in Hand', 'HDFC Current A/c'
  type           VARCHAR(10)  NOT NULL,        -- CASH | BANK
  gl_account_id  INT REFERENCES gl_accounts(id),
  is_default     BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ---------- Supplier bills ----------
CREATE TABLE purchase_bills (
  id              SERIAL PRIMARY KEY,
  internal_ref    VARCHAR(25)   NOT NULL UNIQUE,   -- PB/2026-27/0001
  supplier_id     INT           NOT NULL REFERENCES suppliers(id),
  bill_number     VARCHAR(50)   NOT NULL,          -- supplier's invoice no.
  bill_date       DATE          NOT NULL,
  due_date        DATE,
  tax_type        VARCHAR(5)    NOT NULL,          -- INTRA (CGST+SGST) | INTER (IGST)
  subtotal        NUMERIC(12,2) NOT NULL,
  discount_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable_total   NUMERIC(12,2) NOT NULL,
  cgst_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_charges   NUMERIC(12,2) NOT NULL DEFAULT 0,  -- freight etc.
  round_off       NUMERIC(6,2)  NOT NULL DEFAULT 0,
  grand_total     NUMERIC(12,2) NOT NULL,
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- maintained from allocations
  status          VARCHAR(10)   NOT NULL DEFAULT 'UNPAID', -- UNPAID | PARTIAL | PAID | VOID
  remarks         TEXT,
  attachment_url  TEXT,
  void_reason     TEXT,
  created_by      INT, created_at TIMESTAMPTZ DEFAULT now(),
  updated_by      INT, updated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_supplier_billno
  ON purchase_bills (supplier_id, lower(bill_number)) WHERE status <> 'VOID';

CREATE TABLE purchase_bill_items (
  id                 SERIAL PRIMARY KEY,
  bill_id            INT NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  line_no            INT NOT NULL,
  item_type          VARCHAR(15) NOT NULL,        -- INVENTORY | NON_INVENTORY
  inventory_item_id  INT REFERENCES inventory_items(id),   -- when INVENTORY
  expense_category_id INT REFERENCES expense_categories(id), -- when NON_INVENTORY
  description        VARCHAR(200) NOT NULL,
  hsn_code           VARCHAR(10),
  batch_no           VARCHAR(40),
  expiry_date        DATE,                         -- stored as last day of month
  qty                NUMERIC(10,2) NOT NULL,
  free_qty           NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit               VARCHAR(15),
  purchase_rate      NUMERIC(12,2) NOT NULL,
  mrp                NUMERIC(12,2),
  discount_pct       NUMERIC(5,2)  NOT NULL DEFAULT 0,
  gst_pct            NUMERIC(5,2)  NOT NULL DEFAULT 0,
  taxable_amount     NUMERIC(12,2) NOT NULL,
  tax_amount         NUMERIC(12,2) NOT NULL,
  line_total         NUMERIC(12,2) NOT NULL
);

-- ---------- Supplier payments ----------
CREATE TABLE supplier_payments (
  id            SERIAL PRIMARY KEY,
  voucher_no    VARCHAR(25)   NOT NULL UNIQUE,     -- PO/2026-27/0001
  supplier_id   INT           NOT NULL REFERENCES suppliers(id),
  payment_date  DATE          NOT NULL,
  total_amount  NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  source        VARCHAR(15)   NOT NULL,            -- PAYMENT_OUT | BILL_ENTRY
  remarks       TEXT,
  status        VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | VOID
  void_reason   TEXT,
  created_by    INT, created_at TIMESTAMPTZ DEFAULT now()
);

-- Which bill(s) a payment settles. Unallocated part = advance (on account).
CREATE TABLE payment_allocations (
  id                   SERIAL PRIMARY KEY,
  supplier_payment_id  INT NOT NULL REFERENCES supplier_payments(id),
  purchase_bill_id     INT NOT NULL REFERENCES purchase_bills(id),
  amount               NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  allocated_on         DATE NOT NULL,              -- may be later than payment (advance adjustment)
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- ---------- Expenses ----------
CREATE TABLE expenses (
  id             SERIAL PRIMARY KEY,
  voucher_no     VARCHAR(25)   NOT NULL UNIQUE,    -- EX/2026-27/0001
  expense_date   DATE          NOT NULL,
  category_id    INT           NOT NULL REFERENCES expense_categories(id),
  paid_to        VARCHAR(120),
  bill_ref_no    VARCHAR(50),
  total_amount   NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  gst_amount     NUMERIC(12,2),                    -- optional, for ITC
  vendor_gstin   VARCHAR(15),
  description    TEXT,
  attachment_url TEXT,
  status         VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | VOID
  void_reason    TEXT,
  created_by     INT, created_at TIMESTAMPTZ DEFAULT now(),
  updated_by     INT, updated_at TIMESTAMPTZ
);

-- ---------- Split payment lines (shared) ----------
-- One row per mode used. Also the feed for Cash Book / Bank Book.
CREATE TABLE payment_lines (
  id            SERIAL PRIMARY KEY,
  source_type   VARCHAR(20)   NOT NULL,   -- SUPPLIER_PAYMENT | EXPENSE
  source_id     INT           NOT NULL,
  txn_date      DATE          NOT NULL,
  mode          VARCHAR(15)   NOT NULL,   -- CASH | UPI | CARD | BANK_TRANSFER | CHEQUE
  account_id    INT           NOT NULL REFERENCES payment_accounts(id),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference_no  VARCHAR(60),
  cheque_date   DATE,
  is_void       BOOLEAN       NOT NULL DEFAULT FALSE
);
CREATE INDEX ix_payment_lines_source ON payment_lines (source_type, source_id);
CREATE INDEX ix_payment_lines_date   ON payment_lines (txn_date, mode);
```

**Derived values (don't store separately, or recompute inside the same transaction):**

- `purchase_bills.amount_paid = SUM(payment_allocations.amount)` for active payments.
- `status = PAID` if paid ≥ grand_total, `PARTIAL` if paid > 0, else `UNPAID`.
- **Overdue** is a UI label only: `due_date < today (IST)` and status ≠ PAID.
- Supplier **advance** = `SUM(active payments) − SUM(their allocations)`.

**Migration:** if old expense records have a single `payment_mode` column, create one `payment_lines` row per record with the full amount, then drop or deprecate the column.

---

## 6. Shared Component: `SplitPaymentInput`

Used in: Expense form, Payment Out form, "Payment made now" section of Supplier Bill form.

```
 Payment Details                                         Total: ₹3,000.00
 ┌────────────┬────────────────┬──────────────┬─────────────────────┬───┐
 │ Mode       │ Account        │ Amount (₹)   │ Txn ID / Ref No.    │   │
 ├────────────┼────────────────┼──────────────┼─────────────────────┼───┤
 │ UPI      ▼ │ HDFC Current ▼ │     2,000.00 │ 4521 8876 3310      │ ✕ │
 │ Cash     ▼ │ Cash in Hand   │     1,000.00 │ —                   │ ✕ │
 └────────────┴────────────────┴──────────────┴─────────────────────┴───┘
 [+ Add payment mode]   [Fill balance]
 Entered ₹3,000.00 · Difference ₹0.00 ✓
```

**Behaviour**

1. Starts with **one row: Cash = full total** (fastest path for the common case). User can change the mode or click **+ Add payment mode** to split.
2. When the total changes and there is only one row, that row's amount follows the total automatically. With multiple rows, amounts are left alone and the difference is shown.
3. **Fill balance** puts the remaining difference into the focused row.
4. Account column only appears for non-cash modes and only when more than one bank account exists.
5. Reference field: hidden for Cash, required for Cheque (+ cheque date), optional for the rest.
6. Same mode may appear twice (e.g. UPI from two different bank accounts).
7. Footer shows Entered and Difference. Difference ≠ 0 is shown in red and blocks Save where exact match is required.

**Props:** `total`, `lines`, `onChange`, `requireExactMatch` (Expense: `true`; Payment Out: amount is derived from lines, so always matches), `allowedModes`, `defaultMode`.

**Printed voucher / receipt** shows the breakdown: `Paid: UPI ₹2,000 (Ref 4521…) + Cash ₹1,000`.

---

## 7. Supplier Bills Tab (18.7)

### 7.1 List screen

- Filters: `DateRangeFilter` (bill date), Supplier, Status (Unpaid / Partial / Paid / Overdue / Void), search by bill no.
- Columns: Bill Date · Ref · Supplier Bill No. · Supplier · Total · Paid · Balance · Due Date · Status chip.
- Row actions: View · Edit · **Pay** (opens Payment Out pre-filled with this supplier and bill) · Print · Void.
- Footer totals for the filtered set: Total, Paid, Balance.
- `+ New Supplier Bill` button.

### 7.2 Entry form

**Header**

| Field | Rule |
|-------|------|
| Supplier* | Searchable dropdown, `+ New supplier` inline. On select: show mobile, GSTIN, current balance, available advance |
| Supplier Bill No.* | Unique per supplier (warn and block duplicate) |
| Bill Date* | `DD/MM/YYYY`, default today, future date blocked |
| Due Date | Auto = bill date + supplier credit days, editable |
| Tax type | Auto from supplier state vs clinic state (CGST+SGST or IGST), editable |
| Attachment | Photo/PDF of the physical bill |

**Items grid**

| Item | Batch | Expiry | HSN | Qty | Free | Rate | MRP | Disc % | GST % | Taxable | Tax | Amount |
|------|-------|--------|-----|-----|------|------|-----|--------|-------|---------|-----|--------|

- Item search looks up inventory (medicines, food, accessories). Selecting one fills HSN, GST %, last purchase rate, MRP.
- If the user types something not in inventory, the line becomes **Non-inventory** and asks for an **Expense Category** (e.g. lab supplier's service charge, equipment repair). This keeps credit purchases of non-stock items in the right P&L head.
- Expiry entered as `MM/YYYY`; **required** for medicine items.
- Keyboard flow: Enter moves to the next cell; Enter on the last cell adds a new row.
- Line maths: `taxable = qty × rate × (1 − disc%)`, `tax = taxable × gst%`, `amount = taxable + tax`. Free qty adds stock but not value.

**Footer**

Subtotal · Discount · Taxable · CGST · SGST (or IGST) · Other charges · Round off (auto to nearest ₹, editable ±₹1) · **Grand Total**.
Show a small warning if Grand Total differs from a "Bill total as printed" field (optional field to catch typing mistakes).

**Payment section: "Payment made now?"**

- Options: **No (on credit)** · **Full** · **Partial**.
- Full/Partial reveals `SplitPaymentInput`. Full = amount locked to Grand Total; Partial = user enters amount ≤ Grand Total.
- If supplier has an advance: checkbox `Adjust available advance ₹X against this bill`.
- Buttons: **Save** · **Save & New** · **Save & Print** · Cancel.

### 7.3 On save (single transaction)

1. Insert `purchase_bills` + `purchase_bill_items`.
2. Inventory lines: create/increase stock batches (qty + free qty) with batch, expiry, MRP; update item's last purchase rate.
3. If paid now: create `supplier_payments` (source = `BILL_ENTRY`) + `payment_lines` + `payment_allocations` (full amount to this bill).
4. If advance adjusted: create `payment_allocations` from the oldest unallocated payments.
5. Recalculate `amount_paid` and `status`.
6. Post GL entries (Section 11).

### 7.4 Edit and void rules

- Editing allowed; Grand Total cannot go below `amount_paid` (tell the user to void/reallocate the payment first).
- Reducing qty of an inventory line is blocked if that batch's remaining stock is less than the reduction (stock already sold).
- **Void** requires a reason, reverses stock and GL, and un-allocates payments (the money becomes supplier advance, not lost).

---

## 8. Payment Out Tab (18.8)

### 8.1 Form (mirrors Hitech's Payment Out, with bill-wise allocation)

```
 Payment Out                                                        [Supplier] [Staff*]
 Date* [11/09/2026]      Supplier* [ ABC Pharma ▼ ]      Mobile: 98xxxxxx10
 Outstanding: ₹48,500   ·   Advance available: ₹0   ·   [View Ledger]

 Adjust against:  (•) Selected bills   ( ) Oldest bills first   ( ) On account (advance)

 ┌───┬────────────┬──────────┬───────────┬───────────┬──────────────┐
 │ ☑ │ Bill Date  │ Bill No. │ Total     │ Balance   │ Pay Now (₹)  │
 ├───┼────────────┼──────────┼───────────┼───────────┼──────────────┤
 │ ☑ │ 02/08/2026 │ AP-1182  │ 18,500.00 │ 18,500.00 │    18,500.00 │
 │ ☐ │ 20/08/2026 │ AP-1240  │ 30,000.00 │ 30,000.00 │         0.00 │
 └───┴────────────┴──────────┴───────────┴───────────┴──────────────┘

 [SplitPaymentInput]   Amount = sum of payment lines
 Remarks [                                   ]
                                               [Save and Print]  [Save]
```
*Staff tab optional (Phase 7), see Open Questions.

### 8.2 Allocation logic

| Mode | Logic |
|------|-------|
| **Selected bills** | User ticks bills and edits "Pay Now". Ticking a bill fills its full balance. Sum of Pay Now must be ≤ Amount. Any leftover is kept as advance **after a confirmation prompt**. |
| **Oldest bills first** | System allocates Amount to unpaid bills ordered by `bill_date, id` until exhausted. Preview shown in the table before saving. Leftover = advance. |
| **On account** | No allocation. Full amount becomes advance, adjustable later. |

Opening from a bill's **Pay** action pre-selects that supplier and bill.

### 8.3 Adjusting an existing advance later

From Supplier Ledger or a bill: **Adjust Advance** → pick bills → creates `payment_allocations` only (no new money movement, no new payment lines). `allocated_on` = date of adjustment.

### 8.4 Payment list

Filters: `DateRangeFilter`, supplier, mode. Columns: Date · Voucher · Supplier · Amount · Modes (chips like `UPI 20,000 · Cash 5,000`) · Bills settled · Unallocated. Actions: View · Print · Void.

**Void:** reason required; marks payment and its lines void, removes allocations, recalculates affected bill statuses, reverses GL.

---

## 9. Supplier Ledger

**Convention:** supplier account is a liability. Bill = **Credit** (we owe more). Payment = **Debit** (we owe less). Closing **Cr** balance = payable; **Dr** balance = advance paid.

```
 ABC Pharma · GSTIN 27XXXXX · From [01/04/2026] To [11/09/2026]
 ┌────────────┬──────────────────────────────────────────┬─────────────┬──────────┬──────────┬──────────────┐
 │ Date       │ Particulars                              │ Voucher     │ Debit    │ Credit   │ Balance      │
 ├────────────┼──────────────────────────────────────────┼─────────────┼──────────┼──────────┼──────────────┤
 │ 01/04/2026 │ Opening Balance                          │             │          │          │  12,000 Cr   │
 │ 02/08/2026 │ Purchase Bill AP-1182                    │ PB/…/0041   │          │ 18,500   │  30,500 Cr   │
 │ 05/08/2026 │ Payment (UPI 20,000 + Cash 5,000)        │ PO/…/0017   │ 25,000   │          │   5,500 Cr   │
 └────────────┴──────────────────────────────────────────┴─────────────┴──────────┴──────────┴──────────────┘
 Closing Balance: 5,500 Cr (Payable)
```

- Opening balance for the range = supplier opening balance + all bills − all payments **before** `From`.
- Click a row to open the bill/payment.
- Export PDF / Excel; Print.
- **Payables Summary** (all suppliers): Supplier · Total Outstanding · 0–30 · 31–60 · 61–90 · 90+ days (ageing by bill date or due date, toggle) · Advance.

---

## 10. Expenses Tab (18.9)

### 10.1 Entry form

| Field | Rule |
|-------|------|
| Date* | `DD/MM/YYYY`, default today, future blocked |
| Category* | Searchable dropdown from master; "Manage categories" link |
| Paid To | Free text (e.g. "Shree Printers") |
| Bill / Ref No. | Optional |
| Total Amount* | > 0 |
| Payment Details* | `SplitPaymentInput`, `requireExactMatch = true` |
| GST (collapsible "Bill has GST") | GST amount + vendor GSTIN, feeds ITC in Taxation tab |
| Description / Remarks | Free text |
| Attachment | Photo/PDF of receipt |

Buttons: **Save** · **Save & New** (keeps date and category, clears the rest, for entering several bills in a row) · Cancel.

**Worked example (prescription pads):**
Date 11/09/2026 · Category *Printing and Stationery* · Paid To *Shree Printers* · Total ₹3,000 · Payment: UPI ₹2,000 (Ref 4521…) + Cash ₹1,000 · Remarks "500 prescription pads".
Result: one expense voucher `EX/2026-27/0123`, two payment lines. Cash book shows ₹1,000 out, bank book shows ₹2,000 out, Printing and Stationery expense ₹3,000.

**Design decision:** an expense is always fully paid when entered. If a vendor gives credit (pay later), enter it as a **Supplier Bill** with a non-inventory line and the expense category, so it shows in payables and the supplier ledger.

### 10.2 List screen

- Filters: `DateRangeFilter`, Category (multi-select), Payment mode, Nature (Business / Personal / All), search.
- Columns: Date · Voucher · Category · Paid To · Description · Amount · Modes (chips).
- Summary strip for the filtered range: **Total** · Cash · UPI · Card · Bank · Cheque · and a small category-wise breakdown (top 5 + "others").
- Actions: View · Edit · Void · Print voucher. Export Excel/CSV.

### 10.3 Edit / void

- Edit replaces payment lines inside a transaction (delete old lines, insert new, re-post GL).
- Void requires a reason; lines marked void; GL reversed.

---

## 11. Accounting (GL) Postings

Only needed if 18.2 Chart of Accounts & GL keeps double-entry journals. Post inside the same transaction as the source document; store `source_type` + `source_id` on each journal so voids can reverse them.

| Event | Debit | Credit |
|-------|-------|--------|
| Supplier bill (inventory items) | Purchases / Inventory (taxable) + Input CGST/SGST or IGST + Freight | Supplier A/c (grand total); round off to Round-off A/c |
| Supplier bill (non-inventory line) | Mapped expense category A/c | Supplier A/c |
| Payment to supplier | Supplier A/c (total) | Cash in Hand / Bank A/c **per payment line** |
| Expense (Business) | Expense category A/c (+ Input GST if entered) | Cash / Bank **per payment line** |
| Expense (Personal) | Drawings A/c | Cash / Bank per payment line |
| Void of any of the above | Reverse entry dated on void date | |

Example (prescription pads): Dr Printing and Stationery ₹3,000 / Cr HDFC Bank ₹2,000 / Cr Cash in Hand ₹1,000.

---

## 12. Dashboard & Reports Integration

### 12.1 Financial Dashboard (18.1)

| KPI | New source (for selected From–To) |
|-----|-----------------------------------|
| Net Revenue | Unchanged (sales invoices) |
| **Expenses** | `SUM(expenses.total_amount)` where category nature = BUSINESS + non-inventory supplier bill lines. Tooltip shows the definition |
| **Purchases** (new card) | `SUM(purchase_bills.grand_total)` by bill date, non-void |
| Incoming Bills (Receivables) | Unchanged |
| **Outgoing Bills (Payables)** | Outstanding balance of all non-void supplier bills as on `To` date, minus supplier advances |
| Cash vs Bank outflow (new, optional) | `payment_lines` grouped by account type |

Plus quick-action buttons (Section 3).

### 12.2 Reports (all with `DateRangeFilter`, Excel/PDF export)

1. **Expense Report**: category-wise totals, drill down to entries; mode-wise split.
2. **Purchase Register**: bill-wise with GST columns.
3. **Supplier Ledger** and **Payables Summary with Ageing** (Section 9).
4. **Payment Out Register**: voucher-wise with modes and bills settled.
5. **Cash Book / Bank Book**: from `payment_lines` (plus incoming receipts), opening balance, day-wise running balance. This answers "how much cash went out today" (Hitech's Daily Summary equivalent).
6. **GST Input (ITC) Register**: GST from supplier bills + expenses with GST, feeds 18.5 Taxation & Compliance.

---

## 13. API Endpoints

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET/POST/PUT | `/api/expense-categories` | PUT handles rename, nature, sort, deactivate |
| GET | `/api/payment-accounts` | For account selector |
| GET | `/api/suppliers/:id/summary` | Outstanding, advance, mobile, GSTIN |
| GET | `/api/suppliers/:id/open-bills` | Unpaid + partial bills with balances |
| GET | `/api/suppliers/:id/ledger?from&to` | Opening, rows, closing |
| GET | `/api/payables/ageing?asOf&basis=bill_date\|due_date` | |
| GET/POST | `/api/purchase-bills?from&to&supplier&status&q` | POST accepts optional `payment: {lines[], adjustAdvance}` |
| GET/PUT | `/api/purchase-bills/:id` | |
| POST | `/api/purchase-bills/:id/void` | `{reason}` |
| GET/POST | `/api/supplier-payments?from&to&supplier&mode` | POST: `{supplierId, date, allocationMode, allocations[], lines[], remarks}` |
| POST | `/api/supplier-payments/:id/void` | |
| POST | `/api/suppliers/:id/adjust-advance` | `{allocations: [{billId, amount}]}` |
| GET/POST | `/api/expenses?from&to&category&mode&nature&q` | POST: `{date, categoryId, paidTo, totalAmount, lines[], …}` |
| GET/PUT | `/api/expenses/:id` | |
| POST | `/api/expenses/:id/void` | |
| GET | `/api/reports/expenses?from&to&groupBy=category\|mode` | |
| GET | `/api/reports/cash-book?from&to&accountId` | |
| GET | `/api/dashboard/finance?from&to` | Returns KPIs + comparison period |

Validate every POST/PUT on the server as well (sum of lines, allocations ≤ balance, dates, duplicate bill no.). Never trust the client totals; recompute them.

---

## 14. Validation & Edge Cases

| Case | Handling |
|------|----------|
| Split lines don't add up to expense total | Block save, show difference in red |
| Any payment line amount ≤ 0 | Block |
| Cheque without number/date | Block |
| Duplicate supplier bill no. (same supplier) | Block with link to the existing bill |
| Allocation to a bill exceeds its balance | Block |
| Payment more than total outstanding | Allow, confirm "₹X will be kept as advance" |
| Two users paying the same bill at the same time | Lock the bill rows (`SELECT … FOR UPDATE`) while allocating; re-validate balance inside the transaction |
| Editing a bill below amount already paid | Block, ask to void/reallocate payment first |
| Reducing stock that's already sold | Block with remaining-qty message |
| Voiding a payment | Bills revert to Unpaid/Partial; GL reversed; audit logged |
| Deactivated category | Hidden in dropdown, still shown on old entries and reports |
| Entry between 00:00–05:30 IST | Must fall on the IST date (server timezone handling) |
| Date range crosses FY | Allowed for reports; voucher numbering still per FY of the document date |
| Double-click on Save | Disable button while saving; idempotency key on POST |

---

## 15. Permissions & Audit

| Action | Admin | Accountant | Reception |
|--------|:-----:|:----------:|:---------:|
| Add expense / supplier bill / payment | ✓ | ✓ | configurable |
| Edit | ✓ | ✓ (same day, configurable) | ✗ |
| Void | ✓ | ✗ | ✗ |
| Manage categories / payment accounts | ✓ | ✗ | ✗ |
| View ledgers & reports | ✓ | ✓ | ✗ |

Audit log for every create / edit / void: user, timestamp, old values, new values, reason.

---

## 16. Implementation Phases

| Phase | Deliverable | Done when |
|-------|-------------|-----------|
| **1. Date range foundation** | `DateRangeFilter` component, IST date utils, API `from/to` support, replace on Financial Dashboard | Dashboard works with any custom range, labels updated, URL keeps range |
| **2. Masters** | Expense categories (seeded), payment accounts, supplier fields | Categories manageable; nature flag stored |
| **3. Expenses** | `payment_lines`, `SplitPaymentInput`, expense form + list + void | Prescription-pad example saves with 2 lines; list totals by mode correct |
| **4. Supplier Bills** | Bill form with items grid, inventory stock-in, list, edit/void (no payments yet) | Medicine bill increases stock with batch/expiry; totals and GST correct |
| **5. Payments & Ledger** | `supplier_payments`, allocations, Payment Out tab, "Payment made now" in bill form, advance adjustment, supplier ledger | Bill statuses change correctly; ledger closing balance = outstanding − advance |
| **6. Integration** | GL postings, dashboard KPIs, reports, quick actions, roll `DateRangeFilter` to all remaining screens | Checklist in 2.6 fully ticked; P&L excludes Personal |
| **7. Optional** | Staff payments tab, recurring expenses (Rent, EMI auto-reminder), purchase returns / debit notes, TDS on Professional Charges | As agreed with the doctor |

Each phase is shippable on its own; Phase 3 can go live before bills are ready.

---

## 17. Test Cases

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Expense ₹3,000: UPI ₹2,000 + Cash ₹1,000 | Saves; cash book −₹1,000, bank book −₹2,000; Printing and Stationery +₹3,000 |
| 2 | Expense ₹3,000 with lines totalling ₹2,800 | Save blocked, difference ₹200 shown |
| 3 | Expense in "Home Loan Emi" | Recorded, bank balance reduced, **not** in P&L / Expenses KPI, shows under Drawings |
| 4 | Bill ₹10,000, paid ₹4,000 at entry (Cash) | Status Partial, balance ₹6,000, ledger shows bill Cr + payment Dr |
| 5 | Bills ₹5,000 (01/08) + ₹6,000 (10/08); Payment Out ₹8,000 "oldest first" | Bill 1 Paid, Bill 2 Partial (₹3,000 paid) |
| 6 | Payment Out ₹12,000 against ₹11,000 outstanding | Confirmation; ₹1,000 advance; ledger closing 1,000 Dr |
| 7 | New ₹2,500 bill, tick "adjust advance" | ₹1,000 allocated, bill Partial ₹1,500 due, no new cash movement |
| 8 | Void payment from case 5 | Both bills back to Unpaid; GL reversed |
| 9 | Duplicate bill no. for same supplier | Blocked; same no. for a different supplier allowed |
| 10 | Custom range 01/08/2026–31/08/2026 | Includes entries dated 31/08, excludes 01/09; entry made 31/08 23:50 IST included |
| 11 | From 15/08/2026, To 10/08/2026 | Inline error, no request sent |
| 12 | "This Financial Year" on 11/09/2026 | 01/04/2026 – 11/09/2026 |
| 13 | Edit medicine bill qty down after partial sale | Blocked if reduction > remaining batch stock |
| 14 | Refresh page after picking custom range | Same range restored from URL |

---

## 18. Open Questions (confirm with the doctor before Phase 2)

1. Should **Home Loan Emi**, **Household & Personal**, **Education** and **Party** be kept out of clinic profit (Personal / Drawings)?
2. How many bank accounts are used for UPI / card? (decides whether the account selector is shown)
3. Is the **Staff** tab of Payment Out needed (salary advances per staff member), or is the Salary expense category enough?
4. Are **purchase returns** (expired / damaged medicine sent back) needed now or later?
5. Is TDS deducted on any payments (e.g. Professional Charges)? If yes, add a TDS field to expenses in Phase 7.
6. Who is allowed to edit or void entries?

---

## 19. Prompt for the Coding Agent (per phase)

> You are modifying the Accounting & Finance module of our veterinary clinic ERP. Read `billing-accounts-implementation-plan.md` fully. Implement **Phase N only** as described in Section 16, following the global rules in Section 1 (DD/MM/YYYY display, ISO storage, Asia/Kolkata day boundaries, decimal money, atomic transactions, void instead of delete). Reuse existing tables/components where they already exist and add only missing columns; list any schema differences you find before changing them. Do not modify unrelated modules. After implementing, run through the relevant test cases in Section 17 and report results, plus any assumptions you made.
