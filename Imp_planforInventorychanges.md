# VetOS Inventory & Product Catalogue Redesign — Implementation Plan

**Based on:** VetOS – Inventory & Product Catalogue Redesign Requirements
**Prepared for:** Engineering / Product team
**Scope:** Split Medicine Catalogue into Medicine / Food / Accessories catalogues on top of one centralized, real-time inventory engine; remove manual Bill Sync; make Billing and Purchasing drive stock automatically.

---

## 1. Objectives

1. Three category-specific catalogues (Medicine, Food, Accessories) backed by one Product Master + one Inventory engine.
2. Category-specific Add/Edit forms with a guided multi-step (Save & Next) workflow.
3. Remove manual "Bill Sync" from the Catalogue UI; replace with automatic, transaction-based stock updates.
4. A single authoritative `current_stock` per product/SKU, changed only via an auditable Inventory Transaction Ledger.
5. Alerts (Low Stock / Out of Stock) computed live from the same stock value — no separately maintained alert quantity.
6. Safe migration of the existing 10 medicines, 7 food items and 35 accessories into the new structure.

---

## 2. Architecture Overview

```
Catalogue (UI) → Product Master (DB) → Inventory Transactions (DB) → Current Stock (derived/cached)
                                              ↑                              ↓
                                        Purchasing module              Alerts engine
                                              ↑                              ↑
                                          Billing module ──────────────────┘
```

**Key architectural rule:** Medicine, Food and Accessory are *catalogue-level* (and `product_type`-level) distinctions only. There is exactly **one** inventory/stock engine, one transaction ledger, and one alerts engine shared by all three categories. Nothing about stock, purchasing, billing or alerts should be duplicated per category.

**Layers to touch:**
- Database (schema changes / new tables)
- Backend API (product CRUD, transactions, stock read, alerts)
- Billing service (hook to emit SALE transactions)
- Purchasing service (hook to emit PURCHASE transactions)
- Frontend (Catalogue tabs, dynamic forms, wizard, draft handling, Bill Sync removal)

---

## 3. Data Model

### 3.1 Product Master (shared, all categories)

| Field | Type | Notes |
|---|---|---|
| product_id | UUID/PK | |
| product_type | ENUM(MEDICINE, FOOD, ACCESSORY) | Mandatory, immutable after creation |
| name | string | Mandatory |
| brand | string | |
| sku | string | Unique when SKU tracking enabled |
| sale_price | decimal | Mandatory |
| purchase_price | decimal | |
| mrp | decimal | |
| tax | decimal | GST % |
| discount | decimal | |
| unit | string | e.g. pcs, box, kg |
| current_stock | integer | Denormalized cache, always derived from ledger (see §5) |
| min_stock_level | integer | |
| reorder_level | integer | |
| status | ENUM(ACTIVE, INACTIVE) | Replaces hard delete |
| created_at / updated_at | timestamp | `updated_at` auto-touched on any change, including stock change |

### 3.2 Category detail tables (1:1 with Product Master)

**MEDICINE_DETAILS**
`product_id (FK)`, `medicine_type`, `generic_composition`, `strength`, `dosage_form`, `pack_size`, `batch_number`, `expiry_date`

**FOOD_DETAILS**
`product_id (FK)`, `food_type`, `species`, `variant_flavour`, `pack_size`

**ACCESSORY_DETAILS**
`product_id (FK)`, `accessory_type`, `size_variant`

> Only the detail table matching `product_type` is populated/shown. The API and forms must never expose medicine-only fields (composition, strength, dosage form, batch, expiry) for FOOD or ACCESSORY products.

### 3.3 Inventory Transaction Ledger

| Field | Type | Notes |
|---|---|---|
| transaction_id | UUID/PK | |
| product_id | FK | |
| transaction_type | ENUM(OPENING_STOCK, PURCHASE, SALE, RETURN, ADJUSTMENT, DAMAGE, EXPIRY) | |
| quantity | integer | Signed or use type to imply direction (see §5) |
| reference_id | string | Bill ID / Purchase Order ID / Adjustment ID |
| previous_stock | integer | Snapshot before |
| new_stock | integer | Snapshot after |
| created_at | timestamp | |
| created_by | user_id | |

This table is **append-only**. `current_stock` on Product Master is a cache that is only ever updated inside the same DB transaction that inserts a ledger row — never edited directly.

---

## 4. Backend API Design

### 4.1 Catalogue / Product endpoints
- `GET /products?type=MEDICINE|FOOD|ACCESSORY&search=&status=` — category-filtered list, backed by `product_type`, not a UI-only filter.
- `POST /products` — create; body shape depends on `product_type` (validated against the matching detail schema).
- `PUT /products/{id}` — update identity/price fields; `product_type` field is rejected/ignored on update (immutable).
- `PATCH /products/{id}/status` — Active/Inactive toggle (replaces delete).
- `GET /products/{id}` — full record incl. detail table + current stock + status.

