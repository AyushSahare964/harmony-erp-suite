# Inventory Module — Detailed End-to-End Test Report

**Scope:** the full Inventory & Procurement module (`src/components/erp/inventory/`) across all 4 Product Master categories — **Medicine, Injection, Food, Accessory** — every place a created item has to be reachable elsewhere in the app (Stock View, Alerts, Sales Invoice, Quotation, Pharmacy Retail POS, the clinical Prescription workflow), plus item lifecycle (status toggle, delete), item-detail sub-tabs, and GST correctness through a finalized invoice.

**Suite:** `e2e/inventory-detailed.spec.ts` — **14 tests, 14/14 passing**, confirmed across two consecutive full clean runs, plus a combined regression run against `e2e/inventory.spec.ts` (3/3) and `e2e/clinical-prescription.spec.ts` (1/1) — **18/18 total**, all green together in one run.

**Method:** every test creates its own uniquely-suffixed item/patient/invoice through the real UI against the real MongoDB (no mocks) — nothing here is checked against seed/leftover data. Each category test fills **every field the wizard offers for that category**, saves, then **re-opens the item in edit mode and asserts the field is still there**. All tests run headed (visible browser) so failures could be watched and diagnosed live, not just read from a log.

---

## Errors found

All three are now **fixed and re-verified**.

### 1. A real save-time data-loss bug — root-caused, confirmed fixed

The Medicine test failed on the first run: every field was correctly filled in the wizard (confirmed with a debug screenshot right before submit), but re-opening the saved item in edit mode showed Composition, Route, Storage Condition, Drug Schedule, and Controlled Substance all reverted to blank — only Strength and Dosage Form survived.

**Root cause:** the dev server process had been running since *before* this session's Mongoose schema fix. Mongoose caches a model's compiled schema on `mongoose.models["InventoryItem"]`, and that cache lives in the Node process's memory — a Vite dev-server HMR reload of the model file does **not** clear it, only a full process restart does. So the running server kept writing to Mongo with the *old* schema shape, silently dropping any field not in it.

**Verified as the actual cause:** killed the stale dev-server processes, started one fresh, re-ran the same test — it passed immediately, every field round-tripping correctly.

**Fix applied:** no code defect to change (the schema itself was correct — only the cache was stale), so added a comment directly above the `InventoryItem` model export (`src/lib/mongodb/models/InventoryItem.ts`) documenting the restart requirement.

### 2. `clinical-prescription.spec.ts` — ambiguous button selector, unrelated to Inventory — fixed

```
strict mode violation: getByRole('button', { name: /anorexia/i }) resolved to 2 elements:
  1) "Add "Anorexia" as custom"
  2) "Anorexia / Loss of Appetite"
```

**Root cause:** the Clinical Findings picker only shows an "Add as custom" suggestion when the typed query has no *exact* match among canned options — correct, intentional behavior (confirmed by reading `PrescriptionWorkflow.tsx`). "Anorexia" has no exact match (the canned option is "Anorexia / Loss of Appetite"), so the picker correctly renders both buttons, and the test's loose regex matched both. A test bug, not a product bug.

**Fix applied:** tightened the selector to the exact canned-option text (`{ name: 'Anorexia / Loss of Appetite', exact: true }`), matching the pattern already used for "Vomiting" one line above it.

### 3. Stock Movements ledger never loaded from the server — found while adding GRN/ledger test coverage, confirmed fixed

Adding a real GRN batch to an Injection item and then checking the **Stock Movements** tab (subtitled "Authoritative Stock & Movements Ledger") showed **nothing** — the item's new batch never appeared.

**Root cause:** `useInventoryStore.ts`'s `InventoryProvider` fetches `medicines` from MongoDB on mount (`getItemsFn`), but `ledger` was only ever `useState<LedgerEntry[]>([])` — populated exclusively by local `setLedger((prev) => [entry, ...prev])` calls after actions taken *in the current browser session*. There was no call to the already-existing `getLedgerFn` server function anywhere. A fresh page load (or a different browser tab, or the next day) always started with an empty ledger regardless of real transaction history in the database — directly contradicting the page's own "Authoritative ... Ledger" subtitle.

**Fix applied:** added a `refetchLedger()` (mirroring the existing `refetchItems()` pattern) that calls `getLedgerFn({ data: { limit: 200 } })` on mount and hydrates `ledger` from real data, plus a `mapToLedgerEntry` mapper for type consistency with `mapToMedicine`/`mapToBatch`. Verified: added a real GRN batch to an Injection item, navigated away and back (full page reload), and the movement now correctly shows in Stock Movements.

