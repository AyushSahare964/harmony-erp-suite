# Inventory Management (Medicine Stock) — Detailed Sub-Module Implementation Plan

**VetOS ERP  |  Module 12 (Inventory & Procurement) — Deep-Dive: Real-Time Medicine Stock**
Version 1.0 | Draft for Stakeholder Review
Builds on: `1_ERP_Scope_Roles_Module_Catalogue.docx`, `2_Implementation_Plan_Roadmap.docx`, `4_SubModules_Stepwise_Feature_Breakdown.docx`, `Billing_Payments_Implementation_Plan.md`

---

## 1. Why This Document Exists

The base Sub-Modules document (Section 12) covered Inventory & Procurement at a summary level (12.1 Stock Ledger, 12.2 Purchasing, 12.3 Suppliers). This document expands that module to cover exactly what was asked for:

1. **Current medicine stock must be visible properly** — a live, accurate stock view by medicine, batch and expiry.
2. **Add and remove medicines** — both the master medicine catalogue (add a new medicine/product) and stock quantity movements (add stock in via purchase, remove stock out via sale/wastage/adjustment).
3. **Connected with Billing & Payments** — every sale made through Module 11 (including the new Manual Product Billing, 11.4) must move stock automatically, and every stock movement must be traceable back to its billing/purchase source.
4. **Real-time stock** — the number shown on screen must always reflect the true, current, sellable quantity — no end-of-day batch jobs, no stale counts.

This is an **expansion of Module 12**, not a new module. Roles, phase placement (Phase 3 — Commerce, Billing & Inventory) and cross-module rules stay as defined in Documents 1–2.

---

## 2. Updated Sub-Module Map for Module 12

| # | Sub-module | Status |
|---|---|---|
| 12.1 | Stock Ledger | Existing — this document adds the real-time engine behind it |
| 12.2 | Purchasing | Existing — unchanged, feeds stock-in |
| 12.3 | Suppliers | Existing — unchanged |
| **12.4** | **Medicine Master (Add/Edit/Deactivate Medicines)** | **New — this document** |
| **12.5** | **Real-Time Stock View** | **New — this document** |
| **12.6** | **Stock Movements (Add/Remove Stock)** | **New — this document** |
| **12.7** | **Billing Integration (Live Stock Sync)** | **New — this document** |
| **12.8** | **Low-Stock, Expiry & Reorder Alerts** | **New — this document** |

---

## 3. Sub-Module 12.4 — Medicine Master (Add/Edit/Deactivate Medicines)

### Purpose
Let Admin (and Pharmacy-permissioned staff) maintain the actual list of medicines the clinic stocks — this is the catalogue that both Inventory and Billing (Manual Product Billing, 11.4) read from.

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | "Add Medicine" form: name, generic name, category (medicine/food/accessory/consumable), unit of measure (tablet/ml/vial/box), GST rate, default sale price | MVP |
| Step 2 | Edit existing medicine details | MVP |
| Step 3 | Deactivate a medicine (soft-delete — hidden from new sales/purchases, history retained) instead of hard delete | MVP |
| Step 4 | Barcode field (scan-to-fill on add, scan-to-search on sale) | Phase 2 |
| Step 5 | Duplicate-medicine detection on name/generic match | Phase 2 |
| Step 6 | Bulk import medicines via CSV/Excel (initial catalogue setup) | Phase 2 |
| Step 7 | Reorder threshold and preferred supplier set per medicine | MVP |

### Screen: "Medicine Catalogue"
- List view: Name, Category, Current Stock (live, pulls from 12.5), Reorder Level, Status (Active/Inactive), Last Purchase Price.
- "Add Medicine" / "Edit" opens a form; "Deactivate" requires confirmation and is blocked if the medicine has open/draft bills referencing it.
- **Removing a medicine from the catalogue = deactivate, not delete.** A hard delete is never allowed once any stock or billing transaction references it (audit integrity — matches the cross-module rule "inventory changes require ledger entries").

### Data Model
```
medicine (product master)
  id, tenant_id, name, generic_name, category, unit_of_measure,
  gst_rate, default_sale_price, barcode, reorder_level,
  preferred_supplier_id, status ('active' | 'inactive'),
  created_by, created_at, updated_at
```

### Acceptance Criteria
- A new medicine added to the catalogue is immediately searchable in both the Inventory module and the Billing "New Manual Bill" product picker (11.4).
- Deactivating a medicine removes it from new-sale search but does not affect historical bills or stock history.

---

## 4. Sub-Module 12.5 — Real-Time Stock View

