# Hitech Billing Module — Implementation Plan for Harmony ERP

**Companion to:** `hitech-billing-module-plan.md` (the blueprint — *what* to build)
**This document:** *how* to build it inside **this** codebase — exact files, exact MongoDB collections, exact screens, in order.
**Revision 2** — dashboard-only main view · narrow right rail · no rebuilding of modules that already exist · full payment logic · GST calculator · date format fixed everywhere.

**Stack (fixed, do not change):** TanStack Start + React 19 · Mongoose 9 / MongoDB Atlas · Tailwind v4 (`src/styles.css` tokens) · shadcn/ui · framer-motion · recharts · zod · sonner.

---

## The five shaping rules

1. **The Billing module is ONE page: a dashboard.** Everything a biller does daily — see the numbers, raise a bill, take a payment, look up an invoice — happens on that one scrolling page. Nothing that matters is more than one click away.
2. **The Hitech sidebar moves to the RIGHT and becomes a narrow icon rail** (56 px collapsed, 224 px on hover). It carries *secondary* things only: extra create-actions, tools, and jump-links. It never takes real estate from the dashboard.
3. **We do not rebuild what exists.** Inventory, Accounting, CRM, Pharmacy, Lab, Reports are already built modules. The rail *links* to them. Billing only owns sales documents, payments and the finance view of purchases/expenses.
4. **Every date is `DD/MM/YYYY`.** One helper, no exceptions — §3.
5. **Every rupee goes through one payment engine.** The allocation, settlement and clearing rules in §6 are the only correct behaviour.

---

## 0. What already exists — reuse, don't rebuild

The blueprint assumes greenfield. It is not. **Roughly 60% already ships.**

| Blueprint asks for | Already in this repo | Action |
|---|---|---|
| Money decimal helper | `src/lib/utils/moneyUtils.ts` (`roundMoney`, `calcLineItem`) | **Reuse** |
| `DD/MM/YYYY` formatter + FY ranges | `src/lib/utils/dateUtils.ts` (`formatDisplayDate`, `parseDisplayDate`, `fiscalYearRange`, `presetDateRange`) | **Reuse + enforce** |
| Period selector (Today…Custom) | `src/components/erp/shared/DateRangeFilter.tsx` | **Reuse** |
| Split tender UI | `src/components/erp/shared/SplitPaymentInput.tsx` | **Reuse** |
| Gapless numbering | `serverFns/counters.ts` (`nextSeq`, atomic `$inc`) | **Extend** → FY-aware |
| Supplier master | `models/Supplier.ts` + `serverFns/masters.ts` | **Extend** → link to Party |
| Purchase bill (batch, expiry, MRP, free qty, GST, round-off) | `models/PurchaseBill.ts` + `serverFns/purchaseBills.ts` + `accounting/SupplierBillFormModal.tsx` | **Reuse the modal as-is**, extend the model |
| Expense (split pay, GST, attachment, categories) | `models/Expense.ts`, `serverFns/expenses.ts`, `accounting/ExpenseFormModal.tsx` | **Reuse the modal as-is**, extend the model |
| Payment Out + supplier ledger | `models/SupplierPayment.ts`, `serverFns/supplierPayments.ts` | **Fold** into unified `PaymentDoc` |
| Quotation | `models/Quotation.ts`, `serverFns/quotations.ts`, `billing/QuotationModal.tsx` | **Fold** into `SalesDoc` |
| Item master w/ HSN, GST%, batch, FEFO, reorder | `models/InventoryItem.ts`, `StockBatch.ts`, `serverFns/inventory.ts` | **Extend** → `itemClass`, SAC, Schedule-H |
| Hitech-style sidebar | `billing/BillingDeskShell.tsx` | **Rebuild as the right rail** (§5.2) |
| Hitech-style dashboard | `billing/BillingDeskDashboard.tsx` (KPIs, donut, bars, tabs, search) | **This becomes the whole module** |
| Rx → bill sync | `serverFns/clinical.ts` → `finalizeVisitAndBillFn` | **Extend** → idempotent upsert |
| Payment In, partial payment, allocation | `serverFns/billing.ts` → `recordPartialPaymentFn` | **Migrate** onto `SalesDoc` |
| Chart of accounts / journals / budgets | `models/FinanceTransaction.ts`, `serverFns/finance.ts` | **Leave alone** — Accounting module owns it |

### Modules we link to, never rebuild

| Need | Existing module | Route |
|---|---|---|
| Stock levels, batches, expiry, movements, item master | `InventoryHub` | `/m/inventory` |
| Chart of accounts, journals, P&L, banking, taxation | `AccountingHub` | `/m/accounting` |
| Owners, pets, profiles | `PetOwnerCrmHub` | `/m/crm-pets` |
| Dispensary counter | `PharmacyRetailHub` | `/m/pharmacy` |
| Lab orders | `LaboratoryHub` | `/m/laboratory` |
| Clinical documents | `ClinicalReportsHub` | `/m/reports` |

### The eight real gaps — this is the entire build

1. **No standalone sale invoice.** Invoices live *inside* `ClinicalVisit`; a counter sale to a walk-in with no pet is impossible.
2. **No party master.** `Owner` has no GSTIN / PAN / credit limit / opening balance / billing address; `Owner` and `Supplier` share no ledger.
3. **No tax engine.** No place-of-supply, no CGST/SGST vs IGST, no inclusive pricing, no discount apportionment, no GST calculator.
4. **No ledgers.** No `party_ledger`; the stock ledger is loose rows in `erp_rows`.
5. **No returns.** No credit note, no debit note.
6. **No GST returns.** No GSTR-1 / 3B / 2.
7. **No finance registers.** No sales register, outstanding/ageing, day book, Schedule-H register.
8. **No audit log, no reminders collection, no daily-summary cache.**

---

## 1. Six design decisions

| # | Decision | Why |
|---|---|---|
| **D1** | **`SalesDoc` is the single source of truth for every sale document** — `QUOTATION`, `INVOICE`, `CREDIT_NOTE`. Counter sales and clinical bills live in the same collection. | One register, one ledger, one GSTR-1 query. |
| **D2** | **`ClinicalVisit` keeps the clinical record and points at `salesDocNo`.** Its money fields become read-only mirrors kept in sync by the posting service. | Existing clinical UI keeps working untouched. |
| **D3** | **`Party` is one collection for clients and suppliers.** `Owner` and `Supplier` each get a `partyId` and stay as-is for CRM/procurement. | Blueprint §7.3 "one table"; one ledger for both. |
| **D4** | **The tax engine is a pure function** in `src/lib/finance/taxEngine.ts`. The invoice screen, the preview API, the GST calculator and the GSTR builders all call it. | One implementation, unit-testable, never drifts. |
| **D5** | **Posting is one server function per doc type, and it is the ONLY writer of ledgers.** It allocates the number, writes header + lines, stock moves, party ledger and daily summary — or throws and writes nothing. | No partial state. |
| **D6** | **Posted documents are immutable.** Edit only while `DRAFT`. Fix a posted doc with a credit/debit note or `cancel` (number retained, status `CANCELLED`, reversal rows). No hard delete, ever. | GST + audit. |

