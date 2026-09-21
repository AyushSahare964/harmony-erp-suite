# E2E Test Plan: Full-System Regression & Bug-Discovery Suite (Harmony ERP / VetOS)

## Context

Goal: walk the whole system end-to-end — login through registration, clinical consultation/prescription, laboratory, billing/invoicing/printing, accounting, inventory, and more — with real UX-level detail (actual medicine names, lab checks, invoice printing), and produce a **detailed report of what's actually broken**: sections that don't work, actions that show "saved" but didn't persist.

Foundation already in place: Playwright is installed and configured (`playwright.config.ts`), browsers are downloaded, 4 pre-existing specs exist under `e2e/`, and `e2e/makarand-full-workflow.spec.ts` (login → register patient → prescribe → bill) is passing.

Three research passes mapped the entire codebase: every route/module and its files, every PRD/spec doc's intended scope vs. documented known-issues, and a deep dive into laboratory/inventory/accounting/printing specifically. That research surfaced **concrete suspected defects**, not just guesses — these become the highest-value test cases because they turn "exhaustive testing" into "confirms real bugs" rather than a generic smoke suite:

- **Lab results don't persist.** `EnterLabResultsModal.handleSave` never calls `updateLabResultsFn` — results only live in React state for that session; a reload loses them.
- **Stock additions don't persist to the item record.** `addStockFn` (GRN "Add Stock") writes a `StockBatch` + ledger row but never updates `InventoryItem.currentStock` server-side. The UI shows the new stock optimistically; it disappears on reload. (`adjustStockFn` has the same gap.)
- **Item Purchasing tab is fully mocked.** Hardcoded supplier list, hardcoded "last purchase price", no save button, no server call at all.
- **Quotations can silently fail to save.** `QuotationModal.handleSave` catches a failed `createQuotationFn` call, logs it, and still shows a "successfully saved!" toast (it always writes to `localStorage` regardless of the Mongo result).
- **Two "print" buttons don't actually print a document.** `NewSalesInvoiceModal` and `QuotationModal`'s "Save and Print" call raw `window.print()` on the live unstyled form (no print CSS found), unlike the proper `InvoicePrintView`/`PrescriptionPrintView`/`LabReportPrintModal`, which render a formatted document first.
- **No role-based URL gating.** The sidebar hides module links a role shouldn't see, but nothing stops a logged-in user from navigating directly to any `/m/<moduleId>` URL regardless of role.
- **Several fully-built components are dead code**, unreachable from the router: `BillingHub.tsx` (+ `ManualBilling`, `PaymentAnalytics`, `SubscriptionBilling`, `RazorpayGateway` — none wired to real data anyway), and `PharmacyRetailHub.tsx` (a real POS UI) — `/m/pharmacy` silently falls back to a generic table instead of rendering it.
- **`BudgetingCostCenters.tsx`** ("Set Cost Center Budget") may not be wired into `AccountingHub`'s tab bar at all — needs direct on-screen confirmation.
- **`IdentityAccessHub`** has a "Reset to Defaults" button that wipes all staff data back to 2 seed accounts — must never be exercised by automation.

## Environment & Data Safety — confirmed

`.env` shows **one** MongoDB Atlas cluster (`cluster0.d5k2cce.mongodb.net/vetos_erp`) used both by local dev (`npm run dev`) and by the live Vercel deployment that `playwright.config.ts` defaults to. There is no separate test database — local and "production" are the same Mongo data.

- The suite runs against `localhost:8080` (`npm run test:e2e:local`) rather than the live Vercel URL, so we're not driving the deployed app under test — but this does **not** avoid writing to the shared database, since both environments use the same cluster.
- Every test that creates data (owners, pets, invoices, journal entries, suppliers, lab orders, expenses) uses timestamp-suffixed names, matching the existing convention (`Bruno-${Date.now()...}`), so records stay identifiable and collision-free — but nothing gets auto-deleted afterward; there's no teardown mechanism for app-level Mongo records here.
- The "Reset to Defaults" button is explicitly excluded from all automated tests.
- **Decision: proceed as-is against the shared `vetos_erp` database.** Test records stay permanently but are timestamp-labeled and identifiable if cleanup is ever wanted later.

## Testing Philosophy

Tests assert the **correct/expected** behavior (e.g. "lab results survive a reload," "GRN stock updates `currentStock`"), not whatever the current behavior happens to be. That way a broken feature shows up as a **failing test with a clear message**, and the Playwright HTML report becomes the bug list — not a suite that's been quietly written to pass around known bugs.

The single most valuable pattern here, used everywhere a "does it save?" question applies: perform the action → **reload the page** (or reopen the record from its list) → assert the data is still there. That's exactly the technique needed to catch the lab-results and GRN-stock bugs already found, and any others like them.

Reuse existing conventions from `e2e/makarand-full-workflow.spec.ts` and the other current specs: `test.describe.serial` per flow, `test.setTimeout()` for long flows, timestamp-suffixed test data, and locators scoped to the open dialog (`div[role="dialog"][data-state="open"]`) to avoid strict-mode collisions (already hit once: two "Sign In" buttons on the login page).

## Suite Structure

New files under `e2e/`, one per module area, plus a shared login helper:

- **`e2e/support/auth-helpers.ts`** — `loginAsAdmin(page)` (Dr. Makarand Dixit, `makarand.dixit@gmail.com` / `12345678`), reused by every spec. Plus `registerAndApproveRole(page, roleId)` — runs register → admin approves → login-as-new-user once, for specs that need a real doctor/reception/accounts session instead of admin (admin can reach everything given the no-role-gating finding, so most specs can just use it directly).

