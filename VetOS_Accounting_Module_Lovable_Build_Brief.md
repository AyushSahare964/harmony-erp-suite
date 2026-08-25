# VetOS ERP — Accounting & Ledgers Hub (Build Brief for Lovable)

> **How to use this file:** Paste this document into Lovable as the implementation brief for upgrading the existing `Accounting & Ledgers` module (`/m/accounting`) into a full multi-tab **Accounting Hub**, following the same pattern already used by the Inventory Hub (`/m/inventory`, 5 tabs). Everything below reuses the current VetOS ERP design tokens, component conventions, and data patterns — nothing here introduces a new visual language. Do not restyle existing modules; only build what is specified.

---

## 0. One-line instruction to give Lovable

> "Upgrade the `Accounting & Ledgers` module at `/m/accounting` from a single-page ledger view into a 6-tab **Accounting Hub**, exactly like how `/m/inventory` is a 5-tab hub. Reuse the existing theme tokens, `erp-card` / `page-title` / `section-label` utility classes, KPI card layout, dialog patterns, and bar-chart components already in the codebase. Do not change any other module. Full spec, fields, KPIs and tab breakdown are below."

---

## 1. Context: What Already Exists

- Route: `src/routes/m.$moduleId.tsx` renders `/m/accounting` today as a **single-page module**:
  - Table columns: Journal Entry Number (`JV-0000`), Entry Date, Account Ledger, Narration/Remarks, Amount, Entry Type (`Credit`, `Debit`, `Liability`).
  - Sub-features: Journal voucher entry modal, ledger classification, monthly trend chart.
  - KPI cards: MTD Net Revenue (₹21.6L), MTD Expenses (₹9.2L), Cash & Bank Balance (₹14.3L), GST Payable (₹1.8L).
  - Icon: `Wallet`. Category: **Finance & People**. Role visibility: `admin`, `accounts`.
- The **only** existing multi-tab precedent in the app is `/m/inventory` (`Inventory & Procurement Hub`), which loads 5 sub-tabs with badge numbers (`12.4`–`12.8`) inside one hub shell. **Accounting should follow this exact same hub pattern**, not invent a new one.
- Financial Reports already exist as a **separate** module at `/m/reports-finance` (departmental margin analysis). Do not duplicate that module — the new Accounting Hub's "Reports" tab should link to it rather than rebuild it, except for a compact Trial Balance / P&L / Balance Sheet preview that belongs to the accounting workflow itself.
- Subscription/SaaS billing already lives in the **Platform Administration** layer (`/m/subscriptions`) — do **not** add a Subscription tab to this clinic-level Accounting Hub; that's platform-scope, not branch-scope.

---

## 2. Design System — Reuse As-Is (no new tokens)

Pull every value below from the existing `src/styles.css` — do not hardcode new hex/oklch values anywhere in the new components.

| Token | Value | Use in this module |
| :--- | :--- | :--- |
| `--primary` | `#1F4ED8` (Clinical Blue) | Active tab pill, primary buttons (Add Journal Entry, Reconcile, Post) |
| `--primary-soft` | tinted blue | Icon boxes on tab headers, badge backgrounds |
| `--success` / `--success-soft` | `#168A47` / soft green | Paid, Reconciled, Credit, positive variance |
| `--warning` / `--warning-soft` | `#B7791F` / soft amber | Due, Unreconciled, Pending approval, GST payable |
| `--destructive` / `--danger-soft` | `#C0362C` / soft red | Overdue, Negative variance, Failed reconciliation |
| `--navy` | `#16233F` | Section headings, modal titles |
| `--muted-foreground` | `#5B6472` | Helper captions, timestamps |
| `--border` | `#E2E6ED` | Table dividers, card outlines |
| Font | `Inter` | All text |
| Radius | `--radius-lg` (11.2px) for cards, `--radius-sm` for badges | Match existing `erp-card` |
| Motion | Framer Motion spring (`stiffness: 400-450`, `damping: 25-35`) | Active tab-pill slide, matching the role-selector on the Home Dashboard |

Utility classes to reuse: `page-title`, `erp-card`, `section-label`. No new CSS utilities should be created unless functionally impossible to reuse existing ones.

---

## 3. New Route / Component Structure

