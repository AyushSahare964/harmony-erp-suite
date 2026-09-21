# Billing Desk (`/m/billing`) — Test Report

**Scope:** `PatientBillingHub` and everything it renders — `BillingDeskDashboard` (Quick Info, quick-action buttons, activity tabs, register tabs, search panel, invoice register), `NewSalesInvoiceModal`, `QuotationModal`, `InvoiceDetailModal`, `PaymentInModal`.

**Suite:** `e2e/billing-invoicing.spec.ts` — 35 tests, **35/35 passing** after fixes below.

**Method:** every selector used in the suite was verified against the actual component source before being written (placeholders, button titles, accessible names) — not guessed. The previous version of this file guessed several, which silently broke whole tests. See "Dead tests fixed" below.

---

## Bugs found in the app (fixed)

### 1. Every new Quotation started pre-loaded with a fake ₹380 line item
`QuotationModal.tsx` initialized its item list with hardcoded seed data instead of an empty array:

```ts
const [items, setItems] = useState<QuotationItem[]>([
  { name: "Marvel Animal Food", quantity: 1, rate: 400, discountPercent: 5, lineTotal: 380, ... }
]);
```

Every quotation a staff member created — real client, real estimate — silently included this phantom line unless someone noticed it in the table and deleted it manually. A quotation for two real items summed to the two real amounts **plus 380**, with no indication anything was wrong short of eyeballing the line-item table.

**Fix:** `useState<QuotationItem[]>([])`.

### 2. The manual line-entry Discount field defaulted to 5%, not 0%
Same file:

```ts
const [discountPercent, setDiscountPercent] = useState<number>(5);
```

The first item added to any quotation via the manual entry row got a silent, unrequested 5% discount unless the user noticed the Discount field showing "5" and cleared it. (Confirmed live: a 2×₹300 line landed at ₹570, not ₹600.) Subsequent lines were fine, because the field resets to 0 after each add — only the *first* line in a fresh quotation was affected.

**Fix:** `useState<number>(0)`.

### 3. "Bill of Supply" invoices still charged GST
`NewSalesInvoiceModal.tsx` computes document totals via the shared tax engine, which correctly treats `"BILL_OF_SUPPLY"` as untaxed — but the modal collapsed anything that wasn't `"NON_GST"` into `"GST"` before handing it to the engine:

```ts
invoiceType: invoiceType === "NON_GST" ? "NON_GST" : "GST",   // "BILL_OF_SUPPLY" → "GST"
gstRate: invoiceType === "NON_GST" ? 0 : l.gstRate,           // never zeroed for Bill of Supply
```

Selecting **Invoice Type → Bill of Supply** had no effect on the amount charged — the invoice still computed and charged full GST, both live in the modal and in what got saved. Bill of Supply exists specifically for GST-exempt/composition-scheme sales; this is a real compliance-relevant miscalculation, not cosmetic.

**Fix:** pass the invoice type straight through (`taxInvoiceType = invoiceType`), and zero each line's `gstRate` whenever `taxInvoiceType !== "GST"` — both in the live totals calculation and in the payload persisted on save.

---

## Dead / no-op tests in the previous suite (now fixed or replaced)

These didn't fail — they silently tested nothing, because their selectors never matched real DOM, so they fell through to a fallback branch that always passed:

| Old assertion | Why it was dead | Fix |
|---|---|---|
| `getByPlaceholder(/amount paid\|enter amount\|payment/i)` for the partial-payment input | Real placeholder is `"0.00"` — never matched, so the whole partial-payment test silently skipped to checking the un-discounted total instead | Use the real placeholder; also properly exercise Full Payment / Partial / Credit-Unpaid toggles as three separate tests |
| `getByRole('button', { name: /^add$/i })` for the Quotation's line-add button | The button is icon-only; its accessible name is the full `title` attribute, `"Add line item to quotation"` — never equals `"add"` | `getByTitle('Add line item to quotation')` |
| `getByText(new RegExp(EXPECTED_TOTAL.toString()))` for invoice totals ≥ ₹1,000 | The footer formats with `toLocaleString('en-IN')`, e.g. `"1,500.00"` — a plain-number regex like `1500` never matches text containing a comma | Match the fully formatted string, and separately match the register's own format (`"₹ 3,000"`, no decimals — different formatting function from the modal) |
| `getByRole('button', { name: 'Amount Received' })` (exact) for the activity tab | The button's badge count renders inside the same element, so the accessible name is always `"Amount Received <n>"`, never the bare label | `getByRole('button', { name: /^Amount Received/ })` |

---

## What's covered now

