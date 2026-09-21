# E2E Test Report — Harmony ERP / VetOS

Full-system Playwright test run against the local dev server (`localhost:8080`), covering login through registration, clinical consultation/prescription, laboratory, billing/invoicing/printing, accounting, inventory, and identity/roles. Plan: [E2E_TEST_PLAN.md](E2E_TEST_PLAN.md).

## Status: 30/30 passing

Testing found 4 real bugs (2 already known from code review, 2 more surfaced only by actually running the stress-test flows). All 4 are now fixed and verified — the full suite ran clean, twice, back to back, including 3 dedicated reliability re-runs of the flow that exposed the trickiest one.

Run it yourself: `npm run test:e2e:local` (local dev server) or `npm run test:e2e` (live deployment). `npm run test:e2e:report` gives the interactive HTML view with screenshots/video per test.

---

## Bugs found and fixed

### 1. GRN "Add Stock" silently failed to create the batch at all
**Found via:** `e2e/inventory.spec.ts`
**Root cause:** `StockBatchInputZ` (the Zod validator for `addStockFn`, `src/lib/mongodb/serverFns/inventory.ts`) never declared an `itemId` field. Zod silently strips unrecognized keys, so even though the client sent `itemId`, `StockBatch.create()` received `itemId: undefined` and threw a Mongoose validation error on every single attempt — the batch document was never created, not just under-counted.
**Also found:** even once creation worked, `addStockFn`/`adjustStockFn` updated `StockBatch`/ledger records but never `InventoryItem.currentStock`, so stock still wouldn't show as received.
**Fix:** added `itemId` to the validator; both functions now `$inc` `InventoryItem.currentStock` on success.

### 2. Lab results never persisted
**Found via:** `e2e/laboratory.spec.ts`
**Root cause:** `EnterLabResultsModal.tsx`'s save handler only updated local React state — it never called `updateLabResultsFn` (defined, imported, never invoked).
**Fix:** wired it up, including the status transition to `"Reported"` so the row correctly switches from "Enter Results" to "View Report" afterward.

### 3. Billing lines duplicated once multiple prescription sections were used together
**Found via:** stress-testing `e2e/clinical-prescription.spec.ts` (all 10 Rx sections in one visit) — not something the lighter tests exercised enough to hit.
**Root cause, two compounding bugs:**
- A save-concurrency race: "Proceed to Billing" fired every dirty section's auto-save at once via `Promise.allSettled`, but each save reads a shared `version` counter for optimistic locking *before* awaiting its own network call — so concurrent saves all read the same stale version, and every one but the first was rejected by the server (`"No matching document found for id ... version N"`), silently dropping data.
- Once that was fixed and saves reliably completed, a second bug surfaced: `PrescriptionLineZ` (the validator for the *other*, wholesale-save path, `savePrescriptionFn`) didn't declare `sourceType`/`rxSection` — Zod stripped them, so the section-by-section save's de-dup filter (which matches on exactly those fields) could never find and replace the wholesale-saved copies, and new saves just piled up on top instead.
**Fix:** made the background section saves run sequentially instead of concurrently (each one now sees the version the previous one just wrote), and added the missing fields to `PrescriptionLineZ` so both save paths tag items consistently.

### 4. Finalize could act on a visit that hadn't finished saving
**Found via:** the same stress test, after fixing #3 — clicking Finalize immediately after Proceed to Billing could still race ahead of the now-sequential (and therefore slightly slower) background saves.
**Fix:** `PrescriptionWorkflow` now reports when its background save queue is running; `VisitWorkspaceModal` disables the Finalize button and shows "Syncing prescription…" until it's done, rather than relying on timing. Confirmed with 3 consecutive clean runs at full speed after the fix (previously intermittent even under load).

---

## Other real findings (from code review, not all independently reproduced as failing tests)