**MongoDB transaction note:** Atlas replica sets support multi-document transactions — wrap every posting handler in `session.withTransaction()`. On a standalone cluster, fall back to the compensating-write order in §4.2.

---

## 2. Data model — new MongoDB collections

All under `src/lib/mongodb/models/`. Mongoose, `timestamps: true`, and the existing `mongoose.models[x] ?? model(...)` guard pattern.

### 2.1 `Party.ts` → `parties`

```ts
partyId: string          // unique, "PTY-0001"
partyType: "CLIENT" | "SUPPLIER" | "BOTH"
ownerId?: string         // ← Owner.ownerId  (clients)
supplierRefId?: string   // ← Supplier._id   (suppliers)
displayName, legalName, contactPerson
mobile (required, /^[6-9]\d{9}$/), phone, email
billingAddress, city, stateCode ("27"), pin, country = "India"
gstin, pan
gstTreatment: "REGULAR"|"COMPOSITION"|"UNREGISTERED"|"SEZ"|"EXPORT"   // = UNREGISTERED
docType, docNumber                       // KYC — Aadhaar / DL / PAN
openingBalance = 0, openingType: "DR"|"CR" = "DR", openingDate
creditAllowed = false, creditLimit = 0, creditDays = 0
dateOfBirth, anniversary
bankName, bankAccount, bankIfsc
photoPath, remark, isActive = true
```
Indexes: `{partyId:1}` unique · `{displayName:1}` · `{mobile:1}` · `{gstin:1}` · `{partyType:1, isActive:1}`.

### 2.2 `SalesDoc.ts` → `sales_docs`

```ts
docType: "QUOTATION" | "INVOICE" | "CREDIT_NOTE"
docNumber: string        // "INV/2026-27/0042" — allocated at POST only
docDate: string          // ISO YYYY-MM-DD
branchId = "MAIN"
invoiceType: "GST" | "NON_GST" | "BILL_OF_SUPPLY" | "EXPORT"
linkType: "COUNTER_SALE" | "CLIENT_ACCOUNT"
partyId?, partyName ("CASH" default), partyGstin, partyAddress, partyMobile
animalId?, animalName?                   // primary patient (optional)
visitId?, consultationId?
placeOfSupply: string                    // state code
isInterstate: boolean
reverseCharge = false
soldByStaffId?, soldByStaffName?
priceInclusive = false
lines: SalesLine[]
subTotal, discountTotal, taxableValue
cgst, sgst, igst, cess
shippingAmount = 0, roundOff = 0, grandTotal
paidAmount = 0, balanceDue
paymentStatus: "UNPAID" | "PARTIAL" | "PAID"     // derived, never hand-set
status: "DRAFT" | "POSTED" | "CANCELLED" | "CONVERTED"
referenceDoc?, deliveryTerms?, remarksPrivate?   // remarksPrivate is NEVER printed
validUntil?                              // quotations only
convertedToDocNo?, revisedFromId?
postedAt?, cancelledAt?, cancelReason?
createdBy, createdByName
```

`SalesLine`:
```ts
lineNo, itemId?, itemCode?, itemName     // snapshot, never a join
itemClass: "GOODS" | "SERVICE"
lineType: "Vaccine"|"Consultation"|"Pharmacy"|"Procedure"|"Diagnostic"|"Service"|"Food"|"Accessory"
description?, tag?, serialNo?
batchId?, batchNo?, expiryDate?
animalId?
hsnSac?, uom?
quantity, freeQuantity = 0, rate
discountType: "percentage"|"fixed", discountValue = 0, discountAmount = 0
taxableValue, gstRate, cgst, sgst, igst, cess, lineTotal
sourceRef?                               // "RX:<visitId>:<section>:<elementId>"
```

Indexes: `{docType:1, docNumber:1}` unique · `{docDate:-1, status:1}` · `{partyId:1, docDate:-1}` · `{visitId:1}` · `{status:1, balanceDue:1}` · sparse unique `{_id:1, "lines.sourceRef":1}` for Rx idempotency.

### 2.3 `PartyLedger.ts` → `party_ledger`

```ts
partyId, entryDate (ISO)
sourceKind: "OPENING"|"SALE"|"CREDIT_NOTE"|"PURCHASE"|"DEBIT_NOTE"|"PAYMENT"|"EXPENSE"|"ADJUSTMENT"
sourceId, sourceNumber, narration
debit = 0, credit = 0
isReversal = false, reversalOfId?
```
Index `{partyId:1, entryDate:1, _id:1}`. **Never store a mutable balance column** — outstanding is always `opening ± Σ(debit − credit)`.

### 2.4 `StockLedgerEntry.ts` → `stock_ledger`

```ts
itemId, itemCode, itemName, batchId?, batchNo?
entryDate
sourceKind: "PURCHASE"|"SALE"|"RETURN_IN"|"RETURN_OUT"|"ADJUST"|"EXPIRY"|"CONSUMPTION"|"OPENING"
sourceId, sourceNumber
qtyIn = 0, qtyOut = 0, rate, value, balanceAfter
```
Index `{itemCode:1, entryDate:1, _id:1}` · `{batchId:1}`. Backfill from `erp_rows{moduleId:"inventory_ledger"}`, then repoint `getLedgerFn`. **The Inventory module reads this — we do not build new stock screens.**

### 2.5 `NumberSeries.ts` → `number_series`

```ts
branchId, docType        // INV | QTN | CRN | PUR | DBN | PIN | POUT | EXP
fyCode                   // "2026-27"
prefix, padding = 4, nextNumber = 1
```
Unique `{branchId, docType, fyCode}`. Allocated with `findOneAndUpdate({...},{$inc:{nextNumber:1}},{upsert:true,returnDocument:"after",session})` **inside the posting transaction**. FY derived from `docDate`, never `new Date()`. Drafts get no number — the editor title reads "Unsaved Invoice".

### 2.6 `PaymentDoc.ts` → `payment_docs`

Replaces and absorbs `SupplierPayment`.
```ts
docNumber ("PIN/2026-27/0007" | "POUT/2026-27/0003"), docDate
direction: "IN" | "OUT"
partyId, partyName
totalAmount, allocatedAmount, unallocatedAmount        // unallocated = on-account advance
splits: [{ payMode: "CASH"|"CHEQUE"|"CARD"|"UPI"|"WALLET"|"DD"|"BANK_TRANSFER",
           amount, referenceNo, bankName, instrumentDate,
           clearingStatus: "PENDING"|"CLEARED"|"BOUNCED" }]
allocations: [{ docKind: "SALE"|"PURCHASE", docId, docNumber, amount }]
idempotencyKey (unique, sparse)
narration, status: "POSTED" | "CANCELLED"
```

### 2.7 Small new collections

| Model | Collection | Fields |
|---|---|---|
| `TaxCode.ts` | `tax_codes` | `code, kind:"HSN"\|"SAC", description, gstRate, cessRate, effectiveFrom, effectiveTo` — rate history, never overwrite |
| `Uom.ts` | `uoms` | `code, name, decimals` + `conversions:[{itemCode, fromUom, toUom, factor}]` |
| `OrgBranch.ts` | `org_branches` | `code, name, gstin, stateCode, address, city, pin, phone, email, invoiceFooter, isComposition, lutEnabled` |
| `Reminder.ts` | `reminders` | `remindOn, remindTime, title, notes, partyId, animalId, linkKind, linkId, channel, status` |
| `AuditLog.ts` | `audit_logs` | `entity, entityId, action, actorId, actorName, at, beforeJson, afterJson, ip` |
| `FinDailySummary.ts` | `fin_daily_summary` | `branchId, date, saleTaxable, saleTax, saleTotal, received, purchaseTotal, expenseTotal, cashInHand, invoiceCount` — unique `{branchId,date}` |

