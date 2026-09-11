# Billing Desk Module (Hitech BillSoft–style): Complete Implementation Plan

**Goal:** Give the clinic a dedicated, fast, front-desk billing module inside the veterinary ERP that works the way Hitech BillSoft 9.3 works today at Real Care Small Animal Clinic, so staff can switch without retraining, while using the ERP's own customers (pet owners), pets, inventory, consultations and accounts.

**Companion document:** `billing-accounts-implementation-plan.md` (previous plan) is the detailed spec for **Supplier Bills, Payment Out, Expenses, split payments and date ranges**. This document reuses those designs and does not repeat their full detail.

---

## 0. What "like Hitech" means (feature parity checklist)

Taken from the Hitech screen in use at the clinic and Hitech's published feature list.

| Hitech feature | In this module | Phase |
|----------------|----------------|-------|
| Dashboard: Gross Sale, No. of Invoices, Amount Received, Amount Paid, period dropdown, hide-figures (eye) icon | ✓ | 1 |
| Quick actions: New Invoice, New Quotation, Add Purchase, Add Expense, Add Customer, Add Reminder, Payment In, Payment Out | ✓ | 1–4 |
| Business Insights chart (Paid / Overdue / Due invoice distribution, Last 30 days) | ✓ + more charts | 6 |
| Daily Summary, Stock Summary | ✓ | 6 |
| GST / Non-GST / multi-rate invoices, cash and credit sales | ✓ | 2 |
| Print A4, A5, thermal (2" / 3" / 4") | ✓ | 2 |
| Barcode generate + scan billing | ✓ | 5 |
| Purchase bills, purchase returns, supplier ledger, payments | ✓ (previous plan + returns) | 4 |
| Inventory: low stock, availability, non-moving, fast-moving, profit analysis | ✓ + batch/expiry | 5 |
| Client management: credit limit, receipts, account adjustment, cheque alerts, statement | ✓ | 3 |
| GSTR-1, GSTR-3B, auditor reports | ✓ | 6 |
| SMS / Email | ✓ WhatsApp-first | 7 |
| Staff: attendance, salary, commission | Optional | 8 |
| Auto backup | ✓ (cloud DB + scheduled export) | 7 |
| Offline billing | Optional (PWA) | 8 |
| Online Store | Deferred | — |
| Android app | Not needed: web app is responsive / installable PWA | — |

---

## 1. Guiding Principles

1. **One source of truth.** The Billing Desk is a new *front end* over the ERP's existing tables. There must be exactly **one** customer table (pet owners), **one** item/inventory table, **one** invoice table, **one** payment table. No parallel "Hitech copy" of data.
2. **Consultation bills and counter bills are the same invoice.** The current *Billing & Settlement* step after Doctor Rx opens the same New Invoice screen, pre-filled with pending billables.
3. **Build screens once, mount them in two places.** Supplier Bills, Payment Out and Expenses (previous plan) are built as components and appear both in Billing Desk (Purchase / Expense menus) and in Accounting & Finance (18.x). No duplicate screens.
4. **Keyboard-first and fast.** A counter operator must be able to bill without the mouse (Section 22). Target: item search < 200 ms, invoice save < 1 s.
5. **Global rules from the previous plan apply:** DD/MM/YYYY display, ISO storage, Asia/Kolkata day boundaries, decimal money, atomic transactions, void instead of delete, From/To on every period selector.
6. **Same workflow, ERP's own look.** Copy Hitech's layout pattern and flow (sidebar, quick-action tiles, form fields); keep the ERP's own design system and branding.

---

## 2. How It Fits the Existing ERP

```
 Reception / Appointment
          │
 Clinical Consultation ──► Doctor Rx & Diagnosis ──► Pending Billables (auto-synced, no duplicates)
                                                              │
 Walk-in counter sale (food, accessories, medicine) ──────────┤
                                                              ▼
                                           ┌──────── BILLING DESK ────────┐
                                           │ New Invoice / Quotation      │
                                           │ Payment In / Payment Out     │
                                           │ Purchase / Expense           │
                                           │ Inventory / Customer / ...   │
                                           └──────────────┬───────────────┘
                                                          ▼
                  Inventory (stock ledger) · Customer ledger · Supplier ledger · Cash/Bank book
                                                          ▼
                             Accounting & Finance 18.x (GL, Taxation, Budgeting, Reports)
```

### 2.1 Hitech menu → ERP mapping

| Hitech menu | Billing Desk screen | Build type |
|-------------|--------------------|------------|
| Sale | Invoices, New Invoice, Hold Bills, Sale Returns | New (reuses existing invoice table) |
| Online Store | — | Deferred |
| Purchase | Supplier Bills, Purchase Returns, Payment Out | Reuse previous plan + new returns |
| Inventory | Items, Stock, Batches, Adjustments, Barcodes | Extend existing Inventory module |
| Accounts | Cash Book, Bank Book, Day Book, Cheques, Contra | New views on `payment_lines` |
| Expense | Expenses | Reuse previous plan |
| Customer | Owners, Customer Ledger, Statements | Extend existing owner master |
| Reports | Sales, Purchase, Stock, GST, Outstanding, Summaries | New |
| Staff | Staff, Attendance, Salary, Commission | Optional |
| Tools | Backup, Import/Export, Barcode Labels, Recycle Bin, Audit Log | New |
| Master | Categories, Units, Taxes, HSN, Payment Modes, Series, Services | Extend existing masters |
| Settings | Clinic profile, GST, Print templates, Numbering, Users, Messaging | New |

---

## 3. Module Layout

Route: `/m/billing` (same pattern as `/m/accounting`).

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ BILLING DESK │  Header: Clinic name · Counter/user · global search (owner,  │
│              │  mobile, invoice no., item, barcode) · date & time          │
│ Dashboard    ├──────────────────────────────────────────────────────────────┤
│ Sale       ▸ │                                                              │
│ Purchase   ▸ │                   Page content                               │
│ Inventory  ▸ │                                                              │
│ Accounts   ▸ │                                                              │
│ Expense      │                                                              │
│ Customer   ▸ │                                                              │
│ Reports    ▸ │                                                              │
│ Staff      ▸ │                                                              │
│ Tools      ▸ │                                                              │
│ Master     ▸ │                                                              │
│ Settings     │                                                              │
│              │                                                              │
│ 20:37:42     │                                                              │
│ Thu 03/09/26 │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

- Sidebar collapsible; sub-menus open on hover/click; active item highlighted.
- Menu items hidden by role (Section 24).
- Forms (New Invoice, Payment In, etc.) open as **full-page** on desktop for speed; quick forms (Add Customer, Add Reminder) as modals.
- Mobile: sidebar becomes bottom sheet; dashboard tiles stack two per row.

### 3.1 Route map

```
/m/billing                         Dashboard
/m/billing/sale/new                New Invoice      (?consultationId= / ?quotationId= / ?ownerId=)
/m/billing/sale/invoices           Invoice list
/m/billing/sale/held               Held bills
/m/billing/sale/returns            Sale returns / credit notes
/m/billing/quotations              Quotations (+ /new)
/m/billing/payment-in              Receipts (+ /new)
/m/billing/purchase/bills          Supplier bills    (component from previous plan)
/m/billing/purchase/returns        Purchase returns / debit notes
/m/billing/payment-out             Supplier payments (component from previous plan)
/m/billing/expenses                Expenses          (component from previous plan)
/m/billing/inventory/...           items, stock, batches, adjustments, barcodes
/m/billing/customers/...           list, :id (profile + ledger)
/m/billing/accounts/...            cash-book, bank-book, day-book, cheques, contra
/m/billing/reminders
/m/billing/reports/...
/m/billing/staff/...               (optional)
/m/billing/tools/...
/m/billing/master/...
/m/billing/settings
```

---

## 4. Dashboard

### 4.1 Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Dashboard 👁            [Today ▼]  From [03/09/2026] To [03/09/2026]  ⟳   │
│ GROSS SALE ₹0        NO. OF INVOICES 0     AMOUNT RECEIVED ₹0   AMOUNT PAID ₹0 │
├───────────────────────────────────────────────────────────────────────────┤
│ [New Invoice]   [New Quotation]                                           │
│ [Add Purchase]  [Add Expense]                                             │
│ [Add Customer]  [Add Reminder]                                            │
│ [Payment In]    [Payment Out]                                             │
├───────────────────────────────────────────────────────────────────────────┤
│ BUSINESS INSIGHTS   [Paid/Overdue/Due invoices ▼]   [Last 30 days ▼]   ⟳  │
│                         (chart)                                           │
├───────────────────────────────────────────────────────────────────────────┤
│ Alerts: 4 reminders due today · 6 items low stock · 3 batches expire ≤30d │
│         2 cheques due this week · 5 bills pending from consultations       │
├───────────────────────────────────────────────────────────────────────────┤
│ [Daily Summary]                                    [Stock Summary]        │
└───────────────────────────────────────────────────────────────────────────┘
```

### 4.2 KPI definitions (for the selected From–To, IST)

| KPI | Formula | Tooltip breakdown |
|-----|---------|-------------------|
| Gross Sale | `SUM(sales_invoices.grand_total)` non-void, by invoice date | Services / Medicines / Food / Accessories / Lab |
| No. of Invoices | `COUNT(sales_invoices)` non-void | Counter vs consultation |
| Amount Received | `SUM(payment_lines.amount)` where direction = IN | Cash / UPI / Card / Bank / Cheque |
| Amount Paid | `SUM(payment_lines.amount)` where direction = OUT | Supplier payments / Expenses / Refunds / Salary |

Net Sale (Gross − sale returns) shown as a second line under Gross Sale.

**Eye icon:** masks all dashboard figures as `₹ ••••`. Preference saved per user. Useful when owners stand at the reception counter.

**Period dropdown:** Today, Yesterday, This Week, This Month, Last Month, This FY, Custom, with From/To fields (`DateRangeFilter` from previous plan). Default: Today.

**Refresh (⟳):** re-fetches; also auto-refresh every 60 s while the tab is visible.

### 4.3 Quick actions

| Button | Opens | Keyboard |
|--------|-------|----------|
| New Invoice | `/sale/new` | F2 |
| New Quotation | `/quotations/new` | Alt+Q |
| Add Purchase | Supplier Bill form | Alt+P |
| Add Expense | Expense form | Alt+E |
| Add Customer | Owner quick-add modal | Alt+C |
| Add Reminder | Reminder modal | Alt+R |
| Payment In | Receipt form | Alt+I |
| Payment Out | Supplier payment form | Alt+O |

### 4.4 Business Insights charts (chart dropdown × period dropdown)

1. **Paid / Overdue / Due invoice distribution** (donut, count and ₹), the Hitech default.
2. Sales vs Purchase vs Expense trend (bars by day/week/month).
3. Payment mode split of receipts (donut).
4. Top 10 items / services by sales.
5. Category-wise sales (Services, Medicines, Food, Accessories, Lab).
6. Top 10 customers by outstanding.
7. Expense by category.

Clicking a chart segment opens the filtered list (e.g. Overdue slice → overdue invoices).

### 4.5 Daily Summary (modal, printable on thermal or A4)

For one date (default today): opening cash · sales (count, ₹, by category) · receipts by mode · supplier payments by mode · expenses by mode · refunds · **closing cash in hand** · invoices with dues created today. Button: Print / Share on WhatsApp. This doubles as the **day-end cash tally**: staff enter physical cash counted, the system shows the difference.

### 4.6 Stock Summary (modal)

Total stock value (at purchase rate and at MRP) · low stock items · out of stock · expiring in 30 / 60 / 90 days · expired still in stock · non-moving (no sale in N days). Each row links to the item.

---

## 5. Sale: New Invoice

### 5.1 Layout

```
 New Invoice   INV/2026-27/000123     Date [03/09/2026]      Series [Clinic ▼]   Source: Counter
 Customer [ 98xxxxxx10 / name search… ▼ ] (+ New)   Pet [ Bruno (Labrador) ▼ ]   Doctor [ Dr. … ▼ ]
 Balance due: ₹1,200 · Credit limit: ₹5,000 · Advance: ₹0
 ⚠ 3 items pending from consultation on 03/09/2026  [Add to bill]

 Scan / search item [______________________]  (barcode or name, Enter to add)
 ┌──┬─────────────────────┬────────┬───────┬──────┬──────┬────────┬───────┬──────┬───────────┐
 │# │ Item / Service      │ Batch  │ Exp.  │ Qty  │ Unit │ Rate   │ Disc  │ GST% │ Amount    │
 ├──┼─────────────────────┼────────┼───────┼──────┼──────┼────────┼───────┼──────┼───────────┤
 │1 │ Consultation Fee    │ —      │ —     │ 1    │ Nos  │ 500.00 │ 0     │ 0    │ 500.00    │
 │2 │ Drontal Plus Tab    │ B2231  │ 11/27 │ 2    │ Tab  │ 85.00  │ 5%    │ 12   │ 161.50    │
 │3 │ Royal Canin 3kg     │ RC901  │ 04/27 │ 1    │ Pack │ 2,450  │ 0     │ 18   │ 2,450.00  │
 └──┴─────────────────────┴────────┴───────┴──────┴──────┴────────┴───────┴──────┴───────────┘
 Subtotal · Item disc · Bill disc [ % | ₹ ] · Taxable · CGST · SGST · Round off · GRAND TOTAL ₹3,112.00  (rates GST-inclusive)

 Payment  [SplitPaymentInput]   Cash tendered [3,200]  Change ₹88
 Received now: ₹3,112  → Status: Paid          (less than total → balance goes to customer ledger)
 Notes [            ]   ☑ Send on WhatsApp   Print size [A5 ▼]
 [Hold F8]   [Save F9]   [Save & Print F10]   [Cancel Esc]
```

### 5.2 Header rules

| Field | Rule |
|-------|------|
| Invoice No. | Auto from selected series (Section 17); editable only by Admin |
| Date | Default today; back-dating allowed within N days (setting); future blocked |
| Customer | Search by mobile (primary), name, or pet name. Default "Walk-in Customer" for cash counter sales. Walk-in cannot have a balance due (must be fully paid) |
| Pet | Optional; lists the owner's pets. Line-level pet override for multi-pet owners |
| Doctor | Optional, used for doctor-wise sales and commission |
| Source | `COUNTER`, `CONSULTATION`, `QUOTATION` (set automatically) |

On selecting a customer: show balance due, credit limit, advance, and a banner if there are pending consultation billables.

### 5.3 Line items

- **Line types:** Service (consultation, procedure, grooming), Medicine, Vaccine, Food, Accessory, Lab Test, Other. Driven by the item master.
- **Search:** type-ahead on name, generic name, barcode, item code; shows stock and MRP in results. Barcode scan adds qty 1 or increments the existing line.
- **Batch:** inventory items auto-pick **FEFO** (first expiry, first out) batch with stock; operator can change. If qty exceeds one batch, split across batches automatically into two lines.
- **Stock check:** show available qty; block or warn when insufficient based on `allow_negative_stock` setting. Expired batches are never auto-picked and need Admin override.
- **Rate:** defaults to batch MRP (or item sale price for services). Rate editing allowed per setting; rate below purchase cost shows a warning.
- **Discount:** per line (% or ₹) + bill-level discount (% or ₹), distributed proportionally to lines for GST computation.
- **GST:** rate from item master. Price entry mode setting: *inclusive* (MRP includes GST, back-calculate taxable) or *exclusive*. Medicines at MRP are normally inclusive.
- **Pending billables:** "Add to bill" pulls consultation items (consultation fee, injections, dispensed medicines, lab tests) with their `billable_item_id`. Once invoiced, they are marked billed so they can never be added twice.

### 5.4 GST handling

- Settings decide the document type: **Tax Invoice** (regular GST), **Bill of Supply** (composition scheme, unregistered, or all-exempt bill). Mixed taxable + exempt lines stay on one Tax Invoice.
- CGST+SGST vs IGST from clinic state vs customer state (customers are almost always intra-state; default intra).
- Customer GSTIN optional (B2B, e.g. a kennel or pet shop buying in bulk); if present the invoice is B2B in GSTR-1.
- Services vs goods: veterinary clinical services are generally treated as GST-exempt while medicines, food and accessories carry GST. **Get the exact item-wise rates confirmed by the clinic's CA** and store them in the item master; the code only applies what the master says.

### 5.5 Payment at billing

- Uses `SplitPaymentInput` (previous plan) with `requireExactMatch = false`: received amount may be less than total (credit sale) but never more (excess is either change for cash or an advance only if the user confirms).
- **Cash tendered / change** helper appears when a Cash line exists.
- Customer **advance** available → checkbox "Adjust advance ₹X".
- **Credit limit:** if `previous balance + this bill balance > credit limit`, show a warning; Admin can override, others blocked (setting).
- Status: Paid / Partial / Unpaid; Walk-in must be Paid.

### 5.6 Save logic (one transaction)

1. Lock and increment invoice series counter; insert `sales_invoices` + `sales_invoice_items`.
2. Stock: write `stock_ledger` OUT rows per batch; update batch qty (row lock `FOR UPDATE`).
3. Mark pending billables as billed (`billed_invoice_id`).
4. Payment: `customer_receipts` (source = `INVOICE`) + `payment_lines` (direction IN) + `receipt_allocations` to this invoice.
5. Update invoice `amount_received` / status; GL postings.
6. After commit: print / generate PDF / queue WhatsApp message.

### 5.7 Hold bills

**Hold (F8)** saves the draft (no stock, no number) under the customer name, e.g. while the owner goes to fetch the pet or another customer is waiting. List under *Sale → Held Bills*; resume opens it back in New Invoice. Drafts older than 24 h are flagged.

### 5.8 Invoice list

- Filters: `DateRangeFilter`, customer, pet, doctor, status (Paid / Partial / Unpaid / Overdue / Void), source, payment mode, series; search by number/mobile.
- Columns: Date · Invoice No. · Customer · Pet · Amount · Received · Balance · Status · Source.
- Row actions: View · Print (choose size) · WhatsApp · **Receive payment** · Duplicate as new · Sale return · Void (Admin).
- Footer: totals for filter; export Excel.

### 5.9 Edit, void and lock rules

- Edit allowed on the same day by the creator; older invoices editable only by Admin (setting: lock after N days or after day-end close).
- Editing re-runs stock and GL inside a transaction (reverse old, apply new).
- Returns after the fact go through **Sale Return / Credit Note** (Section 8), not edits.
- Void: Admin only, reason required, stock returned, allocations removed (money becomes customer advance or is refunded), billables un-marked.

---

## 6. Quotation / Estimate

Typical clinic use: surgery or treatment estimate, bulk food order estimate.

- Same form as invoice, but: no stock effect, no payment section, number series `QT/2026-27/…`, **Valid till** date, terms & conditions text.
- Status: Open → Sent → Accepted → Converted / Expired / Rejected. Auto-expire after valid-till.
- **Convert to Invoice:** opens New Invoice pre-filled (`?quotationId=`); re-checks stock and current rates, highlights changed prices; links invoice to quotation.
- Print (A4/A5) and WhatsApp share like invoices.
- List with `DateRangeFilter`, status filter, conversion rate in the footer.

---

## 7. Payment In (customer receipts)

Mirror image of Payment Out from the previous plan.

```
 Payment In     RC/2026-27/000045     Date [03/09/2026]
 Customer* [ 98xxxxxx10 ▼ ]   Outstanding ₹4,750 · Advance ₹0 · [View Ledger]
 Adjust against: (•) Selected invoices  ( ) Oldest first  ( ) Advance (on account)
 ┌───┬────────────┬──────────────┬──────────┬──────────┬─────────────┐
 │ ☑ │ Date       │ Invoice      │ Total    │ Balance  │ Receive now │
 │ ☑ │ 12/08/2026 │ INV/…/000098 │ 3,550.00 │ 3,550.00 │ 3,550.00    │
 │ ☐ │ 28/08/2026 │ INV/…/000117 │ 1,200.00 │ 1,200.00 │ 0.00        │
 └───┴────────────┴──────────────┴──────────┴──────────┴─────────────┘
 [SplitPaymentInput]   Remarks [      ]   ☑ Send receipt on WhatsApp
                                           [Save & Print]  [Save]
```

- Allocation modes and leftover-as-advance logic identical to Payment Out (previous plan §8.2).
- **Cheque** line → creates a `cheques` record (Section 13.3) with status *Pending*; the allocation is made immediately but flagged "cheque not cleared". If the cheque bounces, the receipt is voided automatically and the invoices reopen, with an optional bounce-charge entry.
- **Advance / deposit** (e.g. surgery deposit before admission) uses "Advance (on account)" and is adjusted on the final invoice.
- Receipt print: thermal or A5 with amount in words and mode breakdown.
- **Refund** (money going back to a customer from their advance): *Payment In → Refund* tab; creates `payment_lines` with direction OUT, reduces advance.

---

## 8. Sale Return / Credit Note

- Start from an invoice (Invoice → Sale Return) or standalone (select customer, then invoice).
- Shows invoice lines with *returnable qty* (sold − already returned). Services are non-returnable by default (Admin can override for billing corrections).
- Returned goods: choose **Back to stock** (same batch) or **Damaged / Expired** (write-off, no stock added, posted to loss).
- Settlement: **Adjust against invoice balance** · **Refund** (`SplitPaymentInput`, direction OUT) · **Keep as customer credit**.
- Number series `CN/2026-27/…`; GST reversed proportionally; reported in GSTR-1 as credit note.

---

## 9. Purchase, Payment Out, Expense

Build exactly as in `billing-accounts-implementation-plan.md` (§5–§10 there) and mount the same components here:

| Billing Desk menu | Component |
|-------------------|-----------|
| Purchase → Supplier Bills | Supplier Bills list + form (previous plan §7) |
| Purchase → Payment Out | Payment Out (previous plan §8) |
| Purchase → Supplier Ledger | Supplier Ledger (previous plan §9) |
| Expense | Expenses (previous plan §10) |

**Additions needed for Hitech parity:**

1. **Purchase Return / Debit Note** (`DN/2026-27/…`): select supplier bill → returnable qty per batch (purchased − returned − sold) → stock OUT → settle as *reduce bill balance* or *supplier refund received* (direction IN) or *keep as supplier credit*. Appears as a Debit in supplier ledger.
2. **Purchase Order (optional):** items + qty to order, sent to supplier on WhatsApp; "Convert to Bill" pre-fills the supplier bill form.
3. **Staff tab in Payment Out** if Section 15 is enabled (salary advance, salary payment).

---

## 10. Inventory

Extend the ERP's existing Inventory module (medicine / food / accessories catalogues); add only what's missing.

### 10.1 Item master fields (check and add)

Item code · Name · Generic / composition (medicines) · Category (Medicine, Vaccine, Food, Accessory, Lab consumable, Service) · Brand · HSN/SAC · GST % · Unit + **secondary unit with conversion** (e.g. 1 Strip = 10 Tab, sell by tab or strip) · Purchase rate · MRP · Sale rate · Price inclusive of GST (Y/N) · Min stock (reorder level) · Rack / shelf location · Barcode(s) · Track batch & expiry (Y/N) · Allow loose sale (Y/N) · Active.

### 10.2 Stock ledger (single source for all stock numbers)

Every movement writes one row: Purchase IN · Sale OUT · Sale Return IN · Purchase Return OUT · Adjustment IN/OUT · Opening stock · Clinical consumption OUT (items used during treatment but not billed, if the clinic tracks this). Current stock = sum of ledger, cached on the batch row and updated in the same transaction.

### 10.3 Screens

| Screen | Contents |
|--------|----------|
| Items | List with stock, MRP, value; filters by category, low stock, expiring; bulk edit rates/GST |
| Stock / Batches | Per item: batches with qty, expiry, purchase rate, MRP; movement history from stock ledger |
| Stock Adjustment | Reason (Damage, Expiry, Count correction, Clinical use, Opening), item, batch, qty ±, remarks; Admin approval for large values |
| Physical Stock Count | Enter counted qty per item/batch (scan barcodes) → system shows difference → post as adjustments in one click |
| Barcode Labels | Generate barcode for items without one (Code-128), print labels on A4 sheet (e.g. 65 per sheet) or thermal label printer, with name, MRP, batch, expiry |
| Alerts | Low stock, out of stock, expiring 30/60/90 days, expired in stock, non-moving |
| Reorder List | Items below min stock with last supplier and last rate → create Purchase Order |

---

## 11. Customer (Pet Owner) Management

One screen per owner that brings everything together (Hitech's "client management"):

- **Profile:** name, mobile (unique, primary search key), alternate mobile, email, address, GSTIN (optional), **credit limit**, opening balance (Dr/Cr, as-on date), tags (e.g. Breeder, Kennel, Staff), notes.
- **Pets tab:** from existing ERP pet records (read-only here, link to clinical profile).
- **Ledger tab:** Invoices (Dr), receipts / credit notes (Cr), running balance, `DateRangeFilter`, print/PDF/WhatsApp **statement of account**.
- **Invoices, Quotations, Receipts, Cheques, Reminders** tabs.
- **Actions:** New Invoice · Payment In · Add Reminder · Send statement · **Balance adjustment** (Admin: write-off small balances or correct opening balance, with reason, posted to a Discount/Write-off account).
- **Customer list:** search, filters (with dues, over credit limit, inactive > N months), columns: Name · Mobile · Pets · Outstanding · Last visit · Last payment. Export.
- Quick-add modal (from dashboard or invoice): mobile + name mandatory, rest optional; duplicate-mobile check.

---

## 12. Reminders

| Type | Created by | Example |
|------|-----------|---------|
| Payment due | Manual or auto (invoice unpaid after N days) | "₹1,200 pending from 28/08/2026" |
| Cheque | Auto from cheque records | "Deposit cheque #445566 on 05/09/2026" |
| Custom | Manual | "Call supplier about vaccine delivery" |
| Clinical follow-ups | Existing ERP (vaccine, deworming, treatment follow-up) | Shown here read-only via filter; not duplicated |

- Fields: date (+ optional time), type, customer/supplier (optional), message, channel (WhatsApp / SMS / In-app only), repeat (none / monthly), status (Pending / Done / Snoozed).
- Dashboard alert strip shows today's and overdue reminders; bell icon count in header.
- Bulk "Send payment reminders" to all customers with dues older than N days (WhatsApp message template with amount and UPI link).

---

## 13. Accounts

All read from `payment_lines` (money in/out by mode and account) plus documents.

### 13.1 Cash Book and Bank Book

Per account (Cash in Hand / each bank), `DateRangeFilter`: opening balance, every IN/OUT with document link, running balance, closing. Day-wise subtotals.

### 13.2 Day Book

Every document of a date range in time order: invoices, receipts, credit notes, supplier bills, payments, expenses, adjustments. Auditor-friendly.

### 13.3 Cheques (Hitech "cheque alerts")

| Field | Values |
|-------|--------|
| Direction | Received (from customer) / Issued (to supplier) |
| Cheque no., bank, date, amount, party | |
| Status | Pending → Deposited → Cleared / Bounced / Cancelled |

Alerts on cheque date. Clearing moves the amount into bank book on the clearing date; bouncing voids the linked receipt/payment and reopens bills.

### 13.4 Contra entries

Cash deposited to bank, cash withdrawn from bank, transfer between banks. Two `payment_lines` (OUT from one account, IN to other), no P&L effect.

### 13.5 Day-end close (optional but recommended)

At closing, operator enters counted cash; system records expected vs actual and the difference; the day is locked for non-Admin edits.

---

## 14. Reports

All with `DateRangeFilter`, on-screen table, Excel + PDF export, print.

| Group | Reports |
|-------|---------|
| Sales | Sales register (invoice-wise), item-wise sales, category-wise, doctor-wise, customer-wise, hourly/day-wise sales, payment-mode-wise collection, sale returns, quotation conversion |
| Profit | Item-wise gross profit (sale − purchase cost of batch), invoice-wise profit, category margin |
| Purchase | Purchase register, supplier-wise, item-wise purchase, purchase returns |
| Outstanding | Customer receivables with ageing (0–30, 31–60, 61–90, 90+), supplier payables with ageing, over-credit-limit customers |
| Stock | Current stock (qty, value at cost and MRP), batch-wise stock, expiry report, low stock, non-moving, fast-moving, stock movement (item ledger), adjustment report |
| GST | GSTR-1 (B2B, B2C large, B2C small, credit notes, HSN summary, document summary), GSTR-3B summary, purchase ITC register, HSN-wise sales; export in GST-portal-compatible Excel/JSON |
| Accounts | Cash book, bank book, day book, expense report, P&L summary, daily summary, cheque register |
| Staff (if enabled) | Attendance, salary sheet, commission |

---

## 15. Staff (optional, Phase 8)

Only if the clinic wants payroll here (Hitech offers it; many clinics just use the Salary expense category).

- Staff master: name, role, mobile, joining date, monthly salary, commission rule (e.g. % on services/sales by doctor), active.
- Attendance: manual daily marking (Present / Absent / Half-day / Leave). Biometric device import only if a device exists (CSV import of punches).
- Salary sheet per month: `salary × paid days / days in month + commission − advances`; editable before finalising.
- Salary payment and advances through Payment Out → Staff tab (`SplitPaymentInput`), posted to Salary expense.

---

## 16. Tools

| Tool | Detail |
|------|--------|
| Backup | Rely on the hosted database's automatic backups **and** a scheduled nightly export (JSON/CSV zip) to a second location (e.g. clinic's Google Drive or email). Manual "Download full backup" for Admin |
| Import / Export | Excel templates for customers, items + opening stock, suppliers, opening balances. Validation preview before import. Used for Hitech migration (Section 25) |
| Barcode labels | Section 10.3 |
| Recycle bin | List of voided documents with reason, who, when; view only (void is not reversible, re-create instead) |
| Audit log | Every create/edit/void with old/new values, filter by user, document, date |
| Recalculate | Admin utility to rebuild cached stock and balances from ledgers (safety net) |

---

## 17. Master

| Master | Notes |
|--------|-------|
| Item categories & brands | Used for filters and category-wise reports |
| Units & conversions | Tab, Strip, Bottle, ml, Pack, Nos, Kg |
| Tax rates | 0, 5, 12, 18, 28 (+ exempt, nil-rated flags) |
| HSN / SAC codes | With default GST rate |
| Services | Consultation, procedures, grooming, boarding, with price and SAC |
| Payment modes & accounts | From previous plan §4.2 |
| Expense categories | From previous plan §4.1 |
| Document series | Per type: prefix, FY in number, next number, padding. E.g. `INV/2026-27/000123`. Multiple invoice series allowed (e.g. Clinic, Pet Shop counter) |
| Terms & conditions | Per document type, printed on invoice/quotation |
| Message templates | WhatsApp/SMS text for invoice, receipt, payment reminder, statement |

---

## 18. Settings

| Section | Settings |
|---------|----------|
| Clinic profile | Name, logo, address, state, phone, email, GSTIN, PAN, drug licence no., bank details + UPI ID (printed as QR on invoice) |
| GST | Registration type (Regular / Composition / Unregistered), default intra-state, price inclusive by default |
| Billing behaviour | Allow negative stock · allow rate edit · allow back-dating (N days) · lock invoices after N days · credit limit enforcement (warn / block) · rounding (nearest ₹1 / none) · default customer (Walk-in) · default payment mode |
| Printing | Default template and size per document (A4 / A5 / Thermal 58 mm / 80 mm / 4"), copies, show MRP & savings, show pet name, show batch/expiry, show HSN, footer text, print preview on/off |
| Messaging | WhatsApp mode (click-to-chat link or Business API), SMS gateway + DLT template IDs, email SMTP |
| Users & roles | Section 24 |
| Dashboard | Default period, auto-refresh, figure masking default |

---

## 19. Online Store (deferred)

Hitech's Online Store is a product catalogue for online orders. For a clinic this would mean pet food/accessory ordering for clients. Recommended only after the core module is live; it needs a public site, order management, delivery and online payment gateway. Not included in phases below.

---

## 20. Data Model

PostgreSQL syntax; adapt to your ORM. Tables from the previous plan (`expense_categories`, `payment_accounts`, `purchase_bills`, `purchase_bill_items`, `supplier_payments`, `payment_allocations`, `expenses`, `payment_lines`) are reused. **Check existing tables first** (owners, pets, inventory items, invoices, billables) and add columns instead of creating duplicates.

### 20.1 Changes to existing / previous-plan tables

```sql
-- payment_lines becomes the single money in/out table
ALTER TABLE payment_lines ADD COLUMN direction VARCHAR(3) NOT NULL DEFAULT 'OUT'; -- IN | OUT
-- source_type now also: CUSTOMER_RECEIPT | CUSTOMER_REFUND | SUPPLIER_REFUND | CONTRA | SALARY

-- owners (customers)
ALTER TABLE owners ADD COLUMN credit_limit          NUMERIC(12,2);
ALTER TABLE owners ADD COLUMN opening_balance       NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE owners ADD COLUMN opening_balance_type  VARCHAR(2) DEFAULT 'DR';  -- DR = owner owes clinic
ALTER TABLE owners ADD COLUMN opening_as_on         DATE;
ALTER TABLE owners ADD COLUMN gstin                 VARCHAR(15);
CREATE UNIQUE INDEX uq_owner_mobile ON owners (mobile) WHERE is_active;

-- pending billables from consultation (existing table, whatever its name)
ALTER TABLE consultation_billables ADD COLUMN billed_invoice_id INT REFERENCES sales_invoices(id);
```

### 20.2 New tables

```sql
CREATE TABLE document_series (
  id          SERIAL PRIMARY KEY,
  doc_type    VARCHAR(20) NOT NULL,   -- INVOICE | QUOTATION | RECEIPT | CREDIT_NOTE | DEBIT_NOTE | PURCHASE | PAYMENT_OUT | EXPENSE
  name        VARCHAR(40) NOT NULL,   -- 'Clinic', 'Pet Shop'
  prefix      VARCHAR(10) NOT NULL,   -- 'INV'
  fy          VARCHAR(7)  NOT NULL,   -- '2026-27'
  next_no     INT         NOT NULL DEFAULT 1,
  padding     INT         NOT NULL DEFAULT 6,
  is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
  UNIQUE (doc_type, name, fy)
);  -- increment with SELECT … FOR UPDATE inside the save transaction

CREATE TABLE sales_invoices (            -- or extend the existing invoice table
  id               SERIAL PRIMARY KEY,
  invoice_no       VARCHAR(30) NOT NULL UNIQUE,
  series_id        INT REFERENCES document_series(id),
  invoice_date     DATE NOT NULL,
  owner_id         INT NOT NULL REFERENCES owners(id),   -- Walk-in is a fixed owner row
  pet_id           INT REFERENCES pets(id),
  doctor_id        INT REFERENCES staff(id),
  source           VARCHAR(12) NOT NULL,                 -- COUNTER | CONSULTATION | QUOTATION
  consultation_id  INT,
  quotation_id     INT,
  doc_kind         VARCHAR(15) NOT NULL,                 -- TAX_INVOICE | BILL_OF_SUPPLY
  tax_type         VARCHAR(5)  NOT NULL,                 -- INTRA | INTER
  subtotal         NUMERIC(12,2) NOT NULL,
  line_discount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  bill_discount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable_total    NUMERIC(12,2) NOT NULL,
  cgst_total NUMERIC(12,2) DEFAULT 0, sgst_total NUMERIC(12,2) DEFAULT 0, igst_total NUMERIC(12,2) DEFAULT 0,
  round_off        NUMERIC(6,2)  NOT NULL DEFAULT 0,
  grand_total      NUMERIC(12,2) NOT NULL,
  amount_received  NUMERIC(12,2) NOT NULL DEFAULT 0,     -- from receipt_allocations
  returned_total   NUMERIC(12,2) NOT NULL DEFAULT 0,     -- from credit notes
  status           VARCHAR(10) NOT NULL DEFAULT 'UNPAID',-- UNPAID | PARTIAL | PAID | VOID
  notes TEXT, void_reason TEXT,
  created_by INT, created_at TIMESTAMPTZ DEFAULT now(), updated_by INT, updated_at TIMESTAMPTZ
);

CREATE TABLE sales_invoice_items (
  id             SERIAL PRIMARY KEY,
  invoice_id     INT NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  line_no        INT NOT NULL,
  line_type      VARCHAR(12) NOT NULL,   -- SERVICE | MEDICINE | VACCINE | FOOD | ACCESSORY | LAB | OTHER
  item_id        INT REFERENCES inventory_items(id),
  service_id     INT REFERENCES services(id),
  billable_id    INT,                    -- consultation billable this line came from
  pet_id         INT REFERENCES pets(id),
  description    VARCHAR(200) NOT NULL,
  hsn_sac        VARCHAR(10),
  batch_id       INT REFERENCES item_batches(id),
  qty            NUMERIC(10,3) NOT NULL,
  unit           VARCHAR(15),
  rate           NUMERIC(12,2) NOT NULL,
  mrp            NUMERIC(12,2),
  cost_rate      NUMERIC(12,2),          -- batch purchase rate at time of sale (profit reports)
  discount_amt   NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_pct        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  taxable_amount NUMERIC(12,2) NOT NULL,
  tax_amount     NUMERIC(12,2) NOT NULL,
  line_total     NUMERIC(12,2) NOT NULL,
  returned_qty   NUMERIC(10,3) NOT NULL DEFAULT 0
);

CREATE TABLE held_bills (
  id SERIAL PRIMARY KEY, label VARCHAR(80), owner_id INT, draft JSONB NOT NULL,
  created_by INT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quotations      (/* same header shape as sales_invoices minus payment fields */
  id SERIAL PRIMARY KEY, quotation_no VARCHAR(30) UNIQUE NOT NULL, quotation_date DATE NOT NULL,
  valid_till DATE, owner_id INT NOT NULL, pet_id INT, doctor_id INT, grand_total NUMERIC(12,2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'OPEN', converted_invoice_id INT, terms TEXT,
  created_by INT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE quotation_items (/* same columns as sales_invoice_items without batch/cost/returned */);

CREATE TABLE customer_receipts (
  id SERIAL PRIMARY KEY, receipt_no VARCHAR(30) UNIQUE NOT NULL, owner_id INT NOT NULL,
  receipt_date DATE NOT NULL, total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  source VARCHAR(12) NOT NULL,             -- INVOICE | PAYMENT_IN
  remarks TEXT, status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE', void_reason TEXT,
  created_by INT, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE receipt_allocations (
  id SERIAL PRIMARY KEY, receipt_id INT NOT NULL REFERENCES customer_receipts(id),
  invoice_id INT NOT NULL REFERENCES sales_invoices(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0), allocated_on DATE NOT NULL);

CREATE TABLE credit_notes (      -- sale returns
  id SERIAL PRIMARY KEY, cn_no VARCHAR(30) UNIQUE NOT NULL, cn_date DATE NOT NULL,
  owner_id INT NOT NULL, invoice_id INT REFERENCES sales_invoices(id),
  settlement VARCHAR(12) NOT NULL,        -- ADJUST | REFUND | CREDIT
  taxable_total NUMERIC(12,2), tax_total NUMERIC(12,2), grand_total NUMERIC(12,2) NOT NULL,
  reason TEXT, status VARCHAR(10) DEFAULT 'ACTIVE', created_by INT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE credit_note_items (
  id SERIAL PRIMARY KEY, cn_id INT REFERENCES credit_notes(id), invoice_item_id INT,
  item_id INT, batch_id INT, qty NUMERIC(10,3), rate NUMERIC(12,2), gst_pct NUMERIC(5,2),
  line_total NUMERIC(12,2), restock BOOLEAN NOT NULL DEFAULT TRUE);

CREATE TABLE debit_notes (/* purchase returns: mirror of credit_notes against purchase_bills */);
CREATE TABLE debit_note_items (/* mirror of credit_note_items */);

CREATE TABLE item_batches (      -- skip if inventory already has batches
  id SERIAL PRIMARY KEY, item_id INT NOT NULL REFERENCES inventory_items(id),
  batch_no VARCHAR(40), expiry_date DATE, purchase_rate NUMERIC(12,2), mrp NUMERIC(12,2),
  qty_on_hand NUMERIC(12,3) NOT NULL DEFAULT 0,   -- cache of stock_ledger sum
  UNIQUE (item_id, batch_no));

CREATE TABLE stock_ledger (
  id SERIAL PRIMARY KEY, txn_date DATE NOT NULL, item_id INT NOT NULL, batch_id INT,
  qty_in NUMERIC(12,3) NOT NULL DEFAULT 0, qty_out NUMERIC(12,3) NOT NULL DEFAULT 0,
  rate NUMERIC(12,2),
  source_type VARCHAR(20) NOT NULL,  -- OPENING | PURCHASE | SALE | SALE_RETURN | PURCHASE_RETURN | ADJUSTMENT | CLINICAL_USE
  source_id INT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX ix_stock_ledger_item ON stock_ledger (item_id, txn_date);

CREATE TABLE stock_adjustments (
  id SERIAL PRIMARY KEY, adj_date DATE NOT NULL, reason VARCHAR(20) NOT NULL,
  remarks TEXT, approved_by INT, created_by INT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE stock_adjustment_items (
  id SERIAL PRIMARY KEY, adjustment_id INT REFERENCES stock_adjustments(id),
  item_id INT NOT NULL, batch_id INT, qty_change NUMERIC(12,3) NOT NULL, rate NUMERIC(12,2));

CREATE TABLE cheques (
  id SERIAL PRIMARY KEY, direction VARCHAR(8) NOT NULL,  -- RECEIVED | ISSUED
  party_type VARCHAR(10), party_id INT, cheque_no VARCHAR(20) NOT NULL, bank_name VARCHAR(60),
  cheque_date DATE NOT NULL, amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',       -- PENDING | DEPOSITED | CLEARED | BOUNCED | CANCELLED
  cleared_on DATE, payment_line_id INT REFERENCES payment_lines(id), remarks TEXT);

CREATE TABLE reminders (
  id SERIAL PRIMARY KEY, remind_on DATE NOT NULL, remind_time TIME, type VARCHAR(12) NOT NULL,
  party_type VARCHAR(10), party_id INT, message TEXT NOT NULL, channel VARCHAR(10) DEFAULT 'IN_APP',
  repeat_rule VARCHAR(10) DEFAULT 'NONE', status VARCHAR(10) DEFAULT 'PENDING',
  source_type VARCHAR(20), source_id INT, created_by INT, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE day_end_closings (
  id SERIAL PRIMARY KEY, close_date DATE UNIQUE NOT NULL, expected_cash NUMERIC(12,2),
  counted_cash NUMERIC(12,2), difference NUMERIC(12,2), remarks TEXT,
  closed_by INT, closed_at TIMESTAMPTZ DEFAULT now());
```

### 20.3 Derived values

- Invoice `amount_received` = active allocations; balance = `grand_total − returned_total (adjusted) − amount_received`; status from balance.
- Customer outstanding = opening (Dr) + invoices − receipts − credit notes; advance = unallocated receipts + credit-note credits.
- Stock on hand = `SUM(qty_in − qty_out)` from `stock_ledger`; `item_batches.qty_on_hand` is a cache updated in the same transaction (Tools → Recalculate rebuilds it).

---

## 21. API Endpoints (new; previous-plan endpoints reused)

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/billing/dashboard?from&to` | 4 KPIs + comparison + alert counts |
| GET | `/api/billing/insights?chart=&from&to` | Chart data |
| GET | `/api/billing/daily-summary?date` | Section 4.5 |
| GET | `/api/billing/stock-summary` | Section 4.6 |
| GET | `/api/items/search?q=&barcode=` | Fast type-ahead, returns stock + FEFO batch |
| GET | `/api/owners/search?q=` | Mobile / name / pet name |
| GET | `/api/owners/:id/billing-summary` | Balance, credit limit, advance, pending billables count |
| GET | `/api/owners/:id/pending-billables` | Consultation items not yet invoiced |
| GET | `/api/owners/:id/ledger?from&to` | Statement |
| GET/POST | `/api/sales-invoices?from&to&status&owner&doctor&source&q` | POST accepts `items[]`, `payment{lines[], adjustAdvance}`, `billableIds[]`, idempotency key |
| GET/PUT | `/api/sales-invoices/:id` | Edit rules §5.9 |
| POST | `/api/sales-invoices/:id/void` | |
| GET | `/api/sales-invoices/:id/pdf?size=A4\|A5\|T58\|T80` | Print/share |
| GET/POST/DELETE | `/api/held-bills` | |
| GET/POST/PUT | `/api/quotations`, POST `/api/quotations/:id/convert` | |
| GET/POST | `/api/customer-receipts`, POST `/:id/void`, POST `/refunds` | |
| GET/POST | `/api/credit-notes`, `/api/debit-notes` | |
| GET/POST | `/api/stock-adjustments`, `/api/stock-counts` | |
| GET | `/api/items/:id/stock-ledger?from&to` | |
| POST | `/api/barcodes/generate`, GET `/api/barcodes/labels.pdf` | |
| GET/POST/PUT | `/api/cheques`, POST `/:id/status` | |
| GET/POST/PUT | `/api/reminders`, POST `/bulk-payment-reminders` | |
| GET | `/api/accounts/cash-book`, `/bank-book`, `/day-book` | |
| POST | `/api/accounts/contra`, `/api/accounts/day-end-close` | |
| GET | `/api/reports/:reportKey?from&to&…&format=json\|xlsx\|pdf` | One endpoint pattern for all reports |
| GET | `/api/reports/gstr1?from&to&format=json\|xlsx` | |
| POST | `/api/tools/import/:entity` (validate), POST `/commit` | |
| GET | `/api/tools/backup` | Admin |

Server always recomputes totals, taxes and stock from the items; client values are only for display.

---

## 22. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| F2 | New Invoice (anywhere in module) |
| F3 / `/` | Focus item search / barcode field |
| F4 | Focus customer search |
| F6 | Open pending consultation billables |
| F7 | Payment section |
| F8 | Hold bill |
| F9 | Save |
| F10 | Save & Print |
| Ctrl+D | Bill discount |
| Del | Remove selected line |
| ↑ / ↓ | Move between lines; + / − change qty |
| Enter | Next cell / add item |
| Esc | Close modal / cancel (with unsaved-changes confirm) |
| Alt+Q/P/E/C/R/I/O | Quick actions (Section 4.3) |

Show a `?` shortcut sheet overlay. Don't override browser-reserved keys (F5 refresh, Ctrl+P etc.); call `preventDefault` only for the keys above and only inside the module.

---

## 23. Printing and Sharing

1. **Templates as HTML + print CSS**, one React component per layout: `A4`, `A5`, `Thermal58`, `Thermal80`, `Thermal4in`. Use `@page { size: 80mm auto; margin: 0 }` for thermal and `@page { size: A5 }` etc. Fonts sized in `pt`/`mm`, not `px`.
2. **Print flow:** Save & Print opens a hidden iframe with the template and calls `print()`. Set the thermal printer as default in the counter PC's browser, with margins "None" and headers/footers off (document this in the setup guide).
3. **Silent / faster printing (optional):** a local print agent (e.g. QZ Tray) sending ESC/POS to the thermal printer, only if browser printing is too slow at the counter.
4. **PDF:** server-side generation (headless Chromium or a PDF library) for WhatsApp/email sharing and archival.
5. **Invoice contents:** clinic header + GSTIN + drug licence no., document title (Tax Invoice / Bill of Supply), number, date, customer + mobile, pet name, doctor, lines (HSN, batch, expiry, qty, MRP, rate, disc, GST%, amount), tax summary by rate, totals, amount in words, paid by (mode split), balance due, previous balance (optional), UPI QR for the balance, terms, signature.
6. **WhatsApp (phase 1, free):** `https://wa.me/91XXXXXXXXXX?text=…` with a short message and a secure, expiring link to the PDF. **Phase 2:** WhatsApp Business API or SMS gateway for automatic sends. SMS in India needs DLT registration of sender ID and templates, so plan lead time for that.

---

## 24. Roles, Security, Performance

### 24.1 Roles

| Permission | Admin (Doctor) | Accountant | Reception / Counter |
|------------|:-:|:-:|:-:|
| Create invoice, quotation, receipt | ✓ | ✓ | ✓ |
| Edit own invoice same day | ✓ | ✓ | ✓ |
| Edit older / others' invoices | ✓ | ✓ | ✗ |
| Void, balance adjustment, write-off | ✓ | ✗ | ✗ |
| Rate edit below MRP / discount above X% | ✓ | ✓ | setting |
| Purchase, Payment Out, Expense | ✓ | ✓ | setting |
| Stock adjustment | ✓ | ✓ (approval above limit) | ✗ |
| Dashboard figures, profit reports | ✓ | ✓ | ✗ (or masked) |
| Master, Settings, Tools | ✓ | partial | ✗ |

Enforce on the server, not just by hiding menus.

### 24.2 Concurrency and integrity

- Invoice number: `SELECT … FOR UPDATE` on the `document_series` row inside the save transaction (no gaps from failed saves, no duplicates from two counters).
- Stock: lock batch rows `FOR UPDATE` before decrementing; re-check availability inside the transaction.
- Idempotency key on every POST from a form (prevents double invoice on double click / retry).
- All saves in one transaction; after commit only side effects (print, WhatsApp).

### 24.3 Performance targets

- Item and owner search < 200 ms: trigram index (`pg_trgm`) on names, exact index on mobile and barcode.
- Invoice save < 1 s; dashboard load < 1.5 s (aggregate queries on indexed date columns; cache for 60 s).
- Reports: paginate on screen; generate Excel/PDF server-side for large ranges.

---

## 25. Migration from Hitech and Go-Live

1. **Check what Hitech can export** (customer list, item list with stock, outstanding/party balances, supplier balances) from its Reports/Tools menus to Excel. Confirm this on the clinic PC before building the importers.
2. **Pick a cut-over date** (e.g. 01/10/2026, start of a month).
3. **Import into the ERP** via Tools → Import with validation preview:
   - Customers (match to existing ERP owners by mobile, merge; create if not found)
   - Items (match to existing inventory by name/code) + **opening stock per batch** with expiry
   - Customer opening balances and supplier opening balances as on the cut-over date
   - Unpaid invoices are brought in as opening balance (not recreated as invoices) unless bill-wise detail is essential
4. **Parallel run for 3–7 days:** bill in the ERP, keep Hitech read-only for reference; compare daily summary and cash tally each evening.
5. **Stop entries in Hitech**; keep it installed read-only for old invoice reprints and historical reports.
6. **Training:** one short session per role; printed shortcut card at the counter.

---

## 26. Implementation Phases

| Phase | Deliverable | Done when |
|-------|-------------|-----------|
| **1. Shell + masters + settings** | Module route and sidebar, dashboard skeleton with 4 KPIs + quick-action tiles (linking to existing screens where available), `DateRangeFilter`, document series, clinic profile, GST settings, units/tax/HSN/services masters, roles | Dashboard shows real Gross Sale / invoice count from existing invoice data |
| **2. Sales core** | New Invoice (counter + consultation billables), FEFO batches, stock ledger OUT, split payment at billing, hold bills, invoice list, A4/A5/thermal print, owner quick-add, edit/void rules | Counter sale and consultation bill both save, print on thermal, reduce stock, and billables can't be billed twice |
| **3. Receivables** | Payment In with allocations and advances, customer ledger & statement, credit limit, refunds, cheques (received), reminders (manual + payment-due) | Partial payment → ledger correct; cheque bounce reopens invoice |
| **4. Purchase & expenses** | Mount previous-plan Supplier Bills, Payment Out, Expenses, Supplier Ledger; add Purchase Return / Debit Note | Amount Paid KPI matches cash + bank outflows |
| **5. Inventory extensions** | Item master additions, unit conversions, stock adjustment, physical count, barcode generate/print/scan, alerts, reorder list, purchase order | Scan-to-bill works; expiry and low-stock alerts appear |
| **6. Returns, quotations, insights, reports** | Sale Return / Credit Note, Quotations + convert, Business Insights charts, Daily Summary, Stock Summary, all reports incl. GSTR-1 / 3B, cash/bank/day book, contra, day-end close | Daily Summary cash matches counted cash for a test day; GSTR-1 export opens in the GST offline tool format |
| **7. Tools, messaging, migration** | Import/export, scheduled backup, audit log viewer, recycle bin, recalculate, WhatsApp click-to-chat + PDF links, Hitech data import, parallel run | Clinic runs a full week on the ERP without Hitech |
| **8. Optional** | Staff (attendance, salary, commission), WhatsApp API / SMS (DLT), silent thermal printing agent, offline PWA billing, Online Store | As agreed |

Phases 2 and 3 are the minimum for the counter to stop using Hitech for sales; Phase 4 for purchases/expenses.

---

## 27. Test Cases

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Walk-in buys food ₹2,450 (GST 18% inclusive), pays UPI | Paid invoice, taxable ₹2,076.27 + GST ₹373.73, stock −1, Amount Received +₹2,450 |
| 2 | Walk-in invoice with received < total | Blocked: walk-in must be fully paid |
| 3 | Consultation with 3 billables → invoice → open New Invoice again for same owner | Billables no longer pending; cannot be added twice |
| 4 | Item with batches B1 (exp 11/26, qty 2) and B2 (exp 04/27, qty 10); sell 5 | Two lines: 2 from B1, 3 from B2 |
| 5 | Two counters save invoices at the same second | Consecutive numbers, no duplicate, no gap |
| 6 | Sell qty more than stock, negative stock off | Blocked with available qty |
| 7 | Owner owes ₹4,000, limit ₹5,000, new bill ₹2,000 unpaid | Warning; Reception blocked, Admin can override |
| 8 | Payment In ₹5,000 "oldest first" on invoices ₹3,550 + ₹1,200 | Both paid, ₹250 advance |
| 9 | Cheque receipt then marked Bounced | Receipt voided, invoices reopen, reminder created |
| 10 | Return 1 of 2 strips from an invoice, refund cash | Credit note, stock +1 to same batch, cash book −, GST reversed |
| 11 | Quotation converted after MRP change | Invoice pre-filled, changed rate highlighted |
| 12 | Hold bill, create another invoice, resume held | Held draft restored, gets next number only on save |
| 13 | Print same invoice in A4, A5, 80 mm | All layouts fit, no cut-off columns on 80 mm |
| 14 | Dashboard "Today" with eye icon on | Figures masked; preference persists after reload |
| 15 | Daily Summary for a day with cash sales ₹10,000, cash expense ₹1,000, opening ₹2,000 | Expected closing cash ₹11,000 |
| 16 | GSTR-1 for a month with B2C and one B2B invoice + a credit note | Correct sections and HSN summary |
| 17 | Import Hitech customers where mobile already exists in ERP | Merged, not duplicated |
| 18 | Reception tries to void an invoice via API directly | HTTP 403 |

---

## 28. Open Questions (confirm with the doctor / clinic)

1. Is the clinic GST-registered (Regular / Composition / not registered)? Which GST rates does the CA apply to consultation, procedures, medicines, food, accessories?
2. Which printers are at the counter (thermal 2" or 3", A4/A5 laser)? One counter PC or several billing at once?
3. Are pet food and accessories sold as a separate "pet shop" (separate invoice series or separate GSTIN)?
4. Which Hitech data can be exported, and does the clinic want old invoices migrated or only balances?
5. Are Staff (attendance, salary, commission) and Online Store needed?
6. Should WhatsApp messages go automatically (paid API) or via click-to-send (free)?
7. Is offline billing needed (how often does the internet go down at the clinic)?
8. Who can give discounts, and up to what %?

---

## 29. Prompt for the Coding Agent (per phase)

> You are adding a dedicated **Billing Desk** module (route `/m/billing`) to our veterinary clinic ERP, modelled on the workflow of Hitech BillSoft. Read `billing-desk-module-implementation-plan.md` fully, and `billing-accounts-implementation-plan.md` for the reused Supplier Bills, Payment Out, Expenses, split payment and date range components. Implement **Phase N only** from Section 26. Rules: one source of truth (reuse existing owners, pets, inventory, invoice and consultation billable tables; add columns rather than duplicating tables; list any schema differences before changing them), DD/MM/YYYY display, ISO storage, Asia/Kolkata day boundaries, decimal money, one DB transaction per save, row locks for stock and document numbers, server-side permission checks, void instead of delete. Do not modify unrelated modules. After implementing, run the relevant test cases from Section 27 and report results and assumptions.
