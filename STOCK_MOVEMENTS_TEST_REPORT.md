# Stock Movements — Test Report

**Scope:** `StockMovements` (`src/components/erp/inventory/StockMovements.tsx`, the "Stock Movements" tab at `/m/inventory`) — its three parts: **Add Stock** (Purchase / Goods Inward), **Stock Adjustment / Write-Off** (Outward), and the **Auditable Inventory Transaction Ledger** underneath both.

**Suite:** `e2e/stock-movements.spec.ts` — dedicated, standalone from the general inventory suite — **7 tests, 7/7 passing**, confirmed across two consecutive full clean runs, plus a combined regression run with `e2e/inventory-detailed.spec.ts` and `e2e/inventory.spec.ts` (23/24 — the one failure is the same pre-existing, unrelated supplier data-state issue documented in `INVENTORY_TEST_REPORT.md`, not caused by anything here).

**Method:** every test drives the real UI against the real MongoDB — no mocks. Tests run headed (visible browser) throughout, and every failure below was chased down with real evidence (debug screenshots, dev-server logs) before being called a bug, not guessed at.

---

## Bugs found and fixed

Four real bugs, all now fixed and verified. The first three compounded: fixing one just exposed the next one underneath, since each masked the one below it (a silently-swallowed error hid the "always fails" batch bug, which hid the "batches were never loaded" bug, which hid the actual server-side query bug).

### 1. "Stock Adjustment" never surfaced errors — a failed deduction still showed "success"

`RemoveStockPanel`'s submit handler called `removeStock(...)` without `await` and without a try/catch. If the server call failed, the rejection went nowhere (an unhandled promise rejection, invisible in the UI), while the code unconditionally showed a success toast and reset the form — so a user had no way to know a deduction had actually failed.

**Fix:** made `submit` `async`, awaited `removeStock(...)` inside a `try/catch`, added a `submitting` state that disables both buttons mid-request, and a real error toast on failure. *(This part was already fixed by the time this pass started — confirmed correct, documented for completeness.)*

### 2. "Auto-FIFO deduction" — advertised in the UI, never actually worked

Once errors were surfaced correctly (bug #1), they immediately revealed this: leaving "Specific Batch" on its placeholder ("Auto-FIFO deduction or select batch") — the feature's own advertised default behavior — sent an empty/placeholder batch id to the server on every single attempt. The server has no "pick a batch for me" mode; it always requires one specific real batch. So auto-FIFO deduction failed **100% of the time** it was used, either silently (before fix #1) or with a visible-but-unhelpful "Batch not found" error (after fix #1, before this fix).

**Fix:** when no specific batch is chosen, the client now picks the earliest-expiring batch that alone has enough quantity to cover the request (mirroring the same FIFO pattern already used elsewhere in this codebase for `recordSale`). If no single batch can cover it, a clear, specific error explains why (see bug scenario in test 5 below) instead of a generic failure.

### 3. The batch list was empty on every fresh page load — so "Specific Batch" had nothing to pick from

Chasing bug #2's fix, a deeper cause turned up: the store's `batches` array is only ever populated on demand (e.g., by opening an item's detail view) — nothing fetches it when a user simply selects an item in the Stock Movements dropdowns. On a fresh page load, `getBatches(itemCode)` returns `[]` for *every* item, so "Specific Batch (Optional)" never rendered any options at all, and the auto-FIFO fallback (#2) would have wrongly concluded "this item has no batches" even for items with real stock.

**Fix:** `RemoveStockPanel` now calls the store's `refetchBatches(itemCode)` when an item is selected (populating the UI's batch dropdown), and — since a page-load timing race could still beat that fetch — `submit()` also does its own fresh `refetchBatches(itemCode)` immediately before deciding the auto-FIFO batch, using the returned data directly rather than a component-state value that might not have updated yet. `refetchBatches` was changed to return the batches it just fetched (previously `Promise<void>`) specifically to make this safe.

