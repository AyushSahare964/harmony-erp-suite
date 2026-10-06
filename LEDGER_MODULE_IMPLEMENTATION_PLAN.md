# Ledger Module — Analysis & Implementation Plan

Goal: one dedicated **Ledgers** entry (like Hitech BillSoft's bottom-bar "Ledgers" button) that opens a 4-tile picker — **Customer / Supplier / Staff / Cash** — and each tile opens a date-ranged ledger report, with data read from the existing modules.

---

## 1. What the reference UI does

| Step | Hitech behaviour | Our equivalent |
|---|---|---|
| 1 | "Ledgers" button in the bottom bar | New **Ledgers** tab in `AccountingHub` (+ optional shortcut on the Billing Desk dashboard) |
| 2 | "Select Ledger Type" dialog, 2×2 tiles | `LedgerTypePicker` (shadcn `Dialog`, 4 tiles) |
| 3 | Pick a party → report window titled "<Party> – Supplier Ledger Report" | Party combobox (Customer/Supplier/Staff); Cash needs none (pick account: Cash in Hand / bank) |
| 4 | From / Up to date pickers, chips Today · Yesterday · 7 days · 30 days, Search + Reset | Same; default From = FY start (Apr 1), To = today IST |
| 5 | Table: Date · Particulars · Debit · Credit · Balance; first row "Opening Balance"; zebra rows; balance red when negative, green when positive | Same columns + a Voucher# column (we already have it) |
| 6 | Blue footer bar with closing balance (`₹ -14,223.00 Cr`) + Excel / WhatsApp / PDF / Email / Print icons | Same footer; PDF/print/email infra already exists (see §3) |

## 2. What already exists (reuse, don't rebuild)

| Ledger | Existing source | State |
|---|---|---|
| **Supplier** | `getSupplierLedgerFn` ([supplierPayments.ts:252](src/lib/mongodb/serverFns/supplierPayments.ts#L252)) — derives rows from `PurchaseBill` + `SupplierPayment` with opening-balance roll-forward; UI in [SupplierLedgerModal.tsx](src/components/erp/accounting/SupplierLedgerModal.tsx) | **Working.** Already uses the Hitech convention (Debit = payment, Credit = bill, Cr = we owe). Per-supplier modal only, no picker. |
| **Customer** | `getPartyLedgerFn` ([parties.ts:458](src/lib/mongodb/serverFns/parties.ts#L458)) reading `PartyLedger` | **Incomplete.** See finding A. |
| **Cash** | `FinDailySummary` (`cashIn`/`cashOut` per day), `PaymentDoc` splits with `payMode: CASH`, `SupplierPayment.paymentLines[mode=CASH]`, `Expense.paymentLines[mode=CASH]`, `PaymentAccount` (Cash in Hand / bank) | **No cash book UI/query.** Data exists but is spread over 3 collections. |
| **Staff** | `User` model (roles, approval) only. `Expense.paidByStaffId` and an expense category "Salary". Payroll workspace in `workspaces.ts` is a placeholder (`ErpRow`) | **No staff financial data.** Needs a small new model. |

### Findings that change the design

- **A. `PartyLedger` is never fully written.** The only writers are `writeOpeningRow` (OPENING) and `payments.ts` (PAYMENT). Nothing writes `SALE`, `PURCHASE`, `CREDIT_NOTE` or `DEBIT_NOTE` rows, so a customer ledger built on it would show receipts and no invoices. Don't build the new module on it as-is.
- **B. Two parallel party systems.** Legacy `Supplier` + `PurchaseBill` + `SupplierPayment`, and new `Party` + `PaymentDoc` + `PartyLedger`. `PurchaseBill` carries both `supplierId` and an optional `partyId`; supplier payments may land in either `SupplierPayment` or `PaymentDoc(OUT)`. The supplier ledger must read both or it will miss payments.
- **C. Opposite sign conventions.** `PartyLedger`: debit = party owes us. Supplier ledger / Hitech: debit = we paid, credit = we were billed. The new API must normalise per ledger type; the UI must stay sign-agnostic.

## 3. Recommended architecture — derived read-model, no new stored balances

Follow the same principle the codebase already states in `PartyLedger.ts`: **balance is always computed, never stored.** The ledger report is a *query that merges source documents*, exactly like `getSupplierLedgerFn` does today. This avoids backfilling `PartyLedger` and avoids a second source of truth that can drift.

```
src/lib/mongodb/serverFns/ledgers.ts          (new, one file)
  getLedgerFn({ type, partyId?, accountId?, from, to })  -> LedgerReport
  listLedgerPartiesFn({ type, q })                         -> [{id, name, balance}]   (picker data)

LedgerReport = {
  title, subjectName, subjectMeta,        // "Kukreja Agencies", GSTIN/phone
  openingBalance, closingBalance,         // signed numbers; UI formats "Cr/Dr"
  rows: { date, voucherNo, particulars, debit, credit, balance }[],
  totalDebit, totalCredit
}
```

One internal builder per type returns *unsorted events* `{date, createdAt, voucherNo, particulars, debit, credit}`; a single shared function sorts them, splits "before `from`" into the opening balance, and computes running balance. (This is the loop already in `getSupplierLedgerFn` — lift it out and share it; supplier then becomes one builder.)

### Event sources per ledger

| Ledger | Credit side | Debit side | Opening |
|---|---|---|---|
| **Supplier** (we owe) | `PurchaseBill` (status ≠ VOID, `docType=PURCHASE`) | `SupplierPayment` ACTIVE + `PaymentDoc` OUT POSTED for the linked `partyId`; `PurchaseBill` `DEBIT_NOTE` | `Supplier.openingBalance` (+type) |
| **Customer** (they owe) — shown Hitech-style: Debit = invoice, Credit = receipt | `PaymentDoc` IN POSTED (CLEARED/PENDING, excluding BOUNCED), credit notes | `SalesDoc` INVOICE POSTED | `PartyLedger` OPENING row (already written by `writeOpeningRow`) |
| **Cash** (cash in hand) | Cash **out**: `PaymentDoc` OUT CASH splits, `SupplierPayment` CASH lines, `Expense` CASH lines | Cash **in**: `PaymentDoc` IN CASH splits, + POS/counter cash on invoices (verify, see Q1) | `PaymentAccount` (CASH) opening, else 0 |
| **Staff** | Salary accrued / advance repaid | Salary paid / advance given / expense reimbursed | 0 |

Void/cancelled documents are excluded (same as today). Bounced cheques: exclude `clearingStatus = BOUNCED` splits.

### Staff ledger — the only new data

Minimal new model `StaffLedgerEntry` (`staff_ledger` collection), append-only like `PartyLedger`:
`{ staffId, entryDate, kind: SALARY | ADVANCE | REPAYMENT | REIMBURSEMENT | ADJUSTMENT, voucherNo, narration, debit, credit, payMode }`.
Reimbursements are **derived** from `Expense.paidByStaffId` (no duplicate entry); salary/advance are entered via a small "Add entry" form on the Staff tab. Full payroll (attendance, deductions) is **out of scope** — that belongs to the HRMS-Payroll module.

## 4. UI plan (match the Hitech look using existing shadcn + the project's tokens)

New folder `src/components/erp/accounting/ledgers/`:

| File | Purpose |
|---|---|
| `LedgersTab.tsx` | Tab body: renders the 4 big tiles (Customer / Supplier / Staff / Cash) inline — this *is* the picker, no extra dialog needed inside a hub tab. Click → opens `LedgerReportDialog`. |
| `LedgerReportDialog.tsx` | Generalised version of `SupplierLedgerModal`: party selector, From/To + chips + Search/Reset, table, blue footer bar. Takes `type`. |
| `LedgerTable.tsx` | Table with opening row, zebra rows, red/green balance, totals — extracted from `SupplierLedgerModal` so Supplier modal and the new dialog share it. |
| `ledgerExport.ts` | CSV (Excel) + PDF + print. Reuse the `html2canvas-pro` PDF helper added Oct 3 (invoice/prescription export) and the print-view pattern; WhatsApp = `wa.me` link with summary text; Email = existing token-based public-download-link flow. |

Changes to existing files (small):
- [AccountingHub.tsx](src/components/erp/accounting/AccountingHub.tsx): add `"ledgers"` to `TabId`/`TABS`/render (≈4 lines).
- `SupplierLedgerModal.tsx`: after the extraction, becomes a thin wrapper over `LedgerReportDialog type="supplier"` (so the "Payment Out" tab entry point keeps working) — or leave untouched in v1.
- Optional: "Ledgers" shortcut button on `BillingDeskDashboard` linking to the tab.

Interaction details to copy: quick-range chips set From/To; Reset restores FY-start → today; balance coloured by sign; footer bar shows `₹ 14,223.00 Cr/Dr`; large ledgers use the keyset cursor pattern from `getPartyLedgerFn` ("Load more").

## 5. Phases

| # | Phase | Output | Verify |
|---|---|---|---|
| 1 | Shared engine: `ledgers.ts` with event→running-balance function; port **Supplier** builder (incl. `PaymentDoc` OUT) | `getLedgerFn(type="supplier")` returns identical numbers to `getSupplierLedgerFn` for existing data | Unit test of the pure merge function (opening split, sort, running balance); compare vs old fn on 2–3 real suppliers |
| 2 | UI shell: `LedgersTab`, `LedgerReportDialog`, `LedgerTable`, hub tab wired; Supplier works end-to-end | Screenshot-parity with Hitech report | Manual + Playwright (`--headed`) |
| 3 | **Customer** builder (SalesDoc + PaymentDoc IN + credit notes + opening row) | Customer ledger closing = `computeOutstanding` total | Assert closing balance == sum of `balanceDue` for fully-posted customers |
| 4 | **Cash** builder + account selector | Cash book per day; closing = Cash in Hand | Reconcile daily totals with `FinDailySummary.cashIn/cashOut` |
| 5 | **Staff**: `StaffLedgerEntry` model, add-entry form, expense-reimbursement derivation | Staff ledger | Add advance + repayment → balance 0 |
| 6 | Export: CSV, PDF, Print, WhatsApp, Email | Footer icon bar working | Manual |
| 7 | Hardening: indexes on `SalesDoc{partyId,docDate}`, `SupplierPayment{supplierId,paymentDate}` (check existing), `graphify update .` | — | `tsc`, lint, build |

Phases 1–2 deliver visible value fast; 3–5 are independent and can ship one at a time.

## 6. Open questions (please confirm)

1. **Counter sales cash:** when an invoice is paid in cash at billing, is a `PaymentDoc` created, or is it only on `SalesDoc.paidAmount` / `FinDailySummary`? This decides whether the Cash ledger can be pure-`PaymentDoc` or must also read invoices.
2. **Supplier identity:** are new suppliers created in `Supplier` (legacy) or `Party`(SUPPLIER)? The builder reads both, but if one is dead we can drop half the code.
3. **Staff scope:** is a simple salary/advance/reimbursement ledger enough, or do you want it driven by a real payroll run (separate, larger module)?
4. **Customer sign convention:** keep Hitech's (Debit = invoiced, Credit = received) — recommended — or accounting-textbook style?
5. **Branch scoping:** single clinic (`branchId = MAIN`) for now?

## 7. Out of scope (v1)

Posting journal entries to the Chart of Accounts / GL, bank reconciliation, multi-currency, scheduled statement emails, and backfilling `PartyLedger` with SALE/PURCHASE rows.

---

## 8. Decisions taken & build status (2026-10-07)

| Q | Decision |
|---|---|
| Counter-sale cash | Verified: every receipt goes through `PaymentDoc`, so Cash ledger reads `PaymentDoc` CASH splits + `SupplierPayment` + `Expense` cash lines. |
| Supplier source | DB analysis: legacy `suppliers` (16) / `purchasebills` (14) / `supplierpayments` (9) hold all entries; `payment_docs`, `sales_docs`, `expenses` are empty. Supplier ledger reads the legacy collections only. |
| Staff | Full payroll is a separate larger module. This ledger ships `StaffLedgerEntry` + a minimal add-entry form; payroll will write `SALARY` rows later. |
| Customer convention | Hitech: Debit = invoiced, Credit = received. All ledgers: balance = Σdebit − Σcredit, negative = Cr. |
| Multi-tenant | `branchId` (default `MAIN`) accepted by every ledger fn and stored on `StaffLedgerEntry`; no UI selector yet. Legacy models have no `branchId`. |
| PartyLedger | **Dropped.** Model deleted; all writes removed from sales/payments; party balance now derived (`src/lib/mongodb/partyBalance.ts`); opening balance lives on `Party`. Empty `party_ledger` collection can be dropped in Atlas. |

Built: phases 1–6 (engine, UI, customer, cash, staff, CSV/PDF/Print/WhatsApp/Email-link export). Files:
`src/lib/ledger/buildLedger.ts` (+test), `serverFns/ledgers.ts`, `models/StaffLedgerEntry.ts`, `partyBalance.ts`,
`components/erp/accounting/ledgers/*`, `e2e/ledgers.spec.ts`.
Update: Accounting & Finance module removed; Ledgers is now its own module at /m/ledgers (sidebar card, role-gated via config). The 4 shared modals (SupplierBillForm, ExpenseForm, NewSupplier, SupplierLedger) remain in components/erp/accounting/ because Billing and Inventory use them.
Not done: email-with-attachment (mailto summary only), bank-account cash ledgers, `SupplierLedgerModal` still separate.