```
src/routes/m.$moduleId.tsx        # existing dynamic renderer — detect moduleId === "accounting"
                                   # and mount the new hub instead of the generic table view
src/modules/accounting/
├── AccountingHub.tsx              # Tab shell — mirrors InventoryHub.tsx pattern
├── FinancialDashboard.tsx         # Tab 18.1
├── ChartOfAccounts.tsx            # Tab 18.2
├── ReceivablesPayables.tsx        # Tab 18.3
├── BankingReconciliation.tsx      # Tab 18.4
├── TaxationCompliance.tsx         # Tab 18.5
├── BudgetingCostCenters.tsx       # Tab 18.6
└── components/
    ├── JournalEntryDialog.tsx     # existing JV modal, reused across tabs
    ├── PaymentEntryDialog.tsx     # new
    ├── BankReconciliationDrawer.tsx
    ├── TaxTemplateDialog.tsx
    └── CostCenterTree.tsx
```

Follow the exact same file-naming and tab-shell conventions as `src/modules/inventory/` (or wherever `MedicineCatalogue.tsx`, `StockView.tsx`, `StockMovements.tsx`, `BillingSync.tsx`, `AlertsPanel.tsx` currently live) — copy that shell component and adapt tab labels/icons/badges instead of writing a new hub pattern from scratch.

---

## 4. Tab Breakdown

```
Accounting Hub (/m/accounting)
├── Tab 18.1  Financial Dashboard      [icon: LayoutDashboard]
├── Tab 18.2  Chart of Accounts & GL   [icon: ListTree]
├── Tab 18.3  Receivables & Payables   [icon: HandCoins]
├── Tab 18.4  Banking & Reconciliation [icon: Landmark]
├── Tab 18.5  Taxation & Compliance    [icon: ReceiptText]
└── Tab 18.6  Budgeting & Cost Centers [icon: PieChart]
```

Badge numbers (`18.1`–`18.6`) should render as small pills next to each tab label, exactly like `12.4`–`12.8` do on the Inventory Hub tabs.

---

### Tab 18.1 — Financial Dashboard

**Purpose:** Landing tab when `/m/accounting` is opened. Snapshot of clinic financial health, matching the ERPNext-style dashboard described in the reference report.

**KPI Cards (top row, 4 cards, same card component as Home Dashboard):**
| Label | Example Value | Trend |
| :--- | :--- | :--- |
| MTD Net Revenue | ₹21.6L | ↗ vs last month |
| MTD Expenses | ₹9.2L | ↘ vs last month |
| Cash & Bank Balance | ₹14.3L | — |
| GST Payable | ₹1.8L | ⚠ warning color if due within 7 days |

**Cash Flow Strip (4 smaller stat tiles, matching reference report §2.1):**
- Total Incoming Bills (Receivables raised)
- Total Outgoing Bills (Payables raised)
- Total Incoming Payments (cash actually received)
- Total Outgoing Payments (cash actually disbursed)

**Charts:**
- **Profit & Loss trend** — interactive bar/line combo chart: Income vs Expense vs Net Profit, monthly, current fiscal year selector (e.g. FY 2026–27). Reuse the existing bar-chart component already used on `/m/tenants`, `/m/subscriptions`, `/m/crm-pets`, etc.
- **Cash Flow mini-chart** — 30-day incoming vs outgoing payments line.