### 2.8 Extensions to existing models (additive only)

| File | Add |
|---|---|
| `Owner.ts` | `partyId?`, `gstin?`, `pan?`, `stateCode = "27"`, `billingAddress?`, `pin?`, `creditAllowed = false`, `creditLimit = 0`, `openingBalance = 0`, `openingType = "DR"`, `anniversary?` |
| `Supplier.ts` | `partyId?`, `stateCode?`, `pan?`, `pin?`, `bankName?`, `bankAccount?`, `bankIfsc?`, `contactMobile?` |
| `InventoryItem.ts` | `itemClass: "GOODS"\|"SERVICE" = "GOODS"`, `sacCode?`, `priceInclusive = false`, `isScheduleH = false` |
| `PurchaseBill.ts` | `docType: "PURCHASE"\|"DEBIT_NOTE" = "PURCHASE"`, `poNumber?`, `placeOfSupply?`, `partyId?`, `supplierBillDate?`, `itcEligible = true`, `shippingAmount = 0`, per line `landedCost?` |
| `Expense.ts` | `partyId?`, `taxableValue?`, `itcClaimed = false`, `paidByStaffId?`, `paidByStaffName?`, `isRecurringTemplate = false`, `recurEvery?` |
| `ClinicalVisit.ts` | `salesDocNo?`, `salesDocId?`, `pendingAddendum?: []` |

### 2.9 Migrations — `scripts/migrations/` (idempotent, `--dry-run`)

1. `01-seed-masters.mjs` — branch, tax codes, UoM, state codes, expense categories, payment modes, number series FY 2026-27
2. `02-backfill-parties.mjs` — `Owner` → CLIENT party, `Supplier` → SUPPLIER party, match key = mobile, write `partyId` back
3. `03-opening-balances.mjs` — opening balance → one `PartyLedger{OPENING}` row each
4. `04-visits-to-salesdocs.mjs` — each `ClinicalVisit` with `totalAmount > 0` → `SalesDoc{INVOICE, POSTED}`; each `payments[]` entry → a `PaymentDoc{IN}`; plus ledger rows; set `visit.salesDocNo`
5. `05-quotations-to-salesdocs.mjs` — `Quotation` → `SalesDoc{QUOTATION}`
6. `06-stock-ledger.mjs` — `erp_rows{inventory_ledger}` → `stock_ledger`
7. `07-rebuild-daily-summary.mjs` — aggregate posted docs into `fin_daily_summary`

**Gate:** assert Σ posted `SalesDoc.grandTotal` == Σ `ClinicalVisit.totalAmount`; Σ stock ledger per batch == `StockBatch.qty`; Σ party ledger == computed outstanding. Print a diff; stop on mismatch.

---

## 3. Dates — one format, no exceptions

**Display `DD/MM/YYYY`. Store ISO `YYYY-MM-DD`. Never render ISO to a user.**

| Where | Rendering | Helper |
|---|---|---|
| Any date in a table, card, modal, chart tooltip | `16/09/2026` | `formatDisplayDate(iso)` |
| Any timestamp (payment time, audit, posted-at) | `16/09/2026 14:35` | `formatDisplayDateTime(iso)` — **new**, add to `dateUtils.ts` |
| Date input fields | type or pick `DD/MM/YYYY`; stored ISO on change | `parseDisplayDate()` + `isValidDisplayDate()` |
| Chart axis (15-day bars) | `16/09` | `formatDayMonth(iso)` — **new** |
| Period filter header on every report | `01/09/2026 – 16/09/2026` | `formatDisplayDate` ×2 |
| Financial year label | `FY 2026-27 (01/04/2026 – 31/03/2027)` | `fyCodeFor()` + `fyBounds()` |
| Document numbers | `INV/2026-27/0042` | `fyCodeFor(docDate)` |
| Ageing buckets | whole days from ISO, bucket 0-30 / 31-60 / 61-90 / 90+ | plain ISO diff |
| Expiry on a batch | `MM/YYYY` when only month is known, else `DD/MM/YYYY` | `formatExpiry(iso)` — **new** |

**Cleanup task (Phase 0, non-negotiable):** 11 call sites currently format dates by hand and must be replaced with the helpers — `BillingDeskShell.tsx:67,75` · `InvoiceDetailModal.tsx:279,284` · `ManualBilling.tsx:155,441` · `RazorpayGateway.tsx:313,314` · `SubscriptionBilling.tsx:124,125` · `BankingReconciliation.tsx:125`. After this, `toLocaleDateString` / `toLocaleTimeString` must not appear anywhere in `components/erp/billing/` or `components/erp/accounting/`; add an ESLint `no-restricted-syntax` rule so it cannot come back.

**Rules:** a date field never accepts a future date for a payment or an invoice beyond today. A payment date may not precede its invoice date. Period filters enforce `from <= to`, and heavy reports cap the range at 400 days with a visible warning rather than a silent truncation.

---

## 4. Tax engine + server functions

### 4.1 `src/lib/finance/taxEngine.ts` — pure, imports only `moneyUtils`

```ts
export function computeDocument(input: TaxDocInput): TaxDocResult;
export function computeQuick(input: {                 // powers the GST calculator
  amount: number; gstRate: number; cessRate?: number;
  inclusive: boolean; interstate: boolean;
}): { taxable, cgst, sgst, igst, cess, total, roundOff };
```

**Canonical order (blueprint §6.2 — do not reorder):**
1. `gross = quantity × rate` — `freeQuantity` is never charged
2. `discountAmount` = pct ? `round(gross × pct/100)` : the fixed value capped at `gross`
3. `net = gross − discountAmount`
4. Apportion any invoice-level discount across lines **in proportion to `net`**; push the rounding residue onto the largest line so the sum is exact to the paisa
5. If `priceInclusive`: `taxable = round(net × 100 / (100 + gstRate + cessRate))`, `taxTotal = net − taxable`. Else `taxable = net`, `taxTotal = round(taxable × (gstRate + cessRate)/100)`
6. Split: `NON_GST` / `BILL_OF_SUPPLY` → zero · `EXPORT` + `lutEnabled` → zero-rated · interstate (`placeOfSupply !== branchStateCode`) → all IGST · intrastate → CGST and SGST each take half, with the **residue paisa on SGST** so `cgst + sgst === taxTotal` always. Split in **integer paise** (`floor(paise/2)`), not by rounding a float half — `roundMoney(x/2)` can round either way in binary floating point and would sometimes hand the residue to CGST instead
7. `lineTotal = taxable + taxTotal`
8. `grandTotalRaw = Σ lineTotal + shipping`; `grandTotal = Math.round(grandTotalRaw)`; `roundOff = grandTotal − grandTotalRaw`, stored, printed and posted — never swallowed. Half-up rounding puts the band at **−0.49 … +0.50**, not the −0.50 … +0.49 the blueprint quotes (that figure assumes half-down). Half-up is the Indian convention and is what the tests assert.