*(Incidental, same file: fixed an unrelated pre-existing type error in the `useInventory()` no-provider fallback — `addMedicine`'s stub returned `Promise<void>` against a `Promise<Medicine>` signature. One-line fix, unblocked `tsc --noEmit`.)*

---

## What's covered

- **Medicine** — every Step-1 clinical field (Composition, Strength, Dosage Form, Route, Storage Condition, Drug Schedule, Controlled Substance) filled, saved, and confirmed present after reopening in edit mode.
- **Injection** (new category) — category tile renders and locks correctly in edit mode; every injection-specific field (Composition, Strength, Vial Size, Route, Injection Site, Withdrawal Period, Storage/Cold-Chain Condition, Drug Schedule, Controlled Substance) round-trips; item code issued from the dedicated `I-####` sequence; shows up in its own Injection Catalogue tab.
- **Food** — Target Species, Food Type, Life Stage, Flavour, Pack Size, Dietary Indication all round-trip.
- **Accessory** — Accessory Category, Pet Size, Material, Color all round-trip.
- **Stock View** — category filter dropdown includes "Injection" and actually filters the table to it.
- **Alerts Panel, twice over:**
  - the "Injections" filter pill renders and is clickable;
  - **filtering correctness** — a genuinely out-of-stock Injection item is visible under "ALL", disappears when filtered to "Medicines", and reappears under "Injections" — proves the filter narrows real data, not just changes which pill is highlighted.
- **Item lifecycle** — a throwaway Injection item's status toggle (Active → Inactive → Active) and Delete (confirms the native `window.confirm`, then asserts the row is gone) both work.
- **Item-detail sub-tabs** — Dashboard, Inventory, Variants, Accounting, Purchasing, Sales, Tax, Quality, and Manufacturing all render without crashing the page, for an Injection item specifically (previously only exercised generically for Medicine).
- **Stock Movements** — a real GRN batch recorded against an Injection item shows up in the ledger after a full page reload (the direct regression test for bug #3 above).
- **Pharmacy Retail POS** (`NewRetailSaleModal`) — the "Injection" category tab filters the live grid to show the item, and filtering to "Medicine" correctly hides it again.
- **Sales Invoice, GST correctness end-to-end** — selects the real Injection item from the live search dropdown (not typed free text, which would skip the real-item price/GST auto-fill), confirms the footer computes Sub Total ₹450.00 / GST ₹54.00 (12%) / Total ₹504.00 from the item's real stored rate, finalizes the invoice with **Save**, and confirms it's findable in the billing register afterward by its unique client name.
- **Sales Invoice / Quotation category reachability** — "Injections & Vaccines" appears as a real category tab in both, and the Sales Invoice item picker surfaces the created item under it.
- **Clinical visit — the highest-risk path** — registers a real patient, opens the consultation workspace, and searches the "Injectable / Vaccine Administration" section for the injection item by name. Confirms a **genuine result button** is returned (not the "no results" empty-state text, which also contains the query as a substring and would produce a false pass — caught and hardened against during test-writing), clicking it clears the search box (proving a real selection, not the empty-state paragraph), and the item appears in the section's list.

## Addendum: a data-state observation from an earlier pass (self-resolved)

An earlier regression run found the Purchasing-tab test failing because the `suppliers` collection was genuinely empty (verified by querying MongoDB directly) — traced to `scripts/purge-test-data.mjs`, a pre-existing cleanup utility that wipes all data including suppliers. Not a code bug, not fixed then. Confirmed resolved in this pass's regression run (`inventory.spec.ts` test 2/3 now passes) — a supplier exists in Accounting again.

## Not covered / out of scope

- **Cross-browser** — only Chromium (matches this repo's existing Playwright project config, which only defines a `chromium` project).
- **Quotation finalization with GST** — the Quotation category tab is proven reachable, but (unlike Sales Invoice) no quotation was actually finalized with an injection line to double-check its GST math independently.
- **Printed/PDF invoice output** — GST correctness is proven in the entry-form totals and the billing register total, but the actual print/PDF rendering path (`InvoicePrintView`, reached via "Save and Print" rather than plain "Save") wasn't exercised.
- **Partial payment / credit invoice paths** with an Injection line item — only the fully-paid path was exercised.
- **Multi-item invoices** mixing Injection with other categories in the same bill.