| # | Finding | Where |
|---|---|---|
| A | `allowCustomAdd={false}` was a no-op — stock-bound sections (Immediate Medication, Injectables) silently accepted typed-in items exactly like unrestricted ones. **Fixed**: now correctly gated. | `CatalogueSearch.tsx` |
| B | No role-based URL gating — sidebar hides links a role shouldn't see, but the route itself doesn't check. Confirmed live, not yet fixed (pending Phase B). | `m.$moduleId.tsx`, `Shell.tsx` |
| C | `/m/pharmacy` doesn't render the real POS (`PharmacyRetailHub.tsx` exists, fully built, just unrouted). Also dead: `BillingHub.tsx` + children. Not yet fixed (pending Phase B/C). | `m.$moduleId.tsx` |
| D | Item "Purchasing" tab is fully static (hardcoded suppliers, fake pricing, no save action). Not yet fixed (pending Phase B). | `ItemPurchasing.tsx` |
| E | Quotation save error-swallowing — `QuotationModal.handleSave` showed a success toast even if the server save failed. **Fixed**: now only reports success on an actual successful save. | `QuotationModal.tsx` |
| F | "Save and Print" on Invoice/Quotation calls raw `window.print()` on the live form instead of a formatted document. Not yet fixed (pending Phase B). | `NewSalesInvoiceModal.tsx`, `QuotationModal.tsx` |
| G | Two independent, slightly-inconsistent low-stock/expiry computations (one silently excluded already-expired items from "expiring soon"). **Fixed**: unified into one shared helper, `src/lib/inventory/stockStatus.ts`. | `AlertsPanel.tsx`, `AdminDashboardView.tsx` |
| H | `BudgetingCostCenters.tsx` wasn't wired into any tab bar. **Fixed**: added as a tab in `AccountingHub`. | `AccountingHub.tsx` |

---

## Legacy test files — retrofitted, all passing

5 pre-existing spec files failed against local dev for three reasons unrelated to app bugs: an SSR hydration race (fixed dev-server-only timing helpers didn't exist yet when they were written), stale "VetOS ERP" branding assertions (actual branding is "Real Care Clinic"), and missing login calls. All 5 (`auth.spec.ts`, `dashboard-navigation.spec.ts`, `makarand-full-workflow.spec.ts`, `accounting.spec.ts`, `receptionist-to-doctor-flow.spec.ts`) are retrofitted and passing.

---

## What's confirmed working end-to-end (all 30 tests)

Login, full-detail patient/owner CRM registration, appointments (book/edit/admit/delete), the complete 10-section clinical consultation & prescription flow (with real cross-reload persistence verification), dual-entry-point lab ordering plus now-working result entry, 5-step inventory item creation plus now-working stock receiving, invoice and quotation creation with genuine server persistence, identity registration/approval/rejection, the (still-open) role-access gap, the (still-dead) pharmacy route, and real PDF-popup printing alongside the documented "Save and Print" gap.

---

## Suite Map

| File | Result |
|---|---|
| `e2e/crm-registration.spec.ts` | 3/3 pass |
| `e2e/appointments.spec.ts` | 4/4 pass |
| `e2e/clinical-prescription.spec.ts` | 1/1 pass (3 consecutive confirmations after fix #3/#4) |
| `e2e/laboratory.spec.ts` | 3/3 pass |
| `e2e/inventory.spec.ts` | 3/3 pass |
| `e2e/billing-invoicing.spec.ts` | 2/2 pass |
| `e2e/identity-roles.spec.ts` | 2/2 pass |
| `e2e/route-access.spec.ts` | 1/1 pass (documents finding B, still open) |
| `e2e/dead-routes.spec.ts` | 1/1 pass (documents finding C, still open) |
| `e2e/printing.spec.ts` | 2/2 pass (documents finding F, still open) |
| `e2e/accounting.spec.ts` | 1/1 pass |
| `e2e/auth.spec.ts` | 2/2 pass |
| `e2e/dashboard-navigation.spec.ts` | 2/2 pass |
| `e2e/makarand-full-workflow.spec.ts` | 1/1 pass |
| `e2e/receptionist-to-doctor-flow.spec.ts` | 2/2 pass |

**Total: 30/30**

## Still open (approved plan, Phase B/C — not started)

- Role-based route enforcement (finding B)
- Wire up Pharmacy POS route (finding C)
- Make Purchasing tab real (finding D)
- Fix "Save and Print" to produce a formatted document (finding F)
- Make `BillingHub`'s dead children (`ManualBilling`, `PaymentAnalytics`, `SubscriptionBilling`, `RazorpayGateway`) production-ready — see [the plan file] for the Razorpay-credentials caveat
