/**
 * Migration 06 — backfill `stock_ledger` from the legacy
 * `erp_rows{moduleId:"inventory_ledger"}` documents.
 *
 * Legacy rows sometimes carry a placeholder medicineId ("M-ITEM") rather than
 * a real InventoryItem.itemCode, and no StockBatch documents exist yet in
 * this environment to match batchId against. Rather than invent a false link,
 * this migration copies what is actually known (the item NAME, the movement,
 * the source invoice) and leaves itemCode/batchId blank when they don't
 * resolve — still searchable by name, never silently wrong.
 *
 * Idempotent: keyed on the legacy row's own `id` (its erp_rows data.id, e.g.
 * "L-0001"), stored as `sourceId` — a re-run skips rows already copied.
 *
 *   node scripts/migrations/06-stock-ledger.mjs --dry-run
 *   node scripts/migrations/06-stock-ledger.mjs
 */

import { connect, coll, DRY_RUN, finish, fail } from "./_lib.mjs";

const TAG = "06-stock-ledger";

/** Legacy movementType → stock_ledger sourceKind. */
const MOVEMENT_MAP = {
  sale_out: "SALE",
  purchase_in: "PURCHASE",
  return_in: "RETURN_IN",
  return_out: "RETURN_OUT",
  adjust_in: "ADJUST",
  adjust_out: "ADJUST",
  expiry: "EXPIRY",
  consumption: "CONSUMPTION",
  opening: "OPENING",
};

function isOutbound(movementType) {
  return ["sale_out", "return_out", "adjust_out", "expiry", "consumption"].includes(movementType);
}

async function main() {
  console.log(`[${TAG}] ${DRY_RUN ? "DRY RUN — no writes" : "applying"}`);
  await connect(TAG);

  const erpRows = coll("erp_rows");
  const stockLedger = coll("stock_ledger");
  // Explicit collection name from InventoryItem's schema ({ collection:
  // "inventory_items" }) — mongoose's default pluralization ("inventoryitems")
  // is NOT what this model actually uses, so this must be spelled out.
  const items = coll("inventory_items");

  const itemByCode = new Map();
  for (const it of await items.find({}).toArray()) {
    itemByCode.set(it.itemCode, it);
  }

  const alreadyDone = new Set(
    (await stockLedger.find({ sourceKind: { $ne: null } }).project({ sourceId: 1 }).toArray())
      .map((d) => d.sourceId)
      .filter(Boolean),
  );

  const stats = { scanned: 0, migrated: 0, alreadyDone: 0, unresolvedItem: 0 };
  const rows = await erpRows.find({ moduleId: "inventory_ledger" }).toArray();

  for (const row of rows) {
    stats.scanned++;
    const d = row.data ?? {};
    const legacyId = d.id ?? String(row._id);

    if (alreadyDone.has(legacyId)) {
      stats.alreadyDone++;
      continue;
    }

    const item = itemByCode.get(d.medicineId);
    if (!item) stats.unresolvedItem++;

    const sourceKind = MOVEMENT_MAP[d.movementType] ?? "ADJUST";
    const qty = Number(d.quantity ?? 0);
    const outbound = isOutbound(d.movementType);
    // Legacy timestamps look like "2026-09-02 07:07" — take the date part.
    const entryDate = String(d.createdAt ?? "").slice(0, 10) || new Date(row.createdAt).toISOString().slice(0, 10);

    const entry = {
      itemId: item ? String(item._id) : "",
      // Only trust medicineId as itemCode when it actually resolves —
      // "M-ITEM" is a placeholder, not a real code.
      itemCode: item ? d.medicineId : "",
      itemName: d.medicineName ?? "",
      batchId: "",
      batchNo: d.batchNo ?? "",
      entryDate,
      sourceKind,
      sourceId: legacyId,
      sourceNumber: d.sourceRef ?? "",
      qtyIn: outbound ? 0 : qty,
      qtyOut: outbound ? qty : 0,
      rate: item ? Number(item.defaultPurchasePrice ?? 0) : 0,
      value: item ? Number(item.defaultPurchasePrice ?? 0) * qty : 0,
      balanceAfter: Number(d.balanceAfter ?? 0),
      narration: d.reason ?? "",
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    };

    if (!DRY_RUN) await stockLedger.insertOne(entry);
    stats.migrated++;
  }

  if (stats.unresolvedItem) {
    console.warn(
      `[${TAG}] ${stats.unresolvedItem} row(s) reference an item code that doesn't exist in ` +
        `inventory_items (legacy placeholder data) — migrated with itemCode left blank, searchable by name only.`,
    );
  }

  await finish(TAG, [stats]);
}

main().catch((err) => fail(TAG, err));