### 4.2 Inventory transaction endpoints
- `POST /inventory/transactions` — internal-only, called by Billing/Purchasing/Adjustment services, never directly by the Catalogue UI.
- `GET /inventory/transactions?product_id=` — ledger/history view for a product.
- Stock mutation is **only** allowed through this service layer (single write path), enforced at the service level, not just convention.

### 4.3 Alerts
- `GET /alerts/low-stock`, `GET /alerts/out-of-stock` — computed on read (or via a materialized view refreshed on each transaction) directly from `current_stock` vs `reorder_level`. No separate `alert_quantity` field anywhere.

### 4.4 Billing/Purchasing hooks
- Billing service, on **bill confirmation** (not draft, not cancelled), calls the inventory service to create a `SALE` transaction per line item.
- Purchasing service, on **purchase/receipt confirmation**, calls the inventory service to create a `PURCHASE` transaction per line item.
- Returns/approved reversals create `RETURN` or `ADJUSTMENT` transactions — never a direct stock edit.

---

## 5. Core Business Logic

**Stock formula:**
```
current_stock = opening_stock + Σ(stock-in transactions) − Σ(stock-out transactions) ± adjustments
```
Implementation approach: maintain `current_stock` as a cache column for fast reads, updated transactionally with every ledger insert (within one DB transaction, with row-level locking on the product row to prevent race conditions from concurrent sales).

