/**
 * Migration 07 — rebuild `fin_daily_summary` from source, so the dashboard's
 * KPI cards and 15-day chart have real numbers instead of an empty
 * collection. This is the ONLY place the dashboard reads from (plan §4.8) —
 * it must never scan raw invoice lines — so this materialised view has to be
 * correct from day one.
 *
 * Fully rebuildable: clears the collection and re-aggregates from
 * sales_docs, payment_docs, purchasebills and expenses every time it runs, so
 * it is safe to re-run after any of the earlier migrations changes data, and
 * it is the same script the nightly refresh job would call.
 *
 *   node scripts/migrations/07-rebuild-daily-summary.mjs --dry-run
 *   node scripts/migrations/07-rebuild-daily-summary.mjs
 */

import { connect, coll, DRY_RUN, round2, finish, fail } from "./_lib.mjs";

const TAG = "07-rebuild-daily-summary";

async function main() {
  console.log(`[${TAG}] ${DRY_RUN ? "DRY RUN — no writes" : "applying"}`);
  await connect(TAG);

  const salesDocs = coll("sales_docs");
  const paymentDocs = coll("payment_docs");
  const purchaseBills = coll("purchasebills");
  const expenses = coll("expenses");
  const summary = coll("fin_daily_summary");

  /** date (YYYY-MM-DD) -> accumulator */
  const byDate = new Map();
  const bump = (date, field, amount) => {
    if (!date || !amount) return;
    const row = byDate.get(date) ?? {
      branchId: "MAIN",
      date,
      saleTaxable: 0,
      saleTax: 0,
      saleTotal: 0,
      creditNoteTotal: 0,
      received: 0,
      paidOut: 0,
      purchaseTotal: 0,
      expenseTotal: 0,
      cashIn: 0,
      cashOut: 0,
      invoiceCount: 0,
    };
    row[field] = round2(row[field] + amount);
    byDate.set(date, row);
  };

  // ── Sales invoices (posted only — a cancelled or draft doc is not revenue) ──
  for (const d of await salesDocs.find({ docType: "INVOICE", status: "POSTED" }).toArray()) {
    bump(d.docDate, "saleTaxable", d.taxableValue ?? 0);
    bump(d.docDate, "saleTax", round2((d.cgst ?? 0) + (d.sgst ?? 0) + (d.igst ?? 0) + (d.cess ?? 0)));
    bump(d.docDate, "saleTotal", d.grandTotal ?? 0);
    bump(d.docDate, "invoiceCount", 1);
  }

  // ── Credit notes ──
  for (const d of await salesDocs.find({ docType: "CREDIT_NOTE", status: "POSTED" }).toArray()) {
    bump(d.docDate, "creditNoteTotal", d.grandTotal ?? 0);
  }

  // ── Payments (money actually moving, independent of invoice date) ──
  for (const p of await paymentDocs.find({ status: "POSTED" }).toArray()) {
    const cash = round2(
      (p.splits ?? []).filter((s) => s.payMode === "CASH").reduce((s, x) => s + (x.amount ?? 0), 0),
    );
    if (p.direction === "IN") {
      bump(p.docDate, "received", p.totalAmount ?? 0);
      bump(p.docDate, "cashIn", cash);
    } else {
      bump(p.docDate, "paidOut", p.totalAmount ?? 0);
      bump(p.docDate, "cashOut", cash);
    }
  }

  // ── Purchases (finance view — not re-derived through SalesDoc) ──
  for (const b of await purchaseBills.find({ status: { $ne: "VOID" } }).toArray()) {
    bump(b.billDate, "purchaseTotal", b.grandTotal ?? 0);
  }

  // ── Expenses ──
  for (const e of await expenses.find({ status: { $ne: "VOID" }, isRecurringTemplate: { $ne: true } }).toArray()) {
    bump(e.expenseDate, "expenseTotal", e.totalAmount ?? 0);
  }

  if (!DRY_RUN) {
    await summary.deleteMany({});
    if (byDate.size) await summary.insertMany(Array.from(byDate.values()));
  }

  const totals = Array.from(byDate.values()).reduce(
    (acc, r) => ({
      saleTotal: round2(acc.saleTotal + r.saleTotal),
      received: round2(acc.received + r.received),
      purchaseTotal: round2(acc.purchaseTotal + r.purchaseTotal),
      expenseTotal: round2(acc.expenseTotal + r.expenseTotal),
    }),
    { saleTotal: 0, received: 0, purchaseTotal: 0, expenseTotal: 0 },
  );

  await finish(TAG, [{ days: byDate.size, ...totals }]);
}

main().catch((err) => fail(TAG, err));
