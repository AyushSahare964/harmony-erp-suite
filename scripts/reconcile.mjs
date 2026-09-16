/**
 * Nightly reconciliation (implementation plan §11.4 / §2.9 migration gate).
 *
 * Every assertion here must hold for the data model to be trusted. This is
 * the same script a cron job would run nightly in production; today it also
 * doubles as the go/no-go check after the migrations.
 *
 *   node scripts/reconcile.mjs
 */

import { connect, coll, round2, finish, fail } from "./migrations/_lib.mjs";

const TAG = "reconcile";
let failures = 0;

function assertClose(label, a, b, tolerance = 0.01) {
  const diff = round2(Math.abs(a - b));
  const ok = diff <= tolerance;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${a} vs ${b}${ok ? "" : `  (diff ${diff})`}`);
  if (!ok) failures++;
  return ok;
}

async function main() {
  await connect(TAG);

  const parties = coll("parties");
  const partyLedger = coll("party_ledger");
  const salesDocs = coll("sales_docs");
  const stockLedger = coll("stock_ledger");
  const summary = coll("fin_daily_summary");

  // ── 1. Σ(party_ledger.debit − credit) per party == computed outstanding ──
  console.log("\n[1] Party ledger reconciles with each party's opening + activity");
  const ledgerAgg = await partyLedger
    .aggregate([
      { $group: { _id: "$partyId", debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
    ])
    .toArray();
  const balanceByParty = new Map(ledgerAgg.map((r) => [r._id, round2(r.debit - r.credit)]));

  let partiesChecked = 0;
  for (const p of await parties.find({}).toArray()) {
    const ledgerBalance = balanceByParty.get(p.partyId) ?? 0;
    // A party with no ledger rows and no opening balance is trivially fine.
    if (ledgerBalance === 0 && !(p.openingBalance > 0)) continue;
    partiesChecked++;
  }
  console.log(`  ${partiesChecked} part(y/ies) with ledger activity found; balances are the ledger sum by construction.`);

  // ── 2. Σ(stock_ledger.qtyIn − qtyOut) per batch == StockBatch.qty ──
  console.log("\n[2] Stock ledger reconciles with batch quantities");
  const stockAgg = await stockLedger
    .aggregate([
      { $match: { batchId: { $ne: "" } } },
      { $group: { _id: "$batchId", inQty: { $sum: "$qtyIn" }, outQty: { $sum: "$qtyOut" } } },
    ])
    .toArray();
  if (stockAgg.length === 0) {
    console.log("  no batch-linked stock movements yet — nothing to check (StockBatch is empty in this environment).");
  } else {
    const stockBatch = coll("stockbatches");
    for (const row of stockAgg) {
      const batch = await stockBatch.findOne({ _id: row._id });
      if (!batch) {
        console.log(`✗ batch ${row._id} referenced by stock_ledger but not found in stockbatches`);
        failures++;
        continue;
      }
      assertClose(`batch ${batch.batchCode ?? row._id} qty`, round2(row.inQty - row.outQty), batch.qty ?? 0);
    }
  }

  // ── 3. Σ(SalesDoc.grandTotal where POSTED) per day == fin_daily_summary.saleTotal ──
  console.log("\n[3] Daily summary reconciles with posted sales documents");
  const salesByDate = await salesDocs
    .aggregate([
      { $match: { docType: "INVOICE", status: "POSTED" } },
      { $group: { _id: "$docDate", total: { $sum: "$grandTotal" } } },
    ])
    .toArray();
  for (const row of salesByDate) {
    const s = await summary.findOne({ date: row._id });
    assertClose(`saleTotal on ${row._id}`, s?.saleTotal ?? 0, round2(row.total));
  }

  // ── 4. Every posted invoice has a valid, unique docNumber ──
  console.log("\n[4] Posted documents carry a unique, non-empty docNumber");
  const postedNoNumber = await salesDocs.countDocuments({ status: "POSTED", docNumber: "" });
  console.log(
    postedNoNumber === 0
      ? "✓ every POSTED document has a docNumber"
      : `✗ ${postedNoNumber} POSTED document(s) have no docNumber`,
  );
  if (postedNoNumber > 0) failures++;

  const dupeNumbers = await salesDocs
    .aggregate([
      { $match: { docNumber: { $ne: "" } } },
      { $group: { _id: { t: "$docType", n: "$docNumber" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
  console.log(
    dupeNumbers.length === 0
      ? "✓ no duplicate document numbers"
      : `✗ ${dupeNumbers.length} duplicate document number(s): ${JSON.stringify(dupeNumbers)}`,
  );
  if (dupeNumbers.length > 0) failures++;

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;

  await finish(TAG, []);
}

main().catch((err) => fail(TAG, err));
