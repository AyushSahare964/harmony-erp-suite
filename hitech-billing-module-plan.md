# Hitech-Style Billing & Accounting Module — Methodology and Implementation Plan

**Target system:** existing Veterinary ERP / Clinic Management System
**Reference system:** Hitech BillSoft v6.4.5.2 (screens supplied)
**Document status:** implementation blueprint — build against this, revise per sprint
**Date format rule (system-wide):** every user-facing date is `DD/MM/YYYY`. Storage is always ISO `YYYY-MM-DD` / UTC timestamps. Never render ISO to a user.

---

## 1. Objective and scope

### 1.1 Objective

Add a complete billing, purchase, supplier, expense and GST-return capability to the vet ERP so the clinic can retire Hitech BillSoft and run sales, purchases, party ledgers and statutory returns inside one system — with the clinical side (Rx, lab, inventory, appointments) feeding billing automatically instead of being re-keyed.

### 1.2 In scope

| # | Capability | Hitech screen it maps to |
|---|---|---|
| 1 | GST / Non-GST sale invoice, counter sale + client account | Unsaved Invoice |
| 2 | Quotation → invoice conversion | New Quotation |
| 3 | Purchase bill with supplier, P.O. no., shipping cost | Unsaved Purchase Bill |
| 4 | Supplier master with bank, tax, opening balance | New Supplier Information |
| 5 | Client master with credit limit, opening balance, KYC doc | Client Information |
| 6 | Categorised expenses with pay mode + reference | Add Expense |
| 7 | Payment In / Payment Out, bill-wise settlement | Amount Received / Client Amount Due tabs |
| 8 | Dashboard KPIs, sales chart, sale-vs-purchase distribution | Dashboard |
| 9 | Stock search by item / serial / invoice / client | Search panel |
| 10 | Reports + GSTR-1 / GSTR-3B / GSTR-2 data sets | Reports, GSTR Reports |
| 11 | Sales return (credit note), purchase return (debit note) | Sale / Purchase submenus |
| 12 | Reminders on dues and follow-ups | Add Reminder |

### 1.3 Out of scope (explicitly deferred)

- Full double-entry general ledger with trial balance / P&L / balance sheet. This plan implements **subsidiary ledgers** (party, stock, cash/bank) plus a posting table shaped so a full GL can be layered later without a data migration.
- e-Invoice (IRN/QR) and e-Way Bill API integration. Schema carries the fields; the API call is Phase 7.
- TDS/TCS, composition-scheme returns, multi-currency.
- Payroll (Staff module remains HR-only).

### 1.4 Vet-specific deviations from Hitech (deliberate)

Hitech is a generic trader product. Do not copy it literally. The differences that matter:

1. **Two sellable classes:** *goods* (medicine, food, accessories — carry HSN, batch, expiry, stock) and *services* (consultation, vaccination, surgery, lab test, grooming, boarding — carry SAC, no stock, zero-cost). One invoice mixes both.
2. **Patient dimension:** an invoice line may be linked to an `animal_id`, not just an owner. Billing history must be answerable per pet, not only per client.
3. **Batch + expiry is mandatory for drugs.** Hitech's "Serial No." tagging is a single-unit concept; replace it with batch allocation (FEFO) plus optional serial for equipment.
4. **Rx-driven billing.** Billable items are pushed from Doctor Rx & Diagnosis (Immediate / Prescribed / Injectable treatment, prescribed food, lab orders, consultation fee) into a draft invoice — idempotently, no duplicates.
5. **Schedule-H / H1 drug register** obligations: log of prescribed-drug sales with prescriber and owner, exportable.

---

## 2. Teardown of the reference system

Field-level inventory extracted from the supplied screens. This is the functional baseline; anything marked **(+)** is an addition we make.

### 2.1 Shell and navigation

Sidebar: `Sale | Purchase | Expense | Client | Staff | Reports | GSTR Reports | Master | Tools | Settings | Help`.
Header utilities: quick-entry, calculator, reminders/notifications, cash counter, backup, settings.
Footer status strip: online, sync, license, database, backup, e-mail, cloud, battery — i.e. **system health indicators**. Replicate as a small status bar (DB reachable, last backup, sync state, license/plan).

### 2.2 Dashboard

- **Quick Info card** with period toggle (`TODAY`, extended by us to Today / Yesterday / This Week / This Month / This FY / **Custom range**): Total Sale, Amount Received, Amount Due.
- **Six action tiles:** New Invoice, New Quotation, Add Purchase, Add Expense, Add Client, Add Reminder.
- **Recent Sales chart** — daily bar series, last 15 days, with an auto "1k = 1000" scaling note. Tabs: Recent Sales / Client Amount Due / Amount Received / Client Cash-Cheque Alert.
- **Distribution donut** — last 30 days, Sale vs Purchase (grows a slice as data appears; add Expense as a third slice).
- **Search panel** — one box, radio scope: Stock / Serial No / Invoice / Client.

### 2.3 Sale invoice screen

*Invoice information:* Invoice Type (GST / Non-GST / Bill of Supply / Export) `*`, Date `*`, Sold By (staff), Link To = **Counter Sale | Client Account** `*`, Mobile No., Client Name `*` (defaults `CASH`), Address, Place of Supply `*`, Client GSTIN.

*Particulars:* entry mode **Tagging | Item Code**, Serial No., Item Name `*` with inline "+" to create item, UoM, Quantity `*`, Sale Price `*` (with calculator helper), Discount (₹ | %), Amount, per-line Serial No., green "+" to push the line into the grid.
Grid columns: `S.No | Item Name | Tag | Quantity | UoM | Sale Price | Disc.(%) | Amount`.

*Footer:* Add Shipping and Packaging Costs (checkbox → amount), Invoice Reference (checkbox → ref doc), Delivery Terms, Remarks (private, not printed), Sub Total, **TOTAL AMOUNT**, reminder bell.

*Payment details:* Cash | Cheque | Card | Mobile Wallet | Demand Draft | Bank Transfer, Amount `*`.
Actions: **Save and Print**, **Save**. Title shows dirty state: "Unsaved Invoice".

**(+) Our additions:** tax breakup panel (taxable / CGST / SGST / IGST / cess / round-off), price-inclusive-of-tax toggle, invoice-level discount, **split payment** across modes in one bill, patient (animal) selector, batch picker per line, "Pull from Rx" button.

### 2.4 Purchase bill screen

Purchase Type `*`, Place of Supply `*`, Date, P.O. No., Supplier Name `*` (type-ahead; red warning icon while unmatched), Purchase Bill No.
Particulars: Tagging | Item Code, Serial No., Product Name `*`, UoM, Quantity `*`, Purchase Price `*`, Amount `*`.
Footer: Add Shipping and Packaging Costs, Remarks, Sub Total, Shipping (+), **TOTAL AMOUNT**, Save.