Also in `src/lib/finance/`: `fyUtils.ts` · `validators.ts` (GSTIN / PAN / IFSC / mobile regexes + **GSTIN first two digits must equal the state code**) · `stateCodes.ts` (all 36).

**Tests** — `__tests__/taxEngine.test.ts`, add `vitest` (`npm i -D vitest`, script `test:unit`). Written first, green before any UI.

### 4.2 `serverFns/salesDocs.ts` — the core

- `createDraftSalesDocFn(input)` — no number assigned
- `updateDraftSalesDocFn({id,...})` — **rejects when status ≠ DRAFT**
- `previewSalesDocFn(input)` — tax engine dry-run, **no persistence**; powers the live totals strip and the GST calculator's "use in invoice"
- `postSalesDocFn({id, idempotencyKey, managerOverride?})` — the one transaction:
  1. re-run the tax engine server-side (never trust client totals)
  2. credit check (§6.7) — block, or allow with a logged manager override
  3. allocate the number from `NumberSeries` (`$inc`, in-transaction)
  4. FEFO batch allocation + `StockBatch.qty` decrement + `stock_ledger` rows for every `GOODS` line
  5. `party_ledger` DR row
  6. if a payment was supplied → `PaymentDoc` + allocations + `party_ledger` CR row (§6)
  7. `fin_daily_summary` upsert · `audit_logs` row
  8. mirror totals + `salesDocNo` onto `ClinicalVisit` when `visitId` is set
  - **Idempotent:** the same key returns the original result. This is what stops a double-click or a retried request on flaky clinic wifi from double-billing.
- `cancelSalesDocFn({id, reason})` — status `CANCELLED`, reversal ledger and stock rows, number retained and never reused
- `listSalesDocsFn({docType, from, to, partyId, status, q, page})` — the dashboard register feed
- `getSalesDocFn({id|docNumber})` · `convertQuotationFn({quotationId})` · `createCreditNoteFn({sourceInvoiceId, lines[]})` · `getInvoicePrintPayloadFn({id})`

Without transactions, write in this order and compensate in reverse on failure: header+lines → stock → ledgers → summary.

### 4.3 `serverFns/payments.ts`
`createPaymentFn` · `listPaymentsFn` · `cancelPaymentFn` · `updateClearingStatusFn` · `autoAllocateFn({partyId, amount})`. All rules in §6.

### 4.4 `serverFns/parties.ts`
`listPartiesFn` · `searchPartiesFn` (type-ahead) · `getPartyFn` · `savePartyFn` (validates GSTIN↔state, writes the opening-balance ledger row) · `getPartyLedgerFn` (keyset paging on `(entryDate,_id)`, never `skip`) · `getPartyOutstandingFn` (bill-wise + ageing) · `checkCreditFn`.

### 4.5 Extensions to existing server-fn files
- **`purchaseBills.ts`** — `poNumber`, `placeOfSupply`, `partyId`; **duplicate-bill guard** unique `{supplierId, billNumber, fyCode}` with a blocking error naming the earlier `internalRef`; `landedCost = rate + apportioned shipping` written to `stock_ledger` (not the invoice rate); `createDebitNoteFn`; `postPurchaseBillFn` / `cancelPurchaseBillFn` with the same ledger discipline
- **`expenses.ts`** — `itcClaimed` + supplier GSTIN block, `partyId` (ledger CR when the payee is a party), recurring-template instantiation
- **`clinical.ts`** — the billing half of `finalizeVisitAndBillFn` becomes `syncRxToDraftInvoiceFn` (§8)
- **`inventory.ts`** — repoint `getLedgerFn` at `stock_ledger`; add `allocateFefoFn({itemCode, qty})` → batches by expiry ascending, expired skipped, anything inside 30 days flagged
- **`counters.ts`** — add `nextDocNumber(docType, docDate, branchId, session?)` backed by `NumberSeries`

### 4.6 `serverFns/financeReports.ts`
`salesRegisterFn` · `purchaseRegisterFn` · `outstandingReceivableFn` · `outstandingPayableFn` · `partyLedgerReportFn` · `dayBookFn` · `cashBankBookFn` · `itemProfitabilityFn` · `expenseAnalysisFn` · `doctorRevenueFn` · `scheduleHRegisterFn`.
*Stock summary and batch-expiry are NOT rebuilt here — the rail links to `/m/inventory`, which already has them.*

### 4.7 `serverFns/gstReturns.ts`
`gstr1Fn({month})` → `{b2b, b2cl, b2cs, cdnr, hsnSummary, docSeries}` · `gstr3bFn({month})` · `gstr2Fn({month})` · `exportGstReturnFn({key, month, format:"json"|"csv"})`.

### 4.8 `serverFns/dashboard.ts`
`getFinanceKpisFn({from,to})` — reads **only** `fin_daily_summary`, never raw invoice lines · `getSalesChartFn({days=15})` · `getDistributionFn({days=30})` · `getDueTabsFn()` · `globalSearchFn({scope, q})` (min 2 chars, cap 50).

### 4.9 `serverFns/reminders.ts` · `serverFns/audit.ts`
`listRemindersFn` · `saveReminderFn` · `completeReminderFn` · `generateDueRemindersFn()` (auto-creates for invoices past `creditDays`) · `writeAudit()` helper + `listAuditFn`.

---

## 5. The UI — one dashboard, one narrow right rail

### 5.1 Layout

```
┌──────────────────────────────────────────────────────────────┬────┐
│  Billing Desk — Real Care Small Animal Clinic                 │ ▸  │
│  [Period ▾] [🔍 search]        [👁 mask] [🔄] [🧮 GST]        │ ⊞  │  ← right rail
├──────────────────────────────────────────────────────────────┤ 📄 │    56px collapsed
│  ① SIX KPI CARDS                                              │ 🛒 │    224px on hover
├───────────────────────────────┬──────────────────────────────┤ 💰 │
│  ② 15-day sales bars          │  ③ Recent Sales | Due |      │ 🧾 │
│     30-day donut              │     Received | Cheque alerts │ 📊 │
├───────────────────────────────┴──────────────────────────────┤ 🔔 │
│  ④ DOCUMENTS REGISTER — the big one                           │ ⚙  │
│  [Invoices][Quotations][Credit Notes][Payments][Purchases]    │────│
│  [Expenses]     search · status · export                      │ ●● │  ← status dots
│  ┌─────────────────────────────────────────────────────────┐  │    │
│  │ Date │ No. │ Party │ Pet │ Taxable │ GST │ Total │ Due │ │  │    │
│  └─────────────────────────────────────────────────────────┘  │    │
├──────────────────────────────────────────────────────────────┴────┤
│  ⑤ status strip: DB ● · last backup 16/09/2026 · FY 2026-27       │
└───────────────────────────────────────────────────────────────────┘
```

Route `/m/billing` (aliases `sales`, `invoices`) → **`BillingDeskHub.tsx`**. One scrolling page. **No section swapping of the main area — the dashboard is always what you see.** Every drill-down opens as a modal or a right slide-over on top of it.