### 4. The real root cause, one layer deeper: a server-side query that always throws for real data

With batches now loading and a real batch id being sent, deductions *still* failed — this time with a visible, specific error: **"Cast to ObjectId failed for value 'B-0013' ... at path '_id' for model 'StockBatch'"**.

**Root cause:** `adjustStockFn` (`src/lib/mongodb/serverFns/inventory.ts`) looked up the batch with `StockBatch.findOne({ $or: [{ batchCode: data.batchId }, { _id: data.batchId }] })` — intended to accept either identifier. But Mongoose validates and casts *every* branch of an `$or` against the schema before running the query, and `batchCode` values (e.g. `"B-0013"`) are never valid 24-hex-character ObjectIds — so the `_id` branch throws a `CastError` that aborts the *entire* query, even though the `batchCode` branch alone would have matched correctly. Since every real caller in this codebase only ever has a `batchCode` (that's what `Batch.id` is everywhere on the client), this `$or` didn't add real flexibility — it just broke the common case outright.

**Fix:** query by `batchCode` alone, matching the identifier actually used throughout the rest of the codebase.

---

## What's covered

- **Add Stock (Purchase / Goods Inward)** — a real purchase increases the item's authoritative stock (verified via the product dropdown's own live "N in stock" count, not just a toast) and posts a `PURCHASE IN` entry to the ledger with the right batch number.
- **Stock Adjustment — explicit batch chosen** — deducting from a specifically-selected batch succeeds, decrements the authoritative balance by the right amount, and posts a `DAMAGE WRITEOFF` entry.
- **Stock Adjustment — Auto-FIFO (the core bug)** — leaving "Specific Batch" untouched now genuinely succeeds (bugs #2–#4 above), confirmed by both the absence of any error toast *and* the authoritative balance actually decrementing by the requested amount.
- **Stock Adjustment — insufficient single batch** — an item with two separate small batches (5 + 5 = 10 total) correctly rejects a request for 8 units with a specific, actionable error ("No single batch has 8 ... available — pick a specific batch with enough stock, or reduce the quantity") rather than crashing or silently under-deducting; the balance is confirmed unchanged afterward.
- **Ledger filtering** — "Purchases In" and "Manual Adjustments" each genuinely narrow the table to just that movement type (proven by checking the *absence* of the other type under each filter, not just presence of the expected one), and "All Movements" restores the full list.
- **Ledger persistence across a full page reload** — the direct regression test for the earlier `refetchLedger()` fix (documented in `INVENTORY_TEST_REPORT.md`): a purchase entry for this run's item+batch is still there after a real `page.reload()`.

## Bugs caught in the test itself while building this (test-authoring notes, not product bugs)

- A locator for the ledger's type-filter dropdown was scoped by its *current displayed text* (`hasText: 'All Movements'`) — which stopped matching the moment the filter's own selection changed its displayed value. Fixed by locating it structurally (relative to the "Auditable Inventory Transaction Ledger" heading) instead.
- Unscoped `page.getByText('PURCHASE IN')` checks were at risk of matching the **Add Stock panel's own static description** ("...records purchase in ledger" — genuinely contains that substring) instead of a real ledger table row, since that copy renders *before* the table in document order and `.first()` would have silently picked it. Every such check is now scoped to the `<table>` element, and where possible to a specific row (matched by this run's unique item name **and** batch number together, since the ledger accumulates across every past run of this suite and a single item can have several different-typed rows by the time later tests run).

## Not covered / out of scope

- **Cross-browser** — only Chromium, matching this repo's Playwright config.
- **Transfer movements** (`movementType: "transfer"`) — no UI path currently creates these; only reachable via `adjustStockFn` directly, not exercised here.
- **`allowNegativeStock` override path** — deducting more than the authoritative balance when that flag is enabled on an item isn't exercised (only the standard "cannot exceed balance" rejection is).
- **Multi-item bulk operations** — each test operates on one item at a time.