**(+)** Batch no., expiry date, MRP, free-quantity (trade scheme), item-wise GST rate, supplier-bill date vs entry date, duplicate-bill-number guard per supplier per FY.

### 2.5 Supplier master

Supplier Details: Company Name `*`, Address, City `*`, State `*`, Pin Code, Country (default India), Email, Phone No.
Bank Details: Bank Name, Bank A/c No., IFSC Code.
Tax Details: PAN No., GSTIN, State `*`. Link: **Check GSTIN/UIN Status**.
Account Details: Opening Balance, Type = Debit | Credit.
Contact Details: Contact Person, Mobile No. `*`. Other: Remark / Note.
Account Status badge: `UNSAVED`.

### 2.6 Client master

Profile Pic (upload / camera / reset / remove). Client Details: Full Name `*`, Billing Address `*`, City, State `*`, PIN, Country, Email ID, Phone No, Mobile No `*`.
Tax Details: PAN No., GSTIN. Identity Details: Document Type, Document No.
Account Details: Type Debit | Credit, Opening Balance.
Anniversary: Date of Birth (Applicable checkbox + date), Anniversary (same).
Other Details: Credit Allowed Yes | No, Credit Limit, Remark / Note.

**(+)** Link to existing owner record (do **not** create a second customer table), linked animals list, preferred communication channel, GST treatment (registered / unregistered / composition).

### 2.7 Expense screen

Date `*`, Expense Type `*`, Amount `*`, Paid To `*`, Remarks, Pay Mode `*`, Payment Ref. No. (enabled only for non-cash), Paid By `*`.
**(+)** Expense category tree (hard-coded list replaced by a master), **split pay mode** (e.g. ₹600 UPI + ₹400 cash on one expense), attachment upload, GST-input flag + supplier GSTIN for ITC-eligible expenses, recurring expense template.

---

## 3. Gap analysis against the current vet ERP

| Area | Exists today | Gap to close |
|---|---|---|
| Owner/client master | Yes (Reception) | Add billing fields: GSTIN, PAN, credit allowed/limit, opening balance, billing address |
| Item/inventory catalogue | Yes (medicine / food / accessories) | Add HSN/SAC, tax rate, UoM conversion, batch-expiry-MRP, reorder level |
| Service catalogue | Partially (fees) | Formal service master with SAC + price list |
| Sale invoice | Billing & Settlement exists | Rebuild as full GST document with tax engine, numbering series, print template |
| Quotation | No | New |
| Purchase | No / manual | New: supplier master, purchase bill, purchase return, landed cost |
| Party ledger | No | New: client ledger + supplier ledger with bill-wise allocation |
| Payments | Settlement only | New: Payment In / Out, split modes, on-account advances |
| Expenses | No / basic | New: categorised expenses, split modes, attachments |
| GST returns | No | New: GSTR-1, 3B summary, 2A/2B reconciliation dataset |
| Dashboard finance KPIs | Partial | New KPI service + charts with custom range |
| Audit trail | Unknown | Mandatory for all financial documents |

---

## 4. Target architecture

### 4.1 Module decomposition

```
finance/
├── masters/        parties (client, supplier), items, services, tax (HSN/SAC),
│                   UoM, expense categories, payment modes, numbering series
├── sales/          quotation, invoice, sales return (credit note), counter sale
├── purchases/      purchase bill, purchase return (debit note), landed cost
├── payments/       payment in, payment out, allocation, split tenders, day-book
├── expenses/       expense entry, categories, recurring templates
├── tax/            tax engine (place-of-supply resolver, rate resolver,
│                   inclusive/exclusive, round-off), GSTR builders
├── ledger/         party ledger, stock ledger, cash/bank ledger, posting rules
├── reports/        sales/purchase registers, outstanding, stock, profitability
└── integration/    rx-to-bill bridge, lab-order bridge, inventory bridge
```

### 4.2 Layering rules

1. **The tax engine is pure.** It takes a plain "document intent" object and returns computed lines + tax summary. No DB access, no framework types. This is what makes it testable against the ~40-case matrix in §10.
2. **Documents are immutable once posted.** No `UPDATE` on a posted invoice's financial fields. Corrections happen via credit/debit note or an explicit cancel-and-reissue that writes a reversal and links `revised_from_id`.
3. **Every financial write goes through a single transaction boundary** that: allocates the document number, writes the header + lines, writes stock moves, writes ledger entries, and commits together. Partial success is not allowed.
4. **Read models for dashboards are separate.** Daily aggregates are materialised (see §8.3); dashboards must never scan raw invoice lines.

### 4.3 Assumed stack

Written stack-agnostically. The DDL is ANSI-ish and runs on PostgreSQL or MySQL 8 with trivial edits; the API is REST/JSON. If the ERP is Django/Node/.NET, map the entities directly — nothing here depends on a specific ORM. Money is stored as `DECIMAL(14,2)`, quantities `DECIMAL(14,3)`, rates/percentages `DECIMAL(6,3)`. **Never use float for money.**

---

## 5. Data model

### 5.1 Masters