**Setup Checklist Panel** (collapsible card, only shown if setup incomplete — mirrors ERPNext's guided setup wizard):
1. Review Chart of Accounts
2. Set up Taxes (GST/TDS templates)
3. Configure Accounts Settings
4. Define Cost Centers
5. Enter Opening Balances
6. Post First Purchase/Sales Invoice

Each item is a row with a status dot (`done` = success color, `pending` = muted) and a "Set up →" link that deep-links to the relevant tab.

---

### Tab 18.2 — Chart of Accounts & General Ledger

**Purpose:** Structural backbone of the ledger — account hierarchy, transaction history, trial balance.

**Left panel:** Chart of Accounts tree (Assets, Liabilities, Equity, Income, Expense as root nodes, expandable). Use the same tree/nested-list interaction pattern as the Cost Center Tree described in the reference doc — collapsible rows with indentation, account code + name + running balance per row.

**Right panel (tabs within the tab, or a segmented control):**
- **General Ledger** — table: Date, Account, Voucher Type (`Journal Entry`, `Payment Entry`, `Sales Invoice`, `Purchase Invoice`), Voucher No., Debit, Credit, Running Balance. Filterable by account, date range, cost center.
- **Trial Balance** — table: Account, Opening Balance, Debit, Credit, Closing Balance. Footer row shows Total Debit = Total Credit with a green check badge when balanced, red warning badge if not.

**Actions:** "New Account" dialog (Account Name, Parent Account, Account Type, Is Group toggle), "New Journal Entry" (reuse existing `JournalEntryDialog.tsx`).

**KPI strip:** Total Accounts (count), Unbalanced Entries (should always be 0 — flag in destructive color if >0), Last Reconciled Date, Open Fiscal Year label (e.g. "FY 2026–27").

---

### Tab 18.3 — Receivables & Payables

**Purpose:** Who owes the clinic money, who the clinic owes money to, and recording payments against both.

**Two side-by-side panels or a toggle:**

**Accounts Receivable**
- Table columns: Owner/Customer Name, Invoice No. (cross-link to `/m/billing`), Invoice Date, Due Date, Amount, Outstanding, Ageing Bucket (`0–30`, `31–60`, `61–90`, `90+`), Status (`Unpaid`, `Partially paid`, `Overdue`).
- KPI: Total Receivables, Overdue Receivables (90+ days, destructive color), Avg. Collection Period (days).

**Accounts Payable**
- Table columns: Supplier Name, Bill No. (cross-link to `/m/inventory` Billing Sync where relevant), Bill Date, Due Date, Amount, Outstanding, Ageing Bucket, Status (`Unpaid`, `Partially paid`, `Overdue`).
- KPI: Total Payables, Overdue Payables, Suppliers on Hold.

**Payment Entry dialog** (`PaymentEntryDialog.tsx`): Party Type (`Customer`/`Supplier`), Party Name, Reference Invoice/Bill, Payment Amount, Mode of Payment (`Cash`, `UPI`, `Card`, `Bank Transfer`, `Cheque`), Bank Account, Reference No., Date. On save, updates the linked invoice/bill's Outstanding and Status.

**Journal Entry Templates** — small management panel below the main tables: list of reusable templates (name, default accounts, default narration) with Add/Edit/Delete, so recurring entries (e.g. monthly rent, bank charges) don't need to be rebuilt from scratch each time.

---

### Tab 18.4 — Banking & Reconciliation

**Purpose:** Bank account masters and matching ledger entries against actual bank statements.

**Bank Accounts panel:** Card grid (not table) — one card per bank account showing Bank Name, Account Number (masked, e.g. `••••4821`), Account Type (`Current`, `Savings`), Linked Ledger Account, Current Book Balance. "Add Bank Account" opens a simple form dialog.

**Bank Reconciliation Statement:**
- Table columns: Transaction Date, Description, Cheque/Reference No., Amount, Ledger Status (`Matched`, `Unmatched`, `Pending Clearance`).
- A **Bank Reconciliation Drawer** (`BankReconciliationDrawer.tsx`) lets the user select a bank account + statement period, then check off matched entries side-by-side (Book vs Bank columns), with a running "Difference" total that must hit ₹0 before the "Mark as Reconciled" button becomes enabled (disabled state uses muted styling, enabled state uses success color).

**Mode of Payment settings:** simple settings list (Cash, UPI, Card, Bank Transfer, Cheque) each mapped to a default ledger account — small table with an Edit action per row.

**KPI strip:** Bank Balance (book), Unreconciled Transactions (count), Last Reconciliation Date, Pending Clearance Amount.

---

### Tab 18.5 — Taxation & Compliance

**Purpose:** GST/TDS configuration and payable tracking, matching reference report §3.2.

**Sales & Purchase Tax Templates:** table — Template Name, Applicable To (`Sales`, `Purchase`), Tax Rate(s) (e.g. `CGST 9% + SGST 9%`), Default (toggle), Status (`Active`, `Inactive`). "New Template" dialog.

**Item Tax Overrides:** table — Item/Category (links to Pharmacy/Nutrition catalogues), Override Tax Template, Reason.

**Tax Withholding (TDS):** table — Party Name, TDS Section, Rate %, YTD Deducted Amount, Lower Deduction Certificate (`None`, `Attached — expiry date`).

**GST Summary card:** Output GST (collected), Input GST (paid on purchases), Net GST Payable — this is the figure that feeds the Financial Dashboard's "GST Payable" KPI. Include a "Generate GSTR Summary" button (can be a stub action for now, no real filing integration required).

**KPI strip:** GST Payable (this period), TDS Deducted (MTD), Active Tax Templates, Certificates Expiring in 30d.

---

### Tab 18.6 — Budgeting & Cost Centers

**Purpose:** Departmental/branch-level financial control, matching reference report §3.5.

**Cost Center Tree:** same tree component as the Chart of Accounts (reuse, don't rebuild) — root nodes could mirror the clinic's actual departments: OPD, Laboratory, Pharmacy, Boarding, Swimming, HR/Admin. Each node shows MTD actual spend.

**Budget vs Actual table:** columns — Cost Center, Budgeted Amount, Actual Amount, Variance (₹ and %), Status (`Within budget` success, `Near limit` warning, `Over budget` destructive).

**Cost Center Allocation panel:** for transactions that span multiple departments, a simple % split editor (e.g. a shared electricity bill split 40% OPD / 30% Pharmacy / 30% Boarding) — small inline table with editable percentage inputs that must sum to 100%.

**Accounting Dimensions settings:** list of extra tags available for tagging transactions beyond Cost Center (e.g. `Project`, `Doctor`, `Referral Source`) — simple add/remove list, no need for complex logic in v1.

**KPI strip:** Total Budgeted (FY), Total Spent (FY), Cost Centers Over Budget (count, destructive if >0), Largest Variance Center (name + %).

---

## 5. Cross-Module Links (do not duplicate data, link instead)

| From Accounting Hub | Links to | Why |
| :--- | :--- | :--- |
| GL entries with Voucher Type = Sales Invoice | `/m/billing` | Billing already owns invoice records |
| GL entries with Voucher Type = Purchase Invoice | `/m/inventory` → Billing Sync tab | Inventory hub already owns purchase/GRN flow |
| Financial Reports tab (optional 7th tab, or a link-out card) | `/m/reports-finance` | Avoid rebuilding departmental margin analysis twice |
| Payroll-related ledger entries | `/m/payroll` | Payroll already computes gross/net/TDS |

If time allows, add a slim "Financial Reports" quick-links card at the bottom of Tab 18.1 (Financial Dashboard) with three buttons — "Profit & Loss", "Balance Sheet", "Departmental Margins" — that route to `/m/reports-finance` with the right query param, rather than building a 7th tab.

---

## 6. Data Model Additions

Add these as new `ErpRow`-style dynamic collections (same pattern as every other module — do not create bespoke Mongo schemas per tab):

- `accounting_chart_of_accounts` — `{ code, name, parentCode, accountType, isGroup, balance }`
- `accounting_journal_entries` — already exists as the current Accounting module's records; keep as-is, just re-surface inside Tab 18.2/18.3.
- `accounting_payment_entries` — `{ partyType, partyName, referenceInvoice, amount, modeOfPayment, bankAccount, referenceNo, date }`
- `accounting_bank_accounts` — `{ bankName, accountNumberMasked, accountType, linkedLedgerAccount, bookBalance }`
- `accounting_bank_reconciliations` — `{ bankAccountId, periodStart, periodEnd, matchedEntries[], difference, status, reconciledDate }`
- `accounting_tax_templates` — `{ name, appliesTo, rates[], isDefault, status }`
- `accounting_cost_centers` — `{ name, parentId, budgetAmount, actualAmount }`
- `accounting_dimensions` — `{ label }` (simple tag list)

All should plug into the existing **Offline-First Reactive State (`useErp`)** pattern already used everywhere else — no new state management library.

---

## 7. Explicit Instructions for Lovable

1. **Do not touch** any other module, route, or the Home Dashboard layout.
2. **Reuse, don't reinvent**: tab-shell component from Inventory Hub, KPI card component from Home Dashboard, dialog/drawer components already in the design system, bar-chart component already used across modules.
3. Keep the **role-based visibility** as-is: this module stays visible to `admin` and `accounts` roles only (not `reception`, not `platform`).
4. Update the **module registry / route matrix** entry for `/m/accounting` to note "6 Sub-tabs" (same way `/m/inventory` is annotated as "5 Sub-tabs") in whatever central config drives the sidebar and the `THEME_AND_MODULES.md` reference table.
5. All new numeric/currency values should render in ₹ with the same Indian numbering format (`₹21.6L`, `₹1,24,850`) already used elsewhere in the app — do not switch formats.
6. Ship Tab 18.1 (Financial Dashboard) and Tab 18.2 (Chart of Accounts & GL) first — these two alone make the module usable. Tabs 18.3–18.6 can follow as incremental PRs.
7. When in doubt about a visual pattern (spacing, badge shape, chart style, empty states), copy the closest existing equivalent already in the app rather than designing something new.