### Purpose
This is the core ask: **"the current medicine stock should be visible properly."** A single, always-accurate screen showing exactly how much of each medicine is available right now, broken down by batch and expiry.

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | Stock list: Medicine, Total Available Qty, Unit, Reorder Level, Status badge (OK / Low / Out of Stock) | MVP |
| Step 2 | Expand a medicine row → batch-level breakdown (Batch No., Expiry Date, Qty in that batch, Purchase Price) | MVP |
| Step 3 | Live search/filter by medicine name, category, batch, or supplier | MVP |
| Step 4 | Colour-coded expiry flags (e.g., amber if expiring within 30 days, red if expiring within 7 days or already expired) | MVP |
| Step 5 | Stock value summary (total inventory value at cost, for Accountant/Admin) | Phase 2 |
| Step 6 | Auto-refresh / live update (no manual page reload needed) when a sale or purchase happens anywhere in the system | MVP |
| Step 7 | Stock movement history per medicine (every add/remove event with source, actor, timestamp) — drill-down from the stock list | MVP |

### How "Real-Time" Is Achieved
The stock number shown on screen is **never a stored, separately-maintained field that can drift out of sync.** It is always computed as:

```
current_stock(medicine, batch) = SUM(all stock_ledger entries for that medicine+batch)
```

Every single event that changes stock — a purchase, a bill/sale, a manual adjustment, a return — writes one row to `stock_ledger`. The visible stock number is either:
- **Computed live** on every read (simplest, always-correct, fine at clinic scale), or
- **Maintained as a running balance** on the `medicine_batch` row that is updated **in the same database transaction** as every `stock_ledger` insert (faster reads at larger scale) — recommended once a clinic's catalogue/transaction volume grows.

Either approach guarantees the number on screen reflects the very last sale or purchase, because there is no separate "sync job" — the stock table and the transaction that caused the change are updated together, atomically, or not at all.

To make this feel instantly live in the UI (not just "correct on refresh"), the Stock View screen subscribes to stock-change events (e.g., via a real-time channel/websocket on the `stock_ledger` table) so that when a Receptionist finalizes a sale on one screen, an Admin watching the Stock View on another screen sees the number change without reloading.

### Data Model
```
medicine_batch
  id, tenant_id, medicine_id, batch_no, expiry_date,
  purchase_price, quantity_in (denormalized running balance),
  supplier_id, purchase_id (source), created_at

stock_ledger
  id, tenant_id, medicine_id, batch_id, movement_type
    ('purchase_in' | 'sale_out' | 'adjustment_in' | 'adjustment_out' |
     'return_in' | 'return_out' | 'expiry_writeoff'),
  quantity, source_type ('purchase' | 'invoice' | 'manual_bill' |
     'manual_adjustment' | 'supplier_return'),
  source_id, balance_after, actor_id, created_at, reason (nullable)
```
`balance_after` is stored on every ledger row for fast auditing/history display without recomputation; `quantity_in` on `medicine_batch` is the fast-read running total kept in sync in the same transaction as each ledger write.

### Acceptance Criteria
- Selling one unit of a medicine on the Billing screen (via 11.1, 11.4, or a Pharmacy sale) is reflected on the Stock View within the same request cycle — no separate refresh/sync step, no polling delay felt by the user.
- The batch-level breakdown for any medicine always sums exactly to the total shown at the medicine level.
- Every quantity shown can be drilled into a ledger history that fully explains how that number was reached.

---

## 5. Sub-Module 12.6 — Stock Movements (Add/Remove Stock)

### Purpose
This is the second core ask: **"we should be able to add and remove the medicines"** — meaning both adding new stock in (purchases, corrections, returns from customers) and removing stock out (sales, wastage, expiry write-off, supplier returns), always with a reason and an audit trail.

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | "Add Stock" action — record a purchase receipt against a supplier (new or existing batch), increases stock | MVP |
| Step 2 | "Remove Stock" action — manual adjustment out (damage, wastage, theft, internal use) with a mandatory reason field | MVP |
| Step 3 | Sale-driven removal happens automatically from Billing (see 12.7) — never a separate manual step for a normal sale | MVP |
| Step 4 | Expiry write-off — batch flagged expired can be removed from sellable stock in one action, logged as `expiry_writeoff` | Phase 2 |
| Step 5 | Return-to-supplier — remove stock and optionally record it against the supplier ledger (Module 12.3) | Phase 3 |
| Step 6 | Every add/remove requires: quantity, reason (for non-sale movements), and is attributed to the acting user | MVP |
| Step 7 | Bulk stock adjustment (e.g., physical stock count reconciliation) with a side-by-side "system count vs actual count" entry screen | Phase 2 |