```sql
-- Organisation / branch (clinic). Supports multi-branch numbering later.
CREATE TABLE org_branch (
  id              BIGINT PRIMARY KEY,
  name            VARCHAR(160) NOT NULL,
  gstin           VARCHAR(15),
  state_code      CHAR(2)  NOT NULL,          -- 27 = Maharashtra; drives intra vs inter
  address         TEXT, city VARCHAR(80), pin VARCHAR(10),
  phone VARCHAR(20), email VARCHAR(120),
  invoice_footer  TEXT,
  is_composition  BOOLEAN DEFAULT FALSE
);

-- Unified party: a client (pet owner) and a supplier are both parties.
CREATE TABLE party (
  id              BIGINT PRIMARY KEY,
  party_type      VARCHAR(10) NOT NULL,        -- CLIENT | SUPPLIER | BOTH
  owner_id        BIGINT NULL REFERENCES owner(id),   -- link to existing vet owner record
  display_name    VARCHAR(160) NOT NULL,
  legal_name      VARCHAR(160),
  contact_person  VARCHAR(120),
  mobile          VARCHAR(20) NOT NULL,
  phone           VARCHAR(20), email VARCHAR(120),
  billing_address TEXT, city VARCHAR(80),
  state_code      CHAR(2) NOT NULL, pin VARCHAR(10),
  country         VARCHAR(60) DEFAULT 'India',
  gstin           VARCHAR(15), pan VARCHAR(10),
  gst_treatment   VARCHAR(20) DEFAULT 'UNREGISTERED', -- REGULAR|COMPOSITION|UNREGISTERED|SEZ|EXPORT
  doc_type        VARCHAR(30), doc_number VARCHAR(40), -- KYC (Aadhaar/DL/etc.)
  opening_balance DECIMAL(14,2) DEFAULT 0,
  opening_type    CHAR(2) DEFAULT 'DR',        -- DR | CR
  opening_date    DATE,
  credit_allowed  BOOLEAN DEFAULT FALSE,
  credit_limit    DECIMAL(14,2) DEFAULT 0,
  credit_days     INT DEFAULT 0,
  date_of_birth   DATE, anniversary DATE,
  bank_name VARCHAR(120), bank_account VARCHAR(40), bank_ifsc VARCHAR(15),
  photo_path      VARCHAR(255),
  remark          TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP, created_by BIGINT,
  UNIQUE (party_type, mobile, display_name)
);
CREATE INDEX ix_party_name  ON party (display_name);
CREATE INDEX ix_party_gstin ON party (gstin);

-- Tax master keyed by HSN (goods) or SAC (services)
CREATE TABLE tax_code (
  id          BIGINT PRIMARY KEY,
  code        VARCHAR(10) NOT NULL UNIQUE,     -- HSN 30049099 / SAC 998351
  kind        VARCHAR(4) NOT NULL,             -- HSN | SAC
  description VARCHAR(255),
  gst_rate    DECIMAL(6,3) NOT NULL,           -- total %, split 50/50 for intra
  cess_rate   DECIMAL(6,3) DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to   DATE NULL                     -- rate history, never overwrite
);

CREATE TABLE uom (
  id BIGINT PRIMARY KEY, code VARCHAR(12) UNIQUE,     -- PCS, STRIP, ML, KG, VIAL
  name VARCHAR(40), decimals INT DEFAULT 0
);
CREATE TABLE uom_conversion (                          -- STRIP -> 10 TAB
  id BIGINT PRIMARY KEY, item_id BIGINT, from_uom BIGINT, to_uom BIGINT,
  factor DECIMAL(14,4) NOT NULL
);

-- Sellable thing: goods or service. Extend the existing inventory table instead
-- of creating a parallel one if the current schema allows these columns.
CREATE TABLE item (
  id            BIGINT PRIMARY KEY,
  item_code     VARCHAR(40) UNIQUE,
  name          VARCHAR(200) NOT NULL,
  item_class    VARCHAR(10) NOT NULL,          -- GOODS | SERVICE
  category      VARCHAR(40),                   -- MEDICINE|FOOD|ACCESSORY|CONSULT|LAB|SURGERY|VACCINE
  tax_code_id   BIGINT REFERENCES tax_code(id),
  base_uom_id   BIGINT REFERENCES uom(id),
  sale_price    DECIMAL(14,2) DEFAULT 0,
  purchase_price DECIMAL(14,2) DEFAULT 0,
  price_inclusive BOOLEAN DEFAULT FALSE,       -- is sale_price MRP-inclusive of GST
  track_stock   BOOLEAN DEFAULT TRUE,          -- FALSE for services
  track_batch   BOOLEAN DEFAULT TRUE,
  track_serial  BOOLEAN DEFAULT FALSE,
  is_schedule_h BOOLEAN DEFAULT FALSE,         -- prescription drug register
  reorder_level DECIMAL(14,3) DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE
);

CREATE TABLE item_batch (
  id BIGINT PRIMARY KEY, item_id BIGINT NOT NULL,
  batch_no VARCHAR(40) NOT NULL, expiry_date DATE,
  mrp DECIMAL(14,2), purchase_rate DECIMAL(14,2),
  qty_on_hand DECIMAL(14,3) DEFAULT 0,
  UNIQUE (item_id, batch_no)
);

CREATE TABLE expense_category (
  id BIGINT PRIMARY KEY, name VARCHAR(80) UNIQUE,
  parent_id BIGINT NULL, is_gst_input_eligible BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Gapless numbering, per doc type per financial year per branch
CREATE TABLE numbering_series (
  id BIGINT PRIMARY KEY, branch_id BIGINT, doc_type VARCHAR(20),
  fy_code VARCHAR(7),                      -- 2026-27
  prefix VARCHAR(12), suffix VARCHAR(12),
  padding INT DEFAULT 4, next_number BIGINT DEFAULT 1,
  UNIQUE (branch_id, doc_type, fy_code)
);
```

### 5.2 Sales documents

```sql
CREATE TABLE sale_doc (
  id             BIGINT PRIMARY KEY,
  branch_id      BIGINT NOT NULL,
  doc_type       VARCHAR(12) NOT NULL,      -- QUOTATION | INVOICE | CREDIT_NOTE
  doc_number     VARCHAR(30) NOT NULL,
  doc_date       DATE NOT NULL,
  invoice_type   VARCHAR(16) NOT NULL,      -- GST | NON_GST | BILL_OF_SUPPLY | EXPORT
  link_type      VARCHAR(16) NOT NULL,      -- COUNTER_SALE | CLIENT_ACCOUNT
  party_id       BIGINT NULL,               -- NULL only for walk-in CASH counter sale
  party_name     VARCHAR(160) NOT NULL,     -- snapshot, defaults 'CASH'
  party_gstin    VARCHAR(15), party_address TEXT, party_mobile VARCHAR(20),
  animal_id      BIGINT NULL,               -- primary patient, optional
  place_of_supply CHAR(2) NOT NULL,
  is_interstate  BOOLEAN NOT NULL,
  reverse_charge BOOLEAN DEFAULT FALSE,
  sold_by_staff_id BIGINT,
  consultation_id  BIGINT NULL,             -- source clinical visit, for Rx sync
  price_inclusive  BOOLEAN DEFAULT FALSE,
  taxable_value  DECIMAL(14,2) DEFAULT 0,
  discount_total DECIMAL(14,2) DEFAULT 0,
  cgst DECIMAL(14,2) DEFAULT 0, sgst DECIMAL(14,2) DEFAULT 0,
  igst DECIMAL(14,2) DEFAULT 0, cess DECIMAL(14,2) DEFAULT 0,
  shipping_amount DECIMAL(14,2) DEFAULT 0,
  round_off      DECIMAL(14,2) DEFAULT 0,
  grand_total    DECIMAL(14,2) DEFAULT 0,
  paid_amount    DECIMAL(14,2) DEFAULT 0,
  balance_due    DECIMAL(14,2) DEFAULT 0,
  status         VARCHAR(12) NOT NULL,      -- DRAFT|POSTED|CANCELLED|CONVERTED
  reference_doc  VARCHAR(60),               -- 'Invoice Reference' checkbox value
  delivery_terms TEXT,
  remarks_private TEXT,                     -- never printed
  revised_from_id BIGINT NULL,
  created_at TIMESTAMP, created_by BIGINT,
  posted_at  TIMESTAMP, cancelled_at TIMESTAMP, cancel_reason TEXT,
  UNIQUE (branch_id, doc_type, doc_number)
);
CREATE INDEX ix_sale_date  ON sale_doc (doc_date, status);
CREATE INDEX ix_sale_party ON sale_doc (party_id, doc_date);

CREATE TABLE sale_doc_line (
  id BIGINT PRIMARY KEY, doc_id BIGINT NOT NULL, line_no INT NOT NULL,
  item_id BIGINT NOT NULL, item_name VARCHAR(200) NOT NULL,  -- snapshot
  description TEXT, tag VARCHAR(40), serial_no VARCHAR(60),
  batch_id BIGINT NULL, batch_no VARCHAR(40), expiry_date DATE,
  animal_id BIGINT NULL,
  hsn_sac VARCHAR(10),
  uom_id BIGINT, quantity DECIMAL(14,3) NOT NULL,
  free_quantity DECIMAL(14,3) DEFAULT 0,
  rate DECIMAL(14,2) NOT NULL,
  discount_pct DECIMAL(6,3) DEFAULT 0, discount_amt DECIMAL(14,2) DEFAULT 0,
  taxable_value DECIMAL(14,2) NOT NULL,
  gst_rate DECIMAL(6,3) NOT NULL,
  cgst DECIMAL(14,2), sgst DECIMAL(14,2), igst DECIMAL(14,2), cess DECIMAL(14,2),
  line_total DECIMAL(14,2) NOT NULL,
  source_ref VARCHAR(60) NULL,   -- e.g. 'RX:4821:LINE:7' — idempotency key for Rx sync
  UNIQUE (doc_id, line_no),
  UNIQUE (doc_id, source_ref)
);
```