```
src/components/erp/billing/
├── BillingDeskHub.tsx          ← NEW: dashboard page + rail + modal host
├── RightRail.tsx               ← NEW: narrow icon rail (replaces BillingDeskShell)
├── GstCalculatorPopover.tsx    ← NEW: §7
├── DocumentsRegister.tsx       ← NEW: block ④, the tabbed table
├── InvoiceEditorModal.tsx      ← rebuilt from NewSalesInvoiceModal
├── PaymentModal.tsx            ← rebuilt from PaymentInModal + PartialPaymentModal
├── PartyFormModal.tsx          ← NEW
├── PartyLedgerModal.tsx        ← NEW
├── DocumentDetailSheet.tsx     ← NEW: right slide-over for any row
└── print/  InvoiceA5.tsx · InvoiceThermal80.tsx · print.css
```

`BillingDeskShell.tsx` is deleted — `RightRail.tsx` replaces it.

### 5.2 The right rail (`RightRail.tsx`)

- **`w-14` (56 px) collapsed, `w-56` (224 px) on hover/focus**, `transition-[width] duration-200`. Icons only when collapsed, each with a shadcn `Tooltip` on the left. Labels fade in when expanded. A pin toggle persists the expanded state in `localStorage`.
- Sits inside the page as a sticky right column (`sticky top-4 self-start h-[calc(100vh-8rem)]`) — it scrolls with nothing and steals no width from the dashboard.
- On screens under `md` it collapses to a single floating action button bottom-right that opens a `vaul` sheet with the same list.
- Theme: `bg-card border border-border` — **not** the current `bg-[#0f172a]`. The active item gets `bg-primary-soft text-primary`.

Contents, four groups separated by `<Separator />`:

| Group | Items | Behaviour |
|---|---|---|
| **Create** | New Invoice · New Quotation · Payment In · Payment Out · Add Purchase · Add Expense · Add Client · Add Reminder | Opens the matching modal over the dashboard |
| **Tools** | **GST Calculator** · Day Book · Daily Summary · Outstanding & Ageing · Print Queue · Audit Log | Modal or slide-over |
| **Go to** | Inventory · Accounting · Pet & Owner CRM · Pharmacy · Laboratory · Clinical Reports | `<Link>` to `/m/inventory`, `/m/accounting`, `/m/crm-pets`, `/m/pharmacy`, `/m/laboratory`, `/m/reports` — **these modules already exist; we build nothing there** |
| **Returns & GST** | Credit Note · Debit Note · GSTR-1 · GSTR-3B · GSTR-2 · Settings | Modal |

Bottom of the rail: three small status dots (DB reachable · last backup · sync), the Hitech footer strip reduced to what actually carries information.

### 5.3 Block ① — six KPI cards
Total Sale · Amount Received · Amount Due · Purchases · Expenses · Cash in Hand. All driven by the single `DateRangeFilter` in the header (Today / Yesterday / This Week / This Month / Last Month / This Quarter / This FY / Last FY / **Custom**). A mask (eye) toggle blanks every amount for over-the-counter privacy. Data comes from `getFinanceKpisFn`, which reads only `fin_daily_summary`.

### 5.4 Block ② — charts
15-day daily sales bars with auto `1k = 1000` scaling, x-axis `DD/MM`. 30-day donut: Sale / Purchase / Expense. Colors from tokens (`--color-primary`, `--color-success`, `--color-warning`) — the current hard-coded `INSIGHT_COLORS` hex array is removed.

### 5.5 Block ③ — four alert tabs
Recent Sales · Client Amount Due · Amount Received · Cheque/DD Alerts (from `splits.clearingStatus === "PENDING"`). Each row is clickable and opens `DocumentDetailSheet`.

### 5.6 Block ④ — the Documents Register (this is where "see all bills and invoices" lives)

One table component, six tabs, always on the dashboard:

| Tab | Source | Columns |
|---|---|---|
| **Invoices** | `SalesDoc{INVOICE}` | Date · No. · Party · Pet · Type · Taxable · GST · Total · Paid · **Due** · Status |
| **Quotations** | `SalesDoc{QUOTATION}` | Date · No. · Party · Pet · Total · Valid Until · Status |
| **Credit Notes** | `SalesDoc{CREDIT_NOTE}` | Date · No. · Party · Against Invoice · Total |
| **Payments** | `PaymentDoc` | Date · No. · In/Out · Party · Mode(s) · Amount · Allocated · Unallocated |
| **Purchases** | `PurchaseBill` | Date · Our Ref · Supplier Bill No. · Supplier · Taxable · GST · Total · Due |
| **Expenses** | `Expense` | Date · Voucher · Category · Paid To · Mode(s) · Amount |

Shared toolbar on every tab: search · status filter · row count · **Export CSV** · **Export PDF**. Rows animate in with the same `framer-motion` pattern as `m.$moduleId.tsx`.

**Row click → `DocumentDetailSheet`** (right slide-over, `w-[560px]`, full width on mobile): header with number, status pill and party; line-item table; tax breakup; payment history with timestamps `DD/MM/YYYY HH:mm`; and the actions — **Print** · **Payment In** · **Credit Note** · **Convert to Invoice** (quotations) · **Cancel** (reason required) · **WhatsApp**. The existing `InvoiceDetailModal` content is moved into this sheet; nothing is lost.

### 5.7 The invoice editor (`InvoiceEditorModal.tsx`)

Hitech's layout, top to bottom, so staff don't relearn:

1. **Invoice information** — Invoice Type · Date (`DD/MM/YYYY`) · Sold By · **Link To: Counter Sale | Client Account** · Mobile No. · Client Name (defaults `CASH`) · Address · Place of Supply · Client GSTIN · **Patient (animal) selector**
2. **Particulars** — Tagging | Item Code toggle · item type-ahead with an inline **red warning icon while nothing matches** and a "create new" option · UoM · Quantity · Sale Price · Discount ₹|% toggle · **batch picker (FEFO)** · Amount · green **+** to push the line
3. **Grid** — `S.No | Item | Tag | Batch | Expiry | Qty | UoM | Rate | Disc | Taxable | GST | Amount`, inline edit, `Ctrl+D` to delete
4. **Footer** — `Add Shipping and Packaging Costs` checkbox-reveal · `Invoice Reference` checkbox-reveal · Delivery Terms (printed) · **Remarks (Private Use) — never printed** · **live tax strip: Taxable / CGST / SGST / IGST / Cess / Round-off / TOTAL** from `previewSalesDocFn`
5. **Payment** — `SplitPaymentInput`, full rules in §6
6. **Actions** — Save Draft · **Save (F9)** · **Save and Print (F10)**. Dirty state shows "Unsaved Invoice" with a confirm-on-close guard
7. **"Pull from Rx"** when opened from a consultation

**Keyboard map** — counter billing is done at speed, ship this on day one:
`F2` item search · `Enter` item → qty → rate → push line · `F4` payment amount · `F9` save · `F10` save and print · `Ctrl+D` delete line · `Esc` cancel line (confirm if the grid is non-empty).

### 5.8 Theme rules — what "matches our theme" means