- **`e2e/identity-roles.spec.ts`** — registration for each of the 5 role options → pending-approval screen → admin Approve/Reject → new user can log in; Add Employee flow; staff directory search. Explicitly skips "Reset to Defaults."

- **`e2e/crm-registration.spec.ts`** — deep patient/owner registration with the *full* field set (species, gender, weight, DOB, color, microchip, sterilization status, blood group, allergies via the Yes/No toggle + category badges) — not just name+breed like the current smoke test. Multi-pet-per-owner via "Add Another Pet," search-existing-owner path.

- **`e2e/appointments.spec.ts`** — book, edit, delete an appointment; admit-to-OPD from an appointment; follow-up-due widget.

- **`e2e/clinical-prescription.spec.ts`** (expands `receptionist-to-doctor-flow.spec.ts`) — walks all 10 Rx sections with real data: previous history, symptoms, clinical findings chip picker, immediate meds + prescribed take-home meds + injectables (with dosage/frequency/route), consultation fee, follow-up reminders (assert a real appointment gets created — confirmed wired per research), lab test order, animal food, prescribed diet, accessories. Reloads mid-consultation to confirm section-level auto-save persisted. Exercises "Clone Previous"/"Copy Previous Rx" from an earlier visit.

- **`e2e/laboratory.spec.ts`** — orders a lab test in-consultation AND via the standalone `CreateLabOrderModal`, confirms both surface in `LaboratoryHub`'s queue (the two-entry-point consistency question flagged in research). Enters results in `EnterLabResultsModal`, reloads, asserts persistence — **expected to fail**, documenting the found gap. Prints a report via `LabReportPrintModal`.

- **`e2e/billing-invoicing.spec.ts`** — New Invoice, New Quotation (verified via reload/re-query, not the toast, given the found silent-failure bug), Record Payment (full and partial, plus the validation error messages for negative/over/empty amounts), invoice detail + delete, Daily Cash Summary, Stock Valuation Summary.

- **`e2e/accounting.spec.ts`** (expands the existing one) — New GL Account, Journal Voucher (asserts an unbalanced debit≠credit entry is rejected), Receivables/Payables payment entry, Supplier Bill → Payment Out → Supplier Ledger drill-down consistency, Add Expense (asserts it shows up in the Financial Dashboard KPI afterward), New Supplier, GST tax template, and a direct check of whether "Budgeting & Cost Centers" is reachable as a tab at all.

- **`e2e/inventory.spec.ts`** — create an item, GRN "Add Stock" → reload → assert `currentStock` reflects it — **expected to fail**, documenting the found gap. Low-stock/out-of-stock alert thresholds in both `AlertsPanel` and the Admin dashboard KPI tiles (two independent computations per research — test both). Stock decrement when a medicine is prescribed in consultation (this path IS confirmed persisted server-side — should pass). Item Purchasing tab — asserts it's non-functional rather than pretending it has a save flow.

- **`e2e/printing.spec.ts`** — every "Download PDF"/"Print ..." button, using `page.waitForEvent('popup')` for the ones that go through the shared `pdfExport.ts` helper (Rx Print Preview, Invoice print, Financial Statements print, Supplier Ledger print), and a plain `window.print()`/print-media check for `LabReportPrintModal` (different mechanism, no popup). Also asserts the known gap: "Save and Print" in `NewSalesInvoiceModal`/`QuotationModal` does not open a formatted document.

- **`e2e/route-access.spec.ts`** — logs in as a low-privilege role (via the helper) and navigates directly to `/m/accounting`, `/m/identity`, `/m/inventory`, etc., documenting the current (open) behavior found in research as a flagged finding rather than silently skipping it.

- **`e2e/dead-routes.spec.ts`** — small regression guard asserting `/m/pharmacy` renders the generic fallback table, not `PharmacyRetailHub`. If someone later wires up the real POS hub, this test starts failing and flags that the assumption changed.

## Reporting

No new tooling needed — `playwright.config.ts` already has `html` + `list` reporters, and failure output already includes expected-vs-actual, a screenshot, and a video (`screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`). Since each spec file maps to one module, `npm run test:e2e:report`'s HTML report already gives a file-by-file (= module-by-module) breakdown of what's broken and why.

If a single human-readable summary is wanted after a run, a small follow-up script over the JSON reporter output could produce a one-line-per-test markdown table — add only if the HTML report turns out to not be enough.

## Sequencing

Given the size (~10 new spec files), build in this order so we get signal early and can correct selector/flow assumptions before doing the rest:

1. `crm-registration.spec.ts` + `appointments.spec.ts` (foundation data other specs will reuse)
2. `clinical-prescription.spec.ts` (expand the existing flow to all 10 sections)
3. `laboratory.spec.ts`, `inventory.spec.ts` (the two with concrete suspected persistence bugs — highest value)
4. `billing-invoicing.spec.ts`, `accounting.spec.ts`
5. `identity-roles.spec.ts`, `route-access.spec.ts`, `dead-routes.spec.ts`
6. `printing.spec.ts` last (cuts across everything above)

## Verification

- After writing each spec: `npx playwright test --list` to confirm it's discovered with no syntax errors.
- Run each new spec individually, headed, first: `npx playwright test e2e/<file> --headed` — to visually confirm selectors match the real UI before trusting its pass/fail result (this caught two selector mistakes in the existing `makarand-full-workflow.spec.ts` already).
- Full suite: `npm run test:e2e:local` against the local dev server; review results with `npm run test:e2e:report`.