### Screen: "Stock Movement" (Add / Remove)
- **Add Stock:** Medicine → Batch No. (new or existing) → Expiry Date → Quantity → Purchase Price → Supplier (optional if not tied to a formal purchase) → Save → writes `purchase_in` (or a lighter `adjustment_in` if it's a correction, not a real purchase).
- **Remove Stock:** Medicine → Batch → Quantity → Reason (dropdown: Wastage / Damage / Internal Use / Theft / Other) → Save → writes `adjustment_out`.
- Both actions are **immediately visible** on the Real-Time Stock View (12.5) — no delay.
- **Permission boundary:** Receptionist can trigger stock removal only indirectly through a sale (12.7); manual Add/Remove Stock actions are Admin-only by default (configurable in Module 2's permission override, Phase 2), since these bypass the billing trail and need tighter control.

### Acceptance Criteria
- Every non-sale stock change has a mandatory, auditable reason — nothing can silently change the stock count.
- Add Stock and Remove Stock actions both appear in the medicine's movement history (12.5, Step 7) instantly.
- A removal cannot take a batch's quantity below zero (hard validation).

---

## 6. Sub-Module 12.7 — Billing Integration (Live Stock Sync)

### Purpose
This is the third core ask: **"it should be connected with the bills and payment section."** Every sale — whether from a Pharmacy retail sale, an OPD-linked prescription fulfilment, or a Manual Product Billing (11.4) — must decrement the correct batch's stock at the moment of sale, and every stock number on screen must already account for it.

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | On invoice/manual-bill finalization (Module 11), each medicine line item triggers a `sale_out` stock-ledger entry in the same transaction as the bill being saved | MVP |
| Step 2 | FEFO (First-Expiry-First-Out) batch auto-selection at the point of sale, with manual override available | MVP |
| Step 3 | Stock availability check at the point of adding a line item to a bill — cannot add a quantity greater than current available stock (soft warning, Admin can override; hard block for Receptionist) | MVP |
| Step 4 | If a finalized bill is voided/cancelled, the stock is automatically reversed (`sale_out` reversed via a corresponding `return_in` entry, not a silent edit) | MVP |
| Step 5 | If a bill is in **Draft** status (per 11.4 Step 8), stock is *reserved* but not yet decremented — only Finalize triggers the actual ledger entry, so a draft bill cannot cause a false stock-out to another sale in progress | Phase 2 |
| Step 6 | Refund of a specific medicine line item (partial invoice refund) triggers a partial stock return | Phase 2 |
| Step 7 | Payment status is independent of stock status — stock moves on **bill finalization**, not on **payment completion** — so an unpaid-but-finalized invoice still correctly reflects reduced stock (clinic has physically handed over the medicine) | MVP |

### Integration Flow
```
Receptionist finalizes a bill (11.1 or 11.4) containing 2 medicine line items
        │
        ▼
Billing service, inside ONE database transaction:
   1. Creates/updates the invoice record
   2. For each medicine line item:
        a. Selects batch (FEFO or manually chosen)
        b. Validates available quantity
        c. Writes a stock_ledger entry (movement_type = 'sale_out',
           source_type = 'invoice' or 'manual_bill', source_id = bill id)
        d. Updates medicine_batch.quantity_in (running balance)
        ▼
   3. Commits transaction — invoice AND stock update succeed or fail together
        ▼
Real-Time Stock View (12.5) reflects the new quantity immediately
Payment Analytics / Accounting see the same transaction independently
```
The **same-transaction guarantee** is the key design point: a bill can never be saved while its stock decrement silently fails (or vice versa) — this directly satisfies "connected with the bills and payment section" as a hard integrity guarantee, not just a UI link.

### Acceptance Criteria
- Finalizing a bill with medicine line items always results in a matching stock-ledger entry — verified by an automated reconciliation check (see 12.8 acceptance test).
- Voiding a bill restores the exact quantity that was sold, against the exact batch it came from.
- No sale can be finalized that would take any batch's quantity below zero.

---

## 7. Sub-Module 12.8 — Low-Stock, Expiry & Reorder Alerts

### Purpose
Turn the real-time stock data into proactive signals so stock-outs and expiry wastage are caught before they become a problem — this was already scoped at a summary level in the base document; detailed here for completeness since it depends directly on 12.5–12.7.

### Stepwise Features

| Step | Feature | Priority |
|---|---|---|
| Step 1 | Low-stock badge/alert when a medicine's total quantity falls below its `reorder_level` (12.4) | MVP |
| Step 2 | Expiry alert list — batches expiring within a configurable window (default 30 days) | MVP |
| Step 3 | Dashboard flashcard (Module 12's parent card, per Document 3) shows live "Low-stock items" count | MVP |
| Step 4 | Purchase suggestion list auto-built from low-stock medicines, pre-filled with preferred supplier and last purchase price | Phase 2 |
| Step 5 | Notification to Admin (in-app + optional WhatsApp/email via Module 17) when a critical item goes out of stock | Phase 2 |

### Acceptance Criteria
- The dashboard's "Low-stock items" metric (Document 3, Section 5.3) always matches what the Real-Time Stock View (12.5) would show if filtered to "Low" status — same underlying data, no separate stale count.

---

## 8. Combined Data Flow (All Pieces Together)

```
Medicine Master (12.4) ──► defines what CAN be stocked/sold
        │
        ▼
Purchasing (12.2) ──► Add Stock (12.6) ──┐
Manual Stock Adjustment (12.6) ──────────┼──► stock_ledger ──► medicine_batch.quantity_in
Billing sale, any source (12.7) ─────────┘         │                    │
   (Manual Bill 11.4 / Invoice 11.1 / Pharmacy)     │                    │
                                                     ▼                    ▼
                                          Real-Time Stock View (12.5) ◄───┘
                                                     │
                                                     ▼
                                    Low-Stock / Expiry Alerts (12.8)
                                                     │
                                                     ▼
                              Dashboard flashcard (Document 3) + Payment/Inventory Analytics
```

---

## 9. Implementation Sequence (fits inside existing Phase 3 window)

| Sprint | Deliverable | Depends on |
|---|---|---|
| 1 | 12.4 Medicine Master (Steps 1–3, 7) | Module 2 RBAC (permissions) |
| 2 | 12.5 Real-Time Stock View — ledger-based computed stock (Steps 1–4) | Sprint 1 |
| 3 | 12.6 Stock Movements — Add/Remove Stock manual actions (Steps 1–2, 6) | Sprint 2 |
| 4 | 12.7 Billing Integration — same-transaction stock decrement on bill finalize (Steps 1–3, 7) | Sprint 2–3, and Module 11 (Billing) build |
| 5 | 12.7 remaining — void/refund reversal, draft-stock-reservation (Steps 4–6) | Sprint 4 |
| 6 | 12.5 live-update channel (Step 6) + movement history drill-down (Step 7) | Sprint 4 |
| 7 | 12.8 Low-stock/expiry alerts + dashboard card wiring (Steps 1–3) | Sprint 2, Document 3 dashboard shell |
| 8 | Hardening: bulk import (12.4 Step 6), barcode scan (12.4 Step 4), purchase suggestions (12.8 Step 4) | All above |

**Estimated duration:** 8 sprints (≈16 weeks), run inside/overlapping Phase 3 alongside the Billing & Payments expansion — the two share Sprint 4 as their integration point and should be planned by the same pair of engineers to avoid a hand-off gap.

---

## 10. Roles Recap (unchanged from Document 1, refined here)

| Capability | Admin | Receptionist | Accountant |
|---|---|---|---|
| Add/Edit/Deactivate Medicine (12.4) | Full | — | View |
| View Real-Time Stock (12.5) | Full | View (for sale-time availability only) | View (for costing) |
| Add Stock (12.6) | Full | — | — |
| Remove Stock — manual adjustment (12.6) | Full | — | — |
| Remove Stock — via sale (12.7, automatic) | — | Triggers via Billing | — |
| Low-Stock/Expiry Alerts (12.8) | Full | View (dashboard card only) | View |

---

## 11. Data Integrity Guarantees (Why This Design Is "Real-Time" and Trustworthy)

- **Single source of truth:** stock is derived from `stock_ledger`, never hand-edited as a bare number anywhere in the system.
- **Atomicity:** a bill and its stock decrement are written in one transaction — they cannot disagree.
- **Every movement has a reason and an actor:** satisfies the FRS cross-module rule "every stock change has source transaction."
- **No hard deletes:** medicines are deactivated, batches are written off (not erased), so historical bills always resolve correctly even years later.
- **Reconciliation check (recommended automated test):** `SUM(stock_ledger for a batch) == medicine_batch.quantity_in` must hold true at all times — run as a nightly integrity check even though the design prevents drift by construction.

---

## 12. Open Questions for Stakeholder Confirmation

- Should Receptionist ever be allowed to perform a manual "Remove Stock" (e.g., for visible breakage at the counter), or should that always require Admin sign-off as scoped above?
- Confirm the default expiry-alert window (30 days) and whether it should be configurable per medicine category (e.g., vaccines may need a longer lead time than accessories).
- Confirm whether physical stock-count reconciliation (12.6 Step 7, Phase 2) is needed for MVP or can safely wait — it's the main tool for catching real-world stock drift (shrinkage, miscounts) that no software-side guarantee can prevent.