### 5.3 Purchase documents

```sql
CREATE TABLE purchase_doc (
  id BIGINT PRIMARY KEY, branch_id BIGINT,
  doc_type VARCHAR(12) NOT NULL,            -- PURCHASE | DEBIT_NOTE
  doc_number VARCHAR(30) NOT NULL,          -- our internal number
  supplier_bill_no VARCHAR(40), supplier_bill_date DATE,
  po_number VARCHAR(40),
  doc_date DATE NOT NULL,
  purchase_type VARCHAR(16) NOT NULL,       -- GST | NON_GST | IMPORT
  supplier_id BIGINT NOT NULL REFERENCES party(id),
  place_of_supply CHAR(2), is_interstate BOOLEAN,
  reverse_charge BOOLEAN DEFAULT FALSE,
  taxable_value DECIMAL(14,2), cgst DECIMAL(14,2), sgst DECIMAL(14,2),
  igst DECIMAL(14,2), cess DECIMAL(14,2),
  shipping_amount DECIMAL(14,2) DEFAULT 0,
  round_off DECIMAL(14,2), grand_total DECIMAL(14,2),
  paid_amount DECIMAL(14,2) DEFAULT 0, balance_due DECIMAL(14,2) DEFAULT 0,
  itc_eligible BOOLEAN DEFAULT TRUE,
  status VARCHAR(12), remarks TEXT,
  created_at TIMESTAMP, created_by BIGINT,
  UNIQUE (branch_id, doc_type, doc_number),
  UNIQUE (supplier_id, supplier_bill_no, doc_type)   -- duplicate-bill guard
);

CREATE TABLE purchase_doc_line (
  id BIGINT PRIMARY KEY, doc_id BIGINT, line_no INT,
  item_id BIGINT, item_name VARCHAR(200), hsn_sac VARCHAR(10),
  batch_no VARCHAR(40), expiry_date DATE, mrp DECIMAL(14,2),
  uom_id BIGINT, quantity DECIMAL(14,3), free_quantity DECIMAL(14,3) DEFAULT 0,
  rate DECIMAL(14,2), discount_pct DECIMAL(6,3), discount_amt DECIMAL(14,2),
  taxable_value DECIMAL(14,2), gst_rate DECIMAL(6,3),
  cgst DECIMAL(14,2), sgst DECIMAL(14,2), igst DECIMAL(14,2), cess DECIMAL(14,2),
  landed_cost DECIMAL(14,2),      -- rate + apportioned shipping, drives valuation
  line_total DECIMAL(14,2)
);
```

### 5.4 Payments, expenses, ledgers

```sql
CREATE TABLE payment (
  id BIGINT PRIMARY KEY, branch_id BIGINT,
  direction VARCHAR(4) NOT NULL,        -- IN | OUT
  doc_number VARCHAR(30) NOT NULL, doc_date DATE NOT NULL,
  party_id BIGINT NOT NULL,
  total_amount DECIMAL(14,2) NOT NULL,
  unallocated_amount DECIMAL(14,2) NOT NULL,   -- advance / on-account
  narration TEXT, status VARCHAR(12),
  created_at TIMESTAMP, created_by BIGINT,
  UNIQUE (branch_id, direction, doc_number)
);

-- Split tender: one payment, many modes (600 UPI + 400 cash)
CREATE TABLE payment_split (
  id BIGINT PRIMARY KEY, payment_id BIGINT NOT NULL,
  pay_mode VARCHAR(20) NOT NULL,   -- CASH|CHEQUE|CARD|UPI|WALLET|DD|BANK_TRANSFER
  amount DECIMAL(14,2) NOT NULL,
  reference_no VARCHAR(60),        -- required when mode <> CASH
  bank_name VARCHAR(120), instrument_date DATE,
  clearing_status VARCHAR(12) DEFAULT 'CLEARED'  -- PENDING|CLEARED|BOUNCED (cheque/DD)
);

-- Bill-wise settlement: which payment paid which document, how much
CREATE TABLE payment_allocation (
  id BIGINT PRIMARY KEY, payment_id BIGINT NOT NULL,
  doc_kind VARCHAR(12) NOT NULL,   -- SALE | PURCHASE
  doc_id BIGINT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  UNIQUE (payment_id, doc_kind, doc_id)
);

CREATE TABLE expense (
  id BIGINT PRIMARY KEY, branch_id BIGINT,
  doc_number VARCHAR(30), expense_date DATE NOT NULL,
  category_id BIGINT NOT NULL REFERENCES expense_category(id),
  paid_to VARCHAR(160) NOT NULL,
  supplier_id BIGINT NULL,                  -- when payee is a registered party
  amount DECIMAL(14,2) NOT NULL,            -- gross
  taxable_value DECIMAL(14,2) DEFAULT 0, gst_amount DECIMAL(14,2) DEFAULT 0,
  supplier_gstin VARCHAR(15), itc_claimed BOOLEAN DEFAULT FALSE,
  paid_by_staff_id BIGINT NOT NULL,
  attachment_path VARCHAR(255),
  remarks TEXT, status VARCHAR(12),
  created_at TIMESTAMP, created_by BIGINT
);
CREATE TABLE expense_split (                -- same split-tender pattern
  id BIGINT PRIMARY KEY, expense_id BIGINT NOT NULL,
  pay_mode VARCHAR(20) NOT NULL, amount DECIMAL(14,2) NOT NULL,
  reference_no VARCHAR(60)
);

-- Party ledger: every financial event that moves a party balance
CREATE TABLE party_ledger (
  id BIGINT PRIMARY KEY, party_id BIGINT NOT NULL,
  entry_date DATE NOT NULL,
  source_kind VARCHAR(16) NOT NULL,  -- OPENING|SALE|CREDIT_NOTE|PURCHASE|DEBIT_NOTE|PAYMENT|ADJUSTMENT
  source_id BIGINT, source_number VARCHAR(30),
  narration VARCHAR(255),
  debit DECIMAL(14,2) DEFAULT 0, credit DECIMAL(14,2) DEFAULT 0,
  created_at TIMESTAMP
);
CREATE INDEX ix_pledger ON party_ledger (party_id, entry_date, id);

-- Stock ledger: one row per physical movement
CREATE TABLE stock_ledger (
  id BIGINT PRIMARY KEY, item_id BIGINT NOT NULL, batch_id BIGINT NULL,
  entry_date DATE NOT NULL,
  source_kind VARCHAR(16) NOT NULL,  -- PURCHASE|SALE|RETURN_IN|RETURN_OUT|ADJUST|EXPIRY|CONSUMPTION
  source_id BIGINT, source_number VARCHAR(30),
  qty_in DECIMAL(14,3) DEFAULT 0, qty_out DECIMAL(14,3) DEFAULT 0,
  rate DECIMAL(14,2), value DECIMAL(14,2),
  created_at TIMESTAMP
);
CREATE INDEX ix_sledger ON stock_ledger (item_id, entry_date, id);

CREATE TABLE audit_log (
  id BIGINT PRIMARY KEY, entity VARCHAR(40), entity_id BIGINT,
  action VARCHAR(20),                 -- CREATE|POST|CANCEL|PRINT|EXPORT
  actor_id BIGINT, at TIMESTAMP,
  before_json JSON, after_json JSON, ip VARCHAR(45)
);

CREATE TABLE reminder (
  id BIGINT PRIMARY KEY, remind_on DATE NOT NULL, remind_time TIME,
  title VARCHAR(160), notes TEXT,
  party_id BIGINT NULL, animal_id BIGINT NULL,
  link_kind VARCHAR(16), link_id BIGINT,        -- e.g. overdue invoice, vaccine due
  channel VARCHAR(12) DEFAULT 'IN_APP',         -- IN_APP|SMS|WHATSAPP|EMAIL
  status VARCHAR(12) DEFAULT 'OPEN'
);
```