- `erp-card p-5` for cards · `page-title` for titles · `section-label` for group labels
- Colors **only** from tokens: `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary`, `bg-primary-soft`, `bg-success-soft`, `bg-warning-soft`, `bg-danger-soft`, `text-navy`. **No hard-coded hex anywhere in the module** — `BillingDeskShell`'s `bg-[#0f172a]` and `BillingDeskDashboard`'s `INSIGHT_COLORS` both go
- `<StatusPill />` for every status · money right-aligned `tabular-nums font-semibold`
- Tables: `bg-muted/60` header · `divide-y divide-border` · `hover:bg-primary-soft/35` · `overflow-x-auto scrollbar-thin`
- Motion: `initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.3}}`
- Mobile: rail → FAB + sheet, tables scroll horizontally, modals `max-h-[85vh] overflow-y-auto`

### 5.9 Print — `print/`
`InvoiceA5.tsx` (branch header + GSTIN, party block, line grid with HSN, HSN-wise tax summary, amount in words, round-off, footer terms, signature) · `InvoiceThermal80.tsx` (80 mm counter slip) · `print.css`. Both fed by `getInvoicePrintPayloadFn`. `remarksPrivate` appears in neither.

---

## 6. Payment logic — the complete rules

This is the part that must be exactly right. All of it lives in `serverFns/payments.ts` and is enforced server-side, not in the UI.

### 6.1 Modes and references
Cash · Cheque · Card · UPI · Mobile Wallet · Demand Draft · Bank Transfer.
`referenceNo` is **required for every mode except Cash** (disabled for Cash, exactly as Hitech does). Cheque and DD additionally require `bankName` and `instrumentDate`, and are created with `clearingStatus: "PENDING"` — **not** `CLEARED`.

### 6.2 Split tender
One receipt, many modes (₹600 UPI + ₹400 cash). `Σ splits.amount` must equal `totalAmount` **to the paisa** or the write is rejected with a field-level error. Splits apply to invoices *and* expenses.

### 6.3 Allocation (bill-wise settlement)
- Default proposal is **oldest first**: ascending `docDate`, then `docNumber`. The biller can override any row.
- Per document: `allocation ≤ balanceDue`. Over-allocation is rejected, naming the document.
- `allocatedAmount = Σ allocations`; `unallocatedAmount = totalAmount − allocatedAmount`, and it is never negative.
- Allocation amounts are rounded to 2dp; any residue paisa lands on the **last** allocation so the sum is exact.

### 6.4 Advances and on-account
Excess money is not an error — it becomes `unallocatedAmount`, posts to `party_ledger` as a credit, shows on the dashboard as "Advance ₹X" against that party, and is offered first the next time an invoice is raised for them.

### 6.5 Derived status — never hand-set
```
balanceDue = round(grandTotal − Σ allocations to this doc)
paymentStatus = balanceDue <= 0.005      ? "PAID"
              : Σ allocations > 0        ? "PARTIAL"
              :                            "UNPAID"
```
Recomputed by the server on every payment, cancellation and clearing change. The client never sends a status.

### 6.6 Counter sale vs client account
- `COUNTER_SALE` must be **fully settled at post time**. If the customer can't pay in full, the biller must explicitly switch `linkType` to `CLIENT_ACCOUNT`, which requires a party with `creditAllowed = true`.
- `CLIENT_ACCOUNT` may post with a balance, subject to §6.7.

### 6.7 Credit control (checked at post)
```
if !party.creditAllowed && balanceDue > 0          → block: "Payment required"
if outstanding + balanceDue > party.creditLimit    → block, manager override allowed (audited)
if oldest unpaid invoice age > party.creditDays    → warn, do not block
```
A manager override writes an `audit_logs` row with actor, IP and the breached amount.

### 6.8 Cheque / DD lifecycle
`PENDING` → **Clear** → `CLEARED` (ledger unchanged, instrument drops off the alert tab)
`PENDING` → **Bounce** → `BOUNCED`: writes a reversal `party_ledger` row, recomputes the invoice back to `PARTIAL`/`UNPAID`, restores the party's outstanding, and auto-creates a `Reminder` for follow-up. Bank charges, if any, go in as a separate expense.

### 6.9 Refunds
There is no "negative payment". A refund is a **credit note** (`SalesDoc{CREDIT_NOTE}`) plus a **Payment OUT** allocated against it. This keeps GSTR-1 CDNR correct.

### 6.10 Idempotency, timing and immutability
- Every payment write carries a client-generated `idempotencyKey` (unique, sparse index). A repeat returns the original receipt.
- A payment date may not precede its invoice date, and may not be in the future.
- No payment against a `DRAFT` or `CANCELLED` document.
- Payments are never edited. Cancel (reversal + audit) and re-enter.

### 6.11 Cash position
Cash splits feed the **Cash in Hand** KPI and the Day Book's mode-wise close. Cash in Hand = opening cash + cash receipts − cash payments − cash expenses, for the selected period.

### 6.12 Posting effects (blueprint §6.6, restated for this codebase)

| Document | `party_ledger` | `stock_ledger` | Effect |
|---|---|---|---|
| Invoice (client account) | DR party = grandTotal | qtyOut per GOODS line | ↑ receivable |
| Invoice (counter, settled) | DR party, then CR by payment | qtyOut | nets to zero |
| Credit note | CR party | qtyIn | ↓ receivable |
| Purchase bill | CR supplier | qtyIn at landed cost | ↑ payable |
| Debit note | DR supplier | qtyOut | ↓ payable |
| Payment In | CR party | — | ↓ receivable |
| Payment Out | DR party | — | ↓ payable |
| Expense | CR supplier if party-linked | — | cash/bank out |
| Opening balance | DR or CR per `openingType` | — | seeds the ledger |

---

## 7. The GST calculator (`GstCalculatorPopover.tsx`)

A **small `Calculator` icon button** in the dashboard header strip, next to refresh — `size-8`, `variant="ghost"`, tooltip "GST Calculator", shortcut `Alt+G`. It opens a shadcn `Popover`, ~320 px, anchored below the icon. It is never a page and never a big modal.

**Inputs:** Amount · rate chips `0 / 5 / 12 / 18 / 28` plus a custom field · Cess % (collapsed by default) · toggle **Exclusive | Inclusive** · toggle **Intra-state | Inter-state**.

**Outputs, live as you type:** Taxable · CGST · SGST · IGST · Cess · **Total** · Round-off. Intra shows CGST/SGST rows and hides IGST; inter does the reverse.

**Two buttons:** *Copy breakup* (to clipboard, as text) and *Use in invoice* — which, when an invoice editor is open, pushes the amount and rate into the current line.

It calls `computeQuick()` from the **same tax engine** as the invoice screen (D4). There is no second tax implementation to drift. It also remembers the last-used rate and mode in `localStorage`.

---

## 8. Rx → billing integration

`syncRxToDraftInvoiceFn({visitId})` in `clinical.ts`:

```
for each billable element in
    Immediate Treatment · Prescribed Treatment · Injectables ·
    Prescribed Food · Accessories · Lab Orders ·
    Consultation Fee · Vaccination · Deworming:

  sourceRef = `RX:${visitId}:${section}:${elementId}`
  upsert the line into the DRAFT SalesDoc for that visitId, keyed on sourceRef
```

