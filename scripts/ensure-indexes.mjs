/**
 * Ensure every billing-module index exists on the live Atlas cluster.
 *
 * Mongoose builds indexes lazily on first model use (autoIndex), which is
 * fine for a long-running dev server but unreliable on Vercel's serverless
 * functions — an index only appears once some cold-start request happens to
 * touch that exact model, and a background build failure is easy to miss.
 * This script builds them all up front, explicitly, and is safe to re-run
 * any time (createIndexes is a no-op for an index that already matches).
 *
 * Kept in sync with the `.index(...)` calls and `index: true` field options
 * in src/lib/mongodb/models/*.ts — when a model's indexes change, mirror the
 * change here too.
 *
 *   node scripts/ensure-indexes.mjs
 */

import { connect, coll, finish, fail } from "./migrations/_lib.mjs";

const TAG = "ensure-indexes";

/**
 * @param {string} collectionName
 * @param {Array<{ key: Record<string, 1 | -1 | "text">, options?: object }>} indexes
 */
async function ensure(collectionName, indexes) {
  const c = coll(collectionName);
  const results = [];
  for (const { key, options } of indexes) {
    try {
      const name = await c.createIndex(key, options ?? {});
      results.push({ collection: collectionName, index: name, status: "ok" });
    } catch (err) {
      // A conflicting index with the same keys but different options needs a
      // human decision (drop + recreate touches production data) — surface it
      // rather than silently working around it.
      results.push({ collection: collectionName, index: JSON.stringify(key), status: `FAILED: ${err.message}` });
    }
  }
  return results;
}

async function main() {
  await connect(TAG);
  let all = [];

  all = all.concat(
    await ensure("parties", [
      { key: { partyId: 1 }, options: { unique: true } },
      { key: { displayName: 1 } },
      { key: { mobile: 1 } },
      { key: { gstin: 1 } },
      { key: { partyType: 1, isActive: 1 } },
      { key: { ownerId: 1 } },
      { key: { supplierRefId: 1 } },
      { key: { displayName: "text", mobile: "text" } }, // name auto-matches mongoose's own autoIndex build
    ]),
  );

  all = all.concat(
    await ensure("party_ledger", [{ key: { partyId: 1, entryDate: 1, _id: 1 } }]),
  );

  all = all.concat(
    await ensure("sales_docs", [
      {
        key: { docType: 1, docNumber: 1 },
        options: { unique: true, partialFilterExpression: { docNumber: { $gt: "" } } },
      },
      { key: { docDate: -1, status: 1 } },
      { key: { partyId: 1, docDate: -1 } },
      { key: { status: 1, balanceDue: 1 } },
      { key: { visitId: 1 } },
      { key: { animalId: 1 } },
      { key: { branchId: 1 } },
    ]),
  );

  all = all.concat(
    await ensure("stock_ledger", [
      { key: { itemCode: 1, entryDate: 1, _id: 1 } },
      { key: { batchId: 1 } },
      { key: { sourceNumber: 1 } },
    ]),
  );

  all = all.concat(
    await ensure("payment_docs", [
      {
        key: { direction: 1, docNumber: 1 },
        options: { unique: true, partialFilterExpression: { docNumber: { $gt: "" } } },
      },
      {
        key: { idempotencyKey: 1 },
        options: { unique: true, partialFilterExpression: { idempotencyKey: { $gt: "" } } },
      },
      { key: { partyId: 1, docDate: -1 } },
      { key: { "splits.clearingStatus": 1 } },
      { key: { status: 1 } },
    ]),
  );

  all = all.concat(
    await ensure("number_series", [{ key: { branchId: 1, docType: 1, fyCode: 1 }, options: { unique: true } }]),
  );

  all = all.concat(
    await ensure("tax_codes", [
      { key: { code: 1, effectiveFrom: 1 }, options: { unique: true } },
      { key: { kind: 1 } },
    ]),
  );

  all = all.concat(
    await ensure("uoms", [{ key: { code: 1 }, options: { unique: true } }]),
  );
  all = all.concat(
    await ensure("uom_conversions", [
      { key: { itemCode: 1, fromUom: 1, toUom: 1 }, options: { unique: true } },
    ]),
  );

  all = all.concat(await ensure("org_branches", [{ key: { code: 1 }, options: { unique: true } }]));

  all = all.concat(
    await ensure("audit_logs", [
      { key: { entity: 1, entityId: 1, at: -1 } },
      { key: { at: -1 } },
    ]),
  );

  all = all.concat(
    await ensure("reminders", [
      { key: { status: 1, remindOn: 1 } },
      { key: { autoKey: 1 }, options: { unique: true, partialFilterExpression: { autoKey: { $gt: "" } } } },
    ]),
  );

  all = all.concat(
    await ensure("fin_daily_summary", [{ key: { branchId: 1, date: 1 }, options: { unique: true } }]),
  );

  // ── Extended existing collections ──
  all = all.concat(
    await ensure("purchasebills", [
      { key: { internalRef: 1 }, options: { unique: true } },
      { key: { billDate: 1 } },
      { key: { supplierId: 1, status: 1 } },
      { key: { status: 1 } },
      { key: { partyId: 1, billDate: -1 } },
      { key: { docType: 1 } },
      {
        key: { supplierId: 1, billNumber: 1, docType: 1 },
        options: { unique: true, partialFilterExpression: { billNumber: { $gt: "" } } },
      },
    ]),
  );

  all = all.concat(
    await ensure("expenses", [
      { key: { voucherNo: 1 }, options: { unique: true } },
      { key: { expenseDate: 1 } },
      { key: { categoryId: 1 } },
      { key: { status: 1 } },
      { key: { partyId: 1 } },
      { key: { isRecurringTemplate: 1, recurNextDate: 1 } },
    ]),
  );

  all = all.concat(
    await ensure("owners", [
      { key: { ownerId: 1 }, options: { unique: true } },
      { key: { name: 1 } },
      { key: { phone: 1 } },
      { key: { partyId: 1 } },
    ]),
  );

  all = all.concat(
    await ensure("suppliers", [{ key: { name: 1 } }, { key: { isActive: 1 } }]),
  );

  all = all.concat(
    await ensure("inventory_items", [
      { key: { itemCode: 1 }, options: { unique: true } },
      { key: { productType: 1, status: 1 } },
      { key: { sku: 1 } },
      { key: { itemClass: 1 } },
      { key: { isScheduleH: 1 } },
      { key: { status: 1 } },
    ]),
  );

  all = all.concat(
    await ensure("stock_batches", [
      { key: { itemCode: 1, expiryDate: 1 } },
      { key: { batchCode: 1 }, options: { unique: true } }, // StockBatch.batchCode is unique in the schema
      { key: { status: 1 } },
    ]),
  );

  all = all.concat(
    await ensure("clinicalvisits", [
      { key: { visitId: 1 }, options: { unique: true } },
      { key: { invoiceNo: 1 }, options: { unique: true } },
      { key: { ownerId: 1 } },
      { key: { petId: 1 } },
      { key: { status: 1 } },
      { key: { salesDocNo: 1 } },
      { key: { date: 1 } },
    ]),
  );

  const failed = all.filter((r) => r.status !== "ok");
  console.table(all);
  console.log(`\n${all.length - failed.length}/${all.length} indexes confirmed.`);
  if (failed.length) {
    console.error(`${failed.length} index(es) need attention — see FAILED rows above.`);
    process.exitCode = 1;
  }

  await finish(TAG, []);
}

main().catch((err) => fail(TAG, err));