---

## 6. Business rules and algorithms

### 6.1 Place of supply → tax split

```
clinic_state = branch.state_code
pos          = document.place_of_supply
is_interstate = (pos != clinic_state)

if invoice_type in (NON_GST, BILL_OF_SUPPLY):  gst_rate = 0, no tax rows
elif is_interstate:                            IGST = taxable * rate
else:                                          CGST = SGST = taxable * rate / 2
EXPORT / SEZ: IGST at rate, or zero-rated if LUT flag set on branch
```

Default `place_of_supply` = client's state; for counter sale default to clinic state. It stays user-overridable, exactly as Hitech does.

### 6.2 Line computation (canonical order — do not reorder)

```
1. gross          = quantity * rate                     (free_quantity is NOT charged)
2. discount_amt   = discount_pct > 0 ? round(gross * discount_pct/100, 2) : discount_amt
3. net            = gross - discount_amt
4. if price_inclusive:
       taxable    = round(net * 100 / (100 + gst_rate + cess_rate), 2)
       tax_total  = net - taxable
   else:
       taxable    = net
       tax_total  = round(taxable * (gst_rate + cess_rate)/100, 2)
5. split tax_total into CGST/SGST or IGST per §6.1; CGST = SGST = round(half, 2)
   — put any 1-paisa residue on SGST so CGST+SGST always equals tax_total
6. line_total     = taxable + tax_total
```

Invoice-level discount, if used, is apportioned across lines **in proportion to taxable value** before step 4, so that the HSN-wise summary in GSTR-1 stays consistent. Shipping & packaging is apportioned the same way when taxable, or carried as a separate non-taxable line when not.

### 6.3 Round-off

`grand_total_raw = Σ line_total + shipping`. `grand_total = round_to_nearest_rupee(grand_total_raw)`, `round_off = grand_total - grand_total_raw` (range −0.50 to +0.49). Round-off is stored, printed on the bill, and posted to the ledger — never silently swallowed.

### 6.4 Document numbering (gapless, FY-aware)