1. Duplicates are prevented by the **unique index on `(_id, lines.sourceRef)`**, not by application checks.
2. Editing an Rx element updates the matching draft line; deleting it removes the line — **only while `status === "DRAFT"`**.
3. Once `POSTED`, later Rx edits append to `ClinicalVisit.pendingAddendum[]` and raise a badge at reception; the biller resolves it with a new invoice or a credit note. **A posted document is never silently mutated.**
4. Immediate Treatment writes a `CONSUMPTION` stock move at administration time and bills at invoice time. The posting fn must not double-deduct: if a line already has a `CONSUMPTION` move for that `sourceRef`, skip the `SALE` deduction and record the sale against the existing move.
5. Prescribed (take-home) items move stock only when dispensed at the counter.

---

## 9. Roles and security (enforced in the handler, not the UI)

| Role | Can |
|---|---|
| Receptionist | create invoice / quotation / payment-in; **no cancel, no cost price, no margin** |
| Pharmacist | dispense, batches, purchase entry |
| Doctor | Rx; reads own revenue only |
| Accountant | all finance, cancel with reason, GST returns |
| Admin | masters, settings, credit-limit override |

Cost price and margin are stripped **server-side** before the response leaves. Every `post` / `cancel` / `print` / `export` / `override` writes an `audit_logs` row with actor and IP. No hard delete of any financial document.

---

## 10. Build schedule

Working days only; holidays not accounted for. Start **Wed 16/09/2026**.

| Phase | Dates | Days | Deliverable | Done when |
|---|---|---|---|---|
| **0 · Foundation** | 16/09/2026 – 18/09/2026 | 3 | `src/lib/finance/*` (tax engine, fyUtils, validators, stateCodes) · vitest + full §11.1 matrix · `TaxCode`, `Uom`, `OrgBranch`, `NumberSeries`, `AuditLog` · `nextDocNumber()` · **date-helper cleanup of the 11 call sites + ESLint guard** · migration `01` | `npm run test:unit` green, masters seeded, no raw locale dates left |
| **1 · Party master** | 21/09/2026 – 24/09/2026 | 4 | `Party` + `PartyLedger` · `serverFns/parties.ts` · `PartyFormModal` + `PartyLedgerModal` · migrations `02`, `03` | Every owner and supplier has a party row; each ledger opens at the right balance |
| **2 · Sales invoice** *(critical path)* | 25/09/2026 – 06/10/2026 | 8 | `SalesDoc`, `StockLedgerEntry`, `PaymentDoc` · `salesDocs.ts` + posting transaction · `InvoiceEditorModal` · print templates · migrations `04`, `05` · old fns rewritten as `SalesDoc` wrappers | A counter sale **and** a client-account GST sale both post, print and hit the party ledger — and every existing screen still works |
| **3 · Payments** | 07/10/2026 – 12/10/2026 | 4 | `payments.ts` with **every rule in §6** · `PaymentModal` · cheque clearance · advances · credit control | Partial, split, advance, over-payment, bounce and refund all behave per §6 |
| **4 · Dashboard + rail** | 13/10/2026 – 20/10/2026 | 6 | `BillingDeskHub` · `RightRail` · `DocumentsRegister` (6 tabs) · `DocumentDetailSheet` · **`GstCalculatorPopover`** · `dashboard.ts` + `fin_daily_summary` + migration `07` · token sweep | The whole module is one page; every bill, quotation, payment, purchase and expense is visible and openable from it |
| **5 · Purchases & expenses (finance view)** | 21/10/2026 – 26/10/2026 | 4 | Purchase extensions (PO no., POS, landed cost, duplicate-bill guard, debit note) · expense ITC block · migration `06` · repoint `getLedgerFn` | Purchase → sale → return leaves stock and the supplier ledger reconciled to the unit |
| **6 · Rx integration** | 27/10/2026 – 30/10/2026 | 4 | `syncRxToDraftInvoiceFn` · addendum flow · consumption-vs-dispensing reconciliation · lab order → billable line | A doctor finishing an Rx produces a correct draft bill with zero re-keying; three sync runs give an identical line count |
| **7 · Reports & GST** | 02/11/2026 – 09/11/2026 | 6 | `financeReports.ts` (11 reports) · `gstReturns.ts` (GSTR-1 / 3B / 2) · CSV + PDF export · `reminders.ts` + reminder UI · global search | A full month's GSTR-1 reconciles with the sales register to the rupee |
| **8 · Hardening & cutover** | 10/11/2026 – 13/11/2026 | 4 | Role matrix server-side · audit viewer · status strip · settings · backup drill · performance pass · parallel run + UAT | Parallel-run bills match Hitech bill-by-bill; Hitech goes read-only |

**Target go-live: Mon 16/11/2026.** Total ≈ 39 working days, one developer. Two developers can run Phases 3–5 in parallel with Phase 2 once `SalesDoc` lands, bringing it to roughly 25 days.

**Phase 9 — deferred, do not start before Phase 8 ships:** e-Invoice IRN/QR · e-Way Bill · WhatsApp bill delivery · barcode scanning at the counter · full GL with trial balance · multi-branch consolidation.

---

## 11. Testing

### 11.1 Tax engine matrix (unit, written first)
`{intra, inter} × {0, 5, 12, 18, 28%} × {exclusive, inclusive} × {no discount, % discount, ₹ discount} × {goods, service}` = 240 cases, plus:
- quantity with 3 decimals (0.125 kg feed) · rate with paise (₹12.67)
- CGST/SGST half-paisa split → **residue on SGST, `cgst + sgst === taxTotal`**
- round-off at exactly `₹x.50`
- 100% discount line → taxable 0, tax 0, no divide-by-zero
- free quantity → stock moves, nothing billed
- inclusive pricing → printed total never exceeds `MRP × qty`
- invoice-level discount → `Σ line taxable === invoice taxable`, to the paisa
- `computeQuick()` agrees with `computeDocument()` on a single-line document (guards the GST calculator against drift)

### 11.2 Payment tests (§6, every rule)
Split ≠ total rejected · non-cash without reference rejected · allocation > balanceDue rejected · oldest-first proposal correct · one payment across three invoices leaves every `balanceDue` and the `unallocatedAmount` right · advance auto-offered on the next invoice · counter sale cannot post part-paid · credit-limit breach blocks and the override audits · cheque bounce reverses cleanly and creates the reminder · refund = credit note + payment out · same idempotency key twice = one receipt.

### 11.3 Integration (Playwright, seeded test DB)
Post → cancel → repost: no number gaps, no reuse · two concurrent posts: no duplicate numbers (real DB locking, not mocks) · Rx sync ×3: line count stable · purchase → sale → return: `stock_ledger` closing == `StockBatch.qty` · every visible date matches `/^\d{2}\/\d{2}\/\d{4}$/`.

### 11.4 Nightly reconciliation (`scripts/reconcile.mjs`)
```
Σ(party_ledger.debit − credit) per party      == computed outstanding
Σ(stock_ledger.qtyIn − qtyOut) per batch      == StockBatch.qty
Σ(SalesDoc.grandTotal where POSTED) per day   == fin_daily_summary.saleTotal
Σ GSTR-1 taxable for a month                  == sales register taxable
```

### 11.5 UAT
The receptionist bills 20 real visits in parallel on Hitech and here for one week. Compare bill-by-bill and the month-end GST summary. **Ship only when they match to the rupee.**