- **Page load / static UI** — Quick Info KPIs (with a NaN/undefined guard), all 6 quick-action buttons, all 4 activity tabs (including the always-badged "Amount Received" tab), the 30-day distribution chart, all 4 register tabs, and all 4 search-scope radios.
- **New Invoice — Non-GST math** — single line, multi-line sum, discount-% arithmetic, and line removal, each checked against a hand-computed expected total.
- **New Invoice — GST math** — GST invoice (subtotal + 18% = total, checked exactly) and Bill of Supply (now genuinely zero tax, per the fix above).
- **New Invoice — partial payment** — typing an amount below the total, the Full Payment toggle, and the Credit/Unpaid toggle, each checked against `Balance Due = Total − Paid`.
- **Persistence** — invoice saved, page reloaded, register shows the client and the correct total in the register's own money format.
- **New Quotation** — multi-line total arithmetic (now correct, post seed-data fix) and register persistence after reload.
- **Collect Payment modal** — opens and dismisses.
- **Invoice register** — expected columns present, search narrows to zero on a nonsense query, Status filter narrows correctly, and clicking a row opens the Invoice Detail modal with the total shown matching what was actually saved.
- **Shipping & packaging cost** — checking "Add Shipping and Packaging Costs" and entering a cost correctly adds it on top of the line subtotal (`TOTAL AMOUNT = subtotal + shipping`).
- **Inter-state GST** — switching Place of Supply away from the branch's own state (Maharashtra → Delhi, triggering the CGST+SGST→IGST split inside the tax engine) still charges the same correct 18% total. The UI never shows the CGST/SGST/IGST breakdown itself, only the combined `GST:` figure, so this is the meaningful thing to verify from the outside: the intra/inter-state split doesn't silently drop or double-count tax.
- **Add Purchase** (`SupplierBillFormModal`) — including its nested "+ Add New Supplier" shortcut: creates a supplier inline, confirms it auto-selects back in the purchase bill, adds a line item, and saves.
- **Add Expense** (`ExpenseFormModal`) — minimal expense with auto-selected category, saves and shows the voucher-number toast.
- **Add Client** (`OwnerPetRegistrationModal`, launched from the Billing Desk quick-action) — registers an owner + one pet.
- **Add Supplier** (`NewSupplierModal`) — standalone quick-action, saves with just Company Name + Mobile No.
- **Add Reminder** (`BillingReminderModal`) — schedules a reminder, confirms it appears in the Active Reminders list, and confirms it survives a full page reload against the real database (see finding #4 below).
- **Header Notification Bell** (`Shell.tsx`) — a newly created reminder shows up in the bell's badge and dropdown after reload, and "Mark settled" from the dropdown resolves it without opening the full modal.

### 4. Reminders weren't persisted, and the header notification bell was entirely fake (fixed)

`BillingReminderModal`'s "Save Reminder" only ever called `setReminders(prev => [...])`, backed by `localStorage` — never the database. It survived a reload on the *same browser*, but was invisible to any other staff member's terminal, and there was no shared record of what's due. Separately, the header notification bell (`Shell.tsx`, present on every single page in the app) was a static `<Bell>` icon with a literal, hardcoded `5` badge — no click handler, no data, no function of any kind.

**Fix — real, shared persistence:**
- New model `BillingReminder` (`src/lib/mongodb/models/BillingReminder.ts`) and serverFns (`src/lib/mongodb/serverFns/reminders.ts`): `listRemindersFn`, `createReminderFn`, `settleReminderFn`, `snoozeReminderFn`, `deleteReminderFn`.
- `BillingReminderModal.tsx` now fetches/creates/updates through these instead of `localStorage` — a reminder scheduled by one staff member is now visible to every other terminal in the clinic.

**Fix — a real notification center in the header:**
- `Shell.tsx`'s bell now fetches pending reminders on mount and every 60s, shows the **real** pending count (hidden entirely when there are none — no more permanent fake "5"), and turns red specifically when something is overdue (amber otherwise).
- Clicking it opens a real dropdown listing the pending reminders (pet/owner/amount/type, overdue ones flagged), each with an inline **"Mark settled"** action that resolves it without leaving the current page, plus a "View all in Billing Desk" link.

Verified: a reminder created from the Billing Desk shows up in the header bell after a reload (proving the badge is real data, not decoration), and "Mark settled" from the header dropdown removes it immediately.

## Validation edge cases for Add Expense / Add Supplier / Add Purchase

Covered separately in `e2e/accounting.spec.ts` (11 new tests, all passing), launched from these forms' natural home — the Accounting module's Expenses and Supplier Bills tabs — rather than re-testing the same shared components a second time via the Billing Desk:

- **Add Expense**: blank/zero Amount, blank Paid To, blank Paid By (the field is pre-filled with a default name — cleared explicitly to prove the guard fires), and a full valid save.
- **Add Supplier**: blank Company Name, a Company Name with neither Mobile No. nor Phone No. filled, and confirmation that Phone No. alone (without Mobile No.) is accepted as a valid contact — the code accepts either.
- **Add Purchase (Supplier Bill)**: blank Product Name on "Add Line", zero Quantity on "Add Line", blank Purchase Bill No. on Save (auto-filled by default — cleared explicitly), and Save attempted with zero line items.

**Two error paths are intentionally not exercised** — not an oversight: `ExpenseFormModal`'s "Please select an Expense Type." and `SupplierBillFormModal`'s "Please select a Supplier Name." both guard a `<Select>` that auto-picks the first available row the instant its list loads. In this seeded environment at least one category/supplier already exists by the time a user could click Save, so that branch is unreachable from the UI — it would only ever fire against a genuinely empty install.

**Bonus finding while writing these:** `SupplierBillFormModal`'s Quantity field renders as `value={quantity || ""}`, so typing `0` makes the field visually blank the instant it's typed (0 is falsy) — even though the underlying React state correctly holds `0` and the "Quantity must be greater than 0" validation still fires correctly. Cosmetic, not a functional bug (the numbers are right, the field just looks empty instead of showing "0" for a beat), but worth a follow-up polish pass — this same `value={x || ""}` pattern shows up on the equivalent Quantity fields in `NewSalesInvoiceModal.tsx` and `QuotationModal.tsx` too.

## Not covered (still out of scope)

- Deeper edge-case validation for `Add Client` (`OwnerPetRegistrationModal`) — already covered in `e2e/crm-registration.spec.ts`, which belongs to the CRM module.