**Status rule (computed, not stored as a separate flag beyond what's derivable):**
- `current_stock > reorder_level` → Normal
- `0 < current_stock ≤ reorder_level` → Low Stock
- `current_stock == 0` → Out of Stock

**Validation rules (enforced server-side, not just in the UI):**
- `name` and `sale_price` required.
- `product_type` required and immutable post-creation.
- SKU unique when SKU tracking is enabled for that category.
- Quantity/price fields must be non-negative and numeric.
- Stock cannot go negative unless an explicit business-rule flag allows it (e.g. for backorder scenarios) — default is to block.
- Duplicate product creation (same name + brand + SKU) triggers a warning/confirmation step, not a silent duplicate.

---

## 6. Frontend Implementation

### 6.1 Catalogue screen
- Top-level tabs: **Medicines / Food / Accessories**, each simply calling `GET /products?type=...`.
- Each tab has its own Search + category-appropriate filters (e.g. dosage form for Medicine; species for Food; size for Accessories) and its own table layout (Item, Name, Brand, Stock, Sale Price, Status, Last Updated).
- **Remove** the Bill Sync / Sync Bill / Import Bill control entirely from this screen.
- "+ Add Product" opens the category-aware entry flow (see 6.2), pre-scoped to whichever tab is active, but with the category still explicitly confirmed/selectable at step 1 if the product type isn't obvious from context.

### 6.2 Category-specific, multi-step Add Product form
- Step sequence: **Identity → Stock → Price → Purchasing → Sales**, rendered with a stepper/wizard component and "Save & Next" buttons.
- The set of fields shown per step is driven by `product_type`:
  - Medicine: full field set from §3 (5.1 of requirements) including composition/strength/dosage/batch/expiry.
  - Food/Accessories: identity+stock+price+purchasing+sales fields only — medicine-only fields are not rendered at all (not just disabled/hidden via CSS — excluded from the form schema).
- **Draft persistence:** on each "Save & Next", persist the partial product to a draft record (or local state + autosave) keyed to a draft ID; identity data entered in step 1 stays attached to the same draft/product as the user proceeds through later steps.
- **Navigating away with an incomplete form:** either autosave the draft silently, or show a confirmation dialog ("You have unsaved changes — save as draft / discard?") before leaving.
- On final "Save", the draft is converted into a committed Product Master record (+ detail row) and an `OPENING_STOCK` transaction is created for the initial stock entered.

### 6.3 Status & deactivation
- Add an Active/Inactive toggle on the product edit view; "Delete" for a product with historical transactions is replaced by this toggle. Products with zero transaction history may still support a genuine delete if desired.

---

## 7. Removing Bill Sync — Replacement Flow

Old: user manually clicks "Sync Bill" to reconcile stock after billing.

New (no manual step required):
```
Confirmed Bill → Billing service emits SALE transaction(s)
             → Inventory service applies stock deduction, writes ledger row
             → current_stock cache updated
             → Alerts recalculated (read-time or triggered refresh)
```
- Draft/cancelled bills must **not** call the inventory service at all.
- Returns/approved reversals go through a distinct `RETURN` transaction type so the ledger clearly shows why stock went back up, rather than reversing/deleting the original SALE row.

---

## 8. Data Migration Plan

1. **Classify existing data:** tag each of the currently-combined catalogue items with the correct `product_type` (10 → MEDICINE, 7 → FOOD, 35 → ACCESSORY) based on the supplied VetOS Product Catalogue.
2. **Populate detail tables:** backfill `MEDICINE_DETAILS` for the 10 medicine rows from existing fields; create `FOOD_DETAILS` and `ACCESSORY_DETAILS` rows for the food/accessory items (many fields will start blank and need clinic follow-up, e.g. accessory sale prices are sample values and must be flagged for verification before go-live — including the noted Gastrointestinal Wet Cat brand, which needs confirming).
3. **Backfill stock ledger:** create one `OPENING_STOCK` transaction per existing product using its current recorded stock, so the ledger has a true starting point rather than a gap.
4. **Verify no cross-category leakage:** run a post-migration check that every product's catalogue tab matches its stored `product_type`.
5. **Freeze old Bill Sync path** only after migration + a parallel-run/verification period confirms stock numbers match between old and new mechanisms.

---

## 9. Suggested Delivery Phases

| Phase | Scope |
|---|---|
| 1. Schema & migration | Product Master, detail tables, transaction ledger; migrate & classify existing 52 items |
| 2. Inventory engine | Transaction service, stock cache update logic, status computation, validation rules |
| 3. Catalogue UI | Three tabs, filtered lists, table layouts, search/filter per category |
| 4. Category-aware entry forms | Dynamic field sets, multi-step wizard, draft persistence, Save & Next |
| 5. Billing/Purchasing integration | Auto SALE/PURCHASE transaction creation; remove Bill Sync control |
| 6. Alerts integration | Low-stock/out-of-stock derived directly from current_stock |
| 7. QA & UAT | Full workflow test (see §10), acceptance checklist sign-off |

---

## 10. Testing Plan (mapped to requirement's Acceptance Checklist)

- **Separation correctness:** create one product per category; confirm it appears only in its own tab and never in the others.
- **Immutability:** attempt to change `product_type` post-creation via API directly (bypassing UI) — must be rejected.
- **Dynamic forms:** confirm Food/Accessories forms never render composition/strength/dosage/batch/expiry fields.
- **Wizard/draft behavior:** start a product, fill Identity, navigate to Stock, refresh/leave and return — identity data must persist; incomplete drafts must not silently vanish.
- **Bill Sync removal:** confirm no Bill Sync/Import Bill control exists anywhere in the Catalogue UI.
- **Billing → Inventory:** confirm a bill (draft) does not touch stock; confirming the bill creates exactly one SALE transaction per line and reduces `current_stock` accordingly.
- **Purchasing → Inventory:** confirming a purchase creates a PURCHASE transaction and increases stock.
- **Ledger integrity:** every stock change has a corresponding transaction row with correct `previous_stock`/`new_stock`.
- **Alerts:** manually drive a product's stock down through the reorder level and to zero; confirm Low Stock then Out of Stock states update automatically with no manual step.
- **Validation:** attempt negative stock, duplicate SKU, missing name/price, duplicate product creation — all should be blocked or flagged per §5.
- **Status vs delete:** deactivate a product with historical transactions; confirm historical bills/purchases referencing it remain intact and readable.
- **End-to-end:** run the full target flow — Product Creation → Purchase → Stock Increase → Billing → Stock Decrease → Alert Update — and verify every step at each stage.

---

## 11. Open Items / Needs Clarification Before Build

- **Accessory pricing:** the 35 accessory entries use sample prices and need real clinic-confirmed prices before go-live.
- **Brand verification:** the "Gastrointestinal Wet Cat" item's brand needs confirming before final DB entry.
- **Negative stock policy:** confirm whether any category should ever be allowed to go negative (e.g. backorder support), or whether it should always be hard-blocked.
- **Reorder level source:** confirm whether reorder levels are manually configured per product initially, with the usage/lead-time-based formula (Reorder Point = Avg Daily Usage × Lead Time + Safety Stock) deferred to a later phase, as the requirements suggest.
- **SKU enforcement scope:** confirm which categories require SKU uniqueness at launch vs. which can operate without strict SKU tracking initially.

---

*This plan implements the redesign requirements end-to-end: three catalogues on one inventory engine, category-aware entry with draft-safe multi-step workflow, removal of manual Bill Sync in favor of automatic transaction-driven stock updates, a full inventory transaction ledger, and alerts computed live off a single stock value.*