---

## 12. Seed data (`01-seed-masters.mjs`)

- GST rates 0 / 5 / 12 / 18 / 28 with effective dates
- Vet HSN: 3004 medicaments · 2309 animal feed · 3002 vaccines · 9018 instruments · SAC 998351 veterinary services
- UoM: PCS, STRIP, TAB, BOTTLE, VIAL, ML, GM, KG, DOSE, SESSION
- All 36 state codes
- Expense categories: Rent, Salary, Electricity, Water, Internet & Phone, Vehicle & Fuel, Clinic Consumables, Housekeeping, Equipment Maintenance, Marketing, Professional Fees, Bank Charges, Licence & Statutory, Miscellaneous
- Payment modes: Cash, Cheque, Card, UPI, Mobile Wallet, Demand Draft, Bank Transfer
- Number series FY 2026-27: INV, QTN, CRN, PUR, DBN, PIN, POUT, EXP
- Org branch: Real Care Small Animal Clinic, state code `27`

---

## 13. Coverage matrix — every blueprint item has a home

| Blueprint § | Requirement | Where it lands |
|---|---|---|
| 1.2 #1 | GST/Non-GST invoice, counter + client account | `SalesDoc.invoiceType` + `linkType`; §5.7 |
| 1.2 #2 | Quotation → invoice | `convertQuotationFn`; register tab + detail sheet action |
| 1.2 #3 | Purchase bill + supplier + PO + shipping | Phase 5; existing `SupplierBillFormModal` reused |
| 1.2 #4 | Supplier master + bank + tax + opening balance | `Party` + `PartyFormModal` |
| 1.2 #5 | Client master + credit limit + KYC | `Party` + `PartyFormModal` |
| 1.2 #6 | Categorised expenses + pay mode + reference | Phase 5; existing `ExpenseFormModal` reused |
| 1.2 #7 | Payment In / Out, bill-wise settlement | **§6, in full** |
| 1.2 #8 | Dashboard KPIs, sales chart, distribution | §5.3, §5.4 |
| 1.2 #9 | Search by Stock / Serial / Invoice / Client | `globalSearchFn`, header search |
| 1.2 #10 | Reports + GSTR-1 / 3B / 2 | §4.6, §4.7; rail → Tools / Returns |
| 1.2 #11 | Sales return / purchase return | `createCreditNoteFn` / `createDebitNoteFn` |
| 1.2 #12 | Reminders on dues and follow-ups | §4.9 + rail → Add Reminder |
| 1.4 #1 | Goods and services on one invoice | `itemClass` on item and line |
| 1.4 #2 | Patient dimension per line | `SalesDoc.animalId`, `SalesLine.animalId` |
| 1.4 #3 | Batch + expiry mandatory for drugs | FEFO picker, `allocateFefoFn` |
| 1.4 #4 | Rx-driven billing, idempotent | §8 |
| 1.4 #5 | Schedule-H register | `isScheduleH` + `scheduleHRegisterFn` |
| 2.1 | Sidebar, header utilities, status strip | **§5.2 right rail** + §5.1 status strip |
| 2.2 | Dashboard | §5.1–§5.6 — now the whole module |
| 2.3 | Sale invoice screen, field for field | §5.7 |
| 2.4 | Purchase bill screen | existing modal + Phase 5 extensions |
| 2.5 | Supplier master | `PartyFormModal` (supplier mode) |
| 2.6 | Client master | `PartyFormModal` (client mode) |
| 2.7 | Expense screen | existing modal + ITC block |
| 4.2 | Pure engine · immutable docs · one transaction · separate read models | D4 · D6 · D5 · `fin_daily_summary` |
| 5.x | Full schema | §2, translated to Mongoose |
| 6.1 | Place of supply → tax split | `taxEngine` step 6 |
| 6.2 | Canonical line computation | `taxEngine` steps 1–7 |
| 6.3 | Round-off stored, printed, posted | `taxEngine` step 8 |
| 6.4 | Gapless FY-aware numbering at post time | `NumberSeries` + `nextDocNumber` |
| 6.5 | FEFO, expiry warnings, expired blocked | `allocateFefoFn` |
| 6.6 | Posting rules per document | **§6.12** |
| 6.7 | Credit control + manager override | **§6.7** |
| 6.8 | Rx sync rules 1–5 | §8 |
| 6.9 | Period selectors everywhere | existing `DateRangeFilter` + §3 |
| 7.1 | Keyboard map | §5.7 |
| 7.2–7.5 | Purchase / party / expense / dashboard screens | §5, Phase 5 |
| 8.1 | API surface | §4 — server fns rather than REST, same contract |
| 8.2 | Idempotency key, field-level errors | §4.2, §6.10, zod field errors |
| 8.3 | Daily summary, indexes, keyset paging | §2.7, §2 indexes, §4.4 |
| 9 | Reports and returns | §4.6, §4.7 — stock reports deep-link to `/m/inventory` |
| 10 | Test strategy | §11 |
| 12 | Data migration | §2.9 + Phase 8 parallel run |
| 13 | Roles, audit, compliance, backup | §9 |
| — | **Date format everywhere** | **§3** |
| — | **GST calculator** | **§7** |

**Deliberately out of scope** (blueprint §1.3, unchanged): full double-entry GL with trial balance / P&L / balance sheet · e-Invoice IRN/QR · e-Way Bill · TDS/TCS · composition returns · multi-currency · payroll. The posting tables are shaped so a GL can be layered on later with no data migration.

**Deliberately not rebuilt** (already shipping elsewhere): stock levels, batches, expiry and movements (`/m/inventory`) · chart of accounts, journals, P&L, banking, taxation (`/m/accounting`) · owner and pet profiles (`/m/crm-pets`) · dispensary counter (`/m/pharmacy`) · lab orders (`/m/laboratory`) · clinical documents (`/m/reports`). The right rail links to each.

---

## 14. Definition of done

- [ ] The Billing module is **one dashboard page**; nothing essential requires navigating away
- [ ] The right rail is 56 px collapsed, never wider than 224 px, and carries only secondary actions and jump-links
- [ ] Every invoice, quotation, credit note, payment, purchase and expense is visible and openable from the dashboard register
- [ ] Counter sale and client-account GST invoices post, print (A5 + thermal) and hit the party ledger correctly
- [ ] Tax engine matrix fully green, inclusive pricing and residue-paisa cases included
- [ ] The GST calculator opens from a small header icon and agrees with the invoice screen to the paisa
- [ ] Every payment rule in §6 is enforced server-side and covered by a test
- [ ] Invoice series consecutive and gapless across post/cancel/repost and under concurrent terminals
- [ ] Purchase → sale → return leaves stock and the supplier ledger reconciled to the unit
- [ ] **Every user-facing date renders `DD/MM/YYYY`**; no `toLocaleDateString` remains in the module; the ESLint guard is active
- [ ] Rx sync is idempotent; posted invoices are never silently mutated
- [ ] GSTR-1 export reconciles with the sales register for a full month
- [ ] One week of parallel running matches Hitech bill-by-bill
- [ ] Role permissions enforced server-side; audit log populated
- [ ] No hard-coded hex colors anywhere in the module — design tokens only
- [ ] Backup restored successfully in a drill