- Format: `{prefix}/{fy_code}/{seq:padded}` → `INV/2026-27/0042`.
- Financial year = 1 April – 31 March; `fy_code` derived from `doc_date`, not from today.
- Allocation happens **inside the posting transaction** with `SELECT ... FOR UPDATE` on `numbering_series`. Never pre-fetch a number for a draft — that is how gaps appear, and GST requires a consecutive series.
- Drafts show `Unsaved Invoice` in the title bar (matching Hitech's behaviour) and receive a number only at post time.
- Cancellation keeps the number and marks it `CANCELLED`. Never reuse.

### 6.5 Batch allocation (FEFO)

On invoice line entry for a `track_batch` item: propose batches ordered by `expiry_date ASC`, skipping expired ones; allow manual override; block if allocated qty < line qty unless `allow_negative_stock` is on for that item class. Warn (do not block) when expiry is within 30 days. Expired batches are never auto-selected.

### 6.6 Posting rules (what each document writes)

| Document | Party ledger | Stock ledger | Effect on balances |
|---|---|---|---|
| Sale invoice (client account) | DR party = grand_total | qty_out per goods line | Increases receivable |
| Sale invoice (counter, paid) | DR party then CR by payment | qty_out | Nets to zero |
| Credit note (sales return) | CR party | qty_in | Reduces receivable |
| Purchase bill | CR supplier = grand_total | qty_in at landed cost | Increases payable |
| Debit note (purchase return) | DR supplier | qty_out | Reduces payable |
| Payment In | CR party | — | Reduces receivable |
| Payment Out | DR party | — | Reduces payable |
| Expense | CR supplier if party-linked, else none | — | Cash/bank out |
| Opening balance | DR or CR per `opening_type` | — | Seeds the ledger |

Party outstanding = `opening ± Σ(debit − credit)`. Always compute from `party_ledger`; never store a mutable "balance" column that can drift.

### 6.7 Credit control

At invoice post with `link_type = CLIENT_ACCOUNT` and unpaid balance:

```
if not party.credit_allowed and balance_due > 0        -> block, require payment
if current_outstanding + balance_due > credit_limit    -> block, allow manager override (logged)
if oldest unpaid invoice age > credit_days             -> warn
```

### 6.8 Rx → billing sync (the integration that matters most)

Trigger: doctor saves a section of Doctor Rx & Diagnosis.

```
for each billable element in (Immediate Treatment, Prescribed Treatment,
                              Injectable, Prescribed Food, Lab Orders,
                              Consultation Fee, Vaccination, Deworming):
    source_ref = "RX:{rx_id}:{section}:{element_id}"
    upsert into draft invoice for (consultation_id) keyed on source_ref
```

Rules:
1. `UNIQUE (doc_id, source_ref)` is what prevents duplicates — not application-level checks.
2. Editing the Rx element updates the matching draft line; deleting it removes the line **only while the invoice is DRAFT**.
3. Once the invoice is POSTED, later Rx edits create a *pending addendum* list on the consultation; the biller resolves it via a new invoice or a credit note. Posted documents are never silently mutated.
4. Immediate Treatment consumes stock at administration time (`CONSUMPTION` stock move) and bills at invoice time; reconcile the two so the drug isn't deducted twice.
5. Prescribed (take-home) items only move stock when actually dispensed at the counter.

### 6.9 Financial-period selectors

Every period control in the finance module exposes: Today, Yesterday, This Week, This Month, Last Month, This Quarter, This FY, Last FY, **Custom (from / to)**. One shared component, one shared `{from, to}` contract, `DD/MM/YYYY` in, ISO out. Enforce `from <= to` and cap ranges on heavy reports (e.g. 400 days) with a warning rather than a silent truncation.

---

## 7. Screen specifications

### 7.1 Invoice screen (primary build)

Layout mirrors Hitech so the clinic staff don't relearn: information block → particulars → grid → totals → payment.

**Keyboard-first behaviour is non-negotiable** — counter billing is done at speed:

| Key | Action |
|---|---|
| `F2` | Focus item search |
| `Enter` in item field | Select item, jump to Quantity |
| `Enter` in Quantity | Jump to Rate |
| `Enter` in Rate | Push line to grid, refocus item (Hitech's green "+") |
| `F4` | Focus payment amount |
| `F9` | Save |
| `F10` | Save and Print |
| `Ctrl+D` | Delete highlighted grid line |
| `Esc` | Cancel current line (confirm if grid non-empty) |

Behaviours to replicate:
- Client Name defaults to `CASH` on Counter Sale; switching to Client Account enables party type-ahead and pulls address, GSTIN, POS, credit status.
- Type-ahead with an inline red warning icon while the typed name matches no record, plus "create new" from the dropdown (Hitech does this on the supplier field — apply it to both).
- Discount toggle ₹ | %, mutually exclusive, both stored.
- "Add Shipping and Packaging Costs" and "Invoice Reference" as checkbox-reveals — keeps the default screen clean.
- Remarks (Private Use) never appears on the printed bill. Delivery Terms does.
- Dirty-state title and a confirm-on-close guard.

Additions: patient selector, batch column in the grid, tax-summary strip (Taxable / CGST / SGST / IGST / Round-off), split-payment sub-grid, "Pull from Rx" button when opened from a consultation.

### 7.2 Purchase bill screen

Same skeleton; adds supplier bill no + date, P.O. no., and per-line batch/expiry/MRP/free-qty. Duplicate supplier bill number within the same FY raises a blocking error naming the earlier document. Landed cost = rate + apportioned shipping; that is the value written to `stock_ledger`, not the invoice rate.

### 7.3 Party masters

One screen with a type switch, or two screens over one table — either is fine, but **one table**. The client screen keeps Hitech's Anniversary block (DOB/anniversary drive greeting campaigns, which fit a vet clinic well) and the credit block. The supplier screen keeps bank details and the GSTIN-status link. Validate: GSTIN regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`, PAN `^[A-Z]{5}[0-9]{4}[A-Z]$`, IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`, mobile 10 digits starting 6–9, and check that GSTIN's first two digits equal the selected state code.

### 7.4 Expense screen

Hitech's layout plus: category from master (tree), split-payment rows, attachment upload, GST/ITC block that appears only when the category is `is_gst_input_eligible`. `Payment Ref. No.` stays disabled for Cash and becomes required for every other mode — replicate that conditional exactly.

### 7.5 Dashboard

KPI cards (period-aware): Total Sale, Amount Received, Amount Due, Purchases, Expenses, Cash in Hand.
Charts: daily sales bars (15 days, auto `1k = 1000` scaling), Sale/Purchase/Expense donut (30 days).
Tabs: Recent Sales | Client Amount Due | Amount Received | Cheque/DD Alerts (instruments pending clearance, from `payment_split.clearing_status`).
Global search with scope radios: Stock | Serial No | Invoice | Client — debounced 300 ms, minimum 2 characters, results capped at 50 with "refine your search".

---

## 8. API surface and performance

### 8.1 Endpoints

```
POST   /api/finance/invoices                 create draft
PUT    /api/finance/invoices/{id}            edit draft only
POST   /api/finance/invoices/{id}/post       allocate number, post ledgers  [idempotent]
POST   /api/finance/invoices/{id}/cancel     reversal + reason
GET    /api/finance/invoices?from&to&party&status&q
GET    /api/finance/invoices/{id}/print      PDF / thermal payload
POST   /api/finance/invoices/preview         tax engine dry-run, no persistence

POST   /api/finance/quotations/{id}/convert  -> draft invoice
POST   /api/finance/purchases ... /post ... /cancel
POST   /api/finance/payments                 with splits[] and allocations[]
GET    /api/finance/parties/{id}/ledger?from&to
GET    /api/finance/parties/{id}/outstanding bill-wise ageing buckets
POST   /api/finance/expenses
GET    /api/finance/dashboard/kpis?period|from&to
GET    /api/finance/reports/{report_key}?...
GET    /api/finance/gst/gstr1?month         JSON + CSV/JSON-for-offline-tool
POST   /api/integration/rx/{rx_id}/sync-billing
```

### 8.2 Contract rules

- `POST /post` takes an `Idempotency-Key` header. A repeat with the same key returns the original result — this is what stops double-billing from a double-click or a retried request on flaky clinic wifi.
- Every money field is a string-encoded decimal in JSON to avoid float drift in JavaScript clients.
- Validation errors return field-level codes so the UI can highlight the exact input.

### 8.3 Performance

- Materialised daily aggregate `fin_daily_summary (branch_id, date, sale_taxable, sale_tax, sale_total, received, purchase_total, expense_total)`, refreshed on post/cancel or by a nightly job. Dashboards read only this.
- Indexes as specified in §5; add covering indexes for the sales register (`doc_date, status, party_id`).
- Ledger endpoints paginate with keyset pagination on `(entry_date, id)`, never `OFFSET`.
- Print generation is async for batch print, synchronous for single-bill.

---

## 9. Reports and statutory outputs

| Report | Key columns | Filters |
|---|---|---|
| Sales register | Date, No., Party, GSTIN, Taxable, CGST, SGST, IGST, Total, Paid, Due | period, party, staff, invoice type |
| Purchase register | Date, Our No., Supplier Bill No., Supplier, Taxable, Tax, Total | period, supplier |
| Outstanding receivable | Party, Bill, Date, Age, Amount, Paid, Due | ageing 0-30/31-60/61-90/90+ |
| Outstanding payable | Supplier, Bill, Date, Age, Due | same buckets |
| Party ledger | Date, Particulars, Voucher, Debit, Credit, Running balance | party, period |
| Day book | All vouchers of a day, mode-wise cash summary | date |
| Cash & bank book | Opening, receipts, payments, closing per mode | period, mode |
| Stock summary | Item, Opening, In, Out, Closing, Value | period, category |
| Batch & expiry | Item, Batch, Expiry, Qty, Value, Days to expiry | expiring in N days |
| Item profitability | Item, Qty sold, Sale value, Cost, Margin % | period, category |
| Expense analysis | Category, Amount, % of total, mode split | period, category |
| Doctor-wise revenue | Doctor, Consultations, Services, Medicines, Total | period |
| Schedule-H register | Date, Drug, Batch, Qty, Owner, Animal, Prescriber | period, drug |
| GSTR-1 | B2B, B2CL, B2CS, CDNR, HSN summary, doc series | month/quarter |
| GSTR-3B summary | Outward taxable + tax, inward ITC | month |
| GSTR-2 dataset | Purchase-side data for 2A/2B reconciliation | month |

Every report: on-screen grid + Excel + PDF, dates rendered `DD/MM/YYYY`, totals row, and the applied filter printed in the header.

---

## 10. Testing strategy

### 10.1 Tax engine matrix (pure unit tests — write these first)

Cross-product of: `{intra, inter} × {0, 5, 12, 18, 28%} × {exclusive, inclusive} × {no discount, % discount, ₹ discount} × {goods, service}`, plus edge cases:

- Quantity with 3 decimals (0.125 kg feed).
- Rate with paise (₹12.67).
- 50/50 CGST-SGST split producing a half-paisa (₹0.005) — assert residue lands on SGST and the sum reconciles.
- Round-off at exactly ₹x.50.
- 100% discount line (taxable 0, tax 0, not a divide-by-zero).
- Free quantity: stock moves, nothing billed.
- Inclusive pricing where MRP is the ceiling — assert printed total never exceeds MRP × qty.
- Invoice-level discount apportionment: Σ line taxable after apportionment == invoice taxable, to the paisa.

### 10.2 Integration tests

- Post → cancel → repost: numbering has no gaps and no reuse.
- Concurrent posts from two terminals: no duplicate numbers (run with real DB locking, not mocks).
- Rx sync run three times: line count stable, no duplicates.
- Payment allocated across three invoices: each `balance_due` correct, `unallocated_amount` correct.
- Credit limit breach blocks; manager override succeeds and writes an audit row.
- Purchase → sale → sales return: `stock_ledger` closing qty matches `item_batch.qty_on_hand` exactly.
- Cheque marked BOUNCED: party outstanding reverts.

### 10.3 Reconciliation tests (run nightly in staging)

```
assert Σ(party_ledger.debit - credit) per party == computed outstanding
assert Σ(stock_ledger qty_in - qty_out) per batch == item_batch.qty_on_hand
assert Σ(sale_doc.grand_total where POSTED) == fin_daily_summary.sale_total
assert Σ GSTR-1 taxable == sales register taxable for the same month
```

### 10.4 UAT with the clinic

Have the receptionist bill 20 real visits in parallel on Hitech and the new module for one week; compare bill-by-bill totals and the month-end GST summary. Ship only when they match to the rupee.

---

## 11. Implementation phases

Effort assumes one developer working steadily; halve elapsed time with two.

### Phase 0 — Foundation (week 1)
- Confirm the current schema; decide extend-vs-new for owner/item tables.
- Create masters: `tax_code`, `uom`, `expense_category`, `numbering_series`, `org_branch`.
- Shared `MoneyDecimal` helper, `DD/MM/YYYY` formatter, period-selector component, audit-log hook.
- **Done when:** masters CRUD works, HSN/SAC seeded for the clinic's actual catalogue.

### Phase 1 — Party masters (week 2)
- `party` table + client screen + supplier screen, validation set from §7.3.
- Link existing owners into `party` (backfill script, mobile as match key).
- Opening balances posted to `party_ledger`.
- **Done when:** every existing owner has a party row and the ledger opens at the right balance.

### Phase 2 — Tax engine + sale invoice (weeks 3–5) ← *the critical path*
- Pure tax engine + the full §10.1 matrix, green before any UI work.
- Invoice screen, keyboard flow, grid, totals, split payment.
- Posting transaction: number → header/lines → stock → ledger.
- Print templates: A5 GST bill + 80 mm thermal counter slip.
- **Done when:** a counter sale and a client-account GST sale both post, print, and appear correctly in the party ledger.

### Phase 3 — Purchases, suppliers, stock (weeks 6–7)
- Purchase bill, batch/expiry capture, landed cost, duplicate-bill guard.
- Stock ledger, FEFO allocation wired back into the invoice screen.
- Purchase return / debit note.
- **Done when:** purchase → sale → return leaves stock and supplier ledger reconciled.

### Phase 4 — Payments, expenses, outstanding (week 8)
- Payment In / Out with splits and bill-wise allocation, advances.
- Expenses with categories, splits, attachments, ITC block.
- Outstanding + ageing reports, cheque clearance tracking.
- **Done when:** the Client Amount Due and Cheque Alert dashboard tabs are live off real data.

### Phase 5 — Rx / clinical integration (week 9)
- `source_ref` idempotency, draft-invoice sync, addendum handling for posted bills.
- Lab order → billable line; consultation fee; follow-up-driven reminders.
- Immediate-treatment consumption vs dispensing reconciliation.
- **Done when:** a doctor completing an Rx produces a correct draft bill at reception with zero re-keying and zero duplicates.

### Phase 6 — Reports, GST returns, dashboard (weeks 10–11)
- Report framework + the §9 list, Excel/PDF export.
- GSTR-1 / 3B / 2 datasets with the §10.3 reconciliation assertions.
- Dashboard KPIs, charts, global search, reminders.
- **Done when:** a full month's GSTR-1 export matches the sales register and the clinic's CA signs off.

### Phase 7 — Migration, hardening, cutover (week 12)
- Historical import from Hitech (§12), parallel run, UAT sign-off.
- Role/permission matrix, backup/restore drill, performance pass.
- **Done when:** parallel-run bills match to the rupee and Hitech is switched to read-only.

### Phase 8 — Deferred backlog
e-Invoice IRN/QR, e-Way Bill, WhatsApp bill delivery, barcode/QR scanning at the counter, full GL with trial balance, multi-branch consolidation.

---

## 12. Data migration from Hitech

1. **Export.** Use Hitech's Tools → Backup/Export for masters (clients, suppliers, items, stock) and transactions. If exports are limited on the free edition, extract from its database file directly, or export every report to Excel as a fallback.
2. **Decide the cutover date.** Recommended: 1 April (FY boundary) — then only opening balances and stock migrate, not history. If mid-year, import the current FY's invoices too so GSTR-1 stays continuous.
3. **Migrate in this order:** tax codes → UoM → items → item batches with expiry → parties → opening balances → opening stock → open invoices (unpaid only) → open supplier bills.
4. **Stage everything.** Load into `mig_*` staging tables, run validation (duplicate mobiles, invalid GSTINs, negative stock, expired batches, orphan references), produce an exception report, fix at source, then promote.
5. **Reconcile before go-live.** Three numbers must match Hitech exactly: total receivable, total payable, total stock value. If they don't, do not cut over.
6. **Freeze window.** Stop Hitech entry Friday evening, migrate, verify Saturday, go live Monday. Keep Hitech installed read-only for at least 12 months for any audit query.

---

## 13. Security, roles, compliance

**Roles:** Receptionist (create invoice/payment, no cancel, no cost prices) · Pharmacist (dispense, batch, purchase entry) · Doctor (Rx, reads own revenue) · Accountant (all finance, cancel with reason, GST returns) · Admin (masters, settings, overrides).

**Controls:**
- No hard delete of any financial document. Cancel-with-reason, always audited.
- Cost price and margin hidden from Receptionist/Doctor roles at the API layer, not just the UI.
- Audit log on create / post / cancel / print / export, with actor and IP.
- GST compliance: consecutive invoice series per FY, correct HSN/SAC on every line, 6-digit HSN if turnover > ₹5 crore, POS on every document, mandatory tax breakup on the printed bill, 6-year retention.
- Drug compliance: Schedule-H sale register with prescriber, expired batches blocked from sale.
- Daily automated backup with a monthly restore drill — a backup you have never restored is not a backup.

---

## 14. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Tax rounding disagrees with the CA's expectation | Return mismatch | Fix the canonical order in §6.2 in code and in one written spec; reconcile in the parallel run |
| Invoice number gaps from drafts | GST notice | Number allocated only at post, inside the transaction, with row lock |
| Duplicate lines from Rx sync | Over-billing | DB-level `UNIQUE (doc_id, source_ref)`, not app checks |
| Staff slower than on Hitech | Rejection at counter | Match Hitech's layout, ship the keyboard map on day one, train before cutover |
| Stock drift between consumption and billing | Wrong margins | Nightly reconciliation assertion (§10.3), alert on mismatch |
| Migration opening balances wrong | Wrong dues from day one | Three-number reconciliation gate before go-live |
| Scope creep into a full accounting suite | Never ships | Phases 0–7 are the contract; everything else is Phase 8 |

---

## 15. Definition of done

- [ ] Counter sale and client-account GST invoices post, print (A5 + thermal), and hit the party ledger correctly
- [ ] Tax engine matrix (§10.1) fully green, including inclusive pricing and residue-paisa cases
- [ ] Invoice series is consecutive and gapless across a post/cancel/repost cycle and under concurrent terminals
- [ ] Purchase → sale → return leaves stock and supplier ledger reconciled to the unit
- [ ] Split payments work on both invoices and expenses
- [ ] Every period selector offers a custom from/to range
- [ ] Rx sync is idempotent across repeated runs; posted invoices are never silently mutated
- [ ] All user-facing dates render `DD/MM/YYYY`
- [ ] GSTR-1 export reconciles with the sales register for a full month
- [ ] One week of parallel running against Hitech matches bill-by-bill
- [ ] Role permissions enforced server-side; audit log populated
- [ ] Backup restored successfully in a drill

---

## Appendix A — Field mapping, Hitech → new schema

| Hitech field | Screen | New location |
|---|---|---|
| Invoice Type | Invoice | `sale_doc.invoice_type` |
| Link To (Counter Sale / Client Account) | Invoice | `sale_doc.link_type` |
| Client Name (default CASH) | Invoice | `sale_doc.party_name` + `party_id` |
| Place of Supply | Invoice / Purchase | `*.place_of_supply` → `is_interstate` |
| Sold By | Invoice | `sale_doc.sold_by_staff_id` |
| Tagging / Item Code | Invoice / Purchase | UI entry mode; no column |
| Serial No. (header + line) | Invoice | `sale_doc_line.serial_no` |
| Discount ₹ / % | Invoice | `discount_amt` / `discount_pct` |
| Add Shipping and Packaging Costs | Invoice / Purchase | `*.shipping_amount` |
| Invoice Reference | Invoice | `sale_doc.reference_doc` |
| Delivery Terms | Invoice | `sale_doc.delivery_terms` |
| Remarks (Private Use) | Invoice | `sale_doc.remarks_private` (never printed) |
| Payment Details + Amount | Invoice | `payment` + `payment_split` |
| P. O. No. | Purchase | `purchase_doc.po_number` |
| Purchase Bill No. | Purchase | `purchase_doc.supplier_bill_no` |
| Opening Balance + Debit/Credit | Client / Supplier | `party.opening_balance` / `opening_type` |
| Credit Allowed / Credit Limit | Client | `party.credit_allowed` / `credit_limit` |
| Document Type / Document No. | Client | `party.doc_type` / `doc_number` |
| Date of Birth / Anniversary | Client | `party.date_of_birth` / `anniversary` |
| Bank Name / A-c No / IFSC | Supplier | `party.bank_*` |
| Expense Type | Expense | `expense.category_id` |
| Pay Mode / Payment Ref. No. | Expense | `expense_split.pay_mode` / `reference_no` |
| Paid To / Paid By | Expense | `expense.paid_to` / `paid_by_staff_id` |

## Appendix B — Seed data checklist

- GST rates: 0, 5, 12, 18, 28 with effective dates
- Common vet HSN: 3004 (medicaments), 2309 (animal feed), 3002 (vaccines), 9018 (instruments)
- Common SAC: 998351 (veterinary services)
- UoM: PCS, STRIP, TAB, BOTTLE, VIAL, ML, GM, KG, DOSE, SESSION
- State codes: all 36 with GST codes
- Expense categories: Rent, Salary, Electricity, Water, Internet & Phone, Vehicle & Fuel, Clinic Consumables, Housekeeping, Equipment Maintenance, Marketing, Professional Fees, Bank Charges, Licence & Statutory, Miscellaneous
- Payment modes: Cash, Cheque, Card, UPI, Mobile Wallet, Demand Draft, Bank Transfer
- Numbering series: INV, QTN, CRN, PUR, DBN, PIN, POUT, EXP for FY 2026-27